/* cards/gravity.js — Kepler-orbit mini-animation for the gravity card
 *
 * Pattern mirrors the other cards/*.js: mount(canvas) on DOMContentLoaded.
 *
 * A real two-body orbit, not a decorative loop: the star sits at a focus (not
 * the centre), and the position comes from solving Kepler's equation
 * M = E − e·sin E each frame, so the planet races through perihelion and
 * crawls at aphelion. The shaded wedge is the area swept in a fixed slice of
 * time — it changes shape completely and never changes size, which is the
 * second law drawn rather than stated.
 *
 *   F = G·Mm/r²
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

    const PERIOD_MS = 11000;
    const ECC       = 0.68;
    const SWEEP     = 1 / 13;     // wedge width, as a fraction of the period
    const STAR_R    = 17;
    const PLANET_R  = 5;
    const ARC_PTS   = 26;

    function colours() {
        const s = getComputedStyle(document.documentElement);
        return {
            ink:   s.getPropertyValue('--ink').trim()       || '#363026',
            soft:  s.getPropertyValue('--ink-soft').trim()  || '#4d4436',
            faint: s.getPropertyValue('--ink-faint').trim() || '#7A6A52',
            acc:   s.getPropertyValue('--c-gravity').trim() || '#163868',
            paper: s.getPropertyValue('--paper').trim()     || '#F8F3E5',
        };
    }

    function hexToRgba(hex, alpha) {
        let h = (hex || '').replace('#', '').trim();
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        const n = parseInt(h, 16);
        if (!isFinite(n)) return 'rgba(22,56,104,' + alpha + ')';
        return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
    }

    /* Kepler's equation, Newton–Raphson. Converges in a few steps at this e. */
    function eccentricAnomaly(M, e) {
        let E = M + e * Math.sin(M);
        for (let i = 0; i < 5; i++) {
            E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
        }
        return E;
    }

    function mount(canvas) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        let W = 0, H = 0, col = colours();

        function resize() {
            const rect = canvas.getBoundingClientRect();
            W = rect.width; H = rect.height;
            canvas.width  = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        resize();
        new ResizeObserver(resize).observe(canvas);

        let t0 = null;

        function frame(ts) {
            if (t0 === null) t0 = ts;
            const u = ((ts - t0) % PERIOD_MS) / PERIOD_MS;

            /* Geometry — the star is at the right-hand focus. */
            const b  = Math.min(H * 0.25, W * 0.19);
            const a  = b / Math.sqrt(1 - ECC * ECC);
            const sx = W * 0.46 + 30, sy = H * 0.44;     // focus, i.e. the star
            const ecx = sx - a * ECC, ecy = sy;          // centre of the ellipse

            /* Position relative to the focus, for any phase of the orbit. */
            function at(frac) {
                const M = frac * 2 * Math.PI;
                const E = eccentricAnomaly(M, ECC);
                return {
                    x: sx + a * (Math.cos(E) - ECC),
                    y: sy + b * Math.sin(E),
                    r: a * (1 - ECC * Math.cos(E)),
                };
            }

            const p = at(u);

            ctx.clearRect(0, 0, W, H);

            /* ── The orbit itself ────────────────────────────────────────── */
            ctx.save();
            ctx.strokeStyle = col.faint; ctx.globalAlpha = 0.45;
            ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
            ctx.beginPath(); ctx.ellipse(ecx, ecy, a, b, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();

            /* ── Equal areas: the wedge swept in the last SWEEP of a period ─ */
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            for (let i = 0; i <= ARC_PTS; i++) {
                const q = at(u - SWEEP + SWEEP * i / ARC_PTS);
                ctx.lineTo(q.x, q.y);
            }
            ctx.closePath();
            ctx.fillStyle = hexToRgba(col.acc, 0.16);
            ctx.fill();
            ctx.strokeStyle = hexToRgba(col.acc, 0.42);
            ctx.lineWidth = 1; ctx.setLineDash([]);
            ctx.stroke();
            ctx.restore();

            /* ── Radius vector ───────────────────────────────────────────── */
            ctx.save();
            ctx.strokeStyle = col.acc; ctx.globalAlpha = 0.6;
            ctx.lineWidth = 1.1; ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(p.x, p.y); ctx.stroke();
            ctx.restore();

            /* ── Star ────────────────────────────────────────────────────── */
            ctx.save();
            ctx.strokeStyle = col.acc; ctx.globalAlpha = 0.3; ctx.lineWidth = 1;
            ctx.setLineDash([]);
            ctx.beginPath(); ctx.arc(sx, sy, STAR_R + 4, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.fillStyle = col.acc;
            ctx.beginPath(); ctx.arc(sx, sy, STAR_R, 0, Math.PI * 2); ctx.fill();
            const gr = ctx.createRadialGradient(
                sx - STAR_R * 0.35, sy - STAR_R * 0.35, 1, sx, sy, STAR_R);
            gr.addColorStop(0, 'rgba(255,255,255,0.32)');
            gr.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gr;
            ctx.beginPath(); ctx.arc(sx, sy, STAR_R, 0, Math.PI * 2); ctx.fill();
            ctx.restore();

            /* ── Planet ──────────────────────────────────────────────────── */
            ctx.save();
            ctx.fillStyle = col.soft;
            ctx.beginPath(); ctx.arc(p.x, p.y, PLANET_R, 0, Math.PI * 2); ctx.fill();
            const pg = ctx.createRadialGradient(p.x - 1.4, p.y - 1.4, 0.3, p.x, p.y, PLANET_R);
            pg.addColorStop(0, 'rgba(255,255,255,0.42)');
            pg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = pg;
            ctx.beginPath(); ctx.arc(p.x, p.y, PLANET_R, 0, Math.PI * 2); ctx.fill();
            ctx.restore();

            /* ── Apsides, so the eccentricity is readable ────────────────── */
            ctx.save();
            ctx.fillStyle = col.faint; ctx.globalAlpha = 0.55;
            ctx.beginPath(); ctx.arc(ecx + a, ecy, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(ecx - a, ecy, 2, 0, Math.PI * 2); ctx.fill();
            ctx.restore();

        }

        window.addEventListener('resize', () => { col = colours(); });
        CK.stageOf(canvas);
        CK.loop(canvas, frame);
    }

    function init() {
        const canvas = document.getElementById('card-gravity');
        if (canvas) mount(canvas);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
}());
