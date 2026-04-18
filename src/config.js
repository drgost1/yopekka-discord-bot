require("dotenv").config();

function required(name) {
    const value = process.env[name];
    if (!value) {
        console.error(`[config] Missing required env var: ${name}`);
        console.error(`[config] Copy .env.example to .env and fill it in.`);
        process.exit(1);
    }
    return value;
}

module.exports = {
    token: required("DISCORD_TOKEN"),
    clientId: required("CLIENT_ID"),
    lavalink: {
        host: process.env.LAVALINK_HOST || "localhost",
        port: Number(process.env.LAVALINK_PORT) || 2333,
        password: process.env.LAVALINK_PASSWORD || "youshallnotpass",
        secure: process.env.LAVALINK_SECURE === "true",
    },
    musicChannels: (process.env.MUSIC_CHANNEL_IDS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
};
