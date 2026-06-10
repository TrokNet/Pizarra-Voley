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
        this.dbVersion = 2;
        this.db = null;
        this.initPromise = null;

        this.usersStore = 'users';
        this.playsStore = 'plays';
        this.rostersStore = 'rosters';
        this.metaStore = 'meta';

        // Legacy keys for one-time migration from LocalStorage.
        this.legacyUsersKey = 'voley_tactics_users';
        this.legacySessionKey = 'voley_tactics_active_session';
        this.legacyPlaysPrefix = 'voley_tactics_saved_plays_';
        this.migrationFlagKey = 'legacy_migrated_v1';
        this.rosterMetaMigrationFlagKey = 'roster_meta_migrated_v2';
        this.legacyRosterPrefix = 'players_roster_';
    }

    async init() {
        if (this.db) return;
        if (this.initPromise) {
            await this.initPromise;
            return;
        }

        this.initPromise = new Promise((resolve, reject) => {
            // Verificar si IndexedDB está disponible en el navegador
            if (!window.indexedDB) {
                this.fallbackToLocalStorage();
                resolve();
                return;
            }

            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.warn('IndexedDB falló al abrir, usando localStorage como fallback:', request.error);
                this.fallbackToLocalStorage();
                resolve();
            };

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

                if (!db.objectStoreNames.contains(this.rostersStore)) {
                    const rosters = db.createObjectStore(this.rostersStore, { keyPath: 'id' });
                    rosters.createIndex('byUser', 'user', { unique: true });
                    rosters.createIndex('byUpdatedAt', 'updatedAt', { unique: false });
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
        if (this.db) {
            await this.migrateFromLegacyLocalStorage();
            await this.migrateRosterMetaToDedicatedStore();
        }
    }

    fallbackToLocalStorage() {
        this.db = null;
        this.useLocalStorage = true;
        console.log('LocalDB: Usando localStorage como fallback persistente');
    }

    _lsKey(store, key) {
        return `voley_ls_${store}_${key}`;
    }

    _lsGet(store, key) {
        try {
            const raw = localStorage.getItem(this._lsKey(store, key));
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    _lsSet(store, key, value) {
        try {
            localStorage.setItem(this._lsKey(store, key), JSON.stringify(value));
            return true;
        } catch (_) {
            return false;
        }
    }

    _lsRemove(store, key) {
        try {
            localStorage.removeItem(this._lsKey(store, key));
        } catch (_) {
            // noop
        }
    }

    _lsList(store) {
        const prefix = `voley_ls_${store}_`;
        const items = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(prefix)) {
                try {
                    items.push(JSON.parse(localStorage.getItem(k)));
                } catch (_) {
                    // skip corrupt
                }
            }
        }
        return items;
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
        if (this.useLocalStorage) {
            return this._lsGet(this.metaStore, key);
        }
        const record = await this.requestToPromise(this.tx(this.metaStore).get(key));
        return record ? record.value : null;
    }

    async setMeta(key, value) {
        await this.init();
        if (this.useLocalStorage) {
            this._lsSet(this.metaStore, key, { key, value });
            return;
        }
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
        if (this.useLocalStorage) {
            return this._lsGet(this.usersStore, normalizedUser);
        }
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

        if (this.useLocalStorage) {
            this._lsSet(this.usersStore, id, userRecord);
            return userRecord;
        }

        await this.requestToPromise(this.tx(this.usersStore, 'readwrite').put(userRecord));
        return userRecord;
    }

    async getPlaysByUser(user) {
        await this.init();
        const normalizedUser = this.normalizeUser(user);

        if (this.useLocalStorage) {
            const all = this._lsList(this.playsStore);
            return all
                .filter(p => p.user === normalizedUser)
                .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
                .map(p => ({ name: p.name, date: p.date, frames: p.frames }));
        }

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

        if (this.useLocalStorage) {
            const play = this._lsGet(this.playsStore, id);
            if (!play) return null;
            return { name: play.name, date: play.date, frames: play.frames };
        }

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

        if (this.useLocalStorage) {
            this._lsSet(this.playsStore, id, record);
            return record;
        }

        await this.requestToPromise(this.tx(this.playsStore, 'readwrite').put(record));
        return record;
    }

    async getRosterByUser(user) {
        await this.init();
        const normalizedUser = this.normalizeUser(user);

        if (this.useLocalStorage) {
            const roster = this._lsGet(this.rostersStore, normalizedUser);
            if (!roster || !Array.isArray(roster.players)) {
                return [];
            }
            return roster.players;
        }

        const roster = await this.requestToPromise(this.tx(this.rostersStore).get(normalizedUser));
        if (!roster || !Array.isArray(roster.players)) {
            return [];
        }
        return roster.players;
    }

    async saveRosterByUser(user, players) {
        await this.init();
        const normalizedUser = this.normalizeUser(user);
        const record = {
            id: normalizedUser,
            user: normalizedUser,
            players: Array.isArray(players) ? players : [],
            updatedAt: Date.now()
        };

        if (this.useLocalStorage) {
            this._lsSet(this.rostersStore, normalizedUser, record);
            return record;
        }

        await this.requestToPromise(this.tx(this.rostersStore, 'readwrite').put(record));
        return record;
    }

    async deletePlay(user, playName) {
        await this.init();
        const id = this.makePlayId(user, playName);

        if (this.useLocalStorage) {
            this._lsRemove(this.playsStore, id);
            return;
        }

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

    async migrateRosterMetaToDedicatedStore() {
        const alreadyMigrated = await this.getMeta(this.rosterMetaMigrationFlagKey);
        if (alreadyMigrated) return;

        try {
            const metaStore = this.tx(this.metaStore);
            const records = await new Promise((resolve, reject) => {
                const list = [];
                const req = metaStore.openCursor();

                req.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (!cursor) {
                        resolve(list);
                        return;
                    }
                    list.push(cursor.value);
                    cursor.continue();
                };

                req.onerror = () => reject(req.error);
            });

            for (const record of records) {
                if (!record || typeof record.key !== 'string') continue;
                if (!record.key.startsWith(this.legacyRosterPrefix)) continue;

                const normalizedUser = this.normalizeUser(record.key.replace(this.legacyRosterPrefix, ''));
                const players = Array.isArray(record.value) ? record.value : [];
                await this.saveRosterByUser(normalizedUser, players);
            }
        } catch (err) {
            console.warn('No se pudo migrar plantilla desde meta store:', err);
        } finally {
            await this.setMeta(this.rosterMetaMigrationFlagKey, true);
        }
    }
}
