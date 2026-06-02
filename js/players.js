/**
 * VOLEYTACTICS - PLAYERS MODULE (js/players.js)
 * Gestiona la creación de fichas de jugadores, arrastrar y soltar, edición de propiedades y rotaciones.
 */

export class PlayerManager {
    constructor(rosterManager = null) {
        this.roster = rosterManager;
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

        // Elementos de Roster
        this.rosterLinkSection = document.getElementById('roster-link-field');
        this.selectRosterPlayer = document.getElementById('select-roster-player');
        this.rosterFilterBadgesContainer = document.getElementById('roster-filter-badges');

        this.btnRotate = document.getElementById('btn-rotate-clockwise');
        
        this.players = [];
        this.selectedPlayer = null;
        
        // Dragging State
        this.draggedElement = null;
        this.dragOffset = { x: 0, y: 0 };
        this.isDragging = false;

        this.dragBounds = {
            minX: 20,
            maxX: 980,
            minY: 20,
            maxY: 580
        };
        this.useRotatedHalf = false;
        this.currentView = 'full';
        
        this.init();
    }

    init() {
        this.createInitialSetup();
        this.setupDragAndDrop();
        this.setupEditorListeners();
        
        this.btnRotate.addEventListener('click', () => {
            this.rotateTeamA();
        });

        window.addEventListener('court-view-changed', (e) => {
            if (e.detail) {
                this.currentView = e.detail.view || 'full';
                this.useRotatedHalf = Boolean(e.detail.useRotatedHalf);
                this.updateTeamVisibilityForView(this.currentView);
            }

            if (e.detail && e.detail.dragBounds) {
                this.dragBounds = e.detail.dragBounds;
            }
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
            // Grupo del Icono del Rol (NUEVO)
            const iconGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            iconGroup.setAttribute('class', 'player-token-icon-group');
            iconGroup.setAttribute('transform', 'translate(0, -6)');
            
            const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            iconPath.setAttribute('class', 'player-token-icon-path');
            iconPath.setAttribute('d', this.getRoleIconPath(cfg.role));
            
            iconGroup.appendChild(iconPath);
            g.appendChild(iconGroup);

            // Badge del Rol (Superscript Badge)
            const badge = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            badge.setAttribute('class', 'player-token-role-badge');
            badge.setAttribute('transform', 'translate(15, -15)');
            
            const badgeCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            badgeCircle.setAttribute('cx', '0');
            badgeCircle.setAttribute('cy', '0');
            badgeCircle.setAttribute('r', '7');
            badge.appendChild(badgeCircle);
            
            const badgeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            badgeText.setAttribute('class', 'player-token-role-badge-text');
            badgeText.setAttribute('y', '2.5'); // centrado vertical
            badgeText.textContent = cfg.role;
            badge.appendChild(badgeText);
            
            g.appendChild(badge);

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
        const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : ((e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0].clientX : e.clientX);
        const clientY = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : ((e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0].clientY : e.clientY);
        pt.x = clientX;
        pt.y = clientY;
        
        // Resuelve las coordenadas locales del SVG escalado
        const svgGlobalMatrix = this.courtSvg.getScreenCTM();
        if (svgGlobalMatrix) {
            const screenPoint = pt.matrixTransform(svgGlobalMatrix.inverse());
            return this.toLogicalCoords(screenPoint);
        }
        return this.toLogicalCoords({ x: clientX, y: clientY });
    }

    toLogicalCoords(point) {
        if (!this.useRotatedHalf) {
            return point;
        }

        const centerX = 250;
        const centerY = 300;

        return {
            x: centerX - (point.y - centerY),
            y: centerY + (point.x - centerX)
        };
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
                const targetX = Math.max(this.dragBounds.minX, Math.min(this.dragBounds.maxX, coords.x - this.dragOffset.x));
                const targetY = Math.max(this.dragBounds.minY, Math.min(this.dragBounds.maxY, coords.y - this.dragOffset.y));
                
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
    populateRosterSelect(filterPos = 'ALL', selectedPlayerId = null) {
        if (!this.roster) return;

        this.selectRosterPlayer.innerHTML = '';
        const optDefault = document.createElement('option');
        optDefault.value = '';
        optDefault.textContent = '-- Sin Vincular --';
        this.selectRosterPlayer.appendChild(optDefault);

        const players = this.roster.getPlayersByPosition(filterPos);
        players.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            const posListStr = p.positions.map(pos => pos === p.primaryPosition ? `${pos}★` : pos).join(', ');
            opt.textContent = `${p.name} (#${p.number}) - [${posListStr}]`;
            if (p.id === selectedPlayerId) {
                opt.selected = true;
            }
            this.selectRosterPlayer.appendChild(opt);
        });
    }

    selectPlayer(playerId) {
        // Quitar selección previa
        this.players.forEach(p => p.element.classList.remove('selected'));
        this.selectedPlayer = null;

        if (!playerId) {
            this.editorPlaceholder.style.display = 'flex';
            this.editorForm.style.display = 'none';
            window.dispatchEvent(new CustomEvent('player-selection-changed', {
                detail: { playerId: null }
            }));
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

            if (this.rosterLinkSection) {
                this.rosterLinkSection.style.display = 'none';
            }
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

            if (this.rosterLinkSection && this.roster) {
                this.rosterLinkSection.style.display = 'block';

                let linkedRosterPlayer = null;
                if (player.rosterPlayerId) {
                    linkedRosterPlayer = this.roster.getAllPlayers().find(p => p.id === player.rosterPlayerId);
                }
                
                if (!linkedRosterPlayer) {
                    linkedRosterPlayer = this.roster.getAllPlayers().find(p => p.name === player.name && p.number === parseInt(player.number));
                    if (linkedRosterPlayer) {
                        player.rosterPlayerId = linkedRosterPlayer.id;
                    }
                }

                // Autofiltrar por la posición actual de la ficha
                const filterButtons = this.rosterFilterBadgesContainer.querySelectorAll('.filter-badge-btn');
                filterButtons.forEach(btn => {
                    if (btn.dataset.pos === player.role) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });

                this.populateRosterSelect(player.role, player.rosterPlayerId || null);
            }
        }

        window.dispatchEvent(new CustomEvent('player-selection-changed', {
            detail: { playerId: player.id }
        }));
    }

    updatePlayerMetadata(id, name, number, role, rosterPlayerId = null) {
        const player = this.players.find(p => p.id === id);
        if (!player || id === 'ball') return;

        const oldRole = player.role;
        player.name = name || 'Jugador';
        player.number = parseInt(number) || 1;
        player.role = role || 'A';
        player.rosterPlayerId = rosterPlayerId || null;

        const element = player.element;
        if (element) {
            // Actualizar clases de rol
            element.className.baseVal = `player-token team-${player.team}`;
            element.classList.add(`token-role-${player.role}`);
            if (this.selectedPlayer && this.selectedPlayer.id === id) {
                element.classList.add('selected');
            }
            
            // Actualizar textos e iconos internos
            const iconPath = element.querySelector('.player-token-icon-path');
            if (iconPath) {
                iconPath.setAttribute('d', this.getRoleIconPath(player.role));
            }
            
            const badgeText = element.querySelector('.player-token-role-badge-text');
            if (badgeText) {
                badgeText.textContent = player.role;
            }

            const numText = element.querySelector('.player-token-number');
            if (numText) numText.textContent = player.number;

            const nameText = element.querySelector('.player-token-label');
            if (nameText) nameText.textContent = player.name;
        }

        // Si es el seleccionado actualmente, refrescar la previsualización del editor
        if (this.selectedPlayer && this.selectedPlayer.id === id) {
            this.editBadge.textContent = `${player.role}${player.number}`;
            this.editBadge.style.backgroundColor = `var(--role-${player.role.toLowerCase()})`;
            this.editBadge.style.color = player.role === 'L' ? '#000000' : '#ffffff';
            this.editName.textContent = player.name;
            const rolesMap = { A: 'Armador', P: 'Punta Receptor', C: 'Central', O: 'Opuesto', L: 'Líbero' };
            this.editRoleText.textContent = rolesMap[player.role] || 'Jugador';
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
            element.className.baseVal = `player-token team-${this.selectedPlayer.team} selected`;
            element.classList.add(`token-role-${newRole}`);
            
            // Actualizar textos e iconos internos (NUEVO)
            const iconPath = element.querySelector('.player-token-icon-path');
            if (iconPath) {
                iconPath.setAttribute('d', this.getRoleIconPath(newRole));
            }
            
            const badgeText = element.querySelector('.player-token-role-badge-text');
            if (badgeText) {
                badgeText.textContent = newRole;
            }

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

        // Listeners para vinculación con la plantilla de jugadores (Roster)
        if (this.roster) {
            // Escuchar clics en los botones de filtro rápido
            this.rosterFilterBadgesContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.filter-badge-btn');
                if (!btn) return;

                const filterButtons = this.rosterFilterBadgesContainer.querySelectorAll('.filter-badge-btn');
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const pos = btn.dataset.pos;
                const currentLink = this.selectRosterPlayer.value;
                this.populateRosterSelect(pos, currentLink);
            });

            // Escuchar cambios en la selección de vinculación
            this.selectRosterPlayer.addEventListener('change', () => {
                const playerId = this.selectRosterPlayer.value;
                if (!this.selectedPlayer) return;

                if (!playerId) {
                    this.selectedPlayer.rosterPlayerId = null;
                    return;
                }

                const rosterPlayer = this.roster.getAllPlayers().find(p => p.id === playerId);
                if (rosterPlayer) {
                    this.selectedPlayer.rosterPlayerId = rosterPlayer.id;
                    
                    // Asignar nombre y número
                    this.inputName.value = rosterPlayer.name;
                    this.inputNumber.value = rosterPlayer.number;

                    // Si el filtro activo es una posición válida del jugador, usarla
                    const activeFilterBtn = this.rosterFilterBadgesContainer.querySelector('.filter-badge-btn.active');
                    const activePos = activeFilterBtn ? activeFilterBtn.dataset.pos : 'ALL';
                    
                    if (activePos !== 'ALL' && rosterPlayer.positions.includes(activePos)) {
                        this.inputRole.value = activePos;
                    } else {
                        this.inputRole.value = rosterPlayer.primaryPosition;
                    }

                    // Lanzar la actualización
                    updateCurrentSelected();
                }
            });

            // Escuchar si la plantilla cambia
            window.addEventListener('roster-changed', () => {
                if (this.selectedPlayer && this.selectedPlayer.id !== 'ball') {
                    const activeFilterBtn = this.rosterFilterBadgesContainer.querySelector('.filter-badge-btn.active');
                    const activePos = activeFilterBtn ? activeFilterBtn.dataset.pos : 'ALL';
                    this.populateRosterSelect(activePos, this.selectedPlayer.rosterPlayerId);
                }
            });
        }
    }

