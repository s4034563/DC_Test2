# Discord Purgatory Game Bot

This bot runs a server game around one monitored role.

## What it does

- Admins can choose the monitored role, the purgatory role, and the announcement channel.
- Players start at 50 points when they get the monitored role.
- A valid message loses 1 point.
- A violating message is deleted and adds 5 points.
- When a message is deleted, the bot DMs the player with the rule(s) they broke.
- No more than 2 identical letters may appear in a row.
- At 0 points the monitored role is removed.
- At 100 points the purgatory role is added and the bot applies a timeout.
- If a purgatory player changes username, the bot announces it in the configured channel.

## Setup

1. Install Node.js 18.17 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in the values.
4. Run `npm run deploy:commands`.
5. Start the bot with `npm start`.

## Railway Deploy

If you deploy on Railway, add `DISCORD_TOKEN` in the service Variables panel before the app starts. The bot now registers its slash commands on startup, so you do not need a separate deploy step.

Set `GUILD_ID` if you want `/config` to appear immediately in one server. Without `GUILD_ID`, commands register globally and can take longer to show up in Discord.

## Commands

- `/config show`
- `/config set-monitored-role`
- `/config set-purgatory-role`
- `/config set-log-channel`

All config commands require administrator permission.

## Rule notes

The bot evaluates the full message directly. The date-prefix rule has been removed.

Rule 9 is implemented as an overlap check against the last two successful messages from the same player.

## Permissions

The bot needs:

- Manage Messages
- Manage Roles
- Moderate Members
- Read Message Content intent
- Server Members intent

The monitored role must be below the bot's top role. The purgatory role must also be below the bot's top role.