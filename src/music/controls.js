const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
} = require("discord.js");
const { buildNowPlayingMessage } = require("./nowPlaying");
const { buildQueueEmbed } = require("./queueView");

/**
 * Handle a component interaction (button, select menu, modal submit).
 * Returns:
 *   { ok, message }   → caller sends an ephemeral reply with `message`
 *   null              → handler already replied (used for modals / ephemeral pickers)
 */
async function handleMusicInteraction(interaction, client) {
    const [prefix, action] = interaction.customId.split(":");
    if (prefix !== "music") return { ok: false, message: "Unknown control." };

    const player = client.lavalink.getPlayer(interaction.guildId);

    // Playlist management — don't require an active player
    if (action === "plist-save" || action === "plist-load") {
        return showPlaylistPicker(interaction, client, action);
    }
    if (action === "plist-save-pick") return savePlaylistPick(interaction, client, player);
    if (action === "plist-load-pick") return loadPlaylistPick(interaction, client, player);
    if (action === "plist-create") return showCreateModal(interaction);
    if (action === "plist-create-modal") return handleCreateModal(interaction, client);
    if (action === "plist-delete") return showDeletePicker(interaction, client);
    if (action === "plist-delete-pick") return handleDeletePick(interaction, client);

    if (!player) return { ok: false, message: "Nothing is playing." };

    const memberVoice = interaction.member?.voice?.channelId;
    if (memberVoice && player.voiceChannelId && memberVoice !== player.voiceChannelId) {
        return { ok: false, message: "Join my voice channel to control playback." };
    }

    switch (action) {
        case "toggle": {
            if (player.paused) await player.resume();
            else await player.pause();
            return { ok: true, message: player.paused ? "Paused." : "Resumed." };
        }
        case "skip": {
            if (!player.queue.current) return { ok: false, message: "Nothing to skip." };
            await player.skip();
            return { ok: true, message: "Skipped." };
        }
        case "prev": {
            const prev = player.queue.previous?.[0];
            if (!prev) return { ok: false, message: "No previous track." };
            await player.queue.add(prev, 0);
            await player.skip(0, false);
            return { ok: true, message: "Previous track." };
        }
        case "stop": {
            await player.destroy();
            return { ok: true, message: "Stopped and left the voice channel." };
        }
        case "vol-down": {
            const v = Math.max(0, player.volume - 10);
            await player.setVolume(v);
            return { ok: true, message: `Volume: ${v}%` };
        }
        case "vol-up": {
            const v = Math.min(150, player.volume + 10);
            await player.setVolume(v);
            return { ok: true, message: `Volume: ${v}%` };
        }
        case "loop": {
            const next = player.repeatMode === "off" ? "track" : player.repeatMode === "track" ? "queue" : "off";
            await player.setRepeatMode(next);
            return { ok: true, message: `Loop: ${next}` };
        }
        case "shuffle": {
            if (player.queue.tracks.length < 2) return { ok: false, message: "Need at least 2 tracks in queue." };
            await player.queue.shuffle();
            return { ok: true, message: "Queue shuffled." };
        }
        case "autoplay": {
            const current = Boolean(player.get("autoplay"));
            player.set("autoplay", !current);
            return { ok: true, message: `Autoplay: ${!current ? "On" : "Off"}` };
        }
        case "queue": {
            const embed = buildQueueEmbed(player, 0);
            if (!embed) return { ok: false, message: "Nothing to show." };
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return null;
        }
        case "suggest": {
            const suggestions = player.get("suggestions") ?? [];
            const index = Number(interaction.values?.[0]);
            const track = suggestions[index];
            if (!track) return { ok: false, message: "Suggestion expired, pick another." };
            track.requester = { id: interaction.user.id, username: interaction.user.username, toString: () => `<@${interaction.user.id}>` };
            await player.queue.add(track, 0);
            return { ok: true, message: `Queued next: **${track.info.title}**` };
        }
        default:
            return { ok: false, message: "Unknown action." };
    }
}

// ===================== PLAYLIST PICKERS =====================

async function showPlaylistPicker(interaction, client, action) {
    const playlists = client.playlists.list(interaction.user.id);
    const isSave = action === "plist-save";

    if (isSave) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player?.queue?.current) return { ok: false, message: "Nothing is playing to save." };
    }

    if (playlists.length === 0) {
        return {
            ok: false,
            message: isSave
                ? "You have no playlists. Click ➕ Create to make one."
                : "You have no playlists yet. Click ➕ Create first.",
        };
    }

    const menu = new StringSelectMenuBuilder()
        .setCustomId(isSave ? "music:plist-save-pick" : "music:plist-load-pick")
        .setPlaceholder(isSave ? "Pick a playlist to save to…" : "Pick a playlist to queue…")
        .addOptions(
            playlists.slice(0, 25).map((p) => ({
                label: p.name.slice(0, 100),
                description: `${p.tracks.length} track(s)`.slice(0, 100),
                value: p.name,
                emoji: isSave ? "💾" : "📂",
            })),
        );

    await interaction.reply({
        content: isSave ? "Save current track to which playlist?" : "Load which playlist?",
        components: [new ActionRowBuilder().addComponents(menu)],
        flags: MessageFlags.Ephemeral,
    });
    return null;
}

