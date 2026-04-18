const { SlashCommandBuilder } = require("discord.js");
const { replyError, replyOk } = require("../../utils/embeds");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pause")
        .setDescription("Pause the current song"),
    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) return replyError(interaction, "Nothing is playing.");
        if (player.paused) return replyError(interaction, "Already paused — use /resume.");

        await player.pause();
        await replyOk(interaction, "Paused.");
    },
};
