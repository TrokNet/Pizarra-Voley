/**
 * Cliente de API centralizada para modo cliente-servidor.
 * Si no hay backend disponible, los modulos pueden hacer fallback local.
 */

export class ServerApi {
    static instance = null;

    static getInstance() {
        if (!ServerApi.instance) {
            ServerApi.instance = new ServerApi();
        }
        return ServerApi.instance;
    }

    constructor() {
        const fromWindow = typeof window !== 'undefined' ? window.VOLEY_API_BASE : null;
        const fromStorage = typeof localStorage !== 'undefined' ? localStorage.getItem('voley_api_base') : null;
        const defaultBase = (typeof location !== 'undefined' && location.protocol !== 'file:')
            ? `${location.origin}/api`
            : 'http://localhost:8000/api';

        this.baseUrl = (fromWindow || fromStorage || defaultBase || '').replace(/\/$/, '');
        this.tokenKey = 'voley_api_token';
        this.fallbackBases = this.buildFallbackBases(defaultBase);
    }

    buildFallbackBases(defaultBase) {
        const candidates = [
            defaultBase,
            'http://127.0.0.1:8010/api',
            'http://localhost:8010/api',
            'http://127.0.0.1:8000/api',
            'http://localhost:8000/api'
        ];

        const seen = new Set();
        return candidates
            .map((url) => (url || '').replace(/\/$/, ''))
            .filter((url) => {
                if (!url || seen.has(url)) return false;
                seen.add(url);
                return true;
            });
    }

    isEnabled() {
        return Boolean(this.baseUrl);
    }

    getToken() {
        return localStorage.getItem(this.tokenKey) || '';
    }

    setToken(token) {
        if (token) {
            localStorage.setItem(this.tokenKey, token);
        } else {
            localStorage.removeItem(this.tokenKey);
        }
    }

    async request(path, options = {}) {
        if (!this.isEnabled()) {
            throw new Error('API no configurada');
        }

        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        const token = this.getToken();
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${this.baseUrl}${path}`, {
            ...options,
            headers
        });

        if (!response.ok) {
            let detail = `HTTP ${response.status}`;
            try {
                const errorData = await response.json();
                detail = errorData.detail || detail;
            } catch (_) {
                // noop
            }
            throw new Error(detail);
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return await response.json();
        }
        return null;
    }

    async checkHealthAtBase(baseUrl) {
        const cleanBase = (baseUrl || '').replace(/\/$/, '');
        if (!cleanBase) {
            throw new Error('Base URL vacia');
        }

        let response = await fetch(`${cleanBase}/health`, { method: 'GET' });
        if (!response.ok && cleanBase.endsWith('/api')) {
            const rootBase = cleanBase.slice(0, -4);
            response = await fetch(`${rootBase}/health`, { method: 'GET' });
        }

        if (!response.ok) {
            throw new Error(`Health check fallo en ${cleanBase}`);
        }

        return await response.json();
    }

    async health() {
        const candidates = [this.baseUrl, ...this.fallbackBases].filter(Boolean);
        let lastError = null;

        for (const candidate of candidates) {
            try {
                const data = await this.checkHealthAtBase(candidate);
                this.baseUrl = candidate;
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('voley_api_base', candidate);
                }
                return data;
            } catch (err) {
                lastError = err;
            }
        }

        throw lastError || new Error('Servidor no disponible');
    }

    async register(username, password) {
        const data = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        this.setToken(data.access_token);
        return data;
    }

    async login(username, password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        this.setToken(data.access_token);
        return data;
    }

    async me() {
        return await this.request('/auth/me', { method: 'GET' });
    }

    logout() {
        this.setToken('');
    }

    async updateFavorites(favorites) {
        return await this.request('/users/me/favorites', {
            method: 'PUT',
            body: JSON.stringify({ favorites })
        });
    }

    async getRoster() {
        return await this.request('/roster', { method: 'GET' });
    }

    async saveRoster(players) {
        return await this.request('/roster', {
            method: 'PUT',
            body: JSON.stringify({ players })
        });
    }

    async getPlays() {
        return await this.request('/plays', { method: 'GET' });
    }

    async savePlay(playData) {
        return await this.request('/plays', {
            method: 'POST',
            body: JSON.stringify(playData)
        });
    }

    async deletePlay(playName) {
        return await this.request(`/plays/${encodeURIComponent(playName)}`, {
            method: 'DELETE'
        });
    }
}
