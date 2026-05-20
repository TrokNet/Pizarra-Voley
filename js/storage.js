/**
 * VOLEYTACTICS - STORAGE & EXPORT MODULE (js/storage.js)
 * Maneja el almacenamiento en LocalStorage, la exportación/importación JSON y la conversión de SVG a imagen PNG.
 */

export class StorageManager {
    constructor(timelineManager) {
        this.tm = timelineManager;
        
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
        const activeUser = localStorage.getItem('voley_tactics_active_session');
        this.currentUser = activeUser || 'guest';
        this.storageKey = 'voley_tactics_saved_plays_' + this.currentUser;
        
        this.init();
    }

    init() {
        this.renderSavedPlaysList();

        // Escuchar cambios de sesión para reconfigurar el almacenamiento de jugadas
        window.addEventListener('session-changed', (e) => {
            const { type, user } = e.detail;
            this.currentUser = user || 'guest';
            this.storageKey = 'voley_tactics_saved_plays_' + this.currentUser;
            
            if (type === 'logout') {
                this.createNewPlay();
            } else {
                this.currentPlayName = '';
                this.activePlayNameText.textContent = 'Jugada Nueva';
                this.renderSavedPlaysList();
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
        this.btnSaveConfirm.addEventListener('click', () => {
            const name = this.inputSaveName.value.trim();
            if (name) {
                this.savePlay(name);
                hideSaveModal();
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
     * Guarda la jugada actual en LocalStorage
     */
    savePlay(name) {
        this.currentPlayName = name;
        this.activePlayNameText.textContent = name;
        
        const playData = {
            name: name,
            date: new Date().toLocaleString(),
            frames: this.tm.serializeTimeline()
        };

        let savedPlays = this.getSavedPlays();
        
        // Si ya existe una jugada con este nombre, reemplazarla. Si no, agregarla.
        const existingIdx = savedPlays.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
        if (existingIdx !== -1) {
            savedPlays[existingIdx] = playData;
        } else {
            savedPlays.push(playData);
        }

        localStorage.setItem(this.storageKey, JSON.stringify(savedPlays));
        this.renderSavedPlaysList();
        this.updateSaveStatus('Guardado en LocalStorage');
    }

    /**
     * Obtiene el listado de jugadas guardadas en LocalStorage
     */
    getSavedPlays() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : [];
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
    renderSavedPlaysList() {
        const plays = this.getSavedPlays();
        this.savedPlaysList.innerHTML = '';

        if (plays.length === 0) {
            this.savedPlaysList.innerHTML = '<div class="empty-state">No hay jugadas guardadas localmente.</div>';
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
            
            btnDel.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`¿Estás seguro de que quieres borrar la jugada "${play.name}"?`)) {
                    this.deletePlay(play.name);
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
     * Borra una jugada de LocalStorage
     */
    deletePlay(name) {
        let savedPlays = this.getSavedPlays();
        savedPlays = savedPlays.filter(p => p.name !== name);
        localStorage.setItem(this.storageKey, JSON.stringify(savedPlays));
        
        if (this.currentPlayName === name) {
            this.createNewPlay();
        } else {
            this.renderSavedPlaysList();
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