    /**
     * Retorna la trayectoria de dibujo vectorial SVG (d) correspondiente al icono de cada rol táctico
     */
    getRoleIconPath(role) {
        const paths = {
            // A - Armador: Manos en copa de colocación debajo de un balón flotando
            'A': 'M -5 3 C -6 -1, -3 -5, -1 -5 M -5 3 L -3.5 5.5 M 5 3 C 6 -1, 3 -5, 1 -5 M 5 3 L 3.5 5.5 M -2 -8 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0',
            // P - Punta: Balón rematado que pasa con fuerza sobre la red
            'P': 'M -8 3 L 8 3 M -5 -5 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0 M -1 -3 L 4 2 M 4 2 L 1 2 M 4 2 L 4 -1',
            // C - Central: Bloqueo de doble mano en la red deteniendo el balón
            'C': 'M -9 4 L 9 4 M -4 2 L -4 -4 M -2 3 L -2 -5 M 2 3 L 2 -5 M 4 2 L 4 -4 M -2 -8 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0',
            // O - Opuesto: Remate de potencia (balón de fuego / meteorito diagonal)
            'O': 'M 0.5 -3 a 2.5 2.5 0 1 0 5 0 a 2.5 2.5 0 1 0 -5 0 M -5 5 L -1 1 M -3 7 L 1 3 M -7 3 L -3 -1',
            // L - Líbero: Plataforma de brazos estirados en recepción baja (dig) debajo del balón
            'L': 'M -6 5 L -2 1 L 2 1 L 6 5 M -2 -3 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0',
            // B - Balón (vacío, maneja su propia simbología)
            'B': ''
        };
        return paths[role] || '';
    }

