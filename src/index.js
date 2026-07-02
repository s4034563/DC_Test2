require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  PermissionFlagsBits,
} = require('discord.js');
const {
  loadConfig,
  saveConfig,
  loadState,
  saveState,
  getGuildState,
} = require('./storage');
const { registerCommands } = require('./commands');
const { evaluateMessage } = require('./rules');

const token = process.env.DISCORD_TOKEN;

if (!token) {
  throw new Error('DISCORD_TOKEN is required. Set it in Railway Variables or your local .env file before starting the bot.');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

let config;
let state;

function getPlayerState(guildId, userId) {
  const guildState = getGuildState(state, guildId);

  if (!guildState.players[userId]) {
    guildState.players[userId] = {
      points: 50,
      successfulMessages: [],
    };
  }

  return guildState.players[userId];
}

function isMonitoredPlayer(member) {
  return Boolean(config.monitoredRoleId && member.roles.cache.has(config.monitoredRoleId));
}

async function persist() {
  await saveState(state);
}

function formatViolationDm(violations) {
  const lines = violations.map((violation) => {
    const label = typeof violation.rule === 'number' ? `Rule ${violation.rule}` : violation.rule;
    return `${label}: ${violation.reason}`;
  });
  return `Your message was deleted because it broke the following rule(s):\n${lines.join('\n')}`;
}

async function dmViolations(member, violations) {
  try {
    await member.user.send({ content: formatViolationDm(violations) });
  } catch (error) {
    console.error(`Failed to DM ${member.user.tag} about a deleted message.`, error);
  }
}

async function ensurePlayerInitialized(member) {
  if (!isMonitoredPlayer(member)) {
    return null;
  }

  const playerState = getPlayerState(member.guild.id, member.id);
  playerState.points = 50;
  playerState.successfulMessages = [];
  await persist();
  return playerState;
}

async function applyPurgatory(member) {
  if (config.purgatoryRoleId && !member.roles.cache.has(config.purgatoryRoleId)) {
    await member.roles.add(config.purgatoryRoleId, 'Reached 100 points in the Discord game');
  }

  if (member.moderatable) {
    const maximumTimeoutMs = 28 * 24 * 60 * 60 * 1000;
    await member.timeout(maximumTimeoutMs, 'Reached purgatory in the Discord game');
  }
}

async function removeMonitoredRole(member) {
  if (config.monitoredRoleId && member.roles.cache.has(config.monitoredRoleId)) {
    await member.roles.remove(config.monitoredRoleId, 'Reached 0 points in the Discord game');
  }
}

async function announceUsernameChange(member) {
  if (!config.logChannelId || !config.purgatoryRoleId || !member.roles.cache.has(config.purgatoryRoleId)) {
    return;
  }

  const channel = await member.guild.channels.fetch(config.logChannelId).catch(() => null);
  if (!channel?.isTextBased()) {
    return;
  }

  await channel.send(`${member.user.username} says ${member.toString()}`);
}

function hasAdministratorPermission(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

client.once(Events.ClientReady, async (readyClient) => {
  config = await loadConfig();
  state = await loadState();

  try {
    const clientId = readyClient.application?.id;
    const commandResult = await registerCommands({
      clientId,
      guildId: process.env.GUILD_ID,
      token,
    });
    console.log(`Registered ${commandResult.count} ${commandResult.scope} command set(s).`);
  } catch (error) {
    console.error('Slash command registration failed:', error);
  }

  for (const guild of readyClient.guilds.cache.values()) {
    const members = await guild.members.fetch();
    for (const member of members.values()) {
      if (isMonitoredPlayer(member)) {
        getPlayerState(guild.id, member.id);
      }
    }
  }

  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'config') {
    return;
  }

  if (!hasAdministratorPermission(interaction)) {
    await interaction.reply({ content: 'Administrator permission is required.', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'show') {
    await interaction.reply({
      content: [
        `Monitored role: ${config.monitoredRoleId ? `<@&${config.monitoredRoleId}>` : 'not set'}`,
        `Purgatory role: ${config.purgatoryRoleId ? `<@&${config.purgatoryRoleId}>` : 'not set'}`,
        `Announcement channel: ${config.logChannelId ? `<#${config.logChannelId}>` : 'not set'}`,
      ].join('\n'),
      ephemeral: true,
    });
    return;
  }

  if (subcommand === 'set-monitored-role') {
    const role = interaction.options.getRole('role', true);
    config.monitoredRoleId = role.id;
    await saveConfig(config);
    await interaction.reply({ content: `Monitored role set to ${role.name}.`, ephemeral: true });
    return;
  }

  if (subcommand === 'set-purgatory-role') {
    const role = interaction.options.getRole('role', true);
    config.purgatoryRoleId = role.id;
    await saveConfig(config);
    await interaction.reply({ content: `Purgatory role set to ${role.name}.`, ephemeral: true });
    return;
  }

  if (subcommand === 'set-log-channel') {
    const channel = interaction.options.getChannel('channel', true);
    config.logChannelId = channel.id;
    await saveConfig(config);
    await interaction.reply({ content: `Announcement channel set to ${channel.name}.`, ephemeral: true });
  }
});

client.on(Events.UserUpdate, async (oldUser, newUser) => {
  if (!config || !state || oldUser.username === newUser.username) {
    return;
  }

  for (const guild of client.guilds.cache.values()) {
    const member = await guild.members.fetch(newUser.id).catch(() => null);
    if (member?.roles.cache.has(config.purgatoryRoleId)) {
      await announceUsernameChange(member, oldUser.username);
    }
  }
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  if (!config || !state || !config.monitoredRoleId) {
    return;
  }

  const hadRole = oldMember.roles.cache.has(config.monitoredRoleId);
  const hasRole = newMember.roles.cache.has(config.monitoredRoleId);

  if (!hadRole && hasRole) {
    await ensurePlayerInitialized(newMember);
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (!config || !state) {
    return;
  }

  if (message.author.bot || !message.guild) {
    return;
  }

  const member = message.member ?? await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!member || !isMonitoredPlayer(member)) {
    return;
  }

  const playerState = getPlayerState(message.guild.id, message.author.id);
  const evaluation = evaluateMessage(message.content, playerState);

  if (!evaluation.allowed) {
    await message.delete().catch(() => null);
    if (evaluation.violations?.length > 0) {
      await dmViolations(member, evaluation.violations);
    }
    playerState.points += 5;
    await persist();

    if (playerState.points >= 100) {
      await applyPurgatory(member).catch(() => null);
    }

    return;
  }

  playerState.points -= 1;
  playerState.successfulMessages.push({
    words: evaluation.normalizedWords,
    content: message.content,
    timestamp: Date.now(),
  });
  playerState.successfulMessages = playerState.successfulMessages.slice(-2);

  await persist();

  if (playerState.points <= 0) {
    await removeMonitoredRole(member).catch(() => null);
    return;
  }

  if (playerState.points >= 100) {
    await applyPurgatory(member).catch(() => null);
  }
});

client.login(token).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});