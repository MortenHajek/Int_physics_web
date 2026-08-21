/* cards/induction.js — Faraday's experiment, as a mini-animation
 *
 * Pattern mirrors the other cards/*.js: mount(canvas) on DOMContentLoaded.
 *
 * A bar magnet slides back and forth through a coil drawn as a real helix —
 * the strands behind the magnet are painted first, the magnet next, the
 * strands in front of it last, so it genuinely passes through rather than
 * over. Three things are tied to the physics rather than merely animated:
 *
 *   · the glow filling the coil is the flux Φ threading it, so it swells as
 *     the magnet arrives and fades as it leaves;
 *   · the charge running round the winding moves at a speed set by −dΦ/dt
 *     and reverses with its sign;
 *   · the galvanometer needle follows the same quantity.
 *
 * The pay-off is the moment the magnet sits dead centre: the flux is at its
 * largest and the magnet at its fastest, yet the current stops and the needle
 * crosses zero — because it is the *rate of change* that induces, not the
 * flux itself. The needle also stops at each turning point, for the opposite
 * reason. Two zeroes, two different causes.
 *
 *   ε = -dΦ/dt   (Faraday's law)
 */
(function () {
    'use strict';

    const PERIOD_MS = 6400;      /* one there-and-back            */
    const TURNS     = 7;         /* helix turns                   */
    const SAMPLES   = 26;        /* polyline samples per turn     */
    const N_RED     = '#a04030'; /* warm red for the north pole   */

    function colours() {
        const s = getComputedStyle(document.documentElement);
        return {
            ink:   s.getPropertyValue('--ink').trim()         || '#363026',
            soft:  s.getPropertyValue('--ink-soft').trim()    || '#4d4436',
            faint: s.getPropertyValue('--ink-faint').trim()   || '#7A6A52',
            acc:   s.getPropertyValue('--c-induction').trim() || '#5a8478',
            paper: s.getPropertyValue('--paper').trim()       || '#F8F3E5',
            deep:  s.getPropertyValue('--paper-deep').trim()  || '#efead6',
        };
    }
    function hexToRgb(hex) {
        const h = hex.replace('#', '');
        const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
        return { r: parseInt(v.slice(0, 2), 16),
                 g: parseInt(v.slice(2, 4), 16),
                 b: parseInt(v.slice(4, 6), 16) };
    }
    function rgba(hex, a) {
        const c = hexToRgb(hex);
        return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
    }

    function mount(canvas) {
        const ctx = canvas.getContext('2d');
        let W = 0, H = 0, col = colours();

        function resize() {
            const dpr  = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            W = rect.width; H = rect.height;
            canvas.width  = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            col = colours();
        }
        resize();
        new ResizeObserver(resize).observe(canvas);

        /* ── The physics ─────────────────────────────────────────────────
           x(t) = A sin ωt through a coil of half-length a. The axial flux of
           a dipole falls off as (1 + (x/a)²)^(-3/2), so

               ε = −dΦ/dt = 3 x ẋ / ( a² (1 + (x/a)²)^(5/2) )

           which vanishes both at x = 0 (Φ stationary) and at the turning
           points (ẋ = 0).                                                */
        function flux(x, a)  { return Math.pow(1 + (x / a) * (x / a), -1.5); }
        function emf(x, xd, a) {
            const u = 1 + (x / a) * (x / a);
            return 3 * x * xd / (a * a * Math.pow(u, 2.5));
        }
        /* peak |ε| over a cycle, for scaling the needle and the flow */
        function peakEmf(A, a, omega) {
            let m = 1e-9;
            for (let k = 0; k < 400; k++) {
                const th = (k / 400) * 2 * Math.PI;
                const x  = A * Math.sin(th), xd = A * omega * Math.cos(th);
                m = Math.max(m, Math.abs(emf(x, xd, a)));
            }
            return m;
        }

        let t0 = null, flow = 0, lastTs = 0;
        let eMaxCache = 0, cacheKey = '';

        function frame(ts) {
            if (t0 === null) { t0 = ts; lastTs = ts; }
            const dt = Math.min(64, ts - lastTs) / 1000;
            lastTs = ts;

            /* ── Geometry ────────────────────────────────────────────────
               Kept clear of the equation chip in the bottom-left corner. */
            const cy   = H * 0.40;
            const cx   = W * 0.40;
            const L    = Math.min(W * 0.36, 190);      /* coil length      */
            const R    = Math.min(H * 0.155, 34);      /* coil radius      */
            const A    = Math.min(W * 0.30, 155);      /* magnet swing     */
            const a    = L * 0.52;                     /* flux scale       */
            const omega = 2 * Math.PI / (PERIOD_MS / 1000);

            const tt   = (ts - t0) / 1000;
            const x    = A * Math.sin(omega * tt);
            const xd   = A * omega * Math.cos(omega * tt);
            const phi  = flux(x, a);
            const e    = emf(x, xd, a);
            const key = A.toFixed(2) + '|' + a.toFixed(2);
            if (key !== cacheKey) { cacheKey = key; eMaxCache = peakEmf(A, a, omega); }
            const eMax = eMaxCache;
            const eRel = Math.max(-1, Math.min(1, e / eMax));

            flow += eRel * dt * 78;        /* px along the winding per second */

            ctx.clearRect(0, 0, W, H);

            /* ── Flux filling the coil ───────────────────────────────── */
            const g = ctx.createLinearGradient(cx - L / 2, cy, cx + L / 2, cy);
            g.addColorStop(0,    rgba(col.acc, 0));
            g.addColorStop(0.5,  rgba(col.acc, 0.10 + 0.30 * phi));
            g.addColorStop(1,    rgba(col.acc, 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(cx, cy, L / 2 + 6, R * 0.94, 0, 0, Math.PI * 2);
            ctx.fill();

            /* ── The coil, split front and back around the magnet ─────── */
            const pts = [];
            const total = TURNS * SAMPLES;
            for (let i = 0; i <= total; i++) {
                const th = (i / SAMPLES) * 2 * Math.PI;
                pts.push({
                    x: cx - L / 2 + (i / total) * L,
                    y: cy + R * Math.sin(th),
                    z: Math.cos(th),                    /* > 0 = towards us */
                });
            }
            function strokeHalf(front, dash, offset) {
                ctx.lineCap = dash ? 'butt' : 'round';
                ctx.lineJoin = 'round';
                if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = offset; }
                else ctx.setLineDash([]);
                let run = null;
                for (let i = 0; i < pts.length; i++) {
                    const inHalf = front ? pts[i].z >= 0 : pts[i].z < 0;
                    if (inHalf) {
                        if (!run) { run = true; ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); }
                        else ctx.lineTo(pts[i].x, pts[i].y);
                    } else if (run) { ctx.stroke(); run = null; }
                }
                if (run) ctx.stroke();
            }
            const flowing = Math.abs(eRel) > 0.015;
            const bright  = Math.min(1, 0.30 + Math.abs(eRel));

            ctx.strokeStyle = col.faint;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.75;
            strokeHalf(false);                          /* behind the magnet */
            if (flowing) {
                ctx.strokeStyle = col.acc;
                ctx.lineWidth = 2.6;
                ctx.globalAlpha = 0.30 * bright;
                strokeHalf(false, [4, 11], -flow);
            }
            ctx.globalAlpha = 1;
            ctx.setLineDash([]);

            /* ── The magnet ──────────────────────────────────────────── */
            const mw = Math.min(W * 0.17, 84), mh = R * 1.02;
            const mx = cx + x, my = cy;
            ctx.save();
            ctx.translate(mx, my);
            function magnetPath() {
                const r = 4, x0 = -mw / 2, y0 = -mh / 2;
                ctx.beginPath();
                ctx.moveTo(x0 + r, y0);
                ctx.lineTo(x0 + mw - r, y0);
                ctx.quadraticCurveTo(x0 + mw, y0, x0 + mw, y0 + r);
                ctx.lineTo(x0 + mw, y0 + mh - r);
                ctx.quadraticCurveTo(x0 + mw, y0 + mh, x0 + mw - r, y0 + mh);
                ctx.lineTo(x0 + r, y0 + mh);
                ctx.quadraticCurveTo(x0, y0 + mh, x0, y0 + mh - r);
                ctx.lineTo(x0, y0 + r);
                ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
                ctx.closePath();
            }
            magnetPath();
            ctx.save();
            ctx.clip();
            ctx.fillStyle = N_RED;   ctx.fillRect(-mw / 2, -mh / 2, mw / 2, mh);
            ctx.fillStyle = col.ink; ctx.fillRect(0, -mh / 2, mw / 2, mh);
            ctx.restore();
            magnetPath();
            ctx.strokeStyle = col.ink;
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.font = '600 10px "JetBrains Mono", ui-monospace, monospace';
            ctx.fillStyle = col.paper;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('N', -mw / 4, 0);
            ctx.fillText('S',  mw / 4, 0);
            /* which way it is going */
            if (Math.abs(xd) > A * omega * 0.12) {
                const s = xd > 0 ? 1 : -1;
                ctx.strokeStyle = col.soft;
                ctx.fillStyle = col.soft;
                ctx.lineWidth = 1.6;
                const tipX = s * (mw / 2 + 20), baseX = s * (mw / 2 + 7);
                ctx.beginPath();
                ctx.moveTo(baseX, 0); ctx.lineTo(tipX, 0); ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(tipX, 0);
                ctx.lineTo(tipX - s * 5, -4);
                ctx.lineTo(tipX - s * 5,  4);
                ctx.closePath(); ctx.fill();
            }
            ctx.restore();

            /* ── Coil strands in front ──────────────────────────────── */
            ctx.strokeStyle = col.ink;
            ctx.lineWidth = 2.4;
            strokeHalf(true);
            if (flowing) {
                ctx.strokeStyle = col.acc;
                ctx.lineWidth = 2.6;
                ctx.globalAlpha = 0.95 * bright;
                strokeHalf(true, [4, 11], -flow);
                ctx.globalAlpha = 1;
                ctx.setLineDash([]);
            }

            /* ── Leads out to the meter ───────────────────────────────
               The helix begins and ends at y = cy (whole turns), so the wires
               start on those exact points; they finish on the dial's circle,
               at the two points 7 px above and below its centre line. */
            const dx = W * 0.845, dy = cy, dR = Math.min(H * 0.15, 31);
            const gap = 7;
            const tx  = dx - Math.sqrt(Math.max(dR * dR - gap * gap, 1));
            const rEnd = cx + L / 2, lEnd = cx - L / 2;
            const topY = cy - R - 16;
            ctx.strokeStyle = col.ink;
            ctx.lineWidth = 1.8;
            ctx.lineCap = 'round';
            ctx.setLineDash([]);
            ctx.beginPath();
            /* near lead: right end of the winding straight across */
            ctx.moveTo(rEnd, cy);
            ctx.lineTo(rEnd + 16, cy);
            ctx.lineTo(rEnd + 16, dy + gap);
            ctx.lineTo(tx, dy + gap);
            /* far lead: left end of the winding, up and over the coil */
            ctx.moveTo(lEnd, cy);
            ctx.lineTo(lEnd - 12, cy);
            ctx.lineTo(lEnd - 12, topY);
            ctx.lineTo(tx, topY);
            ctx.lineTo(tx, dy - gap);
            ctx.stroke();

            /* ── Galvanometer ───────────────────────────────────────── */
            ctx.save();
            ctx.translate(dx, dy);
            ctx.beginPath();
            ctx.arc(0, 0, dR, 0, Math.PI * 2);
            ctx.fillStyle = col.paper;
            ctx.fill();
            ctx.strokeStyle = col.ink;
            ctx.lineWidth = 1.6;
            ctx.stroke();
            /* scale ticks */
            ctx.strokeStyle = col.faint;
            ctx.lineWidth = 1;
            for (let k = -2; k <= 2; k++) {
                const th = -Math.PI / 2 + k * 0.36;
                ctx.beginPath();
                ctx.moveTo(Math.cos(th) * (dR - 3), Math.sin(th) * (dR - 3));
                ctx.lineTo(Math.cos(th) * (dR - 8), Math.sin(th) * (dR - 8));
                ctx.stroke();
            }
            ctx.fillStyle = col.faint;
            ctx.font = '8px "JetBrains Mono", ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.fillText('0', 0, -dR + 13);
            /* needle */
            const ang = -Math.PI / 2 + eRel * 0.78;
            ctx.strokeStyle = col.acc;
            ctx.lineWidth = 2.2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, dR * 0.30);
            ctx.lineTo(Math.cos(ang) * (dR - 8), Math.sin(ang) * (dR - 8));
            ctx.stroke();
            ctx.fillStyle = col.ink;
            ctx.beginPath();
            ctx.arc(0, dR * 0.30, 2.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            requestAnimationFrame(frame);
        }

        window.addEventListener('resize', () => { col = colours(); });
        document.addEventListener('langchange', () => { col = colours(); });
        requestAnimationFrame(frame);
    }

    function init() {
        const c = document.getElementById('card-induction');
        if (c) mount(c);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
}());
