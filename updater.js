const fs = require('fs');
const path = require('path');
const { FIELD_ORDER } = require('./fields');
const { getGuild, pushIdentityProfile } = require('./discordApi');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const STATE_PATH = path.join(__dirname, 'state.json');

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { lastPushAt: null, lastCount: null, lastPushedValue: null, lastError: null };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

async function fetchMemberCount(config) {
  const guild = await getGuild(config.botToken, config.guildId);
  return guild.approximate_member_count;
}

// Builds the COMPLETE dynamic field array. The Discord endpoint replaces the whole
// array on every PATCH -- sending a partial set wipes every other field on the widget.
function buildPayload(config, memberCount) {
  const values = {
    ...config.staticFields,
    progress_current: memberCount,
    progress_max: config.goal,
  };

  const dynamic = FIELD_ORDER
    .filter(([key]) => values[key] !== undefined && values[key] !== null && values[key] !== '')
    .map(([key, type]) => ({ type, name: key, value: values[key] }));

  return {
    username: config.staticFields.name,
    metadata: null,
    data: { dynamic },
  };
}

async function pushToDiscord(config, userId, payload) {
  await pushIdentityProfile(config.botToken, config.applicationId, userId, payload);
}

async function runUpdate() {
  const config = loadConfig();
  const state = loadState();

  try {
    const count = await fetchMemberCount(config);
    const payload = buildPayload(config, count);

    for (const userId of config.targetUserIds) {
      await pushToDiscord(config, userId, payload);
    }

    state.lastPushAt = new Date().toISOString();
    state.lastCount = count;
    state.lastPushedValue = count;
    state.lastError = null;
    saveState(state);

    console.log(`[widgetcord] pushed count=${count} to ${config.targetUserIds.length} user(s) at ${state.lastPushAt}`);
    return { ok: true, count };
  } catch (err) {
    state.lastError = err.message;
    saveState(state);
    console.error('[widgetcord] update failed:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  loadConfig,
  saveConfig,
  loadState,
  saveState,
  fetchMemberCount,
  buildPayload,
  pushToDiscord,
  runUpdate,
};
