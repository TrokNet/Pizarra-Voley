/**
 * VOLEYTACTICS - ROSTER MODULE (js/roster.js)
 * Gestiona el registro de jugadores del club, sus múltiples posiciones de juego,
 * posición favorita, persistencia local por usuario y modal de gestión.
 */

import { LocalDatabase } from './localdb.js?v=20260624-001';
import { ServerApi } from './api.js?v=20260624-001';

export class RosterManager {
    constructor() {
        this.db = LocalDatabase.getInstance();
        this.api = ServerApi.getInstance();
        this.remoteMode = false;
        this.currentUser = 'guest';
        this.playersList = []; // Lista de jugadores registrados { id, name, number, positions: [], primaryPosition }
        
        // Elementos DOM del Modal
        this.modal = document.getElementById('roster-modal');
        this.btnOpenModal = document.getElementById('btn-roster');
        this.btnCloseModal = document.getElementById('btn-close-roster-modal');
        this.btnCloseModalHeader = document.getElementById('btn-close-roster-modal-header');
        this.playersListContainer = document.getElementById('roster-players-list');
        this.btnAddPlayer = document.getElementById('btn-add-roster-player');
        
        // Elementos DOM del Formulario de Edición
        this.editorPanel = document.getElementById('roster-editor-panel');
        this.editorEmptyState = document.getElementById('roster-editor-empty');
        this.editorTitle = document.getElementById('roster-editor-title');
        this.form = document.getElementById('roster-player-form');
        this.inputId = document.getElementById('roster-player-id');
        this.inputName = document.getElementById('roster-player-name');
        this.inputNumber = document.getElementById('roster-player-number');
        this.checkboxesPos = document.getElementsByName('roster-positions');
        this.selectPrimaryPos = document.getElementById('roster-player-primary-position');
        
        this.btnCancel = document.getElementById('btn-cancel-roster-save');
        this.btnDelete = document.getElementById('btn-delete-roster-player');
        
        this.activePlayerId = null; // Jugador seleccionado en el modal
        
        this.init();
    }

