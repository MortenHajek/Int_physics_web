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
            const ay = yc - A_MAX - 16, ax1 = xL + len * 0.28, ax2 = xL + len * 0.72;
            CK.arrow(ctx, ax1 - 12, ay, ax1 + 12, ay, col.soft, 1.5);
            CK.arrow(ctx, ax2 + 12, ay, ax2 - 12, ay, col.soft, 1.5);

        }

        window.addEventListener('resize', () => { col = colours(); });
        CK.stageOf(canvas);
        CK.loop(canvas, frame);
    }

    function init() {
        const canvas = document.getElementById('card-waves');
        if (canvas) mount(canvas);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
}());
