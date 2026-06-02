/**
 * VOLEYTACTICS - TIMELINE MODULE (js/timeline.js)
 * Maneja la secuencia de pasos de la jugada, guardando estados de jugadores y dibujos, e implementa la animación.
 */

export class TimelineManager {
    constructor(playerManager, drawingManager) {
        this.pm = playerManager;
        this.dm = drawingManager;
        
        // DOM Elements
        this.framesTrack = document.getElementById('frames-track');
        this.btnAddFrame = document.getElementById('btn-add-frame');
        this.btnDeleteFrame = document.getElementById('btn-delete-frame');
        
        this.btnPrev = document.getElementById('anim-btn-prev');
        this.btnPlay = document.getElementById('anim-btn-play');
        this.btnNext = document.getElementById('anim-btn-next');
        
        this.iconPlay = document.getElementById('icon-play');
        this.iconPause = document.getElementById('icon-pause');
        
        this.speedSelect = document.getElementById('select-play-speed');

        // Controles flotantes de reproducción (NUEVO)
        this.floatBtnPlay = document.getElementById('float-btn-play');
        this.floatIconPlay = document.getElementById('float-icon-play');
        this.floatIconPause = document.getElementById('float-icon-pause');
        
        // Estado de la línea de tiempo
        this.frames = [];
        this.currentFrameIndex = 0;
        this.isPlaying = false;
        this.playInterval = null;
        
        this.init();
    }

    init() {
        // Inicializar con el primer fotograma (Estado Inicial)
        this.resetTimeline();
        
        // Listeners de la timeline
        this.btnAddFrame.addEventListener('click', () => this.addFrame());
        this.btnDeleteFrame.addEventListener('click', () => this.deleteCurrentFrame());
        
        // Listeners de reproducción
        this.btnPrev.addEventListener('click', () => this.goToPrevFrame());
        this.btnNext.addEventListener('click', () => this.goToNextFrame());
        this.btnPlay.addEventListener('click', () => this.togglePlayback());
        
        // Si el usuario mueve un jugador, guardar el estado en el frame activo
        window.addEventListener('player-moved-finished', () => {
            this.saveCurrentStateToFrame();
        });
        
        // Si el usuario dibuja o borra algo, guardar el estado en el frame activo
        window.addEventListener('drawings-changed', () => {
            this.saveCurrentStateToFrame();
        });

        // Si el usuario edita un jugador (nombre, número, rol), guardar el estado en el frame activo
        window.addEventListener('player-updated', () => {
            this.saveCurrentStateToFrame();
        });

        // Vincular select de velocidad a la variable de animación CSS
        this.speedSelect.addEventListener('change', () => this.updateCSSAnimationSpeed());
        this.updateCSSAnimationSpeed(); // inicializar

        // Vincular clic del botón flotante
        if (this.floatBtnPlay) {
            this.floatBtnPlay.addEventListener('click', () => this.togglePlayback());
        }
    }

    /**
     * Reinicia toda la línea de tiempo a un solo fotograma inicial
     */
    resetTimeline() {
        this.frames = [];
        this.currentFrameIndex = 0;
        
        // Obtener el estado actual de los jugadores (que ya se inicializó)
        const initialPlayers = this.pm.players.map(p => ({
            id: p.id,
            x: p.x,
            y: p.y,
            role: p.role,
            number: p.number,
            name: p.name,
            zone: p.zone
        }));

        this.frames.push({
            label: 'Paso 1 (Inicio)',
            players: initialPlayers,
            drawings: []
        });

        this.renderTimeline();
    }

    /**
     * Captura el estado actual del lienzo (jugadores y dibujos) y lo guarda en el frame actual
     */
    saveCurrentStateToFrame() {
        if (this.frames.length === 0) return;
        
        const frame = this.frames[this.currentFrameIndex];
        
        // Guardar posiciones
        frame.players = this.pm.players.map(p => ({
            id: p.id,
            x: p.x,
            y: p.y,
            role: p.role,
            number: p.number,
            name: p.name,
            zone: p.zone,
            rosterPlayerId: p.rosterPlayerId || null
        }));

        // Guardar dibujos
        frame.drawings = this.dm.serializeDrawings();
    }

