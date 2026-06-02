/**
 * VOLEYTACTICS - MAIN CORE (app.js)
 * Orquestador principal de la pizarra de voleibol. Importa los módulos y coordina la lógica global.
 */

import { CourtManager } from './js/court.js?v=20260602-2';
import { PlayerManager } from './js/players.js?v=20260602-3';
import { DrawingManager } from './js/drawing.js?v=20260602-2';
import { TimelineManager } from './js/timeline.js?v=20260602-2';
import { StorageManager } from './js/storage.js?v=20260602-2';
import { UserManager } from './js/users.js?v=20260602-2';
import { RosterManager } from './js/roster.js?v=20260602-2';

class App {
    constructor() {
        this.init();
    }

    init() {
        // 1. Instanciar Módulos Fundacionales y Gestión de Sesión
        this.users = new UserManager();
        this.court = new CourtManager();
        this.roster = new RosterManager();
        this.players = new PlayerManager(this.roster);
        this.drawing = new DrawingManager();
        this.timeline = new TimelineManager(this.players, this.drawing);
        this.storage = new StorageManager(this.timeline);

        // 2. Configurar la Navegación por Pestañas (Tabs) del Panel Derecho
        this.setupTacticsTabs();

        // 3. Vincular los Presets de Tácticas y Sistemas (Biblioteca Expandida de 25)
        this.setupTacticsPresets();

        // 4. Configurar el Sistema de Favoritos y Eventos
        this.setupFavoritesEvents();

        // 5. Comprimir/expandir ficha seleccionada para liberar espacio en tácticas
        this.setupPlayerEditorPanelToggle();
        
        // 5b. Comprimir/expandir secuencia de jugada (timeline)
        this.setupTimelineToggle();

        // 6. Configurar el Modal de Ayuda
        this.setupHelpModal();
        
        // 7. Vincular sincronización inicial e interfaz de favoritos
        this.timeline.saveCurrentStateToFrame();
        this.updateFavoriteStarsUI();
        this.renderFavoritesTab();

        console.log('VoleyTactics inicializado de forma exitosa.');
    }

