/* cards/rotation.js — Pendulum mini-animation for the rotation card
 *
 * Pattern mirrors the other cards/*.js:
 *   mount(canvas) — called once with the card's <canvas> element.
 *
 * Simple-pendulum SHM:  θ(t) = θ_max · cos(ω t)
 *   At extremes (θ = ±θ_max): bob momentarily at rest (ε max, M max).
 *   At the bottom (θ = 0):     bob at maximum speed (ε = 0, M = 0).
 *
 *   ΣM = I ε   — Newton's 2nd law in rotation.
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

    const PERIOD_MS = 4200;             // ms per full oscillation
    const THETA_MAX = 42 * Math.PI/180; // amplitude (rad) — ~42° from vertical
    const BOB_R     = 12;
    const PIVOT_R   = 5;
    const ROD_HALF  = 4.5;              // half-width of solid rod (px)

    function colours() {
        const s = getComputedStyle(document.documentElement);
        return {
            ink:   s.getPropertyValue('--ink').trim()        || '#363026',
            soft:  s.getPropertyValue('--ink-soft').trim()   || '#4d4436',
            faint: s.getPropertyValue('--ink-faint').trim()  || '#7A6A52',
            acc:   s.getPropertyValue('--c-rotation').trim() || '#8a2840',
            paper: s.getPropertyValue('--paper').trim()      || '#F8F3E5',
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

        function drawMount(pivotX, pivotY) {
            // small horizontal bracket above the pivot, plus hatching above it
            // (matches the dynamics-card ground-hatching language, rotated)
            const halfW = 22;
            ctx.save();
            ctx.strokeStyle = col.ink;
            ctx.lineWidth   = 1.4;
            ctx.globalAlpha = 0.75;
            ctx.beginPath();
            ctx.moveTo(pivotX - halfW, pivotY - 7);
            ctx.lineTo(pivotX + halfW, pivotY - 7);
            ctx.stroke();

            ctx.globalAlpha = 0.5;
            ctx.lineWidth   = 0.9;
            const step = 7, len = 6;
            for (let x = pivotX - halfW + 2; x <= pivotX + halfW; x += step) {
                ctx.beginPath();
                ctx.moveTo(x, pivotY - 7);
                ctx.lineTo(x + len, pivotY - 7 - len);
                ctx.stroke();
            }
            ctx.restore();
        }

        function drawTraceArc(pivotX, pivotY, L) {
            ctx.save();
            ctx.strokeStyle = col.soft;
            ctx.globalAlpha = 0.22;
            ctx.lineWidth   = 1;
            ctx.setLineDash([3, 4]);
            ctx.beginPath();
            ctx.arc(pivotX, pivotY, L,
                Math.PI / 2 - THETA_MAX,
                Math.PI / 2 + THETA_MAX);
            ctx.stroke();
            ctx.restore();
        }

        function drawEquilibrium(pivotX, pivotY, L) {
            // faint vertical dashed line marking θ = 0
            ctx.save();
            ctx.strokeStyle = col.faint;
            ctx.globalAlpha = 0.35;
            ctx.lineWidth   = 0.8;
            ctx.setLineDash([2, 4]);
            ctx.beginPath();
            ctx.moveTo(pivotX, pivotY + 6);
            ctx.lineTo(pivotX, pivotY + L + BOB_R + 6);
            ctx.stroke();
            ctx.restore();
        }

        function frame(ts) {
            if (t0 === null) t0 = ts;
            const t     = (ts - t0) % PERIOD_MS;
            const phase = (t / PERIOD_MS) * 2 * Math.PI;
            const theta = THETA_MAX * Math.cos(phase);

            // Layout
            const pivotX = W * 0.5;
            const pivotY = H * 0.18;
            const L      = Math.min(H * 0.58, W * 0.42);  // string length

            const bobX = pivotX + L * Math.sin(theta);
            const bobY = pivotY + L * Math.cos(theta);

            ctx.clearRect(0, 0, W, H);

            drawMount(pivotX, pivotY);
            drawEquilibrium(pivotX, pivotY, L);
            drawTraceArc(pivotX, pivotY, L);

            // ── Solid rod ───────────────────────────────────────────────
            {
                const dx  = bobX - pivotX;
                const dy  = bobY - pivotY;
                const len = Math.hypot(dx, dy);
                const nx  = -dy / len;   // perpendicular unit vector
                const ny  =  dx / len;

                // Four corners of the rod rectangle
                const ax = pivotX + nx * ROD_HALF, ay = pivotY + ny * ROD_HALF;
                const bx = pivotX - nx * ROD_HALF, by = pivotY - ny * ROD_HALF;
                const cx = bobX   - nx * ROD_HALF, cy = bobY   - ny * ROD_HALF;
                const dx2= bobX   + nx * ROD_HALF, dy2= bobY   + ny * ROD_HALF;

                ctx.save();

                // Base fill — rod body
                ctx.beginPath();
                ctx.moveTo(ax, ay); ctx.lineTo(dx2, dy2);
                ctx.lineTo(cx, cy); ctx.lineTo(bx, by);
                ctx.closePath();
                ctx.fillStyle = col.ink;
                ctx.fill();

                // Cylindrical shading: light edge → dark edge across the rod width
                const shadeGrad = ctx.createLinearGradient(
                    pivotX + nx * ROD_HALF, pivotY + ny * ROD_HALF,
                    pivotX - nx * ROD_HALF, pivotY - ny * ROD_HALF
                );
                shadeGrad.addColorStop(0,    'rgba(255,255,255,0.28)');
                shadeGrad.addColorStop(0.30, 'rgba(255,255,255,0.08)');
                shadeGrad.addColorStop(0.65, 'rgba(0,0,0,0.06)');
                shadeGrad.addColorStop(1,    'rgba(0,0,0,0.30)');

                ctx.beginPath();
                ctx.moveTo(ax, ay); ctx.lineTo(dx2, dy2);
                ctx.lineTo(cx, cy); ctx.lineTo(bx, by);
                ctx.closePath();
                ctx.fillStyle = shadeGrad;
                ctx.fill();

                // Thin edge outline for crispness
                ctx.beginPath();
                ctx.moveTo(ax, ay); ctx.lineTo(dx2, dy2);
                ctx.lineTo(cx, cy); ctx.lineTo(bx, by);
                ctx.closePath();
                ctx.strokeStyle = 'rgba(0,0,0,0.18)';
                ctx.lineWidth = 0.6;
                ctx.stroke();

                ctx.restore();
            }

            // ── Pivot pin ───────────────────────────────────────────────
            ctx.save();
            // Pin bearing ring
            ctx.beginPath();
            ctx.arc(pivotX, pivotY, PIVOT_R, 0, Math.PI * 2);
            ctx.fillStyle = col.ink;
            ctx.fill();
            // Highlight on pin
            ctx.beginPath();
            ctx.arc(pivotX - 1.5, pivotY - 1.5, PIVOT_R * 0.55, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.30)';
            ctx.fill();
            ctx.restore();

            // ── Bob ─────────────────────────────────────────────────────
            ctx.save();
            ctx.fillStyle = col.acc;
            ctx.beginPath();
            ctx.arc(bobX, bobY, BOB_R, 0, Math.PI * 2);
            ctx.fill();
            // soft highlight
            const grad = ctx.createRadialGradient(
                bobX - 3, bobY - 3, 0.5,
                bobX, bobY, BOB_R);
            grad.addColorStop(0, 'rgba(255,255,255,0.38)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(bobX, bobY, BOB_R, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

        }

        window.addEventListener('resize', () => { col = colours(); });

        CK.stageOf(canvas);
        CK.loop(canvas, frame);
    }

    function init() {
        const canvas = document.getElementById('card-rotation');
        if (canvas) mount(canvas);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
