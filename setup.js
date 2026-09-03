#!/usr/bin/env node
// Interactive first-time setup for WidgetCord.
//
// Walks you through: validating your bot token, checking your bot is in the target guild,
// creating + publishing a Discord "widget-config" if you don't already have one (using the
// progress-bar layout this tool understands), and writing out config.json.
//
// Run with: npm run setup

const fs = require('fs');
const path = require('path');
const readline = require('readline/promises');
const { stdin, stdout } = require('process');
const {
  DiscordApiError,
  getSelfUser,
  getSelfApplication,
  getGuild,
  listWidgetConfigs,
  createWidgetConfig,
  publishWidgetConfig,
} = require('./discordApi');
const { buildSurfacesSchema } = require('./fields');

const CONFIG_PATH = path.join(__dirname, 'config.json');

const rl = readline.createInterface({ input: stdin, output: stdout });

async function ask(question, { default: def } = {}) {
  const suffix = def !== undefined ? ` [${def}]` : '';
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || def;
}

async function confirm(question, def = true) {
  const hint = def ? 'Y/n' : 'y/N';
  const answer = (await rl.question(`${question} (${hint}): `)).trim().toLowerCase();
  if (!answer) return def;
  return answer.startsWith('y');
}

function die(message) {
  console.error(`\n✗ ${message}`);
  rl.close();
  process.exit(1);
}

async function main() {
  console.log('WidgetCord setup\n');
  console.log('This will validate your bot, optionally create a Discord profile widget,');
  console.log('and write config.json. It only touches your own application/widget.\n');

  // --- Step 1: bot token ---
  const botToken = await ask('Discord bot token (Developer Portal -> your app -> Bot -> Reset Token)');
  if (!botToken) die('A bot token is required.');

  let selfUser, application;
  try {
    selfUser = await getSelfUser(botToken);
    application = await getSelfApplication(botToken);
  } catch (err) {
    if (err instanceof DiscordApiError) {
      return die(`Could not validate the bot token: HTTP ${err.status} ${err.body}`);
    }
    return die(`Could not reach Discord: ${err.message}`);
  }

  if (!selfUser.bot) die('That token is not a bot token.');

  const applicationId = application.id;
  const ownerId = application.owner?.id;
  console.log(`\n✓ Bot: ${selfUser.username} (app ${applicationId})`);
  if (ownerId) console.log(`✓ Application owner: ${application.owner.username} (${ownerId})`);

  // --- Step 2: guild ---
  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=bot&permissions=0`;
  console.log(`\nIf your bot isn't in the target server yet, invite it first (0 permissions is enough):\n  ${inviteUrl}\n`);

  let guildId, guild;
  while (!guild) {
    guildId = await ask('Guild (server) ID to read the member count from');
    if (!guildId) die('A guild ID is required.');
    try {
      guild = await getGuild(botToken, guildId);
    } catch (err) {
      if (err instanceof DiscordApiError) {
        console.error(`✗ Could not read that guild: HTTP ${err.status} ${err.body}`);
        console.error('  Make sure the bot has been invited to it (see the link above).');
      } else {
        console.error(`✗ Could not reach Discord: ${err.message}`);
      }
    }
  }
  console.log(`✓ Found "${guild.name}" — ${guild.approximate_member_count} members\n`);

  // --- Step 3: widget-config (create if needed) ---
  let configs;
  try {
    configs = await listWidgetConfigs(botToken, applicationId);
  } catch (err) {
    return die(
      `Could not list widget-configs for this application: HTTP ${err.status} ${err.body}\n` +
        '  This may mean "Social SDK" access has not been enabled for this app yet ' +
        '(Discord Developer Portal -> your app -> Games -> Social SDK). WidgetCord relies on ' +
        "this undocumented feature, so Discord's own error above is the best diagnostic."
    );
  }

  const published = configs.find((c) => c.status === 'published');
  let staticFields;

  if (published && (await confirm(`\nFound an existing published widget-config ("${published.display_name}"). Reuse it?`))) {
    console.log('✓ Reusing existing widget-config. You can still edit its content from the WidgetCord panel later.\n');
    staticFields = {
      name: published.display_name,
    };
  } else {
    console.log("\nLet's create a new widget-config (a progress-bar style widget).\n");
    const name = await ask('Widget display name', { default: guild.name });
    const sub01 = await ask('Subtitle (shown under the name)', { default: `Join ${guild.name} today!` });
    const imageUrl = await ask('Image URL (server icon or banner — square works best)');
    const progressText = await ask('Progress bar title (e.g. an invite link)', { default: `https://discord.gg/` });
    const progressDescription = await ask('Progress bar subtitle', { default: 'Join today!' });
    const goalStr = await ask('Goal (member target for the progress bar)', { default: '1000' });
    const activityText = await ask('Activity accessory text (shown next to "Playing <app>")', { default: '' });

    const displayNameForConfig = name || guild.name;

    try {
      const created = await createWidgetConfig(botToken, applicationId, {
        display_name: displayNameForConfig,
        surfaces: buildSurfacesSchema(),
      });
      await publishWidgetConfig(botToken, applicationId, created.config_id);
      console.log(`✓ Created and published widget-config ${created.config_id}\n`);
    } catch (err) {
      return die(
        `Could not create/publish the widget-config: HTTP ${err.status} ${err.body}\n` +
          '  Discord\'s own error above is the best diagnostic — this is an undocumented ' +
          'feature and may require Social SDK access to be enabled for this application.'
      );
    }

    staticFields = {
      name: displayNameForConfig,
      sub01,
      primary_image: imageUrl ? { url: imageUrl } : undefined,
      preview_icon: imageUrl ? { url: imageUrl } : undefined,
      preview_image: imageUrl ? { url: imageUrl } : undefined,
      preview_value: 'Custom widget',
      mini_text: sub01,
      mini_icon: imageUrl ? { url: imageUrl } : undefined,
      sub01_icon: imageUrl ? { url: imageUrl } : undefined,
      mini_image: imageUrl ? { url: imageUrl } : undefined,
      progress_text: progressText,
      progress_description: progressDescription,
      progress_image: imageUrl ? { url: imageUrl } : undefined,
      activity_text: activityText || undefined,
    };
    staticFields.goal = Number(goalStr) || 1000;
  }

  // --- Step 4: interval + targets ---
  const intervalStr = await ask('Update interval in minutes', { default: '10' });
  const intervalMinutes = Number(intervalStr) || 10;

  console.log(
    '\nNote: as of a June 2026 Discord change, only the application owner\'s account can ' +
      'currently have this widget added to its profile — pushing to other users\' identities ' +
      'may silently do nothing until Discord lifts that restriction.'
  );
  const targetDefault = ownerId || '';
  const targetInput = await ask('Target Discord user ID(s) to push to (comma-separated)', {
    default: targetDefault,
  });
  const targetUserIds = targetInput.split(',').map((s) => s.trim()).filter(Boolean);

  const goal = staticFields.goal || Number(await ask('Goal (member target)', { default: '1000' }));
  delete staticFields.goal;

  const config = {
    applicationId,
    botToken,
    guildId,
    targetUserIds,
    goal,
    intervalMinutes,
    staticFields: Object.fromEntries(
      Object.entries(staticFields).filter(([, v]) => v !== undefined && v !== '')
    ),
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
  console.log(`\n✓ Wrote ${CONFIG_PATH}`);
  console.log('\nNext: npm start (or docker compose up -d)\n');

  rl.close();
}

main().catch((err) => die(err.message));
