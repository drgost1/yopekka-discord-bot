# YoPekka Discord Bot

Modular Discord bot. Music first, more features coming.

## Features (v0.1)
- `/play <query>` — play from YouTube URL, Spotify URL, SoundCloud URL, or search terms
- `/skip` — skip current track
- `/pause` / `/resume` — toggle playback
- `/stop` — stop, clear queue, leave voice
- `/queue [page]` — show the queue
- `/nowplaying` — show current track
- `/loop <off|song|queue>` — loop mode
- `/volume <0-150>` — set volume
- `/shuffle` — shuffle the queue

## Setup

### Prerequisites
- Node.js 20+
- FFmpeg installed and on PATH (`ffmpeg -version` must work)
- yt-dlp installed and on PATH (optional but recommended for non-YouTube sources)
- A Discord application + bot token from https://discord.com/developers/applications

### Install
```bash
bun install
cp .env.example .env
# edit .env → fill DISCORD_TOKEN and CLIENT_ID
```

### Deploy slash commands
```bash
bun run deploy
```
Set `GUILD_ID` in `.env` for instant guild-scoped deployment while testing. Leave it blank for global deployment (takes ~1 hour to propagate).

### Run
```bash
bun run start      # production
bun run dev        # auto-reload on file change
```

### Invite the bot
Use this URL (replace `CLIENT_ID`):
```
https://discord.com/oauth2/authorize?client_id=CLIENT_ID&permissions=3148864&scope=bot+applications.commands
```
Permissions integer `3148864` = View Channel + Send Messages + Embed Links + Connect + Speak + Use Voice Activity.

## Adding new features

Drop a `.js` file under `src/commands/<category>/name.js`:
```js
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder().setName("ping").setDescription("Replies with pong"),
    async execute(interaction, client) {
        await interaction.reply("pong");
    },
};
```
The handler auto-loads any `.js` inside `src/commands/**`. Run `bun run deploy` to register it with Discord.

For listeners, drop a file under `src/events/name.js`:
```js
const { Events } = require("discord.js");
module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) { /* ... */ },
};
```

## Deploying to YoPekka VPS
```bash
# on VPS: install Node 20, FFmpeg, yt-dlp, bun
# clone repo, bun install
# create systemd service (sample: /etc/systemd/system/yopekka-discord.service)
```
Service sample ships in `deploy/yopekka-discord.service` (create when ready).