    /**
     * Agrega un nuevo fotograma a la secuencia heredando el estado del fotograma actual
     */
    addFrame() {
        // Asegurar que el estado actual esté guardado
        this.saveCurrentStateToFrame();
        
        const currentFrame = this.frames[this.currentFrameIndex];
        
        // Copiar el estado de los jugadores del frame actual para empezar desde ahí
        const copiedPlayers = JSON.parse(JSON.stringify(currentFrame.players));
        
        // Crear nuevo frame
        const nextIndex = this.frames.length + 1;
        const newFrame = {
            label: `Paso ${nextIndex}`,
            players: copiedPlayers,
            drawings: [] // Inicia con dibujos limpios para indicar las nuevas acciones del paso
        };
        
        this.frames.push(newFrame);
        this.currentFrameIndex = this.frames.length - 1;
        
        // Renderizar y cargar el nuevo frame
        this.renderTimeline();
        this.loadFrame(this.currentFrameIndex, false); // No requiere animar al crearlo
    }

    /**
     * Elimina el fotograma actualmente seleccionado
     */
    deleteCurrentFrame() {
        // No permitir borrar si solo queda un frame
        if (this.frames.length <= 1) return;

        this.frames.splice(this.currentFrameIndex, 1);
        
        // Corregir etiquetas de pasos siguientes
        this.frames.forEach((frame, idx) => {
            if (frame.label.startsWith('Paso')) {
                frame.label = idx === 0 ? 'Paso 1 (Inicio)' : `Paso ${idx + 1}`;
            }
        });
        
        // Ajustar índice activo
        if (this.currentFrameIndex >= this.frames.length) {
            this.currentFrameIndex = this.frames.length - 1;
        }

        this.renderTimeline();
        this.loadFrame(this.currentFrameIndex, true); // Animar hacia el frame resultante
    }

    /**
     * Carga el estado de un fotograma en la cancha
     * @param {number} index - Índice del fotograma a cargar
     * @param {boolean} animate - Si los jugadores deben moverse fluidamente
     */
    loadFrame(index, animate = true) {
        if (index < 0 || index >= this.frames.length) return;
        
        this.currentFrameIndex = index;
        const frame = this.frames[this.currentFrameIndex];

        // Mover jugadores a las coordenadas del frame y restaurar metadatos (nombre, número, rol y vinculación)
        frame.players.forEach(pData => {
            this.pm.movePlayerTo(pData.id, pData.x, pData.y, animate);
            if (pData.id !== 'ball') {
                this.pm.updatePlayerMetadata(pData.id, pData.name, pData.number, pData.role, pData.rosterPlayerId);
            }
        });

        // Cargar los dibujos de este frame
        this.dm.deserializeDrawings(frame.drawings);

        // Actualizar visual de la timeline
        const nodes = this.framesTrack.querySelectorAll('.frame-node');
        nodes.forEach((node, idx) => {
            if (idx === index) {
                node.classList.add('active');
                // Auto-scroll del nodo activo
                node.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            } else {
                node.classList.remove('active');
            }
        });

        // Activar/desactivar botón de borrar
        this.btnDeleteFrame.disabled = this.frames.length <= 1;
    }

    /**
     * Avanza al siguiente fotograma
     */
    goToNextFrame() {
        this.saveCurrentStateToFrame();
        if (this.currentFrameIndex < this.frames.length - 1) {
            this.loadFrame(this.currentFrameIndex + 1, true);
        } else if (this.isPlaying) {
            // Si está reproduciendo y llega al final, volver al inicio o parar
            this.loadFrame(0, true);
        }
    }

    /**
     * Retrocede al fotograma anterior
     */
    goToPrevFrame() {
        this.saveCurrentStateToFrame();
        if (this.currentFrameIndex > 0) {
            this.loadFrame(this.currentFrameIndex - 1, true);
        }
    }

