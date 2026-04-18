const { SlashCommandBuilder } = require("discord.js");
const { replyError, replyOk } = require("../../utils/embeds");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("volume")
        .setDescription("Set the playback volume (0-150)")
        .addIntegerOption((opt) =>
            opt.setName("level")
                .setDescription("Volume percentage")
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(150),
        ),
    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player) return replyError(interaction, "Nothing is playing.");

        const level = interaction.options.getInteger("level", true);
        await player.setVolume(level);
        await replyOk(interaction, `Volume set to **${level}%**.`);
    },
};
