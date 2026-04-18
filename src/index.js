const path = require("path");
const { Client, Collection, GatewayIntentBits } = require("discord.js");
const config = require("./config");
const loadCommands = require("./handlers/commandHandler");
const loadEvents = require("./handlers/eventHandler");
const createLavalink = require("./music/lavalink");
const PlaylistStore = require("./playlist/store");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.commands = new Collection();
client.lavalink = createLavalink(client, config);
client.playlists = new PlaylistStore(path.join(__dirname, "..", "data", "playlists.json"));

loadCommands(client);
loadEvents(client);

process.on("unhandledRejection", (err) => console.error("[unhandledRejection]", err));
process.on("uncaughtException", (err) => console.error("[uncaughtException]", err));

(async () => {
    await client.playlists.load();
    await client.login(config.token);
})();
