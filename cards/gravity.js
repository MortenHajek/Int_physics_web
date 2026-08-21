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

            requestAnimationFrame(frame);
        }

        window.addEventListener('resize', () => { col = colours(); });
        requestAnimationFrame(frame);
    }

    function init() {
        const canvas = document.getElementById('card-gravity');
        if (canvas) mount(canvas);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
}());
