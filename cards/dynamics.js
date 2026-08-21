/* cards/dynamics.js — Force-and-motion mini-animation for the dynamics card
 *
 * Pattern mirrors cards/vectors.js and cards/kinematics.js:
 *   mount(canvas) — called once with the card's <canvas> element.
 *
 * Story: a mass-m box sits on a flat ground. T (tension) pulls it across the
 * card, accelerating from rest. At the far edge T vanishes, the box rests,
 * then T flips to the other side and the box accelerates back. Forces G and
 * N stay drawn always (gravity / normal reaction). Ping-pong, forever.
 */
(function () {
    'use strict';

    const GROUND_Y_REL = 0.55;   // ground line position (fraction of canvas height)
    const BOX_SIZE     = 42;     // box side length, px
    const TRAVEL_MS    = 4500;   // ms per leg (one-way traverse)
    const PAUSE_MS     = 1500;   // ms paused at each turn (T not shown)
    const CYCLE_MS     = 2 * (TRAVEL_MS + PAUSE_MS);
    const EASE_POWER   = 2.4;    // >1 = ease-in: slow start, fast finish per leg
    const OFFSCREEN    = 60;     // px the box travels past each edge before stopping
    const T_LEN        = 45;     // px arrow length for tension
    const G_LEN        = 33;     // px arrow length for gravity/normal
    const N_LEN        = 33;

    function colours() {
        const s = getComputedStyle(document.documentElement);
        return {
            ink:    s.getPropertyValue('--ink').trim()         || '#363026',
            soft:   s.getPropertyValue('--ink-soft').trim()    || '#4d4436',
            faint:  s.getPropertyValue('--ink-faint').trim()   || '#7A6A52',
            acc:    s.getPropertyValue('--c-mechanics').trim() || '#b94d28',
            paper:  s.getPropertyValue('--paper').trim()       || '#F8F3E5',
        };
    }

    function drawArrow(ctx, x1, y1, x2, y2, color, lw) {
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
        if (len < 3) return;
        const ux = dx / len, uy = dy / len;
        const hl = Math.min(8, len * 0.32);
        const hw = hl * 0.50;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle   = color;
        ctx.lineWidth   = lw || 1.6;
        ctx.lineCap     = 'round';
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2 - ux * hl * 0.55, y2 - uy * hl * 0.55);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - ux * hl - uy * hw, y2 - uy * hl + ux * hw);
        ctx.lineTo(x2 - ux * hl + uy * hw, y2 - uy * hl - ux * hw);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
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

        function drawGround(groundY) {
            ctx.save();
            // main ground line
            ctx.strokeStyle = col.ink;
            ctx.lineWidth   = 1.4;
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.moveTo(0, groundY);
            ctx.lineTo(W, groundY);
            ctx.stroke();
            // diagonal hatching below (textbook "fixed floor")
            ctx.globalAlpha = 0.5;
            ctx.lineWidth   = 0.9;
            const step = 9;
            const hatchLen = 7;
            for (let x = -10; x < W + 10; x += step) {
                ctx.beginPath();
                ctx.moveTo(x, groundY);
                ctx.lineTo(x - hatchLen, groundY + hatchLen);
                ctx.stroke();
            }
            ctx.restore();
        }

        function drawBox(cx, groundY) {
            const half = BOX_SIZE / 2;
            const top   = groundY - BOX_SIZE;
            const left  = cx - half;

            // fill (subtle paper so grid doesn't show through inside the box)
            ctx.save();
            ctx.fillStyle   = col.paper;
            ctx.fillRect(left, top, BOX_SIZE, BOX_SIZE);
            // border
            ctx.strokeStyle = col.ink;
            ctx.lineWidth   = 1.6;
            ctx.setLineDash([]);
            ctx.strokeRect(left + 0.5, top + 0.5, BOX_SIZE - 1, BOX_SIZE - 1);
            // mass label "m"
            ctx.fillStyle    = col.ink;
            ctx.font         = 'italic 20px "Source Serif 4", Georgia, serif';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('m', cx, top + half + 1);
            ctx.restore();
        }

        function drawForces(cx, groundY, dir, showT) {
            const half    = BOX_SIZE / 2;
            const top     = groundY - BOX_SIZE;
            const centerY = top + half;

            // ── T (tension) — flips side with direction of motion ────────
            if (showT) {
                if (dir > 0) {
                    drawArrow(ctx, cx + half, centerY,
                                   cx + half + T_LEN, centerY, col.acc, 1.8);
                    label('T', cx + half + T_LEN + 4, centerY,
                          col.acc, 'left', 'middle');
                } else {
                    drawArrow(ctx, cx - half, centerY,
                                   cx - half - T_LEN, centerY, col.acc, 1.8);
                    label('T', cx - half - T_LEN - 4, centerY,
                          col.acc, 'right', 'middle');
                }
            }

            // ── G (gravity) — downward from box center, always ───────────
            drawArrow(ctx, cx, centerY, cx, centerY + G_LEN, col.ink, 1.5);
            label('G', cx + 4, centerY + G_LEN + 2, col.ink, 'left', 'top');

            // ── N (normal) — upward from top of box, always ──────────────
            drawArrow(ctx, cx, top, cx, top - N_LEN, col.ink, 1.5);
            label('N', cx + 4, top - N_LEN - 2, col.ink, 'left', 'bottom');
        }

        function label(text, x, y, color, align, baseline) {
            ctx.save();
            ctx.fillStyle    = color;
            ctx.font         = 'italic 11px "Source Serif 4", Georgia, serif';
            ctx.textAlign    = align;
            ctx.textBaseline = baseline;
            ctx.fillText(text, x, y);
            ctx.restore();
        }

        function frame(ts) {
            if (t0 === null) t0 = ts;
            const t = (ts - t0) % CYCLE_MS;

            const groundY = GROUND_Y_REL * H;
            // Start and end fully past each edge so the box (and its arrows)
            // are off-canvas at the moment of rest — the abrupt stop is hidden.
            const leftX   = -OFFSCREEN;
            const rightX  = W + OFFSCREEN;
            const span    = rightX - leftX;

            ctx.clearRect(0, 0, W, H);
            drawGround(groundY);

            // Four phases per cycle:
            //   0                 …  rightward leg (T pulls right, ease-in)
            //   TRAVEL_MS         …  pause at right edge (T off, box at rest)
            //   +PAUSE_MS         …  leftward leg (T pulls left, ease-in)
            //   +TRAVEL_MS        …  pause at left edge
            let cx, dir, showT;
            if (t < TRAVEL_MS) {
                const p = Math.pow(t / TRAVEL_MS, EASE_POWER);
                cx = leftX + span * p;
                dir = +1;
                showT = true;
            } else if (t < TRAVEL_MS + PAUSE_MS) {
                cx = rightX;
                dir = +1;
                showT = false;
            } else if (t < 2 * TRAVEL_MS + PAUSE_MS) {
                const tLeg = t - (TRAVEL_MS + PAUSE_MS);
                const p = Math.pow(tLeg / TRAVEL_MS, EASE_POWER);
                cx = rightX - span * p;
                dir = -1;
                showT = true;
            } else {
                cx = leftX;
                dir = -1;
                showT = false;
            }

            drawBox(cx, groundY);
            drawForces(cx, groundY, dir, showT);

            requestAnimationFrame(frame);
        }

        // refresh colours on theme/style changes
        window.addEventListener('resize', () => { col = colours(); });

        requestAnimationFrame(frame);
    }

    function init() {
        const canvas = document.getElementById('card-dynamics');
        if (canvas) mount(canvas);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
