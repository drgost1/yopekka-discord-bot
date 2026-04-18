const { Events, MessageFlags } = require("discord.js");
const { replyError } = require("../utils/embeds");
const { handleMusicButton, refreshNowPlaying } = require("../music/controls");

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (interaction.isButton() && interaction.customId.startsWith("music:")) {
            try {
                const result = await handleMusicButton(interaction, client);
                await interaction.reply({
                    content: result.message ?? (result.ok ? "Done." : "Failed."),
                    flags: MessageFlags.Ephemeral,
                });
                if (result.ok) {
                    const player = client.lavalink.getPlayer(interaction.guildId);
                    if (player) await refreshNowPlaying(player, client);
                }
            } catch (err) {
                console.error("[buttonClick] error:", err);
                if (!interaction.replied) {
                    await interaction.reply({
                        content: `Error: \`${err.message}\``,
                        flags: MessageFlags.Ephemeral,
                    }).catch(() => {});
                }
            }
            return;
        }

        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction, client);
        } catch (err) {
            console.error(`[interactionCreate] ${interaction.commandName} failed:`, err);
            await replyError(interaction, "Command failed. Check console for details.").catch(() => {});
        }
    },
};
