const { EmbedBuilder } = require("discord.js");

const BRAND_COLOR = 0x5865f2;

function makeBaseEmbed() {
    return new EmbedBuilder().setColor(BRAND_COLOR).setTimestamp();
}

async function replyError(interaction, message) {
    const embed = makeBaseEmbed().setColor(0xed4245).setDescription(message);
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed] });
    } else {
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

async function replyOk(interaction, message) {
    const embed = makeBaseEmbed().setDescription(message);
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed] });
    } else {
        await interaction.reply({ embeds: [embed] });
    }
}

module.exports = { makeBaseEmbed, replyError, replyOk, BRAND_COLOR };
