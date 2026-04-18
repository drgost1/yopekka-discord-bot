const { SlashCommandBuilder } = require("discord.js");
const { replyError, replyOk } = require("../../utils/embeds");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("skip")
        .setDescription("Skip the current song"),
    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) return replyError(interaction, "Nothing is playing.");

        await player.skip();
        await replyOk(interaction, "Skipped.");
    },
};
