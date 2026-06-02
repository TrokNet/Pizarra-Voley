/**
 * VOLEYTACTICS - COURT MODULE (js/court.js)
 * Maneja el estilo visual, visibilidad de elementos y adaptabilidad de la cancha SVG.
 */

export class CourtManager {
    constructor() {
        this.courtSvg = document.getElementById('volleyball-court');
        this.courtStyleSelect = document.getElementById('select-court-style');
        this.btnFull = document.getElementById('btn-court-full');
        this.btnHalf = document.getElementById('btn-court-half');
        this.btnOrientationHorizontal = document.getElementById('btn-orientation-horizontal');
        this.btnOrientationVertical = document.getElementById('btn-orientation-vertical');
        this.chkZones = document.getElementById('chk-show-zones');
        this.chkNet = document.getElementById('chk-show-net');
        
        this.currentView = 'full'; // 'full' o 'half'
        this.currentHalfOrientation = 'vertical'; // 'horizontal' o 'vertical'
        this.currentStyle = 'classic-blue';
        this.sceneLayers = [
            'court-zones-visual',
            'court-lines',
            'court-zones-text',
            'tactical-drawings-group',
            'court-net-visual',
            'players-group',
            'drag-proxy'
        ];
        
        this.init();
    }

    init() {
        // Cargar estilo inicial
        this.setCourtStyle(this.courtStyleSelect.value);
        
        // Listeners
        this.courtStyleSelect.addEventListener('change', (e) => {
            this.setCourtStyle(e.target.value);
        });
        
        this.btnFull.addEventListener('click', () => this.setView('full'));
        this.btnHalf.addEventListener('click', () => this.setView('half'));
        this.btnOrientationHorizontal.addEventListener('click', () => this.setHalfOrientation('horizontal'));
        this.btnOrientationVertical.addEventListener('click', () => this.setHalfOrientation('vertical'));
        
        this.chkZones.addEventListener('change', (e) => {
            this.toggleZones(e.target.checked);
        });
        
        this.chkNet.addEventListener('change', (e) => {
            this.toggleNet(e.target.checked);
        });

        this.applyViewBox();
        this.updateOrientationControlsState();
    }

    /**
     * Establece el estilo de color de la cancha
     * @param {string} styleName - 'classic-blue', 'neon-dark', 'hardwood', 'minimalist'
     */
    setCourtStyle(styleName) {
        // Remover estilos anteriores del SVG
        this.courtSvg.classList.remove(this.currentStyle);
        this.currentStyle = styleName;
        this.courtSvg.classList.add(styleName);
    }

    /**
     * Alterna la visualización entre Cancha Completa y Media Cancha
     * @param {string} view - 'full' o 'half'
     */
    setView(view) {
        this.currentView = view === 'half' ? 'half' : 'full';

        if (this.currentView === 'full') {
            this.btnFull.classList.add('active');
            this.btnHalf.classList.remove('active');
        } else {
            this.btnHalf.classList.add('active');
            this.btnFull.classList.remove('active');
        }

        this.updateOrientationControlsState();
        this.applyViewBox();
    }

    setHalfOrientation(orientation) {
        this.currentHalfOrientation = orientation === 'vertical' ? 'vertical' : 'horizontal';

        this.btnOrientationHorizontal.classList.toggle('active', this.currentHalfOrientation === 'horizontal');
        this.btnOrientationVertical.classList.toggle('active', this.currentHalfOrientation === 'vertical');

        if (this.currentView === 'half') {
            this.applyViewBox();
        }
    }

    updateOrientationControlsState() {
        const isHalf = this.currentView === 'half';
        this.btnOrientationHorizontal.disabled = !isHalf;
        this.btnOrientationVertical.disabled = !isHalf;
    }

    applySceneTransform(transformValue) {
        this.sceneLayers.forEach((layerId) => {
            const layer = document.getElementById(layerId);
            if (!layer) return;

            if (transformValue) {
                layer.setAttribute('transform', transformValue);
            } else {
                layer.removeAttribute('transform');
            }
        });
    }

    applyViewBox() {
        let viewBox = '0 0 1000 600';
        let dragBounds = { minX: 20, maxX: 980, minY: 20, maxY: 580 };
        let transformValue = '';
        let useRotatedHalf = false;

        this.courtSvg.classList.remove('half-court-view', 'half-court-horizontal', 'half-court-vertical');

        if (this.currentView === 'half') {
            this.courtSvg.classList.add('half-court-view');

            // Media cancha siempre muestra solo el lado táctico propio (mitad izquierda).
            dragBounds = { minX: 20, maxX: 480, minY: 20, maxY: 580 };

            if (this.currentHalfOrientation === 'horizontal') {
                // Rotación visual de la misma media cancha para verla en formato apaisado.
                viewBox = '-50 50 600 500';
                transformValue = 'rotate(90 250 300)';
                useRotatedHalf = true;
                this.courtSvg.classList.add('half-court-horizontal');
            } else {
                // Vista natural y ampliada de la media cancha local.
                viewBox = '50 50 450 500';
                this.courtSvg.classList.add('half-court-vertical');
            }
        }

        this.applySceneTransform(transformValue);
        this.courtSvg.setAttribute('viewBox', viewBox);

        // Despachar evento para notificar cambios de vista y límites de interacción.
        window.dispatchEvent(new CustomEvent('court-view-changed', {
            detail: {
                view: this.currentView,
                orientation: this.currentHalfOrientation,
                dragBounds,
                isHalfOwnCourt: this.currentView === 'half',
                useRotatedHalf
            }
        }));
    }

    /**
     * Muestra u oculta las etiquetas de zonas reglamentarias
     * @param {boolean} show 
     */
    toggleZones(show) {
        const zonesGroup = document.getElementById('court-zones-text');
        if (zonesGroup) {
            zonesGroup.style.display = show ? 'block' : 'none';
        }
    }

    /**
     * Muestra u oculta la red táctica
     * @param {boolean} show 
     */
    toggleNet(show) {
        const netVisual = document.getElementById('court-net-visual');
        const netUnder = document.getElementById('net-under-line');
        if (netVisual) {
            netVisual.style.display = show ? 'block' : 'none';
        }
        if (netUnder) {
            netUnder.style.display = show ? 'block' : 'none';
        }
    }
}
