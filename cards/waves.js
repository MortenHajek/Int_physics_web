/* cards/waves.js — Standing-wave mini-animation for the waves card
 *
 * Pattern mirrors the other cards/*.js: mount(canvas) on DOMContentLoaded.
 *
 * A rope clamped between two walls, shown as what it actually is: two
 * travelling waves of half the amplitude running through each other in
 * opposite directions. Both are drawn faint and keep moving; their sum — the
 * accented rope — never travels at all. Where the two are permanently out of
 * step the rope is pinned, and those are the nodes marked on the axis.
 *
 *   v = λf
 */
(function () {
    'use strict';

    const N_MODE    = 3;        // harmonic
    const PERIOD_MS = 2200;     // ms per full cycle
    const A_MAX     = 30;       // px peak displacement of the sum
    const SAMPLES    = 110;

    function colours() {
        const s = getComputedStyle(document.documentElement);
        return {
            ink:   s.getPropertyValue('--ink').trim()      || '#363026',
            soft:  s.getPropertyValue('--ink-soft').trim() || '#4d4436',
            faint: s.getPropertyValue('--ink-faint').trim()|| '#7A6A52',
            acc:   s.getPropertyValue('--c-waves').trim()  || '#1a6678',
            paper: s.getPropertyValue('--paper').trim()    || '#F8F3E5',
        };
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

        function drawWall(x, top, bot, dir) {
            ctx.save();
            ctx.strokeStyle = col.ink; ctx.lineWidth = 1.7; ctx.globalAlpha = 0.8;
            ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot); ctx.stroke();
            ctx.globalAlpha = 0.45; ctx.lineWidth = 0.9;
            for (let y = top + 2; y < bot; y += 8) {
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dir * 6, y - 6); ctx.stroke();
            }
            ctx.restore();
        }

        /* fn(u) → displacement in px, for u from 0 (left wall) to 1 (right). */
        function trace(fn, x0, len, yc) {
            ctx.beginPath();
            for (let i = 0; i <= SAMPLES; i++) {
                const u = i / SAMPLES;
                const x = x0 + u * len, y = yc + fn(u);
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.stroke();
        }

        let t0 = null;

        function frame(ts) {
            if (t0 === null) t0 = ts;
            const wt = ((ts - t0) % PERIOD_MS) / PERIOD_MS * 2 * Math.PI;

            const xL = W * 0.10, xR = W * 0.90;
            const yc = H * 0.50, len = xR - xL;
            const wallTop = yc - A_MAX - 12, wallBot = yc + A_MAX + 12;
            const kx = N_MODE * Math.PI;

            /* The two components and their sum. */
            const right = u => (A_MAX / 2) * Math.sin(kx * u - wt);
            const left  = u => (A_MAX / 2) * Math.sin(kx * u + wt);
            const sum   = u => A_MAX * Math.sin(kx * u) * Math.cos(wt);

            ctx.clearRect(0, 0, W, H);

            drawWall(xL, wallTop, wallBot, -1);
            drawWall(xR, wallTop, wallBot, +1);

            /* ── Envelope ────────────────────────────────────────────────── */
            ctx.save();
            ctx.strokeStyle = col.acc; ctx.globalAlpha = 0.16;
            ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
            trace(u => A_MAX * Math.sin(kx * u), xL, len, yc);
            trace(u => -A_MAX * Math.sin(kx * u), xL, len, yc);
            ctx.restore();

            /* ── The two travelling waves ────────────────────────────────── */
            ctx.save();
            ctx.strokeStyle = col.soft; ctx.globalAlpha = 0.34;
            ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.setLineDash([]);
            trace(right, xL, len, yc);
            ctx.setLineDash([5, 4]);
            trace(left, xL, len, yc);
            ctx.restore();

            /* ── Their sum: the rope ─────────────────────────────────────── */
            ctx.save();
            ctx.strokeStyle = col.acc; ctx.lineWidth = 2;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
            trace(sum, xL, len, yc);
            ctx.restore();

            /* ── Nodes — the points the sum can never move ───────────────── */
            ctx.save();
            ctx.setLineDash([]);
            for (let n = 0; n <= N_MODE; n++) {
                const x = xL + len * n / N_MODE;
                const edge = (n === 0 || n === N_MODE);
                ctx.fillStyle = col.ink;
                ctx.beginPath(); ctx.arc(x, yc, edge ? 2.4 : 3.2, 0, Math.PI * 2); ctx.fill();
                if (!edge) {
                    ctx.fillStyle = col.paper;
                    ctx.beginPath(); ctx.arc(x, yc, 1.5, 0, Math.PI * 2); ctx.fill();
                }
            }
            ctx.restore();

            /* ── Which way each component runs ───────────────────────────── */
            ctx.save();
            ctx.font = '11px "JetBrains Mono","Courier New",monospace';
            ctx.fillStyle = col.soft; ctx.globalAlpha = 0.7;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';
            ctx.fillText('→', xL + len * 0.28, yc - A_MAX - 16);
            ctx.fillText('←', xL + len * 0.72, yc - A_MAX - 16);
            ctx.restore();

            requestAnimationFrame(frame);
        }

        window.addEventListener('resize', () => { col = colours(); });
        requestAnimationFrame(frame);
    }

    function init() {
        const canvas = document.getElementById('card-waves');
        if (canvas) mount(canvas);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
}());
