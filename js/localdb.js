/**
 * VOLEYTACTICS - LOCAL DATABASE MODULE (js/localdb.js)
 * Persistencia local en IndexedDB para usuarios, sesión activa y jugadas.
 */

export class LocalDatabase {
    static instance = null;

    static getInstance() {
        if (!LocalDatabase.instance) {
            LocalDatabase.instance = new LocalDatabase();
        }
        return LocalDatabase.instance;
    }

    constructor() {
        this.dbName = 'voley_tactics_local_db';
        this.dbVersion = 1;
        this.db = null;
        this.initPromise = null;

        this.usersStore = 'users';
        this.playsStore = 'plays';
        this.metaStore = 'meta';

        // Legacy keys for one-time migration from LocalStorage.
        this.legacyUsersKey = 'voley_tactics_users';
        this.legacySessionKey = 'voley_tactics_active_session';
        this.legacyPlaysPrefix = 'voley_tactics_saved_plays_';
        this.migrationFlagKey = 'legacy_migrated_v1';
    }

    async init() {
        if (this.db) return;
        if (this.initPromise) {
            await this.initPromise;
            return;
        }

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(this.usersStore)) {
                    db.createObjectStore(this.usersStore, { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains(this.playsStore)) {
                    const plays = db.createObjectStore(this.playsStore, { keyPath: 'id' });
                    plays.createIndex('byUser', 'user', { unique: false });
                    plays.createIndex('byUpdatedAt', 'updatedAt', { unique: false });
                }

                if (!db.objectStoreNames.contains(this.metaStore)) {
                    db.createObjectStore(this.metaStore, { keyPath: 'key' });
                }
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
        });

        await this.initPromise;
        await this.migrateFromLegacyLocalStorage();
    }

    tx(storeName, mode = 'readonly') {
        return this.db.transaction(storeName, mode).objectStore(storeName);
    }

    requestToPromise(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    normalizeUser(user) {
        return (user || 'guest').toLowerCase();
    }

    makePlayId(user, playName) {
        return `${this.normalizeUser(user)}::${playName.toLowerCase()}`;
    }

    async getMeta(key) {
        await this.init();
        const record = await this.requestToPromise(this.tx(this.metaStore).get(key));
        return record ? record.value : null;
    }

    async setMeta(key, value) {
        await this.init();
        await this.requestToPromise(this.tx(this.metaStore, 'readwrite').put({ key, value }));
    }

    async getActiveSession() {
        return await this.getMeta('active_session');
    }

    async setActiveSession(user) {
        await this.setMeta('active_session', user);
    }

    async clearActiveSession() {
        await this.setMeta('active_session', null);
    }

    async getUser(normalizedUser) {
        await this.init();
        return await this.requestToPromise(this.tx(this.usersStore).get(normalizedUser));
    }

    async saveUser(userObj) {
        await this.init();
        const id = (userObj.id || userObj.username || '').toLowerCase();
        const userRecord = {
            id,
            username: userObj.username,
            passwordHash: userObj.passwordHash,
            favorites: Array.isArray(userObj.favorites) ? userObj.favorites : [],
            settings: userObj.settings || {}
        };

        await this.requestToPromise(this.tx(this.usersStore, 'readwrite').put(userRecord));
        return userRecord;
    }

    async getPlaysByUser(user) {
        await this.init();
        const normalizedUser = this.normalizeUser(user);
        const index = this.tx(this.playsStore).index('byUser');
        const records = await this.requestToPromise(index.getAll(normalizedUser));

        records.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        return records.map((play) => ({
            name: play.name,
            date: play.date,
            frames: play.frames
        }));
    }

    async getPlayByName(user, playName) {
        await this.init();
        const id = this.makePlayId(user, playName);
        const play = await this.requestToPromise(this.tx(this.playsStore).get(id));
        if (!play) return null;

        return {
            name: play.name,
            date: play.date,
            frames: play.frames
        };
    }

    async getLastPlayByUser(user) {
        const plays = await this.getPlaysByUser(user);
        return plays.length > 0 ? plays[0] : null;
    }

    async savePlay(user, playData) {
        await this.init();
        const normalizedUser = this.normalizeUser(user);
        const id = this.makePlayId(normalizedUser, playData.name);

        const record = {
            id,
            user: normalizedUser,
            name: playData.name,
            date: playData.date,
            frames: playData.frames,
            updatedAt: Date.now()
        };

        await this.requestToPromise(this.tx(this.playsStore, 'readwrite').put(record));
        return record;
    }

    async deletePlay(user, playName) {
        await this.init();
        const id = this.makePlayId(user, playName);
        await this.requestToPromise(this.tx(this.playsStore, 'readwrite').delete(id));
    }

    async migrateFromLegacyLocalStorage() {
        const alreadyMigrated = await this.getMeta(this.migrationFlagKey);
        if (alreadyMigrated) return;

        try {
            // 1) Users database.
            const usersData = localStorage.getItem(this.legacyUsersKey);
            if (usersData) {
                const users = JSON.parse(usersData);
                if (users && typeof users === 'object') {
                    for (const [normalizedUser, userObj] of Object.entries(users)) {
                        await this.saveUser({
                            id: normalizedUser,
                            username: userObj.username || normalizedUser,
                            passwordHash: userObj.passwordHash,
                            favorites: userObj.favorites || [],
                            settings: userObj.settings || {}
                        });
                    }
                }
            }

            // 2) Active session.
            const activeSession = localStorage.getItem(this.legacySessionKey);
            if (activeSession) {
                await this.setActiveSession(activeSession);
            }

            // 3) Saved plays by user.
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key || !key.startsWith(this.legacyPlaysPrefix)) continue;

                const user = key.replace(this.legacyPlaysPrefix, '') || 'guest';
                const playsJson = localStorage.getItem(key);
                if (!playsJson) continue;

                const plays = JSON.parse(playsJson);
                if (!Array.isArray(plays)) continue;

                for (const play of plays) {
                    if (!play || !play.name || !play.frames) continue;
                    await this.savePlay(user, {
                        name: play.name,
                        date: play.date || new Date().toLocaleString(),
                        frames: play.frames
                    });
                }
            }
        } catch (err) {
            // Do not block app startup if migration cannot complete.
            console.warn('No se pudo migrar LocalStorage a IndexedDB:', err);
        } finally {
            await this.setMeta(this.migrationFlagKey, true);
        }
    }
}
