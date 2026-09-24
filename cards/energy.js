/* cards/energy.js — Conservation mini-animation for the work-and-energy card
 *
 * Pattern mirrors the other cards/*.js: mount(canvas) on DOMContentLoaded.
 *
 * A bead slides on a frictionless parabolic wire. It is not driven by a
 * sinusoid: the speed at every point is integrated from energy conservation
 * itself, which is why the bead hangs at the rim and races through the bottom.
 * One stacked bar carries the whole story — the boundary between kinetic and
 * potential slides up and down, the top of the bar never moves.
 *
 *   mgh = ½mv²
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

    const G          = 9.81;
    const A_M        = 1.60;    // half-width of the wire, m
    const H_M        = 1.20;    // rim height above the low point, m
    const C          = H_M / (A_M * A_M);   // wire is y = C·x²
    const TIME_SCALE = 0.40;    // slow motion, so the card stays contemplative
    const BALL_R     = 6.5;
    const BAR_W      = 17;
    const BARS_AREA  = 74;      // px reserved on the right
    const SAMPLES    = 64;

    function colours() {
        const s = getComputedStyle(document.documentElement);
        return {
            ink:   s.getPropertyValue('--ink').trim()       || '#363026',
            soft:  s.getPropertyValue('--ink-soft').trim()  || '#4d4436',
            faint: s.getPropertyValue('--ink-faint').trim() || '#7A6A52',
            acc:   s.getPropertyValue('--c-energy').trim()  || '#2d6b3a',
            paper: s.getPropertyValue('--paper').trim()     || '#F8F3E5',
        };
    }

    /* Speed along x for a bead released from rest at the rim:
       ½(1 + 4C²x²)ẋ² = gC(A² − x²). */
    function xdot(x) {
        const num = 2 * G * C * Math.max(A_M * A_M - x * x, 0);
        return Math.sqrt(num / (1 + 4 * C * C * x * x));
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

        function hatch(x1, x2, y) {
            ctx.save();
            ctx.strokeStyle = col.ink; ctx.globalAlpha = 0.4;
            ctx.lineWidth = 0.9; ctx.setLineDash([]);
            for (let x = x1 + 2; x < x2; x += 9) {
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 7); ctx.stroke();
            }
            ctx.restore();
        }

        let x = -A_M * 0.999, dir = +1, last = null;

        function frame(ts) {
            if (last === null) last = ts;
            const dt = Math.min((ts - last) / 1000, 0.05) * TIME_SCALE;
            last = ts;

            /* Two half-steps keep the bead from stalling at the turning point,
               where ẋ → 0 and a single Euler step barely moves it. */
            for (let i = 0; i < 2; i++) {
                x += dir * xdot(x) * dt / 2;
                /* Nudge just inside the rim: parked exactly on it, ẋ is
                   zero and the bead would never leave. */
                if (x >= A_M)  { x =  A_M - 1e-3; dir = -1; }
                if (x <= -A_M) { x = -A_M + 1e-3; dir = +1; }
            }

            const h  = C * x * x;                 // height above the low point, m
            const v  = xdot(x) * Math.hypot(1, 2 * C * x);   // speed along the wire
            const pe = h / H_M;                   // fraction of the total energy
            const ke = 1 - pe;

            /* ── Layout ──────────────────────────────────────────────────── */
            const bowlW  = Math.max(W - BARS_AREA, 70);
            const bowlCx = bowlW * 0.48;
            const bowlA  = bowlW * 0.38;
            const topY   = H * 0.26;
            const botY   = H * 0.70;
            const hPx    = botY - topY;

            const barX   = bowlW + 12;
            const barTop = topY, barBot = botY, barH = barBot - barTop;

            const bx = bowlCx + (x / A_M) * bowlA;
            const by = botY - (h / H_M) * hPx;

            ctx.clearRect(0, 0, W, H);

            /* ── Ground either side of the dip ───────────────────────────── */
            const lEdge = bowlCx - bowlA, rEdge = bowlCx + bowlA;
            ctx.save();
            ctx.strokeStyle = col.ink; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.7;
            ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(0, topY); ctx.lineTo(lEdge, topY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(rEdge, topY); ctx.lineTo(barX - 8, topY); ctx.stroke();
            ctx.restore();
            hatch(0, lEdge, topY);
            hatch(rEdge, barX - 8, topY);

            /* ── The wire ────────────────────────────────────────────────── */
            ctx.save();
            ctx.strokeStyle = col.ink; ctx.lineWidth = 1.7;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
            ctx.beginPath();
            for (let i = 0; i <= SAMPLES; i++) {
                const xn = i / SAMPLES * 2 - 1;
                const px = bowlCx + xn * bowlA;
                const py = botY - hPx * xn * xn;
                i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
            }
            ctx.stroke();
            ctx.restore();

            /* ── Speed as a horizontal bar above the bead ────────────────── */
            const vMax = Math.sqrt(2 * G * H_M);
            const vPx  = (v / vMax) * 30;
            if (vPx > 3) {
                CK.arrow(ctx, bx, by - BALL_R - 8, bx + dir * vPx, by - BALL_R - 8, CK.INK.green, 1.8);
            }

            /* ── Bead ────────────────────────────────────────────────────── */
            ctx.save();
            ctx.fillStyle = col.acc;
            ctx.beginPath(); ctx.arc(bx, by, BALL_R, 0, Math.PI * 2); ctx.fill();
            const gr = ctx.createRadialGradient(bx - 1.8, by - 1.8, 0.5, bx, by, BALL_R);
            gr.addColorStop(0, 'rgba(255,255,255,0.40)');
            gr.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gr;
            ctx.beginPath(); ctx.arc(bx, by, BALL_R, 0, Math.PI * 2); ctx.fill();
            ctx.restore();

            /* ── One stacked bar: KE below, PE above, total never moves ──── */
            const keH = ke * barH;
            ctx.save();
            ctx.setLineDash([]);
            ctx.fillStyle = CK.INK.amber; ctx.globalAlpha = 0.75;
            ctx.fillRect(barX, barBot - keH, BAR_W, keH);
            ctx.fillStyle = CK.INK.blue; ctx.globalAlpha = 0.55;
            ctx.fillRect(barX, barTop, BAR_W, barH - keH);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = col.ink; ctx.lineWidth = 1.2;
            ctx.strokeRect(barX + 0.5, barTop + 0.5, BAR_W - 1, barH - 1);
            /* the moving divide */
            ctx.strokeStyle = col.ink; ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(barX, barBot - keH); ctx.lineTo(barX + BAR_W, barBot - keH);
            ctx.stroke();
            ctx.restore();

            /* ── Bar annotations ─────────────────────────────────────────── */
            CK.sym(ctx, 'E', barX + BAR_W / 2, barTop - 12, col.ink, 14);
            if (barH - keH > 16) CK.symSub(ctx, 'E', 'p', barX + BAR_W + 5, barTop + (barH - keH) / 2, CK.INK.blue, 14, 'left');
            if (keH > 16)        CK.symSub(ctx, 'E', 'k', barX + BAR_W + 5, barBot - keH / 2, CK.INK.amber, 14, 'left');

        }

        window.addEventListener('resize', () => { col = colours(); });
        CK.stageOf(canvas);
        CK.loop(canvas, frame);
    }

    function init() {
        const canvas = document.getElementById('card-energy');
        if (canvas) mount(canvas);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
}());
