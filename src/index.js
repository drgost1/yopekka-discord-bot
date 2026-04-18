const { Client, Collection, GatewayIntentBits } = require("discord.js");
const config = require("./config");
const loadCommands = require("./handlers/commandHandler");
const loadEvents = require("./handlers/eventHandler");
const createLavalink = require("./music/lavalink");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

client.commands = new Collection();
client.lavalink = createLavalink(client, config);

loadCommands(client);
loadEvents(client);

process.on("unhandledRejection", (err) => console.error("[unhandledRejection]", err));
process.on("uncaughtException", (err) => console.error("[uncaughtException]", err));

client.login(config.token);
