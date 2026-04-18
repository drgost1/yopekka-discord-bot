const fs = require("fs").promises;
const path = require("path");

const MAX_NAME_LEN = 32;
const MAX_TRACKS = 200;
const MAX_PLAYLISTS_PER_USER = 50;

/**
 * JSON-backed per-user playlist storage with atomic writes and debounced saves.
 *
 * Shape: { [userId]: { [normalizedName]: { name, created, tracks: [...] } } }
 * Track shape: { title, uri, author, duration, identifier }
 */
class PlaylistStore {
    constructor(filePath) {
        this.filePath = filePath;
        this.data = {};
        this.saveTimer = null;
    }

    async load() {
        try {
            const raw = await fs.readFile(this.filePath, "utf8");
            this.data = JSON.parse(raw) || {};
        } catch (err) {
            if (err.code === "ENOENT") {
                this.data = {};
                await this.save();
            } else {
                console.error("[playlist] load failed:", err);
                this.data = {};
            }
        }
    }

    scheduleSave() {
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            this.save().catch((e) => console.error("[playlist] save failed:", e));
        }, 1000);
    }

    async save() {
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        const tmp = this.filePath + ".tmp";
        await fs.writeFile(tmp, JSON.stringify(this.data, null, 2));
        await fs.rename(tmp, this.filePath);
    }

    _userData(userId) {
        if (!this.data[userId]) this.data[userId] = {};
        return this.data[userId];
    }

    list(userId) {
        return Object.values(this._userData(userId));
    }

    get(userId, name) {
        return this._userData(userId)[normalize(name)];
    }

    create(userId, name) {
        const key = normalize(name);
        if (!key) return { ok: false, reason: "invalid-name" };
        if (key.length > MAX_NAME_LEN) return { ok: false, reason: "name-too-long" };
        const user = this._userData(userId);
        if (user[key]) return { ok: false, reason: "exists" };
        if (Object.keys(user).length >= MAX_PLAYLISTS_PER_USER) {
            return { ok: false, reason: "limit" };
        }
        const playlist = { name: name.trim().slice(0, MAX_NAME_LEN), created: Date.now(), tracks: [] };
        user[key] = playlist;
        this.scheduleSave();
        return { ok: true, playlist };
    }

    delete(userId, name) {
        const key = normalize(name);
        const user = this._userData(userId);
        if (!user[key]) return false;
        delete user[key];
        this.scheduleSave();
        return true;
    }

    rename(userId, oldName, newName) {
        const oldKey = normalize(oldName);
        const newKey = normalize(newName);
        if (!newKey) return { ok: false, reason: "invalid-name" };
        const user = this._userData(userId);
        if (!user[oldKey]) return { ok: false, reason: "not-found" };
        if (user[newKey] && oldKey !== newKey) return { ok: false, reason: "exists" };
        const p = user[oldKey];
        p.name = newName.trim().slice(0, MAX_NAME_LEN);
        delete user[oldKey];
        user[newKey] = p;
        this.scheduleSave();
        return { ok: true };
    }

    addTrack(userId, name, track) {
        const playlist = this.get(userId, name);
        if (!playlist) return { ok: false, reason: "not-found" };
        if (playlist.tracks.length >= MAX_TRACKS) return { ok: false, reason: "full" };
        playlist.tracks.push({
            title: String(track.info?.title ?? "Unknown"),
            uri: String(track.info?.uri ?? ""),
            author: String(track.info?.author ?? ""),
            duration: Number(track.info?.duration ?? 0),
            identifier: String(track.info?.identifier ?? ""),
        });
        this.scheduleSave();
        return { ok: true };
    }

    removeTrack(userId, name, index) {
        const playlist = this.get(userId, name);
        if (!playlist) return { ok: false, reason: "not-found" };
        if (index < 0 || index >= playlist.tracks.length) return { ok: false, reason: "out-of-range" };
        const removed = playlist.tracks.splice(index, 1)[0];
        this.scheduleSave();
        return { ok: true, removed };
    }
}

function normalize(name) {
    return String(name ?? "").trim().toLowerCase();
}

module.exports = PlaylistStore;
