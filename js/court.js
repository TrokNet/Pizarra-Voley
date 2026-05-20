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
        this.chkZones = document.getElementById('chk-show-zones');
        this.chkNet = document.getElementById('chk-show-net');
        
        this.currentView = 'full'; // 'full' o 'half'
        this.currentStyle = 'classic-blue';
        
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
        
        this.chkZones.addEventListener('change', (e) => {
            this.toggleZones(e.target.checked);
        });
        
        this.chkNet.addEventListener('change', (e) => {
            this.toggleNet(e.target.checked);
        });
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
        if (view === 'full') {
            this.btnFull.classList.add('active');
            this.btnHalf.classList.remove('active');
            // Cambiar ViewBox a cancha completa (1000x600)
            this.courtSvg.setAttribute('viewBox', '0 0 1000 600');
            this.currentView = 'full';
            this.courtSvg.classList.remove('half-court-view');
        } else {
            this.btnHalf.classList.add('active');
            this.btnFull.classList.remove('active');
            // Cambiar ViewBox a media cancha izquierda (0 a 550 en X, mantiene 600 en Y)
            // Esto permite ver el campo izquierdo completo y la red central en el borde derecho
            this.courtSvg.setAttribute('viewBox', '0 0 550 600');
            this.currentView = 'half';
            this.courtSvg.classList.add('half-court-view');
        }
        
        // Despachar evento para notificar que la vista cambió (por si otros módulos necesitan reajustar)
        window.dispatchEvent(new CustomEvent('court-view-changed', { detail: { view } }));
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
