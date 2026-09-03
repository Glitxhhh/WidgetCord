// Thin wrapper around Discord's REST API for the bot-token calls WidgetCord needs.
// Centralizes auth headers and error surfacing so updater.js and setup.js don't duplicate it.

const BASE = 'https://discord.com/api/v10';

class DiscordApiError extends Error {
  constructor(status, body) {
    super(`Discord API error: HTTP ${status} ${body}`);
    this.status = status;
    this.body = body;
  }
}

async function discordRequest(botToken, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${botToken}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new DiscordApiError(res.status, text);
  }

  if (res.status === 204) return null;
  return res.json();
}

const getSelfUser = (botToken) => discordRequest(botToken, 'GET', '/users/@me');
const getSelfApplication = (botToken) => discordRequest(botToken, 'GET', '/applications/@me');
const getGuild = (botToken, guildId) =>
  discordRequest(botToken, 'GET', `/guilds/${guildId}?with_counts=true`);
const listWidgetConfigs = (botToken, appId) =>
  discordRequest(botToken, 'GET', `/applications/${appId}/widget-configs`);
const createWidgetConfig = (botToken, appId, body) =>
  discordRequest(botToken, 'POST', `/applications/${appId}/widget-configs`, body);
const publishWidgetConfig = (botToken, appId, configId) =>
  discordRequest(botToken, 'POST', `/applications/${appId}/widget-configs/${configId}/publish`);
const pushIdentityProfile = (botToken, appId, userId, payload) =>
  discordRequest(
    botToken,
    'PATCH',
    `/applications/${appId}/users/${userId}/identities/${userId}/profile`,
    payload
  );

module.exports = {
  DiscordApiError,
  discordRequest,
  getSelfUser,
  getSelfApplication,
  getGuild,
  listWidgetConfigs,
  createWidgetConfig,
  publishWidgetConfig,
  pushIdentityProfile,
};
