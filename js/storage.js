/**
 * VOLEYTACTICS - STORAGE & EXPORT MODULE (js/storage.js)
 * Maneja el almacenamiento en IndexedDB, la exportación/importación JSON y la conversión de SVG a imagen PNG.
 */

import { LocalDatabase } from './localdb.js?v=20260624-001';
import { ServerApi } from './api.js?v=20260624-001';

export class StorageManager {
    constructor(timelineManager) {
        this.tm = timelineManager;
        this.db = LocalDatabase.getInstance();
        this.api = ServerApi.getInstance();
        this.remoteMode = false;
        
        // Buttons
        this.btnSave = document.getElementById('btn-save-play');
        this.btnExportPng = document.getElementById('btn-export-png');
        this.btnNew = document.getElementById('btn-new-play');
        this.btnImportJson = document.getElementById('btn-import-json');
        this.btnExportJson = document.getElementById('btn-export-json');
        this.fileInputJson = document.getElementById('file-input-json');
        
        // Modals
        this.modalSave = document.getElementById('modal-save');
        this.inputSaveName = document.getElementById('input-save-name');
        this.btnSaveCancel = document.getElementById('btn-save-cancel');
        this.btnSaveConfirm = document.getElementById('btn-save-confirm');
        this.btnSaveClose = document.getElementById('btn-close-save');
        
        this.savedPlaysList = document.getElementById('saved-plays-list');
        this.activePlayNameText = document.getElementById('active-play-name');
        this.saveStatusText = document.getElementById('save-status');
        
        // Estado
        this.currentPlayName = '';
        this.currentUser = 'guest';
        
        this.init();
    }

