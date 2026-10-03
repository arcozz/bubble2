// ==UserScript==
// @name           Tab Open Animations
// @version        2.0
// @description    Animation a l'ouverture d'un onglet (Mini aimant, Trainee, Etincelles seules).
// @compatibility  Firefox 100+
// ==/UserScript==

(() => {
    const STYLE_ID = 'tab-open-animations-styles';
    const PREF_PREFIX = 'extension.middle-click-tab-animation.';
    const STARTUP_GRACE_MS = 3000;   // ignore les onglets restaures au demarrage

    const DEFAULTS = { style: 'mini-aimant', speed: 100, debug: false };

    const COLOR = 'var(--tao-color)';
    const GOLD = '#ffd166';

    let S = 1;        // facteur de duree (1 = normal, 2 = deux fois plus lent)
    let ready = false;
    let cfg = null;

    /* ---------- prefs ---------- */

    function readPref(key, fallback) {
        const fullKey = PREF_PREFIX + key;
        try {
            switch (Services.prefs.getPrefType(fullKey)) {
                case Services.prefs.PREF_INT: return Services.prefs.getIntPref(fullKey);
                case Services.prefs.PREF_BOOL: return Services.prefs.getBoolPref(fullKey);
                case Services.prefs.PREF_STRING: return Services.prefs.getCharPref(fullKey);
            }
        } catch (_) { /* pref absente */ }
        return fallback;
    }

    function readConfig() {
        let speed = parseInt(readPref('tab-animation-speed', DEFAULTS.speed), 10);
        if (Number.isNaN(speed)) speed = DEFAULTS.speed;
        speed = Math.min(300, Math.max(25, speed));
        const dbg = readPref('debug', DEFAULTS.debug);
        return {
            style: String(readPref('tab-animation-style', DEFAULTS.style)),
            slow: 100 / speed,
            debug: dbg === true || dbg === 'true',
        };
    }

    /* ---------- styles + helpers ---------- */

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .tao-container {
                position: absolute;
                width: 0;
                height: 0;
                pointer-events: none;
                z-index: 99999;
                --tao-color: color-mix(in srgb, var(--zen-primary-color, #7F77DD), #e6e8e6);
            }
            .tao-item {
                position: absolute;
                pointer-events: none;
                will-change: transform, opacity;
            }
        `;
        document.head.appendChild(style);
    }

    function getAnimationParent() {
        return document.getElementById('browser')
            || document.getElementById('main-window')
            || document.documentElement;
    }

    const rand = (a, b) => a + Math.random() * (b - a);

    function dot(c, w, h, bg, radius) {
        const e = document.createElement('div');
        e.className = 'tao-item';
        e.style.cssText += `width:${w}px;height:${h}px;left:${-w / 2}px;top:${-h / 2}px;background:${bg};border-radius:${radius}`;
        c.appendChild(e);
        return e;
    }

    function ring(c, size, delay, dur, bw) {
        const e = dot(c, size, size, 'transparent', '50%');
        e.style.border = `${bw}px solid ${COLOR}`;
        e.animate(
            [{ transform: 'scale(.05)', opacity: 0.9 }, { transform: 'scale(1)', opacity: 0 }],
            { duration: dur * S, delay: delay * S, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' }
        );
    }

    function sparks(c, n, dist, len = [12, 18]) {
        for (let i = 0; i < n; i++) {
            const e = dot(c, rand(len[0], len[1]), 2.5, COLOR, '2px');
            const a = i * (360 / n) + rand(-8, 8);
            const d = dist * rand(0.75, 1.15);
            e.animate([
                { transform: `rotate(${a}deg) translateX(14px)`, opacity: 1 },
                { transform: `rotate(${a}deg) translateX(${d}px) scaleX(.2)`, opacity: 0 },
            ], { duration: 520 * S, easing: 'ease-out', fill: 'forwards' });
        }
    }

    /* ---------- animations ---------- */

    const EZ = 'cubic-bezier(.2,.8,.3,1)';
    const MAGNET_SPEED = 1.5;   // vitesse de l'attraction (les etincelles gardent leur duree normale)

    const EFFECTS = {
        // Petites particules aspirees vers l'onglet, puis l'onglet pop + gerbe d'etincelles
        'mini-aimant'(tab, r, c) {
            const k = MAGNET_SPEED / S;
            tab.animate([
                { transform: 'scale(.4)', opacity: 0 },
                { transform: 'scale(1.12)', opacity: 1, offset: 0.55 },
                { transform: 'scale(1)', opacity: 1 },
            ], { duration: 340 / k, delay: 320 / k, easing: EZ, fill: 'backwards' });

            for (let i = 0; i < 18; i++) {
                const a = rand(0, Math.PI * 2);
                const d = rand(70, 120);
                const e = dot(c, rand(3, 6), rand(3, 6), i % 3 ? COLOR : GOLD, '50%');
                e.animate([
                    { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d * 0.6}px)`, opacity: 0 },
                    { opacity: 1, offset: 0.2 },
                    { transform: 'translate(0,0) scale(.3)', opacity: 0 },
                ], { duration: 340 / k, delay: rand(0, 70) / k, easing: 'ease-in', fill: 'both' });
            }
            setTimeout(() => sparks(c, 8, 40, [6, 10]), 330 / k);
        },

        // L'onglet glisse depuis la droite avec une courte trainee
        trainee(tab, r, c) {
            const D = 520 * S;
            const E = 'cubic-bezier(.25,.8,.3,1)';
            const P = 'translateX(170px)';
            const label = tab.getAttribute('label') || '';

            // un "double" fait le trajet (visible meme si la sidebar rogne l'onglet reel)
            const pill = dot(c, r.width, r.height, 'var(--zen-primary-color, #7F77DD)', '10px');
            pill.style.cssText += ';display:flex;align-items:center;padding:0 12px;box-sizing:border-box;color:#fff;font-size:13px;white-space:nowrap;overflow:hidden';
            pill.textContent = label;
            pill.animate([
                { transform: P, opacity: 0 },
                { opacity: 1, offset: 0.2 },
                { transform: 'none', opacity: 1, offset: 0.9 },
                { transform: 'none', opacity: 0 },
            ], { duration: D, easing: E, fill: 'forwards' });

            for (let i = 1; i <= 4; i++) {
                const g = dot(c, r.width, r.height, `color-mix(in srgb, var(--zen-primary-color, #7F77DD) ${Math.round((0.4 - i * 0.07) * 100)}%, transparent)`, '10px');
                g.animate([
                    { transform: P, opacity: 0 },
                    { opacity: 1, offset: 0.2 },
                    { transform: 'none', opacity: 0 },
                ], { duration: D, delay: i * 45 * S, easing: E, fill: 'both' });
            }

            // le vrai onglet apparait quand le double se pose
            tab.animate([{ opacity: 0 }, { opacity: 0, offset: 0.85 }, { opacity: 1 }],
                { duration: D, fill: 'backwards' });
        },

        // Petit pop + gerbe d'etincelles
        etincelles(tab, r, c) {
            tab.animate([
                { transform: 'scale(.85)', opacity: 0 },
                { transform: 'scale(1.04)', opacity: 1, offset: 0.6 },
                { transform: 'scale(1)', opacity: 1 },
            ], { duration: 300 * S, easing: EZ, fill: 'backwards' });
            sparks(c, 10, 55, [8, 12]);
        },
    };

    function pickStyle(name) {
        if (name === 'random') {
            const keys = Object.keys(EFFECTS);
            return keys[Math.floor(Math.random() * keys.length)];
        }
        return EFFECTS[name] ? name : 'mini-aimant';
    }

    /* ---------- ouverture d'onglet ---------- */

    // Attend que Zen ait fini de placer l'onglet (sa hauteur/position se stabilisent)
    function whenSettled(tab, cb) {
        let last = null;
        const check = (i) => {
            const r = tab.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && last
                && Math.abs(r.top - last.top) < 0.5 && Math.abs(r.height - last.height) < 0.5) {
                return cb(r);
            }
            last = r;
            if (i < 40) requestAnimationFrame(() => check(i + 1));
            else cb(r.width > 0 && r.height > 0 ? r : null);
        };
        requestAnimationFrame(() => check(0));
    }

    function run(tab, r) {
        const name = pickStyle(cfg.style);
        S = cfg.slow;

        const parent = getAnimationParent();
        const p = parent.getBoundingClientRect();
        const c = document.createElement('div');
        c.className = 'tao-container';
        c.style.left = `${r.left + r.width / 2 - p.left}px`;
        c.style.top = `${r.top + r.height / 2 - p.top}px`;
        parent.appendChild(c);

        if (cfg.debug) console.log('[TabOpenAnimations]', name, r);
        EFFECTS[name](tab, r, c);
        setTimeout(() => c.remove(), 2500 * S);
    }

    function onTabOpen(event) {
        if (!ready) return;
        const en = readPref('tab-animation-enabled', true);
        if (en === false || en === 'false') return;
        const tab = event.target;
        if (!tab || tab.localName !== 'tab') return;
        if (tab.hasAttribute('zen-glance-tab')) return;

        cfg = readConfig();

        // masque l'onglet des l'ouverture pour eviter un flash avant l'animation
        const hold = tab.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 2000, fill: 'forwards' });

        whenSettled(tab, (r) => {
            try {
                if (r) run(tab, r);
            } catch (e) {
                console.error('[TabOpenAnimations]', e);
            }
            hold.cancel();
        });
    }

    function init() {
        if (window.__tabOpenAnimationsInit) return;
        window.__tabOpenAnimationsInit = true;
        injectStyles();
        gBrowser.tabContainer.addEventListener('TabOpen', onTabOpen);
        setTimeout(() => { ready = true; }, STARTUP_GRACE_MS);
    }

    if (gBrowserInit?.delayedStartupFinished) {
        init();
    } else {
        const obs = (subject, topic) => {
            if (topic === 'browser-delayed-startup-finished' && subject === window) {
                Services.obs.removeObserver(obs, topic);
                init();
            }
        };
        Services.obs.addObserver(obs, 'browser-delayed-startup-finished');
    }
})();
