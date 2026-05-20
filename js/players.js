/**
 * VOLEYTACTICS - PLAYERS MODULE (js/players.js)
 * Gestiona la creación de fichas de jugadores, arrastrar y soltar, edición de propiedades y rotaciones.
 */

export class PlayerManager {
    constructor() {
        this.courtSvg = document.getElementById('volleyball-court');
        this.playersGroup = document.getElementById('players-group');
        
        // Editor Panel Elements
        this.editorPlaceholder = document.getElementById('player-editor-placeholder');
        this.editorForm = document.getElementById('player-editor-form');
        this.editBadge = document.getElementById('edit-preview-badge');
        this.editName = document.getElementById('edit-preview-name');
        this.editRoleText = document.getElementById('edit-preview-role');
        this.inputNumber = document.getElementById('edit-player-number');
        this.inputRole = document.getElementById('edit-player-role');
        this.inputName = document.getElementById('edit-player-name');
        
        this.btnRotate = document.getElementById('btn-rotate-clockwise');
        
        this.players = [];
        this.selectedPlayer = null;
        
        // Dragging State
        this.draggedElement = null;
        this.dragOffset = { x: 0, y: 0 };
        this.isDragging = false;
        
        this.init();
    }

    init() {
        this.createInitialSetup();
        this.setupDragAndDrop();
        this.setupEditorListeners();
        
        this.btnRotate.addEventListener('click', () => {
            this.rotateTeamA();
        });
        
        // Deseleccionar al hacer clic en el fondo de la cancha
        this.courtSvg.addEventListener('mousedown', (e) => {
            if (e.target.id === 'court-background' || e.target.id === 'court-playable' || e.target.classList.contains('court-zone-out')) {
                this.selectPlayer(null);
            }
        });
    }

    /**
     * Define y crea los jugadores iniciales y el balón
     */
    createInitialSetup() {
        // Coordenadas iniciales para Campo Izquierdo (Equipo Azul - Local)
        // Posiciones oficiales 1 a 6
        const teamAConfigs = [
            { id: 'A1', team: 'blue', role: 'A', number: 1, name: 'Armador', x: 220, y: 440, zone: 1 },
            { id: 'A6', team: 'blue', role: 'C', number: 6, name: 'Central 1', x: 200, y: 300, zone: 6 },
            { id: 'A5', team: 'blue', role: 'P', number: 5, name: 'Punta 1', x: 220, y: 160, zone: 5 },
            { id: 'A4', team: 'blue', role: 'P', number: 4, name: 'Punta 2', x: 420, y: 160, zone: 4 },
            { id: 'A3', team: 'blue', role: 'C', number: 3, name: 'Central 2', x: 440, y: 300, zone: 3 },
            { id: 'A2', team: 'blue', role: 'O', number: 2, name: 'Opuesto', x: 420, y: 440, zone: 2 }
        ];

        // Coordenadas iniciales para Campo Derecho (Equipo Rojo - Rivales)
        const teamBConfigs = [
            { id: 'B1', team: 'red', role: 'P', number: 1, name: 'Rival 1', x: 780, y: 160, zone: 1 },
            { id: 'B6', team: 'red', role: 'C', number: 6, name: 'Rival Central', x: 800, y: 300, zone: 6 },
            { id: 'B5', team: 'red', role: 'A', number: 5, name: 'Rival Armador', x: 780, y: 440, zone: 5 },
            { id: 'B4', team: 'red', role: 'O', number: 4, name: 'Rival Opuesto', x: 580, y: 440, zone: 4 },
            { id: 'B3', team: 'red', role: 'C', number: 3, name: 'Rival Central 2', x: 560, y: 300, zone: 3 },
            { id: 'B2', team: 'red', role: 'P', number: 2, name: 'Rival Punta', x: 580, y: 160, zone: 2 }
        ];

        // Crear Fichas
        teamAConfigs.forEach(cfg => this.createPlayerToken(cfg));
        teamBConfigs.forEach(cfg => this.createPlayerToken(cfg));

        // Crear Balón Especial
        this.createPlayerToken({
            id: 'ball',
            team: 'neutral',
            role: 'B',
            number: '',
            name: 'Balón',
            x: 500,
            y: 300,
            zone: 0
        });
    }