    /**
     * Alterna la visualización de las pestañas en el panel lateral de sistemas
     */
    setupTacticsTabs() {
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Desactivar todos los botones de pestañas
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Ocultar todos los contenidos de pestañas
                const contents = document.querySelectorAll('.tab-content');
                contents.forEach(c => c.classList.remove('active'));

                // Mostrar el seleccionado
                const targetTabId = tab.dataset.tab;
                document.getElementById(targetTabId).classList.add('active');

                if (targetTabId === 'tab-sistemas' && this.setPlayerEditorCollapsed) {
                    this.setPlayerEditorCollapsed(true, false);
                }
            });
        });
    }

    /**
     * Mapea y configura las coordenadas de los presets tácticos
     */
    setupTacticsPresets() {
        // Coordenadas tácticas específicas para cada preset
        const presets = {
            // ==========================================
            // SISTEMAS DE JUEGO (5-1, 6-2, 4-2, 3-3)
            // ==========================================
            'sistema-5-1-k1': {
                description: '5-1 (Rotación 1) - Armador en Pos. 1 (atrás)',
                players: {
                    'A1': { x: 450, y: 280, zone: 1, role: 'A', number: 1, name: 'Armador' },    // Armador penetrando al centro
                    'A6': { x: 180, y: 410, zone: 5, role: 'L', number: 6, name: 'Líbero' },     // Líbero en recepción
                    'A5': { x: 200, y: 280, zone: 6, role: 'P', number: 5, name: 'Punta 1' },    // Punta en recepción
                    'A4': { x: 250, y: 160, zone: 4, role: 'P', number: 4, name: 'Punta 2' },    // Punta delantero retrasado
                    'A3': { x: 380, y: 280, zone: 3, role: 'C', number: 3, name: 'Central 2' },  // Central delantero preparado
                    'A2': { x: 410, y: 440, zone: 2, role: 'O', number: 2, name: 'Opuesto' },    // Opuesto delantero en banda
                    'ball': { x: 190, y: 390 }                                                  // Balón llegando a la recepción
                }
            },
            'sistema-5-1-rot6': {
                description: '5-1 (Rotación 6) - Armador en Pos. 6 (atrás-centro)',
                players: {
                    'A1': { x: 450, y: 280, zone: 6, role: 'A', number: 1, name: 'Armador' },    // Armador penetrando desde Z6
                    'A6': { x: 200, y: 180, zone: 5, role: 'L', number: 6, name: 'Líbero' },     // Líbero en recepción
                    'A5': { x: 180, y: 420, zone: 1, role: 'P', number: 5, name: 'Punta 1' },    // Punta en recepción
                    'A4': { x: 380, y: 160, zone: 4, role: 'P', number: 4, name: 'Punta 2' },    // Punta delantero en red
                    'A3': { x: 240, y: 280, zone: 3, role: 'C', number: 3, name: 'Central 2' },  // Central replegado
                    'A2': { x: 410, y: 440, zone: 2, role: 'O', number: 2, name: 'Opuesto' },    // Opuesto delantero
                    'ball': { x: 180, y: 200 }
                }
            },
            'sistema-5-1-rot5': {
                description: '5-1 (Rotación 5) - Armador en Pos. 5 (atrás-izquierda)',
                players: {
                    'A1': { x: 450, y: 280, zone: 5, role: 'A', number: 1, name: 'Armador' },    // Armador penetrando desde Z5
                    'A6': { x: 180, y: 300, zone: 6, role: 'L', number: 6, name: 'Líbero' },
                    'A5': { x: 200, y: 420, zone: 1, role: 'P', number: 5, name: 'Punta 1' },
                    'A4': { x: 250, y: 160, zone: 4, role: 'P', number: 4, name: 'Punta 2' },
                    'A3': { x: 420, y: 160, zone: 3, role: 'C', number: 3, name: 'Central 2' },
                    'A2': { x: 410, y: 440, zone: 2, role: 'O', number: 2, name: 'Opuesto' },
                    'ball': { x: 200, y: 180 }
                }
            },
            'sistema-5-1-rot4': {
                description: '5-1 (Rotación 4) - Armador en Pos. 4 (delante-izquierda)',
                players: {
                    'A1': { x: 450, y: 300, zone: 4, role: 'A', number: 1, name: 'Armador' },    // Armador delantero (en red)
                    'A6': { x: 180, y: 300, zone: 6, role: 'L', number: 6, name: 'Líbero' },
                    'A5': { x: 200, y: 160, zone: 5, role: 'P', number: 5, name: 'Punta 1' },
                    'A4': { x: 420, y: 160, zone: 3, role: 'P', number: 4, name: 'Punta 2' },    // Atacando por 4
                    'A3': { x: 420, y: 440, zone: 2, role: 'C', number: 3, name: 'Central 2' },  // Atacando por 2
                    'A2': { x: 220, y: 440, zone: 1, role: 'O', number: 2, name: 'Opuesto' },    // Opuesto zaguero (atrás)
                    'ball': { x: 430, y: 300 }
                }
            },
            'sistema-5-1-rot3': {
                description: '5-1 (Rotación 3) - Armador en Pos. 3 (delante-centro)',
                players: {
                    'A1': { x: 450, y: 300, zone: 3, role: 'A', number: 1, name: 'Armador' },    // Armador delantero en red
                    'A6': { x: 200, y: 160, zone: 5, role: 'L', number: 6, name: 'Líbero' },
                    'A5': { x: 180, y: 300, zone: 6, role: 'P', number: 5, name: 'Punta 1' },
                    'A4': { x: 420, y: 160, zone: 4, role: 'P', number: 4, name: 'Punta 2' },    // Atacante de banda
                    'A3': { x: 200, y: 440, zone: 1, role: 'C', number: 3, name: 'Central 2' },  // Central zaguero
                    'A2': { x: 420, y: 440, zone: 2, role: 'O', number: 2, name: 'Opuesto' },    // Opuesto delantero
                    'ball': { x: 450, y: 280 }
                }
            },
            'sistema-5-1-k2': {
                description: '5-1 (Rotación 2) - Armador en Pos. 2 (delante-derecha)',
                players: {
                    'A1': { x: 460, y: 410, zone: 2, role: 'A', number: 1, name: 'Armador' },    // Armador delantero en red
                    'A6': { x: 180, y: 300, zone: 6, role: 'L', number: 6, name: 'Líbero' },     // Cobertura
                    'A5': { x: 200, y: 160, zone: 5, role: 'P', number: 5, name: 'Punta 1' },    // Defensa
                    'A4': { x: 420, y: 160, zone: 4, role: 'P', number: 4, name: 'Punta 2' },    // Remate por 4
                    'A3': { x: 430, y: 300, zone: 3, role: 'C', number: 3, name: 'Central 2' },  // Remate rápido centro
                    'A2': { x: 220, y: 440, zone: 1, role: 'O', number: 2, name: 'Opuesto' },    // Opuesto zaguero
                    'ball': { x: 450, y: 380 }
                }
            },
            'sistema-6-2': {
                description: 'Sistema 6-2 (Armador zaguero penetra, 3 atacantes)',
                players: {
                    'A1': { x: 450, y: 260, zone: 1, role: 'A', number: 1, name: 'Armador 1' },  // Armador penetrando
                    'A6': { x: 180, y: 300, zone: 6, role: 'C', number: 6, name: 'Central' },
                    'A5': { x: 200, y: 160, zone: 5, role: 'P', number: 5, name: 'Punta 1' },
                    'A4': { x: 420, y: 160, zone: 4, role: 'P', number: 4, name: 'Punta 2' },    // Atacante Delantero Izq
                    'A3': { x: 430, y: 300, zone: 3, role: 'C', number: 3, name: 'Central 2' },  // Atacante Delantero Centro
                    'A2': { x: 420, y: 440, zone: 2, role: 'A', number: 2, name: 'Armador 2' },  // Colocador delantero (actúa como opuesto atacante)
                    'ball': { x: 430, y: 300 }
                }
            },
            'sistema-4-2': {
                description: 'Sistema 4-2 (Colocador delantero en Z3 Centro)',
                players: {
                    'A1': { x: 200, y: 440, zone: 1, role: 'A', number: 1, name: 'Armador 1' },
                    'A6': { x: 200, y: 300, zone: 6, role: 'C', number: 6, name: 'Central 1' },
                    'A5': { x: 200, y: 160, zone: 5, role: 'P', number: 5, name: 'Punta 1' },
                    'A4': { x: 410, y: 160, zone: 4, role: 'P', number: 4, name: 'Punta 2' },    // Atacante Izq
                    'A3': { x: 450, y: 300, zone: 3, role: 'A', number: 3, name: 'Armador 2' },  // Armador activo
                    'A2': { x: 410, y: 440, zone: 2, role: 'O', number: 2, name: 'Opuesto' },    // Atacante Der
                    'ball': { x: 450, y: 300 }
                }
            },
            'sistema-4-2-z2': {
                description: 'Sistema 4-2 (Colocador delantero en Z2 Banda)',
                players: {
                    'A1': { x: 200, y: 300, zone: 6, role: 'A', number: 1, name: 'Armador 1' },
                    'A6': { x: 200, y: 160, zone: 5, role: 'C', number: 6, name: 'Central 1' },
                    'A5': { x: 200, y: 440, zone: 1, role: 'P', number: 5, name: 'Punta 1' },
                    'A4': { x: 410, y: 160, zone: 4, role: 'P', number: 4, name: 'Punta 2' },
                    'A3': { x: 420, y: 300, zone: 3, role: 'C', number: 3, name: 'Central 2' },
                    'A2': { x: 450, y: 410, zone: 2, role: 'A', number: 2, name: 'Armador 2' },  // Colocador activo en banda (Z2)
                    'ball': { x: 440, y: 390 }
                }
            },
            'sistema-3-3': {
                description: 'Sistema Escolar 3-3 (3 Armadores y 3 Atacantes)',
                players: {
                    'A1': { x: 200, y: 420, zone: 1, role: 'A', number: 1, name: 'Armador 1' },
                    'A6': { x: 180, y: 300, zone: 6, role: 'P', number: 6, name: 'Atacante 1' },
                    'A5': { x: 200, y: 180, zone: 5, role: 'A', number: 5, name: 'Armador 2' },
                    'A4': { x: 410, y: 160, zone: 4, role: 'P', number: 4, name: 'Atacante 2' },
                    'A3': { x: 450, y: 300, zone: 3, role: 'A', number: 3, name: 'Armador 3' },  // Armador activo en red
                    'A2': { x: 410, y: 440, zone: 2, role: 'P', number: 2, name: 'Atacante 3' },
                    'ball': { x: 440, y: 280 }
                }
            },

            // ==========================================
            // RECEPCIÓN DE SAQUE
            // ==========================================
            'recep-w': {
                description: 'Recepción en W (5 Receptores)',
                players: {
                    'A1': { x: 460, y: 200, zone: 2, role: 'A', number: 1, name: 'Armador' },    // Armador libre en red
                    'A4': { x: 310, y: 160, zone: 4, role: 'P', number: 4, name: 'Punta 2' },    // Receptores en "W"
                    'A3': { x: 330, y: 300, zone: 3, role: 'C', number: 3, name: 'Central 2' },
                    'A6': { x: 180, y: 300, zone: 6, role: 'L', number: 6, name: 'Líbero' },
                    'A5': { x: 180, y: 160, zone: 5, role: 'P', number: 5, name: 'Punta 1' },
                    'A2': { x: 180, y: 440, zone: 1, role: 'O', number: 2, name: 'Opuesto' },
                    'ball': { x: 80, y: 300 }
                }
            },
            'recep-4-receptores': {
                description: 'Recepción con 4 Receptores (Punta Delantero liberado)',
                players: {
                    'A1': { x: 460, y: 280, zone: 1, role: 'A', number: 1, name: 'Armador' },    // Escondido listo para colocar
                    'A4': { x: 440, y: 140, zone: 4, role: 'P', number: 4, name: 'Punta 2' },    // Punta delantero libre de recepción
                    'A3': { x: 300, y: 220, zone: 3, role: 'C', number: 3, name: 'Central 2' },  // Central
                    'A6': { x: 180, y: 300, zone: 6, role: 'L', number: 6, name: 'Líbero' },     // Líbero
                    'A5': { x: 200, y: 160, zone: 5, role: 'P', number: 5, name: 'Punta 1' },    // Punta zaguero
                    'A2': { x: 200, y: 420, zone: 2, role: 'O', number: 2, name: 'Opuesto' },    // Opuesto
                    'ball': { x: 80, y: 300 }
                }
            },
            'recep-3-receptores': {
                description: 'Recepción con 3 Receptores (Puntas + Líbero)',
                players: {
                    'A1': { x: 460, y: 280, zone: 1, role: 'A', number: 1, name: 'Armador' },    // Armador
                    'A3': { x: 430, y: 200, zone: 3, role: 'C', number: 3, name: 'Central 2' },  // Central listo en red
                    'A2': { x: 430, y: 440, zone: 2, role: 'O', number: 2, name: 'Opuesto' },    // Opuesto escondido
                    'A4': { x: 260, y: 180, zone: 4, role: 'P', number: 4, name: 'Punta 2' },    // Punta receptor 1
                    'A6': { x: 200, y: 300, zone: 6, role: 'L', number: 6, name: 'Líbero' },     // Líbero receptor
                    'A5': { x: 260, y: 400, zone: 5, role: 'P', number: 5, name: 'Punta 1' },    // Punta receptor 2
                    'ball': { x: 60, y: 300 }
                }
            },
            'recep-opuesto-libre': {
                description: 'Recepción con Opuesto Libre (red Z2-Z1)',
                players: {
                    'A1': { x: 460, y: 240, zone: 2, role: 'A', number: 1, name: 'Armador' },
                    'A2': { x: 460, y: 440, zone: 1, role: 'O', number: 2, name: 'Opuesto' },    // Opuesto libre en red
                    'A3': { x: 430, y: 150, zone: 3, role: 'C', number: 3, name: 'Central 2' },
                    'A4': { x: 300, y: 170, zone: 4, role: 'P', number: 4, name: 'Punta 2' },    // Punta receptor
                    'A6': { x: 200, y: 300, zone: 6, role: 'L', number: 6, name: 'Líbero' },     // Líbero
                    'A5': { x: 220, y: 400, zone: 5, role: 'P', number: 5, name: 'Punta 1' },    // Punta zaguero
                    'ball': { x: 60, y: 300 }
                }
            },
            'recep-2-receptores': {
                description: 'Recepción Extrema de 2 Receptores',
                players: {
                    'A1': { x: 460, y: 280, zone: 1, role: 'A', number: 1, name: 'Armador' },    // Armador
                    'A4': { x: 430, y: 150, zone: 4, role: 'P', number: 4, name: 'Punta 2' },    // Delantero escondido
                    'A3': { x: 430, y: 240, zone: 3, role: 'C', number: 3, name: 'Central 2' },  // Central escondido
                    'A2': { x: 430, y: 440, zone: 2, role: 'O', number: 2, name: 'Opuesto' },    // Opuesto escondido
                    'A6': { x: 200, y: 200, zone: 6, role: 'L', number: 6, name: 'Líbero' },     // Receptor 1
                    'A5': { x: 200, y: 380, zone: 5, role: 'P', number: 5, name: 'Punta 1' },    // Receptor 2
                    'ball': { x: 60, y: 300 }
                }
            },
            'recep-saque-potencia': {
                description: 'Recepción replegada para Saque de Potencia',
                players: {
                    'A1': { x: 450, y: 200, zone: 2, role: 'A', number: 1, name: 'Armador' },
                    'A3': { x: 430, y: 300, zone: 3, role: 'C', number: 3, name: 'Central 2' },
                    'A4': { x: 220, y: 150, zone: 4, role: 'P', number: 4, name: 'Punta 2' },
                    'A6': { x: 140, y: 300, zone: 6, role: 'L', number: 6, name: 'Líbero' },
                    'A5': { x: 160, y: 180, zone: 5, role: 'P', number: 5, name: 'Punta 1' },
                    'A2': { x: 160, y: 420, zone: 1, role: 'O', number: 2, name: 'Opuesto' },
                    'ball': { x: 80, y: 300 }
                }
            },
            'recep-saque-flotante': {
                description: 'Recepción adelantada para Saque Flotante',
                players: {
                    'A1': { x: 450, y: 200, zone: 2, role: 'A', number: 1, name: 'Armador' },
                    'A3': { x: 430, y: 300, zone: 3, role: 'C', number: 3, name: 'Central 2' },
                    'A4': { x: 320, y: 180, zone: 4, role: 'P', number: 4, name: 'Punta 2' },
                    'A6': { x: 260, y: 300, zone: 6, role: 'L', number: 6, name: 'Líbero' },
                    'A5': { x: 280, y: 180, zone: 5, role: 'P', number: 5, name: 'Punta 1' },
                    'A2': { x: 280, y: 420, zone: 1, role: 'O', number: 2, name: 'Opuesto' },
                    'ball': { x: 120, y: 300 }
                }
            },

            // ==========================================
            // DEFENSA Y BLOQUEO
            // ==========================================
            'defensa-perimetro': {
                description: 'Defensa Perimetral 3-1-2 (Zagueros profundos)',
                players: {
                    'A3': { x: 460, y: 180, zone: 3, role: 'C', number: 3, name: 'Central 2' },  // Bloqueo doble
                    'A4': { x: 460, y: 120, zone: 4, role: 'P', number: 4, name: 'Punta 2' },    // Bloqueador extremo
                    'A2': { x: 350, y: 380, zone: 2, role: 'O', number: 2, name: 'Opuesto' },    // Apoyo
                    'A5': { x: 180, y: 140, zone: 5, role: 'P', number: 5, name: 'Punta 1' },    // Defensa línea
                    'A1': { x: 220, y: 440, zone: 1, role: 'A', number: 1, name: 'Armador' },    // Defensa diagonal
                    'A6': { x: 150, y: 300, zone: 6, role: 'L', number: 6, name: 'Líbero' },     // Defensa profunda
                    'ball': { x: 530, y: 140 }
                }
            },
            'defensa-diagonal': {
                description: 'Defensa Diagonal 3-2-1 (Z6 avanzado)',
                players: {
                    'A3': { x: 460, y: 300, zone: 3, role: 'C', number: 3, name: 'Central 2' },  // Bloqueo simple centro
                    'A4': { x: 440, y: 160, zone: 4, role: 'P', number: 4, name: 'Punta 2' },    // Apoyo corto
                    'A2': { x: 440, y: 440, zone: 2, role: 'O', number: 2, name: 'Opuesto' },    // Apoyo corto
                    'A5': { x: 220, y: 180, zone: 5, role: 'P', number: 5, name: 'Punta 1' },    // Diagonal
                    'A1': { x: 220, y: 420, zone: 1, role: 'A', number: 1, name: 'Armador' },    // Diagonal
                    'A6': { x: 180, y: 300, zone: 6, role: 'L', number: 6, name: 'Líbero' },     // Z6 avanzado
                    'ball': { x: 540, y: 300 }
                }
            },
            'bloqueo-simple-z4': {
                description: 'Bloqueo Simple en Z4 (Punta)',
                players: {
                    'A4': { x: 460, y: 150, zone: 4, role: 'P', number: 4, name: 'Punta 2' },    // Bloquea
                    'A3': { x: 380, y: 280, zone: 3, role: 'C', number: 3, name: 'Central 2' },
                    'A2': { x: 320, y: 440, zone: 2, role: 'O', number: 2, name: 'Opuesto' },
                    'A5': { x: 200, y: 170, zone: 5, role: 'P', number: 5, name: 'Punta 1' },
                    'A6': { x: 180, y: 300, zone: 6, role: 'L', number: 6, name: 'Líbero' },
                    'A1': { x: 240, y: 420, zone: 1, role: 'A', number: 1, name: 'Armador' },
                    'ball': { x: 530, y: 150 }
                }
            },
            'bloqueo-simple-z3': {
                description: 'Bloqueo Simple en Z3 Centro (Central)',
                players: {
                    'A3': { x: 460, y: 300, zone: 3, role: 'C', number: 3, name: 'Central 2' },  // Bloquea
                    'A4': { x: 400, y: 160, zone: 4, role: 'P', number: 4, name: 'Punta 2' },
                    'A2': { x: 400, y: 440, zone: 2, role: 'O', number: 2, name: 'Opuesto' },
                    'A5': { x: 200, y: 180, zone: 5, role: 'P', number: 5, name: 'Punta 1' },
                    'A6': { x: 160, y: 300, zone: 6, role: 'L', number: 6, name: 'Líbero' },
                    'A1': { x: 200, y: 420, zone: 1, role: 'A', number: 1, name: 'Armador' },
                    'ball': { x: 530, y: 300 }
                }
            },
            'bloqueo-simple-z2': {
                description: 'Bloqueo Simple en Z2 (Opuesto)',
                players: {
                    'A2': { x: 460, y: 440, zone: 2, role: 'O', number: 2, name: 'Opuesto' },    // Bloquea
                    'A3': { x: 380, y: 300, zone: 3, role: 'C', number: 3, name: 'Central 2' },
                    'A4': { x: 320, y: 160, zone: 4, role: 'P', number: 4, name: 'Punta 2' },
                    'A1': { x: 200, y: 420, zone: 1, role: 'A', number: 1, name: 'Armador' },
                    'A6': { x: 180, y: 300, zone: 6, role: 'L', number: 6, name: 'Líbero' },
                    'A5': { x: 240, y: 180, zone: 5, role: 'P', number: 5, name: 'Punta 1' },
                    'ball': { x: 530, y: 440 }
                }
            },
            'bloqueo-doble': {
                description: 'Bloqueo Doble en Z4 (Punta + Central)',
                players: {
                    'A4': { x: 460, y: 130, zone: 4, role: 'P', number: 4, name: 'Punta 2' },    // Bloquea
                    'A3': { x: 460, y: 180, zone: 3, role: 'C', number: 3, name: 'Central 2' },  // Bloquea
                    'A2': { x: 320, y: 420, zone: 2, role: 'O', number: 2, name: 'Opuesto' },
                    'A5': { x: 180, y: 150, zone: 5, role: 'P', number: 5, name: 'Punta 1' },
                    'A6': { x: 160, y: 280, zone: 6, role: 'L', number: 6, name: 'Líbero' },
                    'A1': { x: 220, y: 440, zone: 1, role: 'A', number: 1, name: 'Armador' },
                    'ball': { x: 530, y: 140 }
                }
            },
            'bloqueo-doble-z2': {
                description: 'Bloqueo Doble en Z2 (Opuesto + Central)',
                players: {
                    'A2': { x: 460, y: 460, zone: 2, role: 'O', number: 2, name: 'Opuesto' },    // Bloquea
                    'A3': { x: 460, y: 410, zone: 3, role: 'C', number: 3, name: 'Central 2' },  // Bloquea
                    'A4': { x: 320, y: 180, zone: 4, role: 'P', number: 4, name: 'Punta 2' },
                    'A1': { x: 180, y: 450, zone: 1, role: 'A', number: 1, name: 'Armador' },
                    'A6': { x: 160, y: 320, zone: 6, role: 'L', number: 6, name: 'Líbero' },
                    'A5': { x: 220, y: 160, zone: 5, role: 'P', number: 5, name: 'Punta 1' },
                    'ball': { x: 530, y: 450 }
                }
            },
            'bloqueo-triple': {
                description: 'Bloqueo Triple Centro (Punta + Central + Opuesto)',
                players: {
                    'A4': { x: 460, y: 250, zone: 4, role: 'P', number: 4, name: 'Punta 2' },    // Bloquea
                    'A3': { x: 460, y: 300, zone: 3, role: 'C', number: 3, name: 'Central 2' },  // Bloquea
                    'A2': { x: 460, y: 350, zone: 2, role: 'O', number: 2, name: 'Opuesto' },    // Bloquea
                    'A5': { x: 240, y: 180, zone: 5, role: 'P', number: 5, name: 'Punta 1' },
                    'A1': { x: 240, y: 420, zone: 1, role: 'A', number: 1, name: 'Armador' },
                    'A6': { x: 160, y: 300, zone: 6, role: 'L', number: 6, name: 'Líbero' },
                    'ball': { x: 530, y: 300 }
                }
            }
        };

        // Escuchar clics en los botones de presets tácticos
        const presetItems = document.querySelectorAll('.tactic-item');
        presetItems.forEach(item => {
            item.addEventListener('click', () => {
                const presetKey = item.dataset.preset;
                const data = presets[presetKey];
                
                if (data) {
                    console.log(`Cargando Preset: ${data.description}`);
                    
                    // Mover a los jugadores locales del Equipo A y el Balón a las posiciones del preset
                    Object.keys(data.players).forEach(id => {
                        const coords = data.players[id];
                        this.players.movePlayerTo(id, coords.x, coords.y, true);
                        
                        // Si no es el balón, también actualizar la zona del jugador (manteniendo su nombre, número y rol personalizado)
                        if (id !== 'ball') {
                            const pObj = this.players.players.find(p => p.id === id);
                            if (pObj) {
                                pObj.zone = coords.zone;
                            }
                        }
                    });

                    // Deseleccionar cualquier jugador activo
                    this.players.selectPlayer(null);

                    // Si hay un trazo de pizarra anterior, limpiarlo para dejar la táctica visible
                    this.drawing.clearAllDrawings();

                    // Forzar guardado inmediato en el frame actual de la timeline
                    this.timeline.saveCurrentStateToFrame();
                    this.storage.updateSaveStatus(`Táctica "${item.querySelector('.tactic-name').textContent}" aplicada`);
                }
            });
        });
    }

    /**
     * Configura los eventos del sistema de favoritos (clics en estrella y sincronización)
     */
    setupFavoritesEvents() {
        // Escuchar clics en los botones de estrella en el catálogo
        const favButtons = document.querySelectorAll('.tactic-fav-btn');
        favButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Evitar que cargue el preset al hacer clic en la estrella
                const tacticId = btn.dataset.tacticId;
                if (this.users) {
                    this.users.toggleFavorite(tacticId);
                }
            });
        });

        // Escuchar el evento de cambio de favoritos para actualizar la interfaz
        window.addEventListener('favorites-changed', (e) => {
            this.updateFavoriteStarsUI();
            this.renderFavoritesTab();
        });

        // Escuchar cambios de sesión para re-sincronizar favoritos
        window.addEventListener('session-changed', (e) => {
            this.updateFavoriteStarsUI();
            this.renderFavoritesTab();
        });
    }

    /**
     * Actualiza visualmente el estado de las estrellas en todo el catálogo
     */
    updateFavoriteStarsUI() {
        if (!this.users) return;
        const favButtons = document.querySelectorAll('.tactic-fav-btn');
        favButtons.forEach(btn => {
            const tacticId = btn.dataset.tacticId;
            const isFav = this.users.isFavorite(tacticId);
            if (isFav) {
                btn.textContent = '★';
                btn.classList.add('active');
                btn.title = 'Quitar de favoritos';
            } else {
                btn.textContent = '☆';
                btn.classList.remove('active');
                btn.title = 'Marcar como favorito';
            }
        });
    }

    /**
     * Renderiza dinámicamente la lista de tácticas preferidas dentro de su pestaña
     */
    renderFavoritesTab() {
        const list = document.getElementById('favoritas-list');
        if (!list) return;
        list.innerHTML = '';

        const favs = this.users ? this.users.favorites : [];
        
        if (favs.length === 0) {
            list.innerHTML = '<div class="empty-state">No tienes tácticas marcadas como preferidas aún. Marca las tácticas con estrella (☆) en las otras pestañas.</div>';
            return;
        }

        favs.forEach(tacticId => {
            const originalBtn = document.querySelector(`.tactic-item[data-preset="${tacticId}"]`);
            if (!originalBtn) return;
            
            const originalLi = originalBtn.closest('.tactic-card-item');
            if (!originalLi) return;

            const clone = originalLi.cloneNode(true);
            
            // Vincular clic para aplicar el preset
            const cloneBtn = clone.querySelector('.tactic-item');
            cloneBtn.addEventListener('click', () => {
                originalBtn.click(); // Reutiliza el evento del original
            });

            // Vincular clic en la estrella del clon
            const cloneFavBtn = clone.querySelector('.tactic-fav-btn');
            cloneFavBtn.textContent = '★';
            cloneFavBtn.classList.add('active');
            cloneFavBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.users) {
                    this.users.toggleFavorite(tacticId);
                }
            });

            list.appendChild(clone);
        });
    }

    setupPlayerEditorPanelToggle() {
        const panel = document.getElementById('player-editor-panel');
        const btnToggle = document.getElementById('btn-toggle-player-editor');
        if (!panel || !btnToggle) return;

        const storageKey = 'vt-player-editor-collapsed';

        const applyState = (collapsed) => {
            panel.classList.toggle('collapsed', collapsed);
            btnToggle.setAttribute('aria-expanded', (!collapsed).toString());
            btnToggle.title = collapsed ? 'Expandir ficha seleccionada' : 'Comprimir ficha seleccionada';
        };

        this.setPlayerEditorCollapsed = (collapsed, persist = true) => {
            applyState(collapsed);
            if (persist) {
                localStorage.setItem(storageKey, collapsed ? '1' : '0');
            }
        };

        const savedState = localStorage.getItem(storageKey) === '1';
        this.setPlayerEditorCollapsed(savedState, false);

        btnToggle.addEventListener('click', () => {
            const willCollapse = !panel.classList.contains('collapsed');
            this.setPlayerEditorCollapsed(willCollapse, true);
        });

        window.addEventListener('player-selection-changed', (e) => {
            if (e.detail && e.detail.playerId) {
                this.setPlayerEditorCollapsed(false, false);
            }
        });
    }

    setupTimelineToggle() {
        const card = document.querySelector('.timeline-card');
        const btnToggle = document.getElementById('btn-toggle-timeline');
        if (!card || !btnToggle) return;

        const storageKey = 'vt-timeline-collapsed';

        const applyState = (collapsed) => {
            card.classList.toggle('collapsed', collapsed);
            btnToggle.setAttribute('aria-expanded', (!collapsed).toString());
            btnToggle.title = collapsed ? 'Expandir secuencia de jugada' : 'Comprimir secuencia de jugada';
        };

        const setTimelineCollapsed = (collapsed, persist = true) => {
            applyState(collapsed);
            if (persist) {
                localStorage.setItem(storageKey, collapsed ? '1' : '0');
            }
        };

        const savedState = localStorage.getItem(storageKey) === '1';
        setTimelineCollapsed(savedState, false);

        btnToggle.addEventListener('click', () => {
            const willCollapse = !card.classList.contains('collapsed');
            setTimelineCollapsed(willCollapse, true);
        });
    }

    /**
     * Inicializa y controla las acciones de apertura y cierre del modal de ayuda
     */
    setupHelpModal() {
        const modal = document.getElementById('modal-help');
        const btnOpen = document.getElementById('btn-help');
        const btnClose = document.getElementById('btn-close-help');
        const btnOk = document.getElementById('btn-help-ok');

        const showModal = () => modal.style.display = 'flex';
        const hideModal = () => modal.style.display = 'none';

        btnOpen.addEventListener('click', showModal);
        btnClose.addEventListener('click', hideModal);
        btnOk.addEventListener('click', hideModal);

        // Cerrar si hace clic fuera de la tarjeta del modal
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal();
            }
        });
    }
}

// Inicializar la aplicación cuando el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
