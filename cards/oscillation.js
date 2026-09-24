/* cards/oscillation.js — Spring-mass mini-animation for the oscillation card
 *
 * Pattern mirrors the other cards/*.js: mount(canvas) on DOMContentLoaded.
 *
 * A block on a frictionless floor, held by a coil spring against a wall. The
 * restoring force is drawn to scale from F = −kx, so the arrow reverses at the
 * equilibrium mark and grows out to the turning points where the block is
 * momentarily still — the proportionality is the animation, not a caption.
 * Shown in slow motion; the constants below belong to the real thing.
 *
 *   F = −kx
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

    const K          = 40;      // N/m
    const M          = 2.5;     // kg
    const AMP_M      = 0.12;    // m
    const TIME_SCALE = 0.42;    // slow motion
    const PX_PER_M   = 560;     // 0.12 m ≈ 67 px of amplitude
    const N_PER_PX   = 1 / 7;   // force arrow: 7 px per newton
    const BOX        = 34;
    const COILS      = 9;
    const COIL_R     = 8;
    const GROUND_Y   = 0.66;
    const WALL_X     = 0.09;

    const OMEGA = Math.sqrt(K / M);

    function colours() {
        const s = getComputedStyle(document.documentElement);
        return {
            ink:   s.getPropertyValue('--ink').trim()       || '#363026',
            soft:  s.getPropertyValue('--ink-soft').trim()  || '#4d4436',
            faint: s.getPropertyValue('--ink-faint').trim() || '#7A6A52',
            acc:   s.getPropertyValue('--c-springs').trim() || '#2d6e6a',
            paper: s.getPropertyValue('--paper').trim()     || '#F8F3E5',
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

        function drawGround(y) {
            ctx.save();
            ctx.strokeStyle = col.ink; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.7;
            ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
            ctx.globalAlpha = 0.42; ctx.lineWidth = 0.9;
            for (let x = -10; x < W + 10; x += 9) {
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 7); ctx.stroke();
            }
            ctx.restore();
        }

        function drawWall(x, top, bot) {
            ctx.save();
            ctx.strokeStyle = col.ink; ctx.lineWidth = 1.7; ctx.globalAlpha = 0.8;
            ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot); ctx.stroke();
            ctx.globalAlpha = 0.45; ctx.lineWidth = 0.9;
            for (let y = top + 2; y < bot; y += 8) {
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 7, y - 7); ctx.stroke();
            }
            ctx.restore();
        }

        /* A coil spring drawn as a leaning helix — the coils bunch up when it
           is compressed and open out when stretched, all on their own. */
        function drawSpring(x1, x2, y) {
            const tail = 6;
            const L = Math.max(x2 - x1 - 2 * tail, 8);
            const TURNS = COILS * 2 * Math.PI;
            ctx.save();
            ctx.strokeStyle = col.ink; ctx.lineWidth = 1.5;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(x1, y);
            ctx.lineTo(x1 + tail, y);
            const steps = 180;
            for (let i = 0; i <= steps; i++) {
                const ph = TURNS * i / steps;
                const px = x1 + tail + L * i / steps + COIL_R * 0.22 * Math.cos(ph);
                const py = y + COIL_R * Math.sin(ph);
                ctx.lineTo(px, py);
            }
            ctx.lineTo(x1 + tail + L, y);
            ctx.lineTo(x2, y);
            ctx.stroke();
            ctx.restore();
        }


        let t0 = null;

        function frame(ts) {
            if (t0 === null) t0 = ts;
            const t = (ts - t0) / 1000 * TIME_SCALE;
            const xm = AMP_M * Math.cos(OMEGA * t);        // displacement, m
            const vm = -AMP_M * OMEGA * Math.sin(OMEGA * t);
            const F  = -K * xm;                            // restoring force, N

            const groundY = GROUND_Y * H;
            const wallX   = WALL_X * W;
            const eqX     = wallX + Math.max(W * 0.46, 150);
            const cx      = eqX + xm * PX_PER_M;
            const springY = groundY - BOX / 2;
            const boxTop  = groundY - BOX;

            ctx.clearRect(0, 0, W, H);

            drawGround(groundY);
            drawWall(wallX, boxTop - 16, groundY);

            /* ── Equilibrium mark and the current displacement ───────────── */
            ctx.save();
            ctx.strokeStyle = col.faint; ctx.globalAlpha = 0.6;
            ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
            ctx.beginPath();
            ctx.moveTo(eqX, boxTop - 30); ctx.lineTo(eqX, groundY);
            ctx.stroke();
            ctx.restore();

            if (Math.abs(cx - eqX) > 3) {
                const by = boxTop - 12;
                ctx.save();
                ctx.strokeStyle = col.acc; ctx.globalAlpha = 0.65;
                ctx.lineWidth = 1; ctx.setLineDash([]);
                ctx.beginPath();
                ctx.moveTo(eqX, by - 4); ctx.lineTo(eqX, by + 4);
                ctx.moveTo(eqX, by); ctx.lineTo(cx, by);
                ctx.moveTo(cx, by - 4); ctx.lineTo(cx, by + 4);
                ctx.stroke();
                ctx.restore();
                CK.sym(ctx, 'x', (eqX + cx) / 2, by - 12, col.acc, 15);
            }

            drawSpring(wallX, cx - BOX / 2, springY);

            /* ── Block ───────────────────────────────────────────────────── */
            ctx.save();
            ctx.fillStyle = CK.INK.block;
            ctx.fillRect(cx - BOX / 2, boxTop, BOX, BOX);
            ctx.strokeStyle = col.ink; ctx.lineWidth = 1.5; ctx.setLineDash([]);
            ctx.strokeRect(cx - BOX / 2 + 0.5, boxTop + 0.5, BOX - 1, BOX - 1);
            ctx.fillStyle = col.ink;
            ctx.font = 'italic 16px "Source Serif 4", Georgia, serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('m', cx, boxTop + BOX / 2 + 1);
            ctx.restore();

            /* ── The restoring force, to scale, always pointing home ─────── */
            const fPx = F / N_PER_PX;
            /* Start at the block's edge, so the shaft never crosses the box. */
            const fx0 = cx + Math.sign(fPx) * BOX / 2;
            /* the restoring force in the oscillation sandboxes' crimson */
            CK.arrow(ctx, fx0, springY, fx0 + fPx, springY, CK.INK.crimson, 2.2);
            if (Math.abs(fPx) > 12) CK.sym(ctx, 'F', fx0 + fPx + (fPx > 0 ? 6 : -6), springY - 12, CK.INK.crimson, 15, fPx > 0 ? 'left' : 'right');

        }

        window.addEventListener('resize', () => { col = colours(); });
        CK.stageOf(canvas);
        CK.loop(canvas, frame);
    }

    function init() {
        const canvas = document.getElementById('card-oscillation');
        if (canvas) mount(canvas);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
}());
