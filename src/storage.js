const fs = require('fs/promises');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const configPath = path.join(dataDir, 'config.json');
const statePath = path.join(dataDir, 'state.json');

const defaultConfig = {
  monitoredRoleId: null,
  purgatoryRoleId: null,
  logChannelId: null,
};

const defaultState = {
  guilds: {},
};

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

async function writeJson(filePath, value) {
  await ensureDataDir();
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function loadConfig() {
  const config = await readJson(configPath, null);
  return { ...defaultConfig, ...(config ?? {}) };
}

async function saveConfig(config) {
  await writeJson(configPath, { ...defaultConfig, ...config });
}

async function loadState() {
  const state = await readJson(statePath, null);
  return { ...defaultState, ...(state ?? {}), guilds: { ...(state?.guilds ?? {}) } };
}

async function saveState(state) {
  await writeJson(statePath, state);
}

function getGuildState(state, guildId) {
  if (!state.guilds[guildId]) {
    state.guilds[guildId] = {
      players: {},
    };
  }

  return state.guilds[guildId];
}

module.exports = {
  loadConfig,
  saveConfig,
  loadState,
  saveState,
  getGuildState,
  defaultConfig,
};