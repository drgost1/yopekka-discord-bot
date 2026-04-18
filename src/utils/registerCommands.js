const { REST, Routes } = require("discord.js");

/**
 * Push every loaded slash command to a single guild. Instant, no propagation delay.
 */
async function registerGuild(client, guildId) {
    const body = [...client.commands.values()].map((c) => c.data.toJSON());
    const rest = new REST({ version: "10" }).setToken(client.token);
    await rest.put(
        Routes.applicationGuildCommands(client.user.id, guildId),
        { body },
    );
    return body.length;
}

/**
 * Deploy commands to every guild the bot is currently in.
 * Runs guild deploys in parallel, continues past individual failures.
 */
async function registerAllGuilds(client) {
    const guilds = [...client.guilds.cache.values()];
    const results = await Promise.allSettled(
        guilds.map(async (g) => {
            const count = await registerGuild(client, g.id);
            return { name: g.name, count };
        }),
    );
    for (const [i, r] of results.entries()) {
        const g = guilds[i];
        if (r.status === "fulfilled") {
            console.log(`[register] ${r.value.count} cmds → ${g.name} (${g.id})`);
        } else {
            console.warn(`[register] failed for ${g.name}: ${r.reason?.message ?? r.reason}`);
        }
    }
}

module.exports = { registerGuild, registerAllGuilds };
