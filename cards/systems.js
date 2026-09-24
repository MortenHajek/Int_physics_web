/* cards/systems.js — Particle-sets collision mini-animation
 *
 * Pattern mirrors cards/vectors.js / kinematics.js / dynamics.js / energy.js:
 *   mount(canvas) — called once with the card's <canvas> element.
 *
 * Two equal-mass boxes on a frictionless floor. Elastic head-on collision:
 *   p = m v   →   incoming stops dead, target leaves with the full velocity.
 *
 * Cycle (4 phases, constant velocity per phase):
 *   1) B1 enters from off-canvas left and stops at the contact slot xL.
 *   2) B2 (which had been resting at the contact slot xR) exits to the right.
 *   3) B2 returns from off-canvas right and stops at xR.
 *   4) B1 (now resting at xL) exits to the left. Loop.
 *
 * xL/xR are positioned so the two boxes touch at canvas centre.
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

    const CYCLE_MS     = 14000;   // total cycle, ms (4 phases of equal length)
    const BOX_SIZE     = 42;      // px (~30% larger)
    const OFFSCREEN    = 70;      // px past edge — box centre fully off-canvas
    const GROUND_Y_REL = 0.66;
    const V_LEN        = 30;      // px velocity arrow length

    function colours() {
        const s = getComputedStyle(document.documentElement);
        return {
            ink:   s.getPropertyValue('--ink').trim()       || '#363026',
            soft:  s.getPropertyValue('--ink-soft').trim()  || '#4d4436',
            faint: s.getPropertyValue('--ink-faint').trim() || '#7A6A52',
            acc:   s.getPropertyValue('--c-systems').trim() || '#5a3578',
            paper: s.getPropertyValue('--paper').trim()     || '#F8F3E5',
        };
    }

    function drawArrow(ctx, x1, y1, x2, y2, color, lw) { CK.arrow(ctx, x1, y1, x2, y2, color, (lw || 1.5) + 0.3); }

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

        function drawGround(groundY) {
            ctx.save();
            ctx.strokeStyle = col.ink;
            ctx.lineWidth   = 1.4;
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.moveTo(0, groundY);
            ctx.lineTo(W, groundY);
            ctx.stroke();

            ctx.globalAlpha = 0.5;
            ctx.lineWidth   = 0.9;
            const step = 9, len = 7;
            for (let x = -10; x < W + 10; x += step) {
                ctx.beginPath();
                ctx.moveTo(x, groundY);
                ctx.lineTo(x - len, groundY + len);
                ctx.stroke();
            }
            ctx.restore();
        }

        function drawBox(cx, groundY) {
            const half = BOX_SIZE / 2;
            const top  = groundY - BOX_SIZE;
            const left = cx - half;
            ctx.save();
            ctx.fillStyle = CK.INK.block;
            ctx.fillRect(left, top, BOX_SIZE, BOX_SIZE);
            ctx.strokeStyle = col.ink;
            ctx.lineWidth   = 1.6;
            ctx.setLineDash([]);
            ctx.strokeRect(left + 0.5, top + 0.5, BOX_SIZE - 1, BOX_SIZE - 1);
            ctx.fillStyle    = col.ink;
            ctx.font         = 'italic 20px "Source Serif 4", Georgia, serif';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('m', cx, top + half + 1);
            ctx.restore();
        }

        function drawVelocity(cx, groundY, dir) {
            const top    = groundY - BOX_SIZE;
            const arrowY = top - 12;
            const half   = BOX_SIZE / 2;
            // start arrow from above the leading edge of the moving box
            const startX = cx - dir * half * 0.55;
            const endX   = startX + dir * V_LEN;
            drawArrow(ctx, startX, arrowY, endX, arrowY, CK.INK.green, 1.6);
            CK.vec(ctx, 'v', endX + dir * 10, arrowY - 1, CK.INK.green, 15);
        }

        let t0 = null;

        function frame(ts) {
            if (t0 === null) t0 = ts;
            const t        = (ts - t0) % CYCLE_MS;
            const phaseDur = CYCLE_MS / 4;

            const groundY  = GROUND_Y_REL * H;
            const half     = BOX_SIZE / 2;
            const xMid     = W / 2;
            const xL       = xMid - half;          // left contact slot
            const xR       = xMid + half;          // right contact slot
            const offLeft  = -OFFSCREEN;
            const offRight = W + OFFSCREEN;

            // Four constant-velocity phases:
            //   1) B1 :  offLeft → xL          B2 at xR             (B1 moving +)
            //   2) B1 at xL                    B2 :  xR → offRight  (B2 moving +)
            //   3) B1 at xL                    B2 :  offRight → xR  (B2 moving −)
            //   4) B1 :  xL → offLeft          B2 at xR             (B1 moving −)
            let b1X, b2X, mover, dir;
            if (t < phaseDur) {
                const p = t / phaseDur;
                b1X = offLeft + (xL - offLeft) * p;
                b2X = xR;
                mover = 1; dir = +1;
            } else if (t < 2 * phaseDur) {
                const p = (t - phaseDur) / phaseDur;
                b1X = xL;
                b2X = xR + (offRight - xR) * p;
                mover = 2; dir = +1;
            } else if (t < 3 * phaseDur) {
                const p = (t - 2 * phaseDur) / phaseDur;
                b1X = xL;
                b2X = offRight + (xR - offRight) * p;
                mover = 2; dir = -1;
            } else {
                const p = (t - 3 * phaseDur) / phaseDur;
                b1X = xL + (offLeft - xL) * p;
                b2X = xR;
                mover = 1; dir = -1;
            }

            ctx.clearRect(0, 0, W, H);
            drawGround(groundY);
            drawBox(b1X, groundY);
            drawBox(b2X, groundY);
            drawVelocity(mover === 1 ? b1X : b2X, groundY, dir);

        }

        window.addEventListener('resize', () => { col = colours(); });

        CK.stageOf(canvas);
        CK.loop(canvas, frame);
    }

    function init() {
        const canvas = document.getElementById('card-systems');
        if (canvas) mount(canvas);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
