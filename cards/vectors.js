/* cards/vectors.js — Vector addition mini-animation for the vectors card
 *
 * Pattern mirrors the other cards/*.js: mount(canvas) on DOMContentLoaded.
 *
 * Tip-to-tail addition: a is fixed and horizontal, b swings through the upper
 * half-plane from its tail at A, and c = a + b runs from O to b's tip. Dotted
 * rails drop c onto the axes so its components are always on show — that
 * resolve-then-add habit is the whole of the topic's exercise work.
 *
 *   a + b = c
 */
(function () {
    'use strict';

    const PERIOD_MS = 20000;
    const THETA_MIN = 26 * Math.PI / 180;
    const THETA_MAX = 122 * Math.PI / 180;
    const B_REL     = 0.66;         // |b| / |a|

    function colours() {
        const s = getComputedStyle(document.documentElement);
        return {
            ink:   s.getPropertyValue('--ink').trim()       || '#363026',
            soft:  s.getPropertyValue('--ink-soft').trim()  || '#4d4436',
            faint: s.getPropertyValue('--ink-faint').trim() || '#7A6A52',
            acc:   s.getPropertyValue('--c-vectors').trim() || '#1e5080',
            paper: s.getPropertyValue('--paper').trim()     || '#F8F3E5',
        };
    }

    function drawArrow(ctx, x1, y1, x2, y2, color, lw) {
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
        if (len < 4) return;
        const ux = dx / len, uy = dy / len;
        const hl = Math.min(11, len * 0.18), hw = hl * 0.44;
        ctx.save();
        ctx.strokeStyle = color; ctx.fillStyle = color;
        ctx.lineWidth = lw || 2.0; ctx.lineCap = 'round'; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(x1, y1);
        ctx.lineTo(x2 - ux * hl * 0.55, y2 - uy * hl * 0.55); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - ux * hl - uy * hw, y2 - uy * hl + ux * hw);
        ctx.lineTo(x2 - ux * hl + uy * hw, y2 - uy * hl - ux * hw);
        ctx.closePath(); ctx.fill();
        ctx.restore();
    }

    /* Letter with a little over-arrow, the way the printed notes set it. */
    function vecLabel(ctx, x, y, letter, color) {
        ctx.save();
        ctx.setLineDash([]); ctx.lineCap = 'round';
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.1;
        const hy = y - 18;
        ctx.beginPath(); ctx.moveTo(x - 6, hy); ctx.lineTo(x + 1, hy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 6, hy); ctx.lineTo(x + 1, hy - 3); ctx.lineTo(x + 1, hy + 3);
        ctx.closePath(); ctx.fill();
        ctx.font = 'italic 15px "Source Serif 4", Georgia, serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(letter, x, y);
        ctx.restore();
    }

    /* Point d px to the right of travel direction at fraction t along the
       segment. Right normal in canvas (y-down) is (dy, -dx)/len; negative d
       gives the left normal. */
    function rPerp(x1, y1, x2, y2, t, d) {
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
        return { x: x1 + dx * t + (dy / len) * d, y: y1 + dy * t + (-dx / len) * d };
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

        /* One component rail: dotted line with a tick cap at each end. */
        function rail(x1, y1, x2, y2) {
            ctx.save();
            ctx.strokeStyle = col.acc; ctx.globalAlpha = 0.45;
            ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.lineCap = 'butt';
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

            const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len * 3.5, ny = dx / len * 3.5;
            ctx.setLineDash([]); ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.moveTo(x1 - nx, y1 - ny); ctx.lineTo(x1 + nx, y1 + ny);
            ctx.moveTo(x2 - nx, y2 - ny); ctx.lineTo(x2 + nx, y2 + ny);
            ctx.stroke();
            ctx.restore();
        }

        let t0 = null;

        function frame(ts) {
            if (t0 === null) t0 = ts;
            const phase = ((ts - t0) % PERIOD_MS) / PERIOD_MS * 2 * Math.PI;
            const theta = (THETA_MIN + THETA_MAX) / 2
                        + (THETA_MAX - THETA_MIN) / 2 * Math.cos(phase);

            const ox = W * 0.20, oy = H * 0.60;
            /* Figure drawn ~30% larger than the first pass, still bounded by both
               card dimensions so a short or narrow card never clips it. */
            const aLen = Math.min(W * 0.44, H * 0.60, 159);
            const bLen = aLen * B_REL;

            const ax = ox + aLen, ay = oy;                       // tip of a
            const bVx = bLen * Math.cos(theta);
            const bVy = -bLen * Math.sin(theta);                 // up is −y
            const cx = ax + bVx, cy = ay + bVy;                  // tip of c

            ctx.clearRect(0, 0, W, H);

            /* ── Component rails — c dropped onto the axes ───────────────── */
            rail(ox, oy, cx, oy);
            rail(cx, oy, cx, cy);

            ctx.save();
            ctx.font = '10px "JetBrains Mono","Courier New",monospace';
            ctx.fillStyle = col.acc; ctx.globalAlpha = 0.75;
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText('cx', (ox + cx) / 2, oy + 7);
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText('cy', cx + 7, (oy + cy) / 2);
            ctx.restore();

            /* ── Angle arc at O, between a and c ─────────────────────────── */
            const angleC = Math.atan2(cy - oy, cx - ox);
            ctx.save();
            ctx.strokeStyle = col.acc; ctx.globalAlpha = 0.40;
            ctx.lineWidth = 1.0; ctx.setLineDash([]);
            ctx.beginPath(); ctx.arc(ox, oy, 35, angleC, 0); ctx.stroke();
            ctx.restore();

            /* ── c — the resultant ───────────────────────────────────────── */
            drawArrow(ctx, ox, oy, cx, cy, col.acc, 2.3);
            { const p = rPerp(ox, oy, cx, cy, 0.52, 26); vecLabel(ctx, p.x, p.y, 'c', col.acc); }

            /* ── a — fixed, horizontal (label below it) ──────────────────── */
            drawArrow(ctx, ox, oy, ax, ay, col.ink, 2.0);
            { const p = rPerp(ox, oy, ax, ay, 0.50, -25); vecLabel(ctx, p.x, p.y, 'a', col.ink); }

            /* ── b — tip-to-tail from A (label on the outside) ───────────── */
            drawArrow(ctx, ax, ay, cx, cy, col.ink, 2.0);
            { const p = rPerp(ax, ay, cx, cy, 0.50, -29); vecLabel(ctx, p.x, p.y, 'b', col.ink); }

            /* ── Origin dot and tip dot ──────────────────────────────────── */
            ctx.save();
            ctx.fillStyle = col.ink;
            ctx.beginPath(); ctx.arc(ox, oy, 3.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = col.acc;
            ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
            ctx.restore();

            requestAnimationFrame(frame);
        }

        window.addEventListener('resize', () => { col = colours(); });
        requestAnimationFrame(frame);
    }

    function init() {
        const canvas = document.getElementById('card-vectors');
        if (canvas) mount(canvas);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
}());
