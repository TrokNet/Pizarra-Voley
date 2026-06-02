/**
 * VOLEYTACTICS - DRAWING MODULE (js/drawing.js)
 * Maneja los trazos de pizarra táctica (libre, carrera, pases) sobre la cancha usando vectores SVG.
 */

export class DrawingManager {
    constructor() {
        this.courtSvg = document.getElementById('volleyball-court');
        this.drawingsGroup = document.getElementById('tactical-drawings-group');
        this.strokeWidthSlider = document.getElementById('range-stroke-width');
        this.strokeWidthValue = document.getElementById('stroke-width-value');
        
        // Elementos de herramientas
        this.tools = {
            select: document.getElementById('tool-select'),
            draw: document.getElementById('tool-draw'),
            run: document.getElementById('tool-arrow-player'),
            pass: document.getElementById('tool-arrow-ball'),
            eraser: document.getElementById('tool-eraser')
        };
        this.btnClear = document.getElementById('btn-clear-drawings');
        
        // Estado
        this.activeTool = 'select'; // 'select', 'draw', 'run', 'pass', 'eraser'
        this.currentColor = '#ff4757'; // Rojo por defecto
        this.currentStrokeWidth = 4;
        this.useRotatedHalf = false;
        
        // Estado del trazo actual
        this.isDrawing = false;
        this.activeElement = null;
        this.startPoint = { x: 0, y: 0 };
        this.pointsHistory = []; // Para deshacer (Undo) si es necesario
        
        this.init();
    }

    init() {
        this.setupToolSelectors();
        this.setupColorPicker();
        this.setupStrokeSlider();
        this.setupDrawingListeners();
        
        this.btnClear.addEventListener('click', () => this.clearAllDrawings());
        
        // Escuchar si cambiamos la vista de la cancha para reajustar si fuera necesario
        window.addEventListener('court-view-changed', (e) => {
            this.useRotatedHalf = Boolean(e?.detail?.useRotatedHalf);
            // Los dibujos SVG se adaptan solos gracias a la escala del viewBox!
        });
    }

    /**
     * Configura los botones de selección de herramientas
     */
    setupToolSelectors() {
        Object.keys(this.tools).forEach(toolName => {
            const btn = this.tools[toolName];
            btn.addEventListener('click', () => {
                // Quitar clase activa a todas las herramientas
                Object.values(this.tools).forEach(b => b.classList.remove('active'));
                
                // Activar la seleccionada
                btn.classList.add('active');
                this.activeTool = btn.id.replace('tool-', '');
                
                // Si es borrador, cambiamos estilo en la cancha para cursor y hover
                if (this.activeTool === 'eraser') {
                    this.courtSvg.classList.add('eraser-active');
                } else {
                    this.courtSvg.classList.remove('eraser-active');
                }
            });
        });
    }

