const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { makeBaseEmbed, replyError, replyOk } = require("../../utils/embeds");

const PAGE_SIZE = 10;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("playlist")
        .setDescription("Manage your private playlists")
        .addSubcommand((s) => s.setName("create").setDescription("Create a new playlist")
            .addStringOption((o) => o.setName("name").setDescription("Playlist name").setRequired(true).setMaxLength(32)))
        .addSubcommand((s) => s.setName("delete").setDescription("Delete a playlist")
            .addStringOption((o) => o.setName("name").setDescription("Playlist name").setRequired(true).setAutocomplete(true)))
        .addSubcommand((s) => s.setName("rename").setDescription("Rename a playlist")
            .addStringOption((o) => o.setName("name").setDescription("Current name").setRequired(true).setAutocomplete(true))
            .addStringOption((o) => o.setName("new-name").setDescription("New name").setRequired(true).setMaxLength(32)))
        .addSubcommand((s) => s.setName("list").setDescription("Show all your playlists"))
        .addSubcommand((s) => s.setName("show").setDescription("Show tracks in a playlist")
            .addStringOption((o) => o.setName("name").setDescription("Playlist name").setRequired(true).setAutocomplete(true))
            .addIntegerOption((o) => o.setName("page").setDescription("Page number").setMinValue(1)))
        .addSubcommand((s) => s.setName("add").setDescription("Add the currently playing song or a search result")
            .addStringOption((o) => o.setName("name").setDescription("Playlist name").setRequired(true).setAutocomplete(true))
            .addStringOption((o) => o.setName("query").setDescription("URL or search — leave empty to add current track")))
        .addSubcommand((s) => s.setName("remove").setDescription("Remove a track by its position")
            .addStringOption((o) => o.setName("name").setDescription("Playlist name").setRequired(true).setAutocomplete(true))
            .addIntegerOption((o) => o.setName("position").setDescription("Track number (see /playlist show)").setRequired(true).setMinValue(1)))
        .addSubcommand((s) => s.setName("play").setDescription("Queue up a playlist and start playing")
            .addStringOption((o) => o.setName("name").setDescription("Playlist name").setRequired(true).setAutocomplete(true))
            .addBooleanOption((o) => o.setName("shuffle").setDescription("Shuffle the tracks"))),

    async autocomplete(interaction, client) {
        const focused = interaction.options.getFocused(true);
        if (focused.name !== "name") return interaction.respond([]);
        const playlists = client.playlists.list(interaction.user.id);
        const q = focused.value.toLowerCase();
        const matches = playlists
            .filter((p) => p.name.toLowerCase().includes(q))
            .slice(0, 25)
            .map((p) => ({ name: `${p.name} (${p.tracks.length})`, value: p.name }));
        await interaction.respond(matches);
    },

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();
        switch (sub) {
            case "create": return handleCreate(interaction, client);
            case "delete": return handleDelete(interaction, client);
            case "rename": return handleRename(interaction, client);
            case "list": return handleList(interaction, client);
            case "show": return handleShow(interaction, client);
            case "add": return handleAdd(interaction, client);
            case "remove": return handleRemove(interaction, client);
            case "play": return handlePlay(interaction, client);
            default: return replyError(interaction, "Unknown subcommand.");
        }
    },
};

function handleCreate(interaction, client) {
    const name = interaction.options.getString("name", true);
    const res = client.playlists.create(interaction.user.id, name);
    if (!res.ok) {
        return replyError(interaction, reasonMessage(res.reason, name));
    }
    return replyOk(interaction, `Created playlist **${res.playlist.name}**.`);
}

function handleDelete(interaction, client) {
    const name = interaction.options.getString("name", true);
    const ok = client.playlists.delete(interaction.user.id, name);
    if (!ok) return replyError(interaction, `No playlist named **${name}**.`);
    return replyOk(interaction, `Deleted playlist **${name}**.`);
}

function handleRename(interaction, client) {
    const oldName = interaction.options.getString("name", true);
    const newName = interaction.options.getString("new-name", true);
    const res = client.playlists.rename(interaction.user.id, oldName, newName);
    if (!res.ok) return replyError(interaction, reasonMessage(res.reason, newName));
    return replyOk(interaction, `Renamed **${oldName}** → **${newName}**.`);
}

