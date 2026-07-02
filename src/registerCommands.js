require('dotenv').config();

const { registerCommands } = require('./commands');

const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const token = process.env.DISCORD_TOKEN;

async function main() {
  const result = await registerCommands({ clientId, guildId, token });
  console.log(`Registered ${result.count} ${result.scope} command set(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});