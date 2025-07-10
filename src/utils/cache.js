const fs = require('fs');
const path = require('path');

const cacheFile = path.join(__dirname, '..', '..', '.cache.json');
let cache = {};
try {
    if (fs.existsSync(cacheFile)) {
        cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }
} catch {
    cache = {};
}

function save() {
    try {
        fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
    } catch {
        // ignora erro ao salvar
    }
}

function clearExpired() {
    const now = Date.now();
    let changed = false;
    for (const [key, entry] of Object.entries(cache)) {
        if (entry.expires && entry.expires < now) {
            delete cache[key];
            changed = true;
        }
    }
    if (changed) save();
}

function getCache(key) {
    clearExpired();
    return cache[key] ? cache[key].value : undefined;
}

function setCache(key, value, ttl) {
    const ttlEnv = Number(ttl !== undefined ? ttl : process.env.CACHE_TTL);
    const ttlMs = !isNaN(ttlEnv) && ttlEnv > 0 ? ttlEnv * 1000 : 0;
    if (!ttlMs) return; // TTL inválido ou zero => não armazena
    cache[key] = { value, expires: Date.now() + ttlMs };
    save();
}

module.exports = { getCache, setCache, clearExpired };
