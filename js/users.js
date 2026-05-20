/**
 * VOLEYTACTICS - USER MANAGER MODULE (js/users.js)
 * Maneja las cuentas de usuario locales (LocalStorage), cifrado SHA-256, sesiones activas y favoritos.
 */

export class UserManager {
    constructor() {
        this.usersKey = 'voley_tactics_users';
        this.sessionKey = 'voley_tactics_active_session';
        this.currentUser = null; // null, 'guest', o username
        this.favorites = []; // array de IDs de tácticas preferidas
        
        // Modal & DOM Elements
        this.modalLogin = document.getElementById('modal-login');
        this.loginTabBtn = document.getElementById('tab-btn-login');
        this.registerTabBtn = document.getElementById('tab-btn-register');
        this.loginForm = document.getElementById('login-form-container');
        this.registerForm = document.getElementById('register-form-container');
        
        // Input Fields
        this.inputLoginUser = document.getElementById('login-user');
        this.inputLoginPass = document.getElementById('login-pass');
        this.inputRegisterUser = document.getElementById('register-user');
        this.inputRegisterPass = document.getElementById('register-pass');
        this.inputRegisterPassConfirm = document.getElementById('register-pass-confirm');
        
        // Buttons
        this.btnLoginSubmit = document.getElementById('btn-login-submit');
        this.btnRegisterSubmit = document.getElementById('btn-register-submit');
        this.btnGuestSubmit = document.getElementById('btn-guest-submit');
        this.btnLogout = document.getElementById('btn-logout');
        this.headerProfile = document.getElementById('header-profile-section');
        this.headerUsername = document.getElementById('header-username');
        
        this.init();
    }

    async init() {
        this.setupAuthModalTabs();
        this.setupAuthListeners();
        
        // Cargar sesión guardada al iniciar
        await this.loadActiveSession();
    }

