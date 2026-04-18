const { Events } = require("discord.js");
const config = require("../config");
const { buildNowPlayingMessage } = require("../music/nowPlaying");
const { playQuery } = require("../music/playQuery");

/**
 * Two responsibilities:
 *   1. Music-channel monitor: if the message is in a configured MUSIC_CHANNEL, treat
 *      its content as a /play query.
 *   2. Sticky Now Playing: repost the Now Playing message to the bottom after any
 *      new chatter in the player's text channel.
 */
const repostTimers = new Map(); // channelId -> NodeJS.Timeout

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (!message.guild) return;
        if (message.author?.bot) return;

        const isMusicChannel = config.musicChannels.includes(message.channelId);
        if (isMusicChannel) {
            await handleMusicChannelMessage(message, client);
            return;
        }

        scheduleStickyRepost(message, client);
    },
};

async function handleMusicChannelMessage(message, client) {
    const query = message.content?.trim();
    if (!query) return;

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
        await ephemeralReply(message, "Join a voice channel first.");
        return;
    }

    const res = await playQuery(client, {
        guildId: message.guild.id,
        voiceChannel,
        textChannelId: message.channelId,
        user: message.author,
        member: message.member,
        query,
    });

    await message.delete().catch(() => {});

    if (!res.ok) {
        await ephemeralReply(message, res.message);
        return;
    }

    // Success feedback — the trackStart/addSong events already send embeds,
    // so a short ack helps confirm bot saw the request.
    if (res.track) {
        await autoExpireReply(message.channel, `▶ Queued: **${res.track.info.title}**`, 4000);
    } else {
        await autoExpireReply(
            message.channel,
            `▶ Queued playlist **${res.playlist?.name ?? "Unknown"}** — ${res.playlistLength} tracks`,
            4000,
        );
    }
}

async function ephemeralReply(message, content) {
    const sent = await message.channel.send(content).catch(() => null);
    if (sent) setTimeout(() => sent.delete().catch(() => {}), 5000);
}

async function autoExpireReply(channel, content, ttlMs) {
    const sent = await channel.send(content).catch(() => null);
    if (sent) setTimeout(() => sent.delete().catch(() => {}), ttlMs);
}

function scheduleStickyRepost(message, client) {
    if (message.author?.id === client.user.id) return;

    const player = client.lavalink.getPlayer(message.guild.id);
    if (!player?.nowPlayingMessageId) return;
    if (message.channelId !== player.textChannelId) return;

    const key = player.textChannelId;
    if (repostTimers.has(key)) clearTimeout(repostTimers.get(key));

    const timer = setTimeout(async () => {
        repostTimers.delete(key);
        await repostStickyMessage(player, client);
    }, 1000);
    repostTimers.set(key, timer);
}

async function repostStickyMessage(player, client) {
    if (!player.nowPlayingMessageId || !player.textChannelId) return;
    const track = player.queue.current;
    if (!track) return;

    const channel = client.channels.cache.get(player.textChannelId);
    if (!channel) return;

    try {
        const latest = await channel.messages.fetch({ limit: 1 });
        if (latest.first()?.id === player.nowPlayingMessageId) return;

        const old = await channel.messages.fetch(player.nowPlayingMessageId).catch(() => null);
        if (old) await old.delete().catch(() => {});

        const msg = await channel.send(buildNowPlayingMessage(player, track, player.get("suggestions")));
        player.nowPlayingMessageId = msg.id;
    } catch (err) {
        console.warn("[sticky] repost failed:", err.message);
    }
}