    /**
     * Crea un elemento SVG para el jugador y lo añade al DOM
     */
    createPlayerToken(cfg) {
        const isBall = cfg.id === 'ball';
        
        // Crear grupo contenedor del jugador
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('id', `token-${cfg.id}`);
        g.setAttribute('class', `player-token token-role-${cfg.role} team-${cfg.team}`);
        if (isBall) g.classList.add('token-ball');
        g.setAttribute('transform', `translate(${cfg.x}, ${cfg.y})`);
        g.dataset.id = cfg.id;

        // Círculo principal
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('class', 'player-token-circle');
        circle.setAttribute('cx', '0');
        circle.setAttribute('cy', '0');
        circle.setAttribute('r', isBall ? '15' : '24');
        g.appendChild(circle);

        if (!isBall) {
            // Texto del Rol (ej. A, P, C, O, L)
            const textRole = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textRole.setAttribute('class', 'player-token-text');
            textRole.setAttribute('y', '-2');
            textRole.textContent = cfg.role;
            g.appendChild(textRole);

            // Texto del Número (abajo)
            const textNum = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textNum.setAttribute('class', 'player-token-number');
            textNum.setAttribute('y', '12');
            textNum.textContent = cfg.number;
            g.appendChild(textNum);

            // Nombre del jugador (debajo del círculo)
            const textName = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textName.setAttribute('class', 'player-token-label');
            textName.setAttribute('y', '38');
            textName.textContent = cfg.name;
            g.appendChild(textName);
        } else {
            // Diseño del Balón (líneas de voley dentro del círculo)
            const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path1.setAttribute('d', 'M -12 -9 C -4 -12, 4 -12, 12 -9');
            path1.setAttribute('fill', 'none');
            path1.setAttribute('stroke', '#ffffff');
            path1.setAttribute('stroke-width', '1.5');
            g.appendChild(path1);

            const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path2.setAttribute('d', 'M -12 9 C -4 12, 4 12, 12 9');
            path2.setAttribute('fill', 'none');
            path2.setAttribute('stroke', '#ffffff');
            path2.setAttribute('stroke-width', '1.5');
            g.appendChild(path2);

            const path3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path3.setAttribute('d', 'M -15 0 L 15 0');
            path3.setAttribute('fill', 'none');
            path3.setAttribute('stroke', '#ffffff');
            path3.setAttribute('stroke-width', '1.5');
            g.appendChild(path3);
        }

        // Agregar al grupo contenedor de la cancha
        this.playersGroup.appendChild(g);

        // Guardar en la estructura de estado
        const playerObj = {
            id: cfg.id,
            team: cfg.team,
            role: cfg.role,
            number: cfg.number,
            name: cfg.name,
            x: cfg.x,
            y: cfg.y,
            zone: cfg.zone,
            element: g
        };
        this.players.push(playerObj);
    }

    /**
     * Transforma coordenadas de pantalla a coordenadas del espacio de trabajo SVG
     */
    getSVGCoords(e) {
        const pt = this.courtSvg.createSVGPoint();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        pt.x = clientX;
        pt.y = clientY;
        
        // Resuelve las coordenadas locales del SVG escalado
        const svgGlobalMatrix = this.courtSvg.getScreenCTM();
        if (svgGlobalMatrix) {
            return pt.matrixTransform(svgGlobalMatrix.inverse());
        }
        return { x: clientX, y: clientY };
    }