    async init() {
        this.remoteMode = await this.detectRemoteMode();
        // Cargar sesión activa
        await this.loadActiveUser();
        await this.loadRoster();

        // Escuchar cambios de sesión para recargar plantilla
        window.addEventListener('session-changed', async () => {
            await this.loadActiveUser();
            await this.loadRoster();
        });

        // Configurar Listeners del Modal
        if (this.btnOpenModal) {
            this.btnOpenModal.addEventListener('click', () => this.openModal());
        }
        if (this.btnCloseModal) {
            this.btnCloseModal.addEventListener('click', () => this.closeModal());
        }
        if (this.btnCloseModalHeader) {
            this.btnCloseModalHeader.addEventListener('click', () => this.closeModal());
        }
        if (this.btnAddPlayer) {
            this.btnAddPlayer.addEventListener('click', () => this.prepareCreateForm());
        }
        if (this.btnCancel) {
            this.btnCancel.addEventListener('click', () => this.resetEditor());
        }
        if (this.btnDelete) {
            this.btnDelete.addEventListener('click', () => this.deleteActivePlayer());
        }

        // Listener de checkboxes para poblar dinámicamente la posición favorita
        this.checkboxesPos.forEach(cb => {
            cb.addEventListener('change', () => this.updatePrimaryPositionSelect());
        });

        // Submit de Formulario
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePlayer();
        });
    }

    async detectRemoteMode() {
        if (!this.api.isEnabled()) return false;
        try {
            await this.api.health();
            return true;
        } catch (_) {
            return false;
        }
    }

    async loadActiveUser() {
        if (this.remoteMode) {
            try {
                const me = await this.api.me();
                this.currentUser = (me.username || 'guest').toLowerCase();
            } catch (_) {
                this.currentUser = 'guest';
            }
            return;
        }

        const session = await this.db.getActiveSession();
        this.currentUser = (session || 'guest').toLowerCase();
    }

    async loadRoster() {
        try {
            if (this.remoteMode && this.currentUser !== 'guest') {
                try {
                    const data = await this.api.getRoster();
                    this.playersList = Array.isArray(data.players) ? data.players : [];
                } catch (_) {
                    this.playersList = [];
                }
            } else {
                this.playersList = [];
            }
            this.notifyRosterChanged();
        } catch (err) {
            console.error('Error cargando plantilla de jugadores:', err);
            this.playersList = [];
        }
    }

    async saveRosterToDB() {
        try {
            if (this.remoteMode && this.currentUser !== 'guest') {
                try {
                    const result = await this.api.saveRoster(this.playersList);
                    this.playersList = Array.isArray(result.players) ? result.players : this.playersList;
                } catch (err) {
                    alert(`No se pudo guardar la plantilla en el servidor: ${err.message}`);
                    return;
                }
            } else {
                alert('Inicia sesion y asegurese de que el servidor este disponible para guardar plantilla.');
                return;
            }
            this.notifyRosterChanged();
        } catch (err) {
            console.error('Error guardando plantilla de jugadores:', err);
        }
    }

    async loadLocalRoster(user) {
        if (typeof this.db.getRosterByUser === 'function') {
            return await this.db.getRosterByUser(user);
        }

        const legacy = await this.db.getMeta(`players_roster_${(user || 'guest').toLowerCase()}`);
        return Array.isArray(legacy) ? legacy : [];
    }

    async saveLocalRoster(user, players) {
        if (typeof this.db.saveRosterByUser === 'function') {
            await this.db.saveRosterByUser(user, players);
            return;
        }

        await this.db.setMeta(`players_roster_${(user || 'guest').toLowerCase()}`, players);
    }

    notifyRosterChanged() {
        window.dispatchEvent(new CustomEvent('roster-changed', { detail: this.playersList }));
    }

    openModal() {
        this.modal.style.display = 'flex';
        this.resetEditor();
        this.renderPlayersList();
    }

    closeModal() {
        this.modal.style.display = 'none';
    }

    renderPlayersList() {
        this.playersListContainer.innerHTML = '';
        
        if (this.playersList.length === 0) {
            this.playersListContainer.innerHTML = `
                <div class="empty-state">No hay jugadores registrados. Haz clic en '+ Nuevo Jugador' para comenzar.</div>
            `;
            return;
        }

        // Ordenar alfabéticamente
        const sortedList = [...this.playersList].sort((a, b) => a.name.localeCompare(b.name));

        sortedList.forEach(player => {
            const item = document.createElement('div');
            item.className = `roster-player-item ${this.activePlayerId === player.id ? 'active' : ''}`;
            item.dataset.id = player.id;

            const info = document.createElement('div');
            info.className = 'roster-player-info';

            const numBadge = document.createElement('div');
            numBadge.className = 'roster-player-number-badge';
            numBadge.textContent = player.number;

            const nameEl = document.createElement('div');
            nameEl.className = 'roster-player-name-text';
            nameEl.textContent = player.name;

            info.appendChild(numBadge);
            info.appendChild(nameEl);

            const posContainer = document.createElement('div');
            posContainer.className = 'roster-player-positions';

            // Agregar badges de posiciones
            player.positions.forEach(pos => {
                const badge = document.createElement('span');
                const isFavorite = pos === player.primaryPosition;
                badge.className = `roster-pos-badge badge-${pos.toLowerCase()} ${isFavorite ? 'favorite' : ''}`;
                badge.textContent = pos;
                posContainer.appendChild(badge);
            });

            item.appendChild(info);
            item.appendChild(posContainer);

            item.addEventListener('click', () => this.selectPlayerForEdit(player.id));
            this.playersListContainer.appendChild(item);
        });
    }

    selectPlayerForEdit(id) {
        this.activePlayerId = id;
        const player = this.playersList.find(p => p.id === id);
        if (!player) return;

        this.editorEmptyState.style.display = 'none';
        this.editorPanel.style.display = 'flex';
        this.editorTitle.textContent = 'Editar Datos de Jugador';
        this.btnDelete.style.display = 'block';

        this.inputId.value = player.id;
        this.inputName.value = player.name;
        this.inputNumber.value = player.number;

        // Resetear y re-chequear posiciones
        this.checkboxesPos.forEach(cb => {
            cb.checked = player.positions.includes(cb.value);
        });

        // Actualizar select de primaria y forzar selección
        this.updatePrimaryPositionSelect();
        this.selectPrimaryPos.value = player.primaryPosition;

        // Refrescar el active de la lista
        const items = this.playersListContainer.querySelectorAll('.roster-player-item');
        items.forEach(item => {
            if (item.dataset.id === id) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    prepareCreateForm() {
        this.activePlayerId = null;
        this.editorEmptyState.style.display = 'none';
        this.editorPanel.style.display = 'flex';
        this.editorTitle.textContent = 'Registrar Jugador';
        this.btnDelete.style.display = 'none';

        this.form.reset();
        this.inputId.value = '';
        
        // Quitar actives en la lista visual
        const items = this.playersListContainer.querySelectorAll('.roster-player-item');
        items.forEach(item => item.classList.remove('active'));

        this.updatePrimaryPositionSelect();
    }

    resetEditor() {
        this.activePlayerId = null;
        this.editorEmptyState.style.display = 'flex';
        this.editorPanel.style.display = 'none';
        this.form.reset();
        this.inputId.value = '';
        
        const items = this.playersListContainer.querySelectorAll('.roster-player-item');
        items.forEach(item => item.classList.remove('active'));
    }

    updatePrimaryPositionSelect() {
        const checkedPositions = [];
        this.checkboxesPos.forEach(cb => {
            if (cb.checked) checkedPositions.push(cb.value);
        });

        const prevSelected = this.selectPrimaryPos.value;
        this.selectPrimaryPos.innerHTML = '';

        if (checkedPositions.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Selecciona primero las posiciones...';
            opt.disabled = true;
            opt.selected = true;
            this.selectPrimaryPos.appendChild(opt);
            this.selectPrimaryPos.disabled = true;
            return;
        }

        this.selectPrimaryPos.disabled = false;
        
        const rolesMap = { A: 'Armador (Setter)', P: 'Punta (Outside)', C: 'Central (Middle)', O: 'Opuesto (Opposite)', L: 'Líbero (Libero)' };
        
        checkedPositions.forEach(pos => {
            const opt = document.createElement('option');
            opt.value = pos;
            opt.textContent = rolesMap[pos] || pos;
            this.selectPrimaryPos.appendChild(opt);
        });

        // Intentar mantener selección anterior si sigue estando habilitada
        if (checkedPositions.includes(prevSelected)) {
            this.selectPrimaryPos.value = prevSelected;
        } else {
            this.selectPrimaryPos.selectedIndex = 0;
        }
    }

    async savePlayer() {
        const id = this.inputId.value;
        const name = this.inputName.value.trim();
        const number = parseInt(this.inputNumber.value) || 1;
        
        const positions = [];
        this.checkboxesPos.forEach(cb => {
            if (cb.checked) positions.push(cb.value);
        });

        if (positions.length === 0) {
            alert('Por favor selecciona al menos una posición en la que juega.');
            return;
        }

        const primaryPosition = this.selectPrimaryPos.value;
        if (!primaryPosition) {
            alert('Por favor selecciona una posición principal/favorita.');
            return;
        }

        if (id) {
            // Modo Edición
            const index = this.playersList.findIndex(p => p.id === id);
            if (index !== -1) {
                this.playersList[index] = { id, name, number, positions, primaryPosition };
            }
        } else {
            // Modo Creación
            const newPlayer = {
                id: 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                name,
                number,
                positions,
                primaryPosition
            };
            this.playersList.push(newPlayer);
        }

        await this.saveRosterToDB();
        this.renderPlayersList();
        this.resetEditor();
    }

    async deleteActivePlayer() {
        if (!this.activePlayerId) return;
        const player = this.playersList.find(p => p.id === this.activePlayerId);
        if (!player) return;

        if (confirm(`¿Estás seguro de que deseas eliminar a ${player.name} de tu plantilla?`)) {
            this.playersList = this.playersList.filter(p => p.id !== this.activePlayerId);
            await this.saveRosterToDB();
            this.renderPlayersList();
            this.resetEditor();
        }
    }

    /**
     * Métodos públicos para consulta táctica externa
     */
    getAllPlayers() {
        return this.playersList;
    }

    getPlayersByPosition(pos) {
        if (!pos || pos === 'ALL') return this.playersList;
        return this.playersList.filter(p => p.positions.includes(pos));
    }
}
