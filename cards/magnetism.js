/* cards/magnetism.js — Charged particle gyrating in a uniform B-field
 *
 * A uniform magnetic field points OUT of the page — drawn as a regular grid
 * of encircled dots (the textbook "arrow tip emerging from the page"). A
 * positive charge moves in the plane and is bent into a closed circular
 * orbit by the Lorentz force. The velocity vector (tangent, accent colour)
 * and force vector (radial-inward, warm red) ride with the particle so the
 * F ⟂ v relationship is visible at every instant.
 *
 *   F = q v × B
 */
(function () {
    'use strict';

    /* ── the house style for card drawings (the same few helpers in every
          card): serif-italic symbols with a halo in the viewport's own tone,
          drawn subscripts and vector arrows, filled arrowheads, and a loop
          that sleeps while the card is scrolled out of view ── */
    const CK = (function () {
        const SERIF = '"Source Serif 4",Georgia,serif', SANS = '"Geist",ui-sans-serif,sans-serif';
        const INK = { blue: '#2a62a8', green: '#2d7a45', crimson: '#a8243b', violet: '#6d4a9c',
                      teal: '#127070', amber: '#c47a17', block: '#e9e1c6' };
        let halo = '#efead6';
        function stageOf(canvas) {
            const bg = getComputedStyle(canvas.parentElement).backgroundColor;
            halo = bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : halo;
            return halo;
        }
        function sym(ctx, t, x, y, col, size, align) {
            ctx.save();
            ctx.font = 'italic ' + (size || 15) + 'px ' + SERIF;
            ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
            ctx.lineJoin = 'round'; ctx.lineWidth = 3.5; ctx.strokeStyle = halo;
            ctx.strokeText(t, x, y); ctx.fillStyle = col; ctx.fillText(t, x, y);
            ctx.restore();
        }
        /* a symbol with a drawn subscript; halos first so none bites a glyph */
        function symSub(ctx, m, s, x, y, col, size, align) {
            size = size || 15;
            const ss = Math.round(size * 0.7), fm = 'italic ' + size + 'px ' + SERIF, fs = 'italic ' + ss + 'px ' + SERIF;
            ctx.save();
            ctx.font = fm; const w1 = ctx.measureText(m).width;
            ctx.font = fs; const tw = w1 + 1 + ctx.measureText(s).width;
            const x0 = align === 'right' ? x - tw : align === 'left' ? x : x - tw / 2;
            const parts = [[m, x0, y, fm], [s, x0 + w1 + 1, y + size * 0.28, fs]];
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
            ctx.lineWidth = 3.5; ctx.strokeStyle = halo;
            parts.forEach(([t, px, py, f]) => { ctx.font = f; ctx.strokeText(t, px, py); });
            ctx.fillStyle = col;
            parts.forEach(([t, px, py, f]) => { ctx.font = f; ctx.fillText(t, px, py); });
            ctx.restore();
        }
        /* a letter with a vector arrow drawn over it */
        function vec(ctx, t, x, y, col, size) {
            size = size || 15;
            sym(ctx, t, x, y, col, size);
            ctx.save();
            ctx.font = 'italic ' + size + 'px ' + SERIF;
            const w = ctx.measureText(t).width, ay = y - size * 0.64, x1 = x - w / 2, x2 = x + w / 2 + 2;
            ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.1;
            ctx.beginPath(); ctx.moveTo(x1, ay); ctx.lineTo(x2 - 2, ay); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x2 + 1, ay); ctx.lineTo(x2 - 4, ay - 2.4); ctx.lineTo(x2 - 4, ay + 2.4); ctx.closePath(); ctx.fill();
            ctx.restore();
        }
        function small(ctx, t, x, y, col, size, align) {
            ctx.save();
            ctx.font = (size || 10.5) + 'px ' + SANS;
            ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
            ctx.fillStyle = col; ctx.fillText(t, x, y);
            ctx.restore();
        }
        function arrow(ctx, x1, y1, x2, y2, col, lw) {
            const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
            if (L < 3) return;
            const ux = dx / L, uy = dy / L, hl = Math.min(10, L * 0.36), hw = hl * 0.5;
            ctx.save();
            ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw || 2;
            ctx.setLineDash([]); ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - ux * hl * 0.9, y2 - uy * hl * 0.9); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - ux * hl + uy * hw, y2 - uy * hl - ux * hw);
            ctx.lineTo(x2 - ux * hl - uy * hw, y2 - uy * hl + ux * hw);
            ctx.closePath(); ctx.fill();
            ctx.restore();
        }
        /* run frame(ts) every animation frame, but only while the canvas is on
           screen; redraw once after a resize (it clears the canvas) */
        function loop(canvas, frame) {
            let raf = 0, visible = true;
            const tick = ts => { raf = 0; frame(ts); if (visible) raf = requestAnimationFrame(tick); };
            if (window.IntersectionObserver) new IntersectionObserver(es => {
                visible = es.some(e => e.isIntersecting);
                if (visible && !raf) raf = requestAnimationFrame(tick);
            }).observe(canvas);
            raf = requestAnimationFrame(tick);
            return () => { if (!raf) requestAnimationFrame(ts => frame(ts)); };
        }
        return { INK, stageOf, sym, symSub, vec, small, arrow, loop };
    }());

    const PERIOD_MS         = 6000;   // one full orbit
    const ORBIT_R_REL       = 0.27;   // orbit radius / min(W, H)
    const PARTICLE_R        = 5.5;
    const FIELD_DOT_SPACING = 22;
    const FIELD_DOT_R_INNER = 1.5;
    const FIELD_DOT_R_OUTER = 4.2;
    const FIELD_DOT_ALPHA   = 0.32;
    const V_ARROW_LEN       = 40;
    const F_ARROW_LEN       = 32;
    const FORCE_COL         = '#a8243b';   // the site's crimson — separates F from v

    function colours() {
        const s = getComputedStyle(document.documentElement);
        return {
            ink:   s.getPropertyValue('--ink').trim()         || '#363026',
            soft:  s.getPropertyValue('--ink-soft').trim()    || '#4d4436',
            faint: s.getPropertyValue('--ink-faint').trim()   || '#7A6A52',
            paper: s.getPropertyValue('--paper').trim()       || '#F8F3E5',
            acc:   s.getPropertyValue('--c-magnetism').trim() || '#5a6878',
        };
    }

    function mount(canvas) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        let W = 0, H = 0;
        let col = colours();

        function resize() {
            const rect = canvas.getBoundingClientRect();
            W = rect.width;
            H = rect.height;
            canvas.width  = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        resize();
        new ResizeObserver(resize).observe(canvas);

        let t0 = null;

        // ── Uniform B field marker grid (B points out of the page) ─────
        function drawFieldGrid() {
            ctx.save();
            ctx.strokeStyle = col.ink;
            ctx.fillStyle   = col.ink;
            ctx.lineWidth   = 0.9;
            ctx.globalAlpha = FIELD_DOT_ALPHA;
            const startX = (W % FIELD_DOT_SPACING) / 2 + FIELD_DOT_SPACING / 2;
            const startY = (H % FIELD_DOT_SPACING) / 2 + FIELD_DOT_SPACING / 2;
            for (let y = startY; y < H; y += FIELD_DOT_SPACING) {
                for (let x = startX; x < W; x += FIELD_DOT_SPACING) {
                    ctx.beginPath();
                    ctx.arc(x, y, FIELD_DOT_R_OUTER, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(x, y, FIELD_DOT_R_INNER, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.restore();
        }

        function drawOrbit(cx, cy, R) {
            ctx.save();
            ctx.strokeStyle = col.soft;
            ctx.globalAlpha = 0.30;
            ctx.lineWidth   = 1.2;
            ctx.setLineDash([4, 5]);
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        function arrow(x1, y1, x2, y2, color, lw) { CK.arrow(ctx, x1, y1, x2, y2, color, lw || 2); }

        function drawParticle(x, y) {
            ctx.save();
            // body
            ctx.fillStyle = col.acc;
            ctx.beginPath();
            ctx.arc(x, y, PARTICLE_R, 0, Math.PI * 2);
            ctx.fill();
            // subtle radial highlight (matches the energy/electrostatics-1 idiom)
            const grad = ctx.createRadialGradient(
                x - 1.5, y - 1.8, 0.5,
                x, y, PARTICLE_R);
            grad.addColorStop(0, 'rgba(255,255,255,0.42)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, PARTICLE_R, 0, Math.PI * 2);
            ctx.fill();
            // + glyph (positive charge)
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth   = 1.5;
            ctx.lineCap     = 'round';
            const g = PARTICLE_R * 0.5;
            ctx.beginPath();
            ctx.moveTo(x - g, y);  ctx.lineTo(x + g, y);
            ctx.moveTo(x, y - g);  ctx.lineTo(x, y + g);
            ctx.stroke();
            ctx.restore();
        }

        function frame(ts) {
            if (t0 === null) t0 = ts;
            const phase = ((ts - t0) % PERIOD_MS) / PERIOD_MS * 2 * Math.PI;

            const cx = W / 2;
            const cy = H / 2;
            const R  = Math.min(W, H) * ORBIT_R_REL;

            // Particle position (clockwise in screen coords for q > 0,
            // B out of page — right-hand rule).
            const px = cx + R * Math.cos(phase);
            const py = cy + R * Math.sin(phase);

            // Unit velocity (tangent), unit force (toward centre).
            const vx = -Math.sin(phase);
            const vy =  Math.cos(phase);
            const fux = (cx - px) / R;
            const fuy = (cy - py) / R;

            ctx.clearRect(0, 0, W, H);

            drawFieldGrid();
            drawOrbit(cx, cy, R);

            // Force vector (radial-inward, warm red)
            arrow(px, py,
                  px + fux * F_ARROW_LEN,
                  py + fuy * F_ARROW_LEN,
                  FORCE_COL, 1.9);

            // Velocity vector (tangent, accent)
            arrow(px, py,
                  px + vx * V_ARROW_LEN,
                  py + vy * V_ARROW_LEN,
                  CK.INK.green, 2);

            drawParticle(px, py);

        }

        window.addEventListener('resize', () => { col = colours(); });
        CK.stageOf(canvas);
        CK.loop(canvas, frame);
    }

    function init() {
        const canvas = document.getElementById('card-magnetism');
        if (canvas) mount(canvas);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
