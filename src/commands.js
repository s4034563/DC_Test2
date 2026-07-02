const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

function buildCommands() {
  return [
    new SlashCommandBuilder()
      .setName('config')
      .setDescription('Configure the game bot')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand((subcommand) =>
        subcommand.setName('show').setDescription('Show the current game configuration'),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('set-monitored-role')
          .setDescription('Set the role that becomes monitored players')
          .addRoleOption((option) => option.setName('role').setDescription('Role to monitor').setRequired(true)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('set-purgatory-role')
          .setDescription('Set the purgatory role')
          .addRoleOption((option) => option.setName('role').setDescription('Purgatory role').setRequired(true)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('set-log-channel')
          .setDescription('Set the channel used for username-change announcements')
          .addChannelOption((option) => option.setName('channel').setDescription('Announcement channel').setRequired(true)),
      )
      .toJSON(),
  ];
}

async function registerCommands({ clientId, guildId, token }) {
  if (!clientId) {
    throw new Error('CLIENT_ID is required to register slash commands.');
  }

  if (!token) {
    throw new Error('DISCORD_TOKEN is required to register slash commands.');
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const commands = buildCommands();

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    return { scope: 'guild', count: commands.length };
  }

  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  return { scope: 'global', count: commands.length };
}

module.exports = {
  buildCommands,
  registerCommands,
};