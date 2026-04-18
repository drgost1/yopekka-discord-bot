const { REST, Routes } = require("discord.js");
const config = require("./config");
const loadCommands = require("./handlers/commandHandler");

const fakeClient = { commands: new Map() };
loadCommands(fakeClient);

const body = [...fakeClient.commands.values()].map((c) => c.data.toJSON());

const rest = new REST({ version: "10" }).setToken(config.token);

(async () => {
    try {
        if (config.guildId) {
            console.log(`[deploy] registering ${body.length} command(s) to guild ${config.guildId}`);
            await rest.put(
                Routes.applicationGuildCommands(config.clientId, config.guildId),
                { body },
            );
            console.log("[deploy] guild deployment done (instant).");
        } else {
            console.log(`[deploy] registering ${body.length} command(s) globally`);
            await rest.put(Routes.applicationCommands(config.clientId), { body });
            console.log("[deploy] global deployment done (propagation may take up to 1 hour).");
        }
    } catch (err) {
        console.error("[deploy] failed:", err);
        process.exit(1);
    }
})();