function savePlaylistPick(interaction, client, player) {
    if (!player?.queue?.current) return { ok: false, message: "Nothing is playing to save." };
    const playlistName = interaction.values?.[0];
    const playlist = client.playlists.get(interaction.user.id, playlistName);
    if (!playlist) return { ok: false, message: `Playlist **${playlistName}** no longer exists.` };

    const res = client.playlists.addTrack(interaction.user.id, playlistName, player.queue.current);
    if (!res.ok) {
        return { ok: false, message: res.reason === "full" ? "Playlist is full (200 tracks)." : "Couldn't save." };
    }
    return {
        ok: true,
        message: `Saved **${player.queue.current.info.title}** to **${playlist.name}** (${playlist.tracks.length} total).`,
    };
}

async function loadPlaylistPick(interaction, client, player) {
    const playlistName = interaction.values?.[0];
    const playlist = client.playlists.get(interaction.user.id, playlistName);
    if (!playlist) return { ok: false, message: `Playlist **${playlistName}** no longer exists.` };
    if (playlist.tracks.length === 0) return { ok: false, message: `**${playlist.name}** is empty.` };

    const voiceChannel = interaction.member?.voice?.channel;
    let active = player;
    if (!active && !voiceChannel) return { ok: false, message: "Join a voice channel first." };
    if (!active) {
        active = client.lavalink.createPlayer({
            guildId: interaction.guildId,
            voiceChannelId: voiceChannel.id,
            textChannelId: interaction.channelId,
            selfDeaf: true,
            volume: 80,
        });
    }
    if (!active.connected) {
        try { await active.connect(); }
        catch (err) { return { ok: false, message: `Voice connect failed: ${err.message}` }; }
    }

    const resolved = [];
    for (const t of playlist.tracks) {
        const url = t.uri || (t.identifier ? `https://www.youtube.com/watch?v=${t.identifier}` : null);
        if (!url) continue;
        const res = await active.search({ query: url, source: "ytsearch" }, interaction.user).catch(() => null);
        const track = res?.tracks?.[0];
        if (track) resolved.push(track);
    }
    if (resolved.length === 0) return { ok: false, message: "Couldn't resolve tracks from playlist." };

    await active.queue.add(resolved);
    if (!active.playing && !active.paused) await active.play();

    return { ok: true, message: `Queued **${playlist.name}** — ${resolved.length} track(s).` };
}

// ===================== CREATE MODAL =====================

async function showCreateModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId("music:plist-create-modal")
        .setTitle("Create Playlist")
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("name")
                    .setLabel("Playlist name")
                    .setPlaceholder("e.g. My Mix, Workout, Chill Vibes")
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(32)
                    .setRequired(true),
            ),
        );
    await interaction.showModal(modal);
    return null;
}

function handleCreateModal(interaction, client) {
    const name = interaction.fields.getTextInputValue("name");
    const res = client.playlists.create(interaction.user.id, name);
    if (!res.ok) {
        const map = {
            "invalid-name": "Invalid name.",
            "name-too-long": "Name too long (max 32 characters).",
            exists: `A playlist named **${name}** already exists.`,
            limit: "You have reached the 50-playlist limit.",
        };
        return { ok: false, message: map[res.reason] ?? "Couldn't create." };
    }
    return { ok: true, message: `Created playlist **${res.playlist.name}**.` };
}

// ===================== DELETE PICKER =====================

async function showDeletePicker(interaction, client) {
    const playlists = client.playlists.list(interaction.user.id);
    if (playlists.length === 0) {
        return { ok: false, message: "You have no playlists to delete." };
    }

    const menu = new StringSelectMenuBuilder()
        .setCustomId("music:plist-delete-pick")
        .setPlaceholder("Pick a playlist to delete…")
        .addOptions(
            playlists.slice(0, 25).map((p) => ({
                label: p.name.slice(0, 100),
                description: `${p.tracks.length} track(s) — will be permanently deleted`.slice(0, 100),
                value: p.name,
                emoji: "🗑",
            })),
        );

    await interaction.reply({
        content: "Which playlist to delete?",
        components: [new ActionRowBuilder().addComponents(menu)],
        flags: MessageFlags.Ephemeral,
    });
    return null;
}

function handleDeletePick(interaction, client) {
    const name = interaction.values?.[0];
    const ok = client.playlists.delete(interaction.user.id, name);
    if (!ok) return { ok: false, message: `Playlist **${name}** not found.` };
    return { ok: true, message: `Deleted **${name}**.` };
}

// ===================== HELPERS =====================

function fmtTime(ms) {
    if (!ms || ms < 0) return "LIVE";
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
}

async function refreshNowPlaying(player, client) {
    if (!player.nowPlayingMessageId || !player.textChannelId) return;
    const channel = client.channels.cache.get(player.textChannelId);
    if (!channel) return;
    const msg = await channel.messages.fetch(player.nowPlayingMessageId).catch(() => null);
    if (!msg) return;
    const track = player.queue.current;
    if (!track) return;
    await msg.edit(buildNowPlayingMessage(player, track, player.get("suggestions"))).catch(() => {});
}

module.exports = { handleMusicInteraction, refreshNowPlaying };
