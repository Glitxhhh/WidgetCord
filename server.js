const express = require('express');
const path = require('path');
const {
  loadConfig,
  saveConfig,
  loadState,
  fetchMemberCount,
  runUpdate,
} = require('./updater');

const PORT = process.env.PORT || 3000;
// Defaults to loopback-only (put a reverse proxy in front, as our own deployment does).
// Docker sets HOST=0.0.0.0 so the port mapping actually works.
const HOST = process.env.HOST || '127.0.0.1';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let intervalHandle = null;

function armInterval(config) {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = setInterval(runUpdate, config.intervalMinutes * 60 * 1000);
}

// Strip the bot token before anything reaches the browser.
function sanitizeConfig(config) {
  const { botToken, ...safe } = config;
  return safe;
}

app.get('/api/status', async (req, res) => {
  const config = loadConfig();
  const state = loadState();

  let liveCount = null;
  let liveError = null;
  try {
    liveCount = await fetchMemberCount(config);
  } catch (err) {
    liveError = err.message;
  }

  const nextPushAt = state.lastPushAt
    ? new Date(new Date(state.lastPushAt).getTime() + config.intervalMinutes * 60 * 1000).toISOString()
    : null;

  res.json({
    liveCount,
    liveError,
    goal: config.goal,
    intervalMinutes: config.intervalMinutes,
    targetUserIds: config.targetUserIds,
    lastPushAt: state.lastPushAt,
    lastPushedValue: state.lastPushedValue,
    lastError: state.lastError,
    nextPushAt,
    staticFields: config.staticFields,
    applicationId: config.applicationId,
  });
});

app.get('/api/config', (req, res) => {
  res.json(sanitizeConfig(loadConfig()));
});

app.post('/api/config', (req, res) => {
  const config = loadConfig();
  const { goal, intervalMinutes, targetUserIds, staticFields } = req.body;

  if (goal !== undefined) config.goal = Number(goal);
  if (intervalMinutes !== undefined) config.intervalMinutes = Number(intervalMinutes);
  if (Array.isArray(targetUserIds)) config.targetUserIds = targetUserIds;
  if (staticFields && typeof staticFields === 'object') {
    config.staticFields = { ...config.staticFields, ...staticFields };
  }

  saveConfig(config);
  armInterval(config);
  res.json(sanitizeConfig(config));
});

app.post('/api/push-now', async (req, res) => {
  const result = await runUpdate();
  res.json(result);
});

app.listen(PORT, HOST, () => {
  console.log(`[widgetcord] listening on ${HOST}:${PORT}`);
  const config = loadConfig();
  armInterval(config);
  runUpdate(); // push once on boot
});
