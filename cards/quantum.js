/* cards/quantum.js — Bohr-transition mini-animation for the quantum card
 *
 * Pattern mirrors the other cards/*.js: mount(canvas) on DOMContentLoaded.
 *
 * Left: an electron on the Bohr orbits of hydrogen. Right: the level ladder
 * those orbits correspond to, drawn at the real energies E_n = −13,6/n² eV, so
 * the rungs crowd together towards the ionisation limit instead of sitting at
 * tidy equal steps.
 *
 * The photon is the point of the card. Its drawn wavelength is inversely
 * proportional to the gap it bridges, so the big 1→3 absorption arrives tightly
 * wound while the small 3→2 emission leaves as a long, lazy wave — E = hν with
 * nothing said.
 */
(function () {
    'use strict';

    const E_RY   = 13.6;                       // eV
    const LEVELS = [1, 2, 3];
    const ORBIT  = [0.38, 0.70, 1.00];         // orbit radii, relative to the outer one
    const OMEGA  = [1.75, 1.10, 0.80];         // rad/s — outer orbits turn more slowly
    const EL_R   = 4;
    const NUC_R  = 5.5;
    const SPLIT  = 0.45;                       // photon leg / jump leg of a transition
    const LAM_K  = 78;                         // px of drawn wavelength per eV⁻¹

    const SEQ = [
        { kind: 'orbit',  n: 1,               ms: 1500 },
        { kind: 'absorb', from: 1, to: 3,     ms: 1200, dir: Math.PI },
        { kind: 'orbit',  n: 3,               ms: 1300 },
        { kind: 'emit',   from: 3, to: 2,     ms: 1100, dir: Math.PI * 0.82 },
        { kind: 'orbit',  n: 2,               ms: 1100 },
        { kind: 'emit',   from: 2, to: 1,     ms: 1100, dir: Math.PI * 1.18 },
    ];
    const TOTAL = SEQ.reduce((s, p) => s + p.ms, 0);

    function energy(n) { return -E_RY / (n * n); }
    function gap(a, b) { return Math.abs(energy(b) - energy(a)); }
    function smooth(t) { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); }

    function colours() {
        const s = getComputedStyle(document.documentElement);
        return {
            ink:   s.getPropertyValue('--ink').trim()       || '#363026',
            soft:  s.getPropertyValue('--ink-soft').trim()  || '#4d4436',
            faint: s.getPropertyValue('--ink-faint').trim() || '#7A6A52',
            acc:   s.getPropertyValue('--c-quantum').trim() || '#2a1f50',
            paper: s.getPropertyValue('--paper').trim()     || '#F8F3E5',
        };
    }

    function hexToRgba(hex, alpha) {
        let h = (hex || '').replace('#', '').trim();
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        const n = parseInt(h, 16);
        if (!isFinite(n)) return 'rgba(42,31,80,' + alpha + ')';
        return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
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

        /* A photon: a sine along a segment, wound at the wavelength its energy
           demands, fading out along its tail. */
        function photon(hx, hy, dir, lambda, length, alpha) {
            const ux = Math.cos(dir), uy = Math.sin(dir);
            const nx = -uy, ny = ux;
            const amp = Math.min(3.6, lambda * 0.28);
            const steps = Math.max(40, Math.round(length));
            ctx.save();
            ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.setLineDash([]);
            for (let i = 0; i < steps; i++) {
                const s0 = length * i / steps, s1 = length * (i + 1) / steps;
                const fade = 1 - s1 / length;
                const a0 = alpha * fade * fade;
                if (a0 < 0.03) continue;
                const y0 = amp * Math.sin(2 * Math.PI * s0 / lambda);
                const y1 = amp * Math.sin(2 * Math.PI * s1 / lambda);
                ctx.strokeStyle = hexToRgba(col.acc, a0);
                ctx.beginPath();
                ctx.moveTo(hx - ux * s0 + nx * y0, hy - uy * s0 + ny * y0);
                ctx.lineTo(hx - ux * s1 + nx * y1, hy - uy * s1 + ny * y1);
                ctx.stroke();
            }
            ctx.fillStyle = hexToRgba(col.acc, alpha);
            ctx.beginPath(); ctx.arc(hx, hy, 2.2, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        let t0 = null, spin = 0, lastTs = null;

        function frame(ts) {
            if (t0 === null) { t0 = ts; lastTs = ts; }
            const dt = Math.min((ts - lastTs) / 1000, 0.05);
            lastTs = ts;

            /* Where are we in the sequence? */
            let t = (ts - t0) % TOTAL, seg = SEQ[0], local = 0;
            for (const p of SEQ) {
                if (t < p.ms) { seg = p; local = t / p.ms; break; }
                t -= p.ms;
            }

            /* ── Layout ──────────────────────────────────────────────────── */
            const S   = Math.min(W * 0.22, H * 0.22);        // outer orbit radius
            const acx = Math.max(W * 0.30, S + 22), acy = H * 0.45;
            const ladR = W - 40, ladL = W - 98;
            const ladTop = H * 0.22, ladBot = H * 0.72;
            const ladH = ladBot - ladTop;

            /* Rung y for a level, from the true energies. */
            function rungY(n) {
                return ladBot - (energy(n) + E_RY) / E_RY * ladH;
            }

            /* ── Electron level and radius ───────────────────────────────── */
            let nFrom, nTo, jump = 0;
            if (seg.kind === 'orbit') { nFrom = nTo = seg.n; }
            else {
                nFrom = seg.from; nTo = seg.to;
                jump = seg.kind === 'absorb'
                    ? smooth((local - SPLIT) / (1 - SPLIT))
                    : smooth(local / SPLIT);
            }
            const rFrom = ORBIT[nFrom - 1] * S, rTo = ORBIT[nTo - 1] * S;
            const rNow  = rFrom + (rTo - rFrom) * jump;
            const wNow  = OMEGA[nFrom - 1] + (OMEGA[nTo - 1] - OMEGA[nFrom - 1]) * jump;
            spin += wNow * dt;

            const ex = acx + rNow * Math.cos(spin);
            const ey = acy + rNow * Math.sin(spin);

            ctx.clearRect(0, 0, W, H);

            /* ── Orbits ──────────────────────────────────────────────────── */
            ctx.save();
            ctx.strokeStyle = col.faint; ctx.globalAlpha = 0.4;
            ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
            for (const f of ORBIT) {
                ctx.beginPath(); ctx.arc(acx, acy, f * S, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.restore();

            /* ── Photon ──────────────────────────────────────────────────── */
            if (seg.kind !== 'orbit') {
                const dE  = gap(seg.from, seg.to);
                const lam = LAM_K / dE;                       // λ ∝ 1/ΔE
                /* A long wave needs a longer trail to read as a wave at all. */
                const len = Math.min(58, Math.max(30, lam * 1.5));
                const far = S + len + 14;

                if (seg.kind === 'absorb' && local < SPLIT) {
                    /* Flying in, head landing on the orbit as the jump starts. */
                    const k = local / SPLIT;
                    const d = far - (far - rFrom) * k;
                    photon(acx + d * Math.cos(seg.dir), acy + d * Math.sin(seg.dir),
                           seg.dir + Math.PI, lam, len, 0.85);
                } else if (seg.kind === 'emit' && local > SPLIT) {
                    const k = (local - SPLIT) / (1 - SPLIT);
                    const d = rTo + (far - rTo) * k;
                    photon(acx + d * Math.cos(seg.dir), acy + d * Math.sin(seg.dir),
                           seg.dir, lam, len, 0.85 * (1 - k * 0.5));
                }
            }

            /* ── Nucleus ─────────────────────────────────────────────────── */
            ctx.save();
            ctx.fillStyle = col.acc;
            ctx.beginPath(); ctx.arc(acx, acy, NUC_R, 0, Math.PI * 2); ctx.fill();
            const ng = ctx.createRadialGradient(acx - 2, acy - 2, 0.4, acx, acy, NUC_R);
            ng.addColorStop(0, 'rgba(255,255,255,0.42)');
            ng.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = ng;
            ctx.beginPath(); ctx.arc(acx, acy, NUC_R, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = col.acc; ctx.globalAlpha = 0.28; ctx.lineWidth = 1;
            ctx.setLineDash([]);
            ctx.beginPath(); ctx.arc(acx, acy, NUC_R + 4, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();

            /* ── Electron ────────────────────────────────────────────────── */
            ctx.save();
            ctx.fillStyle = hexToRgba(col.acc, 0.14);
            ctx.beginPath(); ctx.arc(ex, ey, EL_R + 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = col.ink;
            ctx.beginPath(); ctx.arc(ex, ey, EL_R, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = col.paper; ctx.globalAlpha = 0.55;
            ctx.beginPath(); ctx.arc(ex - 1.2, ey - 1.2, 1.4, 0, Math.PI * 2); ctx.fill();
            ctx.restore();

            /* ── Level ladder, at the real energies ──────────────────────── */
            ctx.save();
            ctx.strokeStyle = col.faint; ctx.globalAlpha = 0.5;
            ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
            ctx.beginPath(); ctx.moveTo(ladL, ladTop); ctx.lineTo(ladR, ladTop); ctx.stroke();
            ctx.restore();

            /* The ionisation limit. No axis caption — there is nowhere to
               put one that is not under the card's colour label, and the rung
               labels name the ladder well enough. */
            ctx.save();
            ctx.font = '9px "JetBrains Mono","Courier New",monospace';
            ctx.fillStyle = col.faint;
            ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
            ctx.fillText('0', ladR + 3, ladTop);
            ctx.restore();

            const nShown = jump > 0.5 ? nTo : nFrom;
            for (const n of LEVELS) {
                const y = rungY(n);
                const here = n === nShown;
                ctx.save();
                ctx.setLineDash([]);
                ctx.strokeStyle = here ? col.acc : col.ink;
                ctx.globalAlpha = here ? 1 : 0.5;
                ctx.lineWidth = here ? 2 : 1.2;
                ctx.beginPath(); ctx.moveTo(ladL, y); ctx.lineTo(ladR, y); ctx.stroke();
                ctx.font = '9px "JetBrains Mono","Courier New",monospace';
                ctx.fillStyle = here ? col.acc : col.faint;
                ctx.globalAlpha = 1;
                ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                ctx.fillText('n' + n, ladR + 3, y);
                ctx.restore();
                if (here) {
                    ctx.save();
                    ctx.fillStyle = col.ink;
                    ctx.beginPath(); ctx.arc(ladL + 11, y, 3, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                }
            }

            /* ── The transition, drawn on the ladder ─────────────────────── */
            if (seg.kind !== 'orbit') {
                const yA = rungY(seg.from), yB = rungY(seg.to);
                const ax = (ladL + ladR) / 2;
                const up = yB < yA;
                ctx.save();
                ctx.strokeStyle = col.acc; ctx.fillStyle = col.acc;
                ctx.lineWidth = 1.6; ctx.setLineDash([]); ctx.lineCap = 'butt';
                ctx.beginPath();
                ctx.moveTo(ax, yA); ctx.lineTo(ax, yB + (up ? 6 : -6)); ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(ax, yB);
                ctx.lineTo(ax - 3.6, yB + (up ? 7 : -7));
                ctx.lineTo(ax + 3.6, yB + (up ? 7 : -7));
                ctx.closePath(); ctx.fill();
                ctx.font = '9px "JetBrains Mono","Courier New",monospace';
                ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
                ctx.fillText(gap(seg.from, seg.to).toFixed(2), ax - 6, (yA + yB) / 2);
                ctx.restore();
            }

            requestAnimationFrame(frame);
        }

        window.addEventListener('resize', () => { col = colours(); });
        requestAnimationFrame(frame);
    }

    function init() {
        const canvas = document.getElementById('card-quantum');
        if (canvas) mount(canvas);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
}());