    /**
     * Cifra la contraseña utilizando el estándar SHA-256 mediante Web Crypto API (nativo del navegador)
     */
    async hashPassword(password) {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Alterna la vista entre pestañas de Iniciar Sesión y Registrarse
     */
    setupAuthModalTabs() {
        this.loginTabBtn.addEventListener('click', () => {
            this.loginTabBtn.classList.add('active');
            this.registerTabBtn.classList.remove('active');
            this.loginForm.style.display = 'flex';
            this.registerForm.style.display = 'none';
        });

        this.registerTabBtn.addEventListener('click', () => {
            this.registerTabBtn.classList.add('active');
            this.loginTabBtn.classList.remove('active');
            this.registerForm.style.display = 'flex';
            this.loginForm.style.display = 'none';
        });
    }

    /**
     * Obtiene el listado total de usuarios creados localmente
     */
    getUsersDatabase() {
        const data = localStorage.getItem(this.usersKey);
        return data ? JSON.parse(data) : {};
    }

    /**
     * Guarda la base de datos local de usuarios en LocalStorage
     */
    saveUsersDatabase(db) {
        localStorage.setItem(this.usersKey, JSON.stringify(db));
    }

    /**
     * Configura los eventos del formulario de Login, Registro e Invitado
     */
    setupAuthListeners() {
        // Clic Iniciar Sesión
        this.btnLoginSubmit.addEventListener('click', async (e) => {
            e.preventDefault();
            const username = this.inputLoginUser.value.trim();
            const password = this.inputLoginPass.value;

            if (!username || !password) {
                alert('Por favor, completa todos los campos.');
                return;
            }

            const success = await this.login(username, password);
            if (success) {
                this.inputLoginUser.value = '';
                this.inputLoginPass.value = '';
            } else {
                alert('Usuario o contraseña incorrectos.');
            }
        });

        // Clic Registrarse
        this.btnRegisterSubmit.addEventListener('click', async (e) => {
            e.preventDefault();
            const username = this.inputRegisterUser.value.trim();
            const password = this.inputRegisterPass.value;
            const passConfirm = this.inputRegisterPassConfirm.value;

            if (!username || !password || !passConfirm) {
                alert('Por favor, completa todos los campos.');
                return;
            }

            if (username.length < 3) {
                alert('El nombre de usuario debe tener al menos 3 caracteres.');
                return;
            }

            if (password.length < 4) {
                alert('La contraseña debe tener al menos 4 caracteres.');
                return;
            }

            if (password !== passConfirm) {
                alert('Las contraseñas no coinciden.');
                return;
            }

            const success = await this.register(username, password);
            if (success) {
                alert('¡Registro exitoso! Ya puedes iniciar sesión.');
                // Cambiar a pestaña Login automáticamente
                this.loginTabBtn.click();
                this.inputLoginUser.value = username;
                this.inputRegisterUser.value = '';
                this.inputRegisterPass.value = '';
                this.inputRegisterPassConfirm.value = '';
            }
        });

        // Clic Entrar como Invitado
        this.btnGuestSubmit.addEventListener('click', () => {
            this.loginAsGuest();
        });

        // Clic Cerrar Sesión
        this.btnLogout.addEventListener('click', () => {
            this.logout();
        });
    }

    /**
     * Intenta registrar un nuevo usuario
     */
    async register(username, password) {
        const db = this.getUsersDatabase();
        const normalizedUser = username.toLowerCase();

        if (db[normalizedUser]) {
            alert('El nombre de usuario ya existe. Elige otro.');
            return false;
        }

        const hashedPassword = await this.hashPassword(password);
        db[normalizedUser] = {
            username: username,
            passwordHash: hashedPassword,
            favorites: [],
            settings: {}
        };

        this.saveUsersDatabase(db);
        return true;
    }

    /**
     * Intenta autenticar a un usuario
     */
    async login(username, password) {
        const db = this.getUsersDatabase();
        const normalizedUser = username.toLowerCase();
        const userObj = db[normalizedUser];

        if (!userObj) return false;

        const hashedPassword = await this.hashPassword(password);
        if (userObj.passwordHash === hashedPassword) {
            this.currentUser = userObj.username;
            this.favorites = userObj.favorites || [];
            
            // Guardar sesión activa
            localStorage.setItem(this.sessionKey, this.currentUser);
            
            this.applySessionUI();
            this.notifySessionChanged('login');
            return true;
        }

        return false;
    }

    /**
     * Inicia sesión temporal como invitado
     */
    loginAsGuest() {
        this.currentUser = 'guest';
        this.favorites = [];
        
        localStorage.setItem(this.sessionKey, 'guest');
        
        this.applySessionUI();
        this.notifySessionChanged('login');
    }

    /**
     * Cierra la sesión activa
     */
    logout() {
        if (confirm('¿Estás seguro de que quieres cerrar la sesión? Tu pizarra táctica se reiniciará.')) {
            this.currentUser = null;
            this.favorites = [];
            localStorage.removeItem(this.sessionKey);
            
            this.applySessionUI();
            this.notifySessionChanged('logout');
        }
    }

    /**
     * Carga la sesión activa desde LocalStorage al iniciar
     */
    async loadActiveSession() {
        const active = localStorage.getItem(this.sessionKey);
        
        if (active) {
            if (active === 'guest') {
                this.currentUser = 'guest';
                this.favorites = [];
            } else {
                const db = this.getUsersDatabase();
                const userObj = db[active.toLowerCase()];
                if (userObj) {
                    this.currentUser = userObj.username;
                    this.favorites = userObj.favorites || [];
                } else {
                    this.currentUser = null;
                    localStorage.removeItem(this.sessionKey);
                }
            }
        }
        
        this.applySessionUI();
        this.notifySessionChanged('init');
    }

    /**
     * Aplica los cambios visuales en el header y muestra el modal si no hay sesión
     */
    applySessionUI() {
        if (this.currentUser) {
            // Sesión activa: Ocultar login modal
            this.modalLogin.style.display = 'none';
            this.headerProfile.style.display = 'flex';
            
            if (this.currentUser === 'guest') {
                this.headerUsername.textContent = 'Entrenador Invitado';
            } else {
                this.headerUsername.textContent = `Entrenador: ${this.currentUser}`;
            }
        } else {
            // Sin sesión: Mostrar login modal y ocultar profile en header
            this.modalLogin.style.display = 'flex';
            this.headerProfile.style.display = 'none';
        }
    }

    /**
     * Despacha un evento avisando a los demás componentes del cambio de usuario
     */
    notifySessionChanged(type) {
        window.dispatchEvent(new CustomEvent('session-changed', {
            detail: {
                type: type, // 'login', 'logout', 'init'
                user: this.currentUser
            }
        }));
    }

    /**
     * Retorna si un preset táctico está marcado como favorito
     */
    isFavorite(tacticId) {
        return this.favorites.includes(tacticId);
    }

    /**
     * Alterna el estado de favoritos de una táctica específica
     */
    toggleFavorite(tacticId) {
        if (!this.currentUser) return;
        
        const index = this.favorites.indexOf(tacticId);
        if (index === -1) {
            this.favorites.push(tacticId);
        } else {
            this.favorites.splice(index, 1);
        }

        // Guardar persistencia en base de datos si no es invitado
        if (this.currentUser !== 'guest') {
            const db = this.getUsersDatabase();
            const normalizedUser = this.currentUser.toLowerCase();
            if (db[normalizedUser]) {
                db[normalizedUser].favorites = this.favorites;
                this.saveUsersDatabase(db);
            }
        }

        // Emitir evento
        window.dispatchEvent(new CustomEvent('favorites-changed', {
            detail: {
                favorites: this.favorites,
                tacticId: tacticId
            }
        }));
    }
}