    async init() {
        await this.db.init();
        this.remoteMode = await this.detectRemoteMode();

        if (this.remoteMode) {
            try {
                const me = await this.api.me();
                this.currentUser = me.username || 'guest';
            } catch (_) {
                this.currentUser = 'guest';
            }
        } else {
            const activeUser = await this.db.getActiveSession();
            this.currentUser = activeUser || 'guest';
        }

        await this.renderSavedPlaysList();
        await this.loadLastSavedPlay();

        // Escuchar cambios de sesión para reconfigurar el almacenamiento de jugadas
        window.addEventListener('session-changed', async (e) => {
            const { type, user } = e.detail;
            this.currentUser = user || 'guest';
            
            if (type === 'logout') {
                this.createNewPlay();
            } else {
                this.currentPlayName = '';
                this.activePlayNameText.textContent = 'Jugada Nueva';
                await this.renderSavedPlaysList();
                await this.loadLastSavedPlay();
            }
        });
        
        // Abrir modal de guardar
        this.btnSave.addEventListener('click', () => {
            this.inputSaveName.value = this.currentPlayName || 'Jugada ' + new Date().toLocaleDateString();
            this.modalSave.style.display = 'flex';
        });

        // Cancelar guardar
        const hideSaveModal = () => this.modalSave.style.display = 'none';
        this.btnSaveCancel.addEventListener('click', hideSaveModal);
        this.btnSaveClose.addEventListener('click', hideSaveModal);
        
        // Confirmar guardar
        this.btnSaveConfirm.addEventListener('click', async () => {
            const name = this.inputSaveName.value.trim();
            if (name) {
                const saved = await this.savePlay(name);
                if (saved) {
                    hideSaveModal();
                }
            }
        });

        // Nueva jugada
        this.btnNew.addEventListener('click', () => {
            if (confirm('¿Estás seguro de que quieres crear una jugada nueva en blanco? Se perderán los cambios no guardados.')) {
                this.createNewPlay();
            }
        });

        // Exportar e Importar JSON
        this.btnExportJson.addEventListener('click', () => this.exportToJson());
        this.btnImportJson.addEventListener('click', () => this.fileInputJson.click());
        this.fileInputJson.addEventListener('change', (e) => this.importFromJson(e));

        // Exportar a PNG
        this.btnExportPng.addEventListener('click', () => this.exportToPng());
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

    /**
     * Crea una jugada limpia y resetea la pizarra
     */
    createNewPlay() {
        this.currentPlayName = '';
        this.activePlayNameText.textContent = 'Jugada Nueva';
        this.tm.resetTimeline();
        this.updateSaveStatus('Pizarra restablecida');
    }

    /**
     * Guarda la jugada actual en IndexedDB
     */
    async savePlay(name) {
        const normalizedNewName = name.trim().toLowerCase();
        const normalizedCurrentName = (this.currentPlayName || '').trim().toLowerCase();
        const isRenamingCurrentPlay = normalizedCurrentName && normalizedCurrentName === normalizedNewName;

        if (!isRenamingCurrentPlay && !this.remoteMode) {
            const existingPlay = await this.db.getPlayByName(this.currentUser, name);
            if (existingPlay) {
                alert('Ya existe una jugada con ese nombre. Selecciona otro nombre para no sobrescribir.');
                this.updateSaveStatus('Nombre duplicado: elige otro');
                return false;
            }
        }

        this.currentPlayName = name;
        this.activePlayNameText.textContent = name;
        
        const playData = {
            name: name,
            date: new Date().toLocaleString(),
            frames: this.tm.serializeTimeline()
        };

        if (this.remoteMode) {
            if (this.currentUser === 'guest') {
                alert('Inicia sesion para guardar jugadas en la base de datos central.');
                this.updateSaveStatus('No se guardo: usuario invitado');
                return false;
            }

            try {
                await this.api.savePlay(playData);
            } catch (err) {
                alert(`No se pudo guardar en el servidor: ${err.message}`);
                this.updateSaveStatus('Error al guardar en servidor');
                return false;
            }
        } else {
            alert('Servidor no disponible. No se guardan jugadas fuera de la base de datos central.');
            this.updateSaveStatus('Servidor no disponible');
            return false;
        }

        await this.renderSavedPlaysList();
        this.updateSaveStatus('Guardado en servidor central');
        return true;
    }

    async loadLastSavedPlay() {
        let lastPlay = null;

        if (this.remoteMode && this.currentUser !== 'guest') {
            try {
                const plays = await this.api.getPlays();
                lastPlay = Array.isArray(plays) && plays.length > 0 ? plays[0] : null;
            } catch (_) {
                lastPlay = null;
            }
        }

        if (!lastPlay) {
            this.createNewPlay();
            if (!this.remoteMode) {
                this.updateSaveStatus('Servidor no disponible');
            }
            return;
        }

        this.loadPlay(lastPlay);
        this.updateSaveStatus('Se cargó la última jugada guardada');
    }

    /**
     * Obtiene el listado de jugadas guardadas en IndexedDB
     */
    async getSavedPlays() {
        if (this.remoteMode && this.currentUser !== 'guest') {
            try {
                return await this.api.getPlays();
            } catch (_) {
                return [];
            }
        }
        return [];
    }

    /**
     * Actualiza el indicador visual del estado de guardado
     */
    updateSaveStatus(status) {
        this.saveStatusText.textContent = status;
        this.saveStatusText.style.opacity = '1';
        setTimeout(() => {
            this.saveStatusText.style.opacity = '0.7';
        }, 2000);
    }

    /**
     * Renderiza la lista lateral de jugadas guardadas
     */
    async renderSavedPlaysList() {
        const plays = await this.getSavedPlays();
        this.savedPlaysList.innerHTML = '';

        if (plays.length === 0) {
            this.savedPlaysList.innerHTML = '<div class="empty-state">No hay jugadas guardadas en el servidor.</div>';
            return;
        }

        plays.forEach(play => {
            const item = document.createElement('div');
            item.className = 'play-list-item';
            if (play.name === this.currentPlayName) item.classList.add('active');

            const info = document.createElement('div');
            info.className = 'play-item-info';
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'play-item-name';
            nameSpan.textContent = play.name;
            
            const dateSpan = document.createElement('span');
            dateSpan.className = 'play-item-date';
            dateSpan.textContent = play.date;

            info.appendChild(nameSpan);
            info.appendChild(dateSpan);

            // Clic para cargar
            info.addEventListener('click', () => {
                this.loadPlay(play);
            });

            // Botón eliminar
            const btnDel = document.createElement('button');
            btnDel.className = 'play-item-delete';
            btnDel.title = 'Eliminar jugada';
            btnDel.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
            
            btnDel.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`¿Estás seguro de que quieres borrar la jugada "${play.name}"?`)) {
                    await this.deletePlay(play.name);
                }
            });