    /**
     * Implementa Drag and Drop interactivo tanto para mouse como para pantallas táctiles
     */
    setupDragAndDrop() {
        const startDrag = (e) => {
            // Verificar si hicimos clic en un token de jugador o balón
            const tokenElement = e.target.closest('.player-token');
            const toolActive = document.querySelector('.tool-btn.active').id;
            
            // Solo arrastrar si la herramienta activa es "Mover" (tool-select)
            if (tokenElement && toolActive === 'tool-select') {
                e.preventDefault();
                this.draggedElement = tokenElement;
                this.isDragging = true;
                
                const playerId = tokenElement.dataset.id;
                this.selectPlayer(playerId);
                
                const coords = this.getSVGCoords(e);
                const player = this.players.find(p => p.id === playerId);
                
                // Guardar la diferencia de coordenadas para evitar saltos al arrastrar
                this.dragOffset.x = coords.x - player.x;
                this.dragOffset.y = coords.y - player.y;
                
                // Mover al jugador arriba de todos en orden de renderizado
                this.playersGroup.appendChild(tokenElement);
            }
        };

        const doDrag = (e) => {
            if (this.isDragging && this.draggedElement) {
                e.preventDefault();
                const coords = this.getSVGCoords(e);
                const targetX = Math.max(20, Math.min(980, coords.x - this.dragOffset.x));
                const targetY = Math.max(20, Math.min(580, coords.y - this.dragOffset.y));
                
                // Actualizar visualmente la ficha
                this.draggedElement.setAttribute('transform', `translate(${targetX}, ${targetY})`);
                
                // Actualizar estado interno
                const player = this.players.find(p => p.id === this.draggedElement.dataset.id);
                if (player) {
                    player.x = targetX;
                    player.y = targetY;
                }
                
                // Despachar evento para avisar del movimiento (utilizado por el canvas de dibujo táctico)
                window.dispatchEvent(new CustomEvent('player-moving', { detail: { id: player.id, x: targetX, y: targetY } }));
            }
        };

        const stopDrag = () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.draggedElement = null;
                
                // Notificar cambios para que la timeline pueda registrar si se desea
                window.dispatchEvent(new CustomEvent('player-moved-finished'));
            }
        };

        // Desktop Mouse Events
        this.courtSvg.addEventListener('mousedown', startDrag);
        window.addEventListener('mousemove', doDrag);
        window.addEventListener('mouseup', stopDrag);

        // Mobile Touch Events
        this.courtSvg.addEventListener('touchstart', startDrag, { passive: false });
        window.addEventListener('touchmove', doDrag, { passive: false });
        window.addEventListener('touchend', stopDrag);
    }

    /**
     * Selecciona un jugador y muestra sus detalles en el editor lateral
     */
    selectPlayer(playerId) {
        // Quitar selección previa
        this.players.forEach(p => p.element.classList.remove('selected'));
        this.selectedPlayer = null;

        if (!playerId) {
            this.editorPlaceholder.style.display = 'flex';
            this.editorForm.style.display = 'none';
            return;
        }

        const player = this.players.find(p => p.id === playerId);
        if (!player) return;

        this.selectedPlayer = player;
        player.element.classList.add('selected');

        // Mostrar formulario
        this.editorPlaceholder.style.display = 'none';
        this.editorForm.style.display = 'flex';

        // Llenar datos
        if (player.id === 'ball') {
            this.editBadge.textContent = '⚽';
            this.editBadge.style.backgroundColor = 'var(--role-b)';
            this.editBadge.style.color = '#000000';
            this.editName.textContent = 'Balón de Voleibol';
            this.editRoleText.textContent = 'Objeto Táctico';
            
            // Deshabilitar campos no editables para el balón
            this.inputNumber.value = '';
            this.inputNumber.disabled = true;
            this.inputRole.value = 'B';
            this.inputRole.disabled = true;
            this.inputName.value = 'Balón';
            this.inputName.disabled = true;
        } else {
            this.editBadge.textContent = `${player.role}${player.number}`;
            this.editBadge.style.backgroundColor = `var(--role-${player.role.toLowerCase()})`;
            this.editBadge.style.color = player.role === 'L' ? '#000000' : '#ffffff';
            this.editName.textContent = player.name;
            
            const rolesMap = { A: 'Armador', P: 'Punta Receptor', C: 'Central', O: 'Opuesto', L: 'Líbero' };
            this.editRoleText.textContent = rolesMap[player.role] || 'Jugador';

            // Activar e inyectar valores en los inputs
            this.inputNumber.disabled = false;
            this.inputNumber.value = player.number;
            this.inputRole.disabled = false;
            this.inputRole.value = player.role;
            this.inputName.disabled = false;
            this.inputName.value = player.name;
        }
    }

    /**
     * Escucha cambios en los controles del editor y actualiza la ficha al instante
     */
    setupEditorListeners() {
        const updateCurrentSelected = () => {
            if (!this.selectedPlayer || this.selectedPlayer.id === 'ball') return;

            const oldRole = this.selectedPlayer.role;
            const newRole = this.inputRole.value;
            const newNum = parseInt(this.inputNumber.value) || 1;
            const newName = this.inputName.value.trim() || 'Jugador';

            // Actualizar estado
            this.selectedPlayer.role = newRole;
            this.selectedPlayer.number = newNum;
            this.selectedPlayer.name = newName;

            // Actualizar visualmente la ficha SVG
            const element = this.selectedPlayer.element;
            
            // Actualizar clases de rol
            element.classList.remove(`token-role-${oldRole}`);
            element.classList.add(`token-role-${newRole}`);
            
            // Actualizar textos internos
            const roleText = element.querySelector('.player-token-text');
            if (roleText) roleText.textContent = newRole;

            const numText = element.querySelector('.player-token-number');
            if (numText) numText.textContent = newNum;

            const nameText = element.querySelector('.player-token-label');
            if (nameText) nameText.textContent = newName;

            // Actualizar previsualización en editor
            this.editBadge.textContent = `${newRole}${newNum}`;
            this.editBadge.style.backgroundColor = `var(--role-${newRole.toLowerCase()})`;
            this.editBadge.style.color = newRole === 'L' ? '#000000' : '#ffffff';
            this.editName.textContent = newName;
            const rolesMap = { A: 'Armador', P: 'Punta Receptor', C: 'Central', O: 'Opuesto', L: 'Líbero' };
            this.editRoleText.textContent = rolesMap[newRole] || 'Jugador';
            
            window.dispatchEvent(new CustomEvent('player-updated', { detail: this.selectedPlayer }));
        };

        this.inputNumber.addEventListener('input', updateCurrentSelected);
        this.inputRole.addEventListener('change', updateCurrentSelected);
        this.inputName.addEventListener('input', updateCurrentSelected);
    }

    /**
     * Realiza la rotación reglamentaria de las posiciones del Equipo A (Azul - Local) en sentido horario
     */
    rotateTeamA() {
        // En voley, las posiciones giran en sentido de las agujas del reloj:
        // Posición 1 pasa a Posición 6
        // Posición 6 pasa a Posición 5
        // Posición 5 pasa a Posición 4
        // Posición 4 pasa a Posición 3
        // Posición 3 pasa a Posición 2
        // Posición 2 pasa a Posición 1
        
        // Coordenadas tácticas ideales para cada zona (Campo Izquierdo)
        const zoneCoords = {
            1: { x: 220, y: 440 }, // Zaguero Derecho
            6: { x: 200, y: 300 }, // Zaguero Centro
            5: { x: 220, y: 160 }, // Zaguero Izquierdo
            4: { x: 420, y: 160 }, // Delantero Izquierdo
            3: { x: 440, y: 300 }, // Delantero Centro
            2: { x: 420, y: 440 }  // Delantero Derecho
        };

        // Encontrar los 6 jugadores del Equipo Azul
        const teamAPlayers = this.players.filter(p => p.team === 'blue');
        
        // Rotar las zonas asignadas internamente
        teamAPlayers.forEach(player => {
            let currentZone = player.zone;
            let nextZone;

            if (currentZone === 1) nextZone = 6;
            else if (currentZone === 6) nextZone = 5;
            else if (currentZone === 5) nextZone = 4;
            else if (currentZone === 4) nextZone = 3;
            else if (currentZone === 3) nextZone = 2;
            else if (currentZone === 2) nextZone = 1;

            player.zone = nextZone;
            
            // Obtener nuevas coordenadas de la zona
            const newPos = zoneCoords[nextZone];
            player.x = newPos.x;
            player.y = newPos.y;

            // Desplazar con animación fluida (añadiendo clase de transición temporal)
            player.element.classList.add('player-animating');
            player.element.setAttribute('transform', `translate(${player.x}, ${player.y})`);
            
            // Remover la clase de animación después de completar el desplazamiento
            setTimeout(() => {
                player.element.classList.remove('player-animating');
            }, 1000);
        });

        // Seleccionar de nuevo para refrescar la zona en el editor si estaba seleccionado
        if (this.selectedPlayer && this.selectedPlayer.team === 'blue') {
            this.selectPlayer(this.selectedPlayer.id);
        }

        // Notificar movimiento completado
        window.dispatchEvent(new CustomEvent('player-moved-finished'));
    }

    /**
     * Mueve a un jugador directamente a coordenadas específicas (usado por presets y línea de tiempo)
     */
    movePlayerTo(id, x, y, animate = true) {
        const player = this.players.find(p => p.id === id);
        if (player) {
            player.x = x;
            player.y = y;
            if (animate) {
                player.element.classList.add('player-animating');
                player.element.setAttribute('transform', `translate(${x}, ${y})`);
                setTimeout(() => player.element.classList.remove('player-animating'), 1000);
            } else {
                player.element.setAttribute('transform', `translate(${x}, ${y})`);
            }
        }
    }
}
