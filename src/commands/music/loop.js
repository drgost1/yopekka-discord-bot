const { SlashCommandBuilder } = require("discord.js");
const { replyError, replyOk } = require("../../utils/embeds");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("loop")
        .setDescription("Set the loop mode")
        .addStringOption((opt) =>
            opt.setName("mode")
                .setDescription("Loop mode")
                .setRequired(true)
                .addChoices(
                    { name: "off", value: "off" },
                    { name: "song", value: "track" },
                    { name: "queue", value: "queue" },
                ),
        ),
    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player) return replyError(interaction, "Nothing is playing.");

        const mode = interaction.options.getString("mode", true);
        await player.setRepeatMode(mode);
        await replyOk(interaction, `Loop set to **${mode}**.`);
    },
};