    /**
     * Configura los selectores de colores
     */
    setupColorPicker() {
        const colorBtns = document.querySelectorAll('.color-btn');
        colorBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                colorBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentColor = btn.dataset.color;
            });
        });
    }

    /**
     * Configura el slider de grosor de línea
     */
    setupStrokeSlider() {
        this.strokeWidthSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            this.currentStrokeWidth = val;
            this.strokeWidthValue.textContent = `${val}px`;
        });
    }

    /**
     * Crea un marcador de punta de flecha en el SVG dynamically según el color elegido
     */
    ensureMarker(color) {
        const cleanColor = color.replace('#', '');
        const markerId = `arrow-marker-${cleanColor}`;
        const defs = this.courtSvg.querySelector('defs');
        
        if (!document.getElementById(markerId)) {
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            marker.setAttribute('id', markerId);
            marker.setAttribute('viewBox', '0 0 10 10');
            marker.setAttribute('refX', '7'); // Ajustar para que quede centrado al final de la línea
            marker.setAttribute('refY', '5');
            marker.setAttribute('markerWidth', '6');
            marker.setAttribute('markerHeight', '6');
            marker.setAttribute('orient', 'auto-start-reverse');
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M 0 1 L 8 5 L 0 9 z');
            path.setAttribute('fill', color);
            
            marker.appendChild(path);
            defs.appendChild(marker);
        }
        
        return `url(#${markerId})`;
    }

    /**
     * Convierte coordenadas de ratón/toque a coordenadas de espacio de trabajo SVG
     */
    getSVGCoords(e) {
        const pt = this.courtSvg.createSVGPoint();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        pt.x = clientX;
        pt.y = clientY;
        
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
     * Inicializa los listeners de dibujo libre y trazado de flechas
     */
    setupDrawingListeners() {
        const startDraw = (e) => {
            // Evitar dibujar si hacemos clic en una ficha o si la herramienta activa es "Mover" (select)
            if (e.target.closest('.player-token') || this.activeTool === 'select') {
                return;
            }

            // Si es borrador, borrar trazos al hacer clic sobre ellos
            if (this.activeTool === 'eraser') {
                const targetDrawing = e.target.closest('#tactical-drawings-group path, #tactical-drawings-group line, #tactical-drawings-group g');
                if (targetDrawing) {
                    targetDrawing.remove();
                    this.notifyDrawingsChanged();
                }
                return;
            }

            e.preventDefault();
            this.isDrawing = true;
            const coords = this.getSVGCoords(e);
            this.startPoint = { x: coords.x, y: coords.y };

            if (this.activeTool === 'draw') {
                // Herramienta Lápiz: Crear elemento <path> para trazo libre
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke', this.currentColor);
                path.setAttribute('stroke-width', this.currentStrokeWidth);
                path.setAttribute('stroke-linecap', 'round');
                path.setAttribute('stroke-linejoin', 'round');
                path.setAttribute('d', `M ${coords.x} ${coords.y}`);
                
                // Guardar datos tácticos en dataset para poder exportarlo después
                path.dataset.tool = 'draw';
                path.dataset.color = this.currentColor;
                path.dataset.width = this.currentStrokeWidth;
                
                this.drawingsGroup.appendChild(path);
                this.activeElement = path;
            } else if (this.activeTool === 'run' || this.activeTool === 'pass') {
                // Herramientas de Flechas: Crear una línea táctica con punta de flecha
                const isPass = this.activeTool === 'pass';
                const arrowMarker = this.ensureMarker(this.currentColor);
                
                const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                group.dataset.tool = this.activeTool;
                
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', coords.x);
                line.setAttribute('y1', coords.y);
                line.setAttribute('x2', coords.x);
                line.setAttribute('y2', coords.y);
                line.setAttribute('stroke', this.currentColor);
                line.setAttribute('stroke-width', this.currentStrokeWidth);
                line.setAttribute('stroke-linecap', 'round');
                line.setAttribute('marker-end', arrowMarker);
                
                if (isPass) {
                    // Si es pase, poner línea discontinua
                    line.setAttribute('stroke-dasharray', '8 6');
                }
                
                group.appendChild(line);
                this.drawingsGroup.appendChild(group);
                this.activeElement = group;
            }
        };

        const doDraw = (e) => {
            if (!this.isDrawing || !this.activeElement) return;
            e.preventDefault();
            
            const coords = this.getSVGCoords(e);
            
            if (this.activeTool === 'draw') {
                // Lápiz: Añadir el punto al trazado libre
                let d = this.activeElement.getAttribute('d');
                d += ` L ${coords.x} ${coords.y}`;
                this.activeElement.setAttribute('d', d);
            } else if (this.activeTool === 'run' || this.activeTool === 'pass') {
                // Flechas: Actualizar extremo final de la línea táctica
                const line = this.activeElement.querySelector('line');
                if (line) {
                    line.setAttribute('x2', coords.x);
                    line.setAttribute('y2', coords.y);
                }
            }
        };

        const stopDraw = () => {
            if (this.isDrawing) {
                this.isDrawing = false;
                
                // Si la línea de flecha es demasiado corta, descartarla (ej. clics accidentales)
                if (this.activeTool === 'run' || this.activeTool === 'pass') {
                    const line = this.activeElement.querySelector('line');
                    if (line) {
                        const x1 = parseFloat(line.getAttribute('x1'));
                        const y1 = parseFloat(line.getAttribute('y1'));
                        const x2 = parseFloat(line.getAttribute('x2'));
                        const y2 = parseFloat(line.getAttribute('y2'));
                        const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                        
                        if (length < 8) {
                            this.activeElement.remove();
                        }
                    }
                }
                
                this.activeElement = null;
                this.notifyDrawingsChanged();
            }
        };

        // Escuchar clics sobre elementos existentes de dibujo para borrarlos si es borrador
        this.drawingsGroup.addEventListener('click', (e) => {
            if (this.activeTool === 'eraser') {
                e.stopPropagation();
                const pathEl = e.target.closest('path, line, g');
                if (pathEl) {
                    pathEl.remove();
                    this.notifyDrawingsChanged();
                }
            }
        });

        // Desktop mouse
        this.courtSvg.addEventListener('mousedown', startDraw);
        window.addEventListener('mousemove', doDraw);
        window.addEventListener('mouseup', stopDraw);

        // Mobile touch
        this.courtSvg.addEventListener('touchstart', startDraw, { passive: false });
        window.addEventListener('touchmove', doDraw, { passive: false });
        window.addEventListener('touchend', stopDraw);
    }

    /**
     * Limpia completamente todos los dibujos de la pizarra
     */
    clearAllDrawings() {
        this.drawingsGroup.innerHTML = '';
        this.notifyDrawingsChanged();
    }

    /**
     * Despacha un evento para notificar que los dibujos han cambiado
     */
    notifyDrawingsChanged() {
        window.dispatchEvent(new CustomEvent('drawings-changed'));
    }

    /**
     * Serializa los dibujos actuales a una estructura JSON (para guardar/exportar)
     */
    serializeDrawings() {
        const drawings = [];
        
        // Recorrer todos los trazos libres (path)
        const paths = this.drawingsGroup.querySelectorAll('path');
        paths.forEach(p => {
            drawings.push({
                type: 'path',
                d: p.getAttribute('d'),
                color: p.getAttribute('stroke'),
                width: p.getAttribute('stroke-width')
            });
        });

        // Recorrer todas las flechas (g)
        const groups = this.drawingsGroup.querySelectorAll('g');
        groups.forEach(g => {
            const line = g.querySelector('line');
            if (line) {
                drawings.push({
                    type: 'arrow',
                    tool: g.dataset.tool, // 'run' o 'pass'
                    x1: line.getAttribute('x1'),
                    y1: line.getAttribute('y1'),
                    x2: line.getAttribute('x2'),
                    y2: line.getAttribute('y2'),
                    color: line.getAttribute('stroke'),
                    width: line.getAttribute('stroke-width')
                });
            }
        });

        return drawings;
    }

    /**
     * Reconstruye los dibujos a partir de datos serializados JSON (para cargar)
     */
    deserializeDrawings(drawingsData) {
        this.clearAllDrawings();
        if (!drawingsData || !Array.isArray(drawingsData)) return;

        drawingsData.forEach(data => {
            if (data.type === 'path') {
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke', data.color);
                path.setAttribute('stroke-width', data.width);
                path.setAttribute('stroke-linecap', 'round');
                path.setAttribute('stroke-linejoin', 'round');
                path.setAttribute('d', data.d);
                this.drawingsGroup.appendChild(path);
            } else if (data.type === 'arrow') {
                const arrowMarker = this.ensureMarker(data.color);
                const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                group.dataset.tool = data.tool;

                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', data.x1);
                line.setAttribute('y1', data.y1);
                line.setAttribute('x2', data.x2);
                line.setAttribute('y2', data.y2);
                line.setAttribute('stroke', data.color);
                line.setAttribute('stroke-width', data.width);
                line.setAttribute('stroke-linecap', 'round');
                line.setAttribute('marker-end', arrowMarker);

                if (data.tool === 'pass') {
                    line.setAttribute('stroke-dasharray', '8 6');
                }

                group.appendChild(line);
                this.drawingsGroup.appendChild(group);
            }
        });
    }
}
