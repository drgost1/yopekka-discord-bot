const { SlashCommandBuilder } = require("discord.js");
const { makeBaseEmbed, replyError } = require("../../utils/embeds");

const PAGE_SIZE = 10;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("queue")
        .setDescription("Show the current song queue")
        .addIntegerOption((opt) =>
            opt.setName("page").setDescription("Page number").setMinValue(1),
        ),
    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) return replyError(interaction, "Nothing is playing.");

        const page = (interaction.options.getInteger("page") ?? 1) - 1;
        const tracks = player.queue.tracks;
        const totalPages = Math.max(1, Math.ceil(tracks.length / PAGE_SIZE));

        if (page >= totalPages) return replyError(interaction, `Only ${totalPages} page(s) available.`);

        const slice = tracks.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
        const lines = slice.map((t, i) => {
            const idx = page * PAGE_SIZE + i + 1;
            return `\`${idx}\` **[${t.info.title}](${t.info.uri})** · \`${fmt(t.info.duration)}\``;
        });

        const current = player.queue.current;
        const embed = makeBaseEmbed()
            .setTitle(`Queue — ${tracks.length} upcoming`)
            .setDescription(
                `**Now:** [${current.info.title}](${current.info.uri}) · \`${fmt(current.info.duration)}\`\n\n` +
                (lines.length ? lines.join("\n") : "_Queue is empty._"),
            )
            .setFooter({ text: `Page ${page + 1}/${totalPages} · Vol ${player.volume}% · Loop ${player.repeatMode}` });

        await interaction.reply({ embeds: [embed] });
    },
};

function fmt(ms) {
    if (!ms || ms < 0) return "LIVE";
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
}