function handleList(interaction, client) {
    const playlists = client.playlists.list(interaction.user.id);
    if (playlists.length === 0) {
        return replyError(interaction, "You have no playlists. Create one with `/playlist create`.");
    }
    const lines = playlists.map((p) => `**${p.name}** — ${p.tracks.length} track(s)`);
    const embed = makeBaseEmbed()
        .setTitle(`Your playlists (${playlists.length})`)
        .setDescription(lines.join("\n"));
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

function handleShow(interaction, client) {
    const name = interaction.options.getString("name", true);
    const playlist = client.playlists.get(interaction.user.id, name);
    if (!playlist) return replyError(interaction, `No playlist named **${name}**.`);

    const page = (interaction.options.getInteger("page") ?? 1) - 1;
    const totalPages = Math.max(1, Math.ceil(playlist.tracks.length / PAGE_SIZE));
    if (page >= totalPages) return replyError(interaction, `Only ${totalPages} page(s) available.`);

    const slice = playlist.tracks.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
    const lines = slice.length
        ? slice.map((t, i) => {
              const idx = page * PAGE_SIZE + i + 1;
              const link = t.uri ? `[${t.title}](${t.uri})` : t.title;
              return `\`${idx}\` ${link} · \`${fmt(t.duration)}\``;
          })
        : ["_Empty playlist._"];

    const embed = makeBaseEmbed()
        .setTitle(`Playlist: ${playlist.name}`)
        .setDescription(lines.join("\n"))
        .setFooter({ text: `Page ${page + 1}/${totalPages} · ${playlist.tracks.length} total` });

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleAdd(interaction, client) {
    const name = interaction.options.getString("name", true);
    const query = interaction.options.getString("query");
    const playlist = client.playlists.get(interaction.user.id, name);
    if (!playlist) return replyError(interaction, `No playlist named **${name}**. Create one first with \`/playlist create\`.`);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let track;
    if (!query) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player?.queue?.current) {
            return interaction.editReply("Nothing is playing. Provide a `query` or start a song first.");
        }
        track = player.queue.current;
    } else {
        const tempPlayer = client.lavalink.getPlayer(interaction.guildId);
        const searcher = tempPlayer || client.lavalink.nodeManager.leastUsedNodes[0];
        if (!searcher) return interaction.editReply("No Lavalink node available.");

        const res = tempPlayer
            ? await tempPlayer.search({ query, source: "ytsearch" }, interaction.user).catch(() => null)
            : await client.lavalink.nodeManager.leastUsedNodes[0].lavalinkManager.search({ query, source: "ytsearch" }, interaction.user).catch(() => null);

        if (!res || !res.tracks?.length) return interaction.editReply(`No results for **${query}**.`);
        track = res.tracks[0];
    }

    const addRes = client.playlists.addTrack(interaction.user.id, name, track);
    if (!addRes.ok) return interaction.editReply(reasonMessage(addRes.reason, name));
    return interaction.editReply(`Added **${track.info?.title ?? track.title}** to **${playlist.name}** (${playlist.tracks.length} total).`);
}

function handleRemove(interaction, client) {
    const name = interaction.options.getString("name", true);
    const position = interaction.options.getInteger("position", true);
    const res = client.playlists.removeTrack(interaction.user.id, name, position - 1);
    if (!res.ok) return replyError(interaction, reasonMessage(res.reason, name));
    return replyOk(interaction, `Removed **${res.removed.title}** from **${name}**.`);
}

async function handlePlay(interaction, client) {
    const name = interaction.options.getString("name", true);
    const shuffle = interaction.options.getBoolean("shuffle") ?? false;
    const playlist = client.playlists.get(interaction.user.id, name);
    if (!playlist) return replyError(interaction, `No playlist named **${name}**.`);
    if (playlist.tracks.length === 0) return replyError(interaction, `**${playlist.name}** is empty.`);

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
        return interaction.reply({
            content: "Join a voice channel first.",
            flags: MessageFlags.Ephemeral,
        });
    }

    await interaction.deferReply();

    let player = client.lavalink.getPlayer(interaction.guildId);
    if (!player) {
        player = client.lavalink.createPlayer({
            guildId: interaction.guildId,
            voiceChannelId: voiceChannel.id,
            textChannelId: interaction.channelId,
            selfDeaf: true,
            volume: 80,
        });
    }
    if (!player.connected) {
        try { await player.connect(); }
        catch (err) { return interaction.editReply(`Voice connect failed: ${err.message}`); }
    }

    const order = shuffle ? shuffled(playlist.tracks) : playlist.tracks.slice();
    const resolved = [];
    for (const t of order) {
        const url = t.uri || (t.identifier ? `https://www.youtube.com/watch?v=${t.identifier}` : null);
        if (!url) continue;
        const res = await player.search({ query: url, source: "ytsearch" }, interaction.user).catch(() => null);
        const track = res?.tracks?.[0];
        if (track) resolved.push(track);
    }
    if (resolved.length === 0) return interaction.editReply("Couldn't resolve any tracks from that playlist.");

    await player.queue.add(resolved);
    if (!player.playing && !player.paused) await player.play();

    await interaction.editReply(`Queued **${playlist.name}** — ${resolved.length} track(s)${shuffle ? " (shuffled)" : ""}.`);
}

function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function fmt(ms) {
    if (!ms || ms < 0) return "LIVE";
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function reasonMessage(reason, name) {
    return {
        "invalid-name": "Invalid name. Use 1-32 characters.",
        "name-too-long": "Name too long (max 32 characters).",
        exists: `A playlist named **${name}** already exists.`,
        "not-found": `No playlist named **${name}**.`,
        full: "That playlist has reached the 200-track limit.",
        limit: "You have reached the 50-playlist limit. Delete one first.",
        "out-of-range": "That track position doesn't exist.",
    }[reason] ?? "Something went wrong.";
}