    /**
     * Genera la lista visual de nodos de fotogramas en el panel inferior
     */
    renderTimeline() {
        this.framesTrack.innerHTML = '';
        
        this.frames.forEach((frame, idx) => {
            const node = document.createElement('div');
            node.className = `frame-node ${idx === this.currentFrameIndex ? 'active' : ''}`;
            node.dataset.index = idx;

            const thumb = document.createElement('div');
            thumb.className = 'frame-thumb-voley';
            thumb.textContent = `Paso ${idx + 1}`;

            const label = document.createElement('span');
            label.className = 'frame-label';
            label.textContent = idx === 0 ? 'Inicio' : 'Táctica';

            node.appendChild(thumb);
            node.appendChild(label);

            // Clic para saltar al fotograma
            node.addEventListener('click', () => {
                if (this.isPlaying) this.stopPlayback();
                this.saveCurrentStateToFrame();
                this.loadFrame(idx, true);
            });

            this.framesTrack.appendChild(node);
        });

        this.btnDeleteFrame.disabled = this.frames.length <= 1;
    }

    /**
     * Alterna la reproducción automática de la jugada
     */
    togglePlayback() {
        if (this.isPlaying) {
            this.stopPlayback();
        } else {
            this.startPlayback();
        }
    }

    /**
     * Inicia el bucle de animación
     */
    startPlayback() {
        this.saveCurrentStateToFrame();
        this.isPlaying = true;
        
        // Actualizar iconos estándar y texto
        this.iconPlay.style.display = 'none';
        this.iconPause.style.display = 'block';
        this.btnPlay.classList.add('btn-primary');
        const playLabel = document.getElementById('play-btn-label');
        if (playLabel) playLabel.textContent = 'Pausar';

        // Actualizar iconos flotantes
        if (this.floatIconPlay && this.floatIconPause) {
            this.floatIconPlay.style.display = 'none';
            this.floatIconPause.style.display = 'block';
            this.floatBtnPlay.classList.add('btn-primary');
        }
 
        const speed = parseInt(this.speedSelect.value) || 1000;
 
        // Bucle de reproducción
        this.playInterval = setInterval(() => {
            this.goToNextFrame();
        }, speed);
    }

    /**
     * Detiene el bucle de animación
     */
    stopPlayback() {
        this.isPlaying = false;
        
        // Actualizar iconos estándar y texto
        this.iconPause.style.display = 'none';
        this.iconPlay.style.display = 'block';
        this.btnPlay.classList.remove('btn-primary');
        const playLabel = document.getElementById('play-btn-label');
        if (playLabel) playLabel.textContent = 'Reproducir';

        // Actualizar iconos flotantes
        if (this.floatIconPlay && this.floatIconPause) {
            this.floatIconPause.style.display = 'none';
            this.floatIconPlay.style.display = 'block';
            this.floatBtnPlay.classList.remove('btn-primary');
        }
 
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
    }

    /**
     * Serializa toda la línea de tiempo (para guardar)
     */
    serializeTimeline() {
        this.saveCurrentStateToFrame();
        return this.frames;
    }

    /**
     * Carga una línea de tiempo completa desde datos guardados (LocalStorage o JSON)
     */
    deserializeTimeline(framesData) {
        if (this.isPlaying) this.stopPlayback();
        
        if (!framesData || !Array.isArray(framesData) || framesData.length === 0) {
            this.resetTimeline();
            return;
        }

        this.frames = JSON.parse(JSON.stringify(framesData));
        this.currentFrameIndex = 0;
        this.renderTimeline();
        this.loadFrame(0, false); // Carga el primer frame sin animación
    }

    /**
     * Sincroniza la duración de la animación de los tokens CSS con la velocidad del playback
     */
    updateCSSAnimationSpeed() {
        const speed = parseInt(this.speedSelect.value) || 1000;
        document.documentElement.style.setProperty('--anim-duration', `${speed}ms`);
    }
}