            item.appendChild(info);
            item.appendChild(btnDel);
            this.savedPlaysList.appendChild(item);
        });
    }

    /**
     * Carga una jugada seleccionada en la pizarra
     */
    loadPlay(play) {
        this.currentPlayName = play.name;
        this.activePlayNameText.textContent = play.name;
        this.tm.deserializeTimeline(play.frames);
        this.renderSavedPlaysList();
        this.updateSaveStatus('Jugada cargada con éxito');
    }

    /**
     * Borra una jugada de IndexedDB
     */
    async deletePlay(name) {
        if (!this.remoteMode) {
            alert('Servidor no disponible. No se pueden eliminar jugadas fuera de la base de datos central.');
            this.updateSaveStatus('Servidor no disponible');
            return;
        }

        if (this.currentUser === 'guest') {
            alert('Inicia sesion para eliminar jugadas de la base de datos central.');
            this.updateSaveStatus('No autorizado para eliminar');
            return;
        }

        try {
            await this.api.deletePlay(name);
        } catch (err) {
            alert(`No se pudo eliminar en el servidor: ${err.message}`);
            this.updateSaveStatus('Error al eliminar en servidor');
            return;
        }
        
        if (this.currentPlayName === name) {
            this.createNewPlay();
        } else {
            await this.renderSavedPlaysList();
        }
        
        this.updateSaveStatus('Jugada eliminada');
    }

    /**
     * Exporta la jugada completa a un archivo JSON local
     */
    exportToJson() {
        this.tm.saveCurrentStateToFrame();
        const data = {
            app: 'VoleyTactics',
            version: '1.0',
            name: this.currentPlayName || 'Jugada Sin Nombre',
            date: new Date().toLocaleString(),
            frames: this.tm.serializeTimeline()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_voleytactics.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.updateSaveStatus('Exportado a JSON');
    }

    /**
     * Importa una jugada desde un archivo JSON
     */
    importFromJson(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = JSON.parse(evt.target.result);
                if (data.app !== 'VoleyTactics' || !data.frames) {
                    alert('El archivo no tiene el formato oficial de VoleyTactics.');
                    return;
                }
                
                this.currentPlayName = data.name;
                this.activePlayNameText.textContent = data.name;
                this.tm.deserializeTimeline(data.frames);
                this.renderSavedPlaysList();
                this.updateSaveStatus('Importado con éxito');
            } catch (err) {
                alert('Error al leer el archivo JSON.');
            }
        };
        reader.readAsText(file);
        
        // Reset del input para poder subir el mismo archivo después
        e.target.value = '';
    }

    /**
     * Convierte la pizarra interactiva SVG a una imagen PNG y la descarga
     */
    exportToPng() {
        this.updateSaveStatus('Procesando imagen PNG...');
        
        const courtSvg = document.getElementById('volleyball-court');
        const width = 1000;
        const height = 600;

        // 1. Clonar el SVG para no modificar la pizarra real
        const svgClone = courtSvg.cloneNode(true);
        svgClone.setAttribute('width', width);
        svgClone.setAttribute('height', height);

        // 2. Extraer todos los estilos CSS del documento e inyectarlos dentro del clon
        // Esto asegura que la imagen renderizada en canvas conserve colores, neones y bordes correctos
        const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        let cssText = '';
        for (const sheet of document.styleSheets) {
            try {
                for (const rule of sheet.cssRules) {
                    cssText += rule.cssText + '\n';
                }
            } catch (err) {
                // Capturar restricciones cross-origin si existieran
            }
        }
        styleEl.textContent = cssText;
        svgClone.insertBefore(styleEl, svgClone.firstChild);

        // 3. Convertir el SVG clonado a string y serializarlo
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgClone);
        
        // 4. Crear un objeto Image de HTML5 en memoria y cargar el SVG serializado
        const img = new Image();
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        
        img.onload = () => {
            // 5. Dibujar en un Canvas de alta resolución
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            // Renderizar fondo sólido de apoyo para el PNG transparente
            ctx.fillStyle = '#0a0d14';
            ctx.fillRect(0, 0, width, height);

            ctx.drawImage(img, 0, 0);
            
            // 6. Generar descarga del archivo PNG
            const pngUrl = canvas.toDataURL('image/png');
            
            const a = document.createElement('a');
            a.href = pngUrl;
            a.download = `${(this.currentPlayName || 'pizarra_tactica').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            this.updateSaveStatus('Imagen PNG descargada');
        };

        img.onerror = () => {
            alert('Error al procesar el vector SVG para exportar a imagen.');
            URL.revokeObjectURL(url);
        };

        img.src = url;
    }
}