    updateTeamVisibilityForView(view) {
        const isHalfView = view === 'half';

        this.players.forEach((player) => {
            const shouldHide = isHalfView && player.team === 'red';
            player.element.style.display = shouldHide ? 'none' : '';
        });

        if (isHalfView && this.selectedPlayer && this.selectedPlayer.team === 'red') {
            this.selectPlayer(null);
        }
    }

    constrainPlayersToBounds(bounds) {
        if (!bounds) return;

        this.players.forEach((player) => {
            const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, player.x));
            const clampedY = Math.max(bounds.minY, Math.min(bounds.maxY, player.y));

            if (clampedX !== player.x || clampedY !== player.y) {
                player.x = clampedX;
                player.y = clampedY;
                player.element.setAttribute('transform', `translate(${clampedX}, ${clampedY})`);
            }
        });

        window.dispatchEvent(new CustomEvent('player-moved-finished'));
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
            
            // Remover la clase de animación después de completar el desplazamiento de manera dinámica
            const speed = parseInt(document.getElementById('select-play-speed')?.value) || 1000;
            setTimeout(() => {
                player.element.classList.remove('player-animating');
            }, speed);
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
                const speed = parseInt(document.getElementById('select-play-speed')?.value) || 1000;
                setTimeout(() => player.element.classList.remove('player-animating'), speed);
            } else {
                player.element.setAttribute('transform', `translate(${x}, ${y})`);
            }
        }
    }

}
