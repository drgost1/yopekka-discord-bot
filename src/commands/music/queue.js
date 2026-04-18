const { SlashCommandBuilder } = require("discord.js");
const { replyError } = require("../../utils/embeds");
const { buildQueueEmbed } = require("../../music/queueView");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("queue")
        .setDescription("Show previous, current, and upcoming songs")
        .addIntegerOption((opt) =>
            opt.setName("page").setDescription("Page number").setMinValue(1),
        ),
    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) return replyError(interaction, "Nothing is playing.");

        const page = (interaction.options.getInteger("page") ?? 1) - 1;
        const result = buildQueueEmbed(player, page);
        if (!result) return replyError(interaction, "Invalid page.");

        await interaction.reply({ embeds: [result] });
    },
};
