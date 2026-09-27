/* Raamiz & Fiza — envelope → invitation.
   The whole opening is a pure function of time, render(t), so any frame can be
   frozen while previewing with ?t=<ms> (or ?t=end for the opened page). */
(() => {
  'use strict';

  const doc = document.documentElement;
  const EVENT = doc.dataset.event;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, [t0, t1]) => clamp((t - t0) / (t1 - t0));
  const ease = {
    in: (t) => t * t * t,
    out: (t) => 1 - (1 - t) ** 3,
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  };

  const params = new URLSearchParams(location.search);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ── ?to=Name personalises the envelope ── */
  const guest = (params.get('to') || '').replace(/\s+/g, ' ').trim().slice(0, 48);
  if (guest) {
    $('[data-guest]').textContent = guest;
    $('.guest').hidden = false;
    $('.guest').classList.toggle('is-long', guest.length > 20);
  }

  /* ── days to go (event dates are Pakistan time, UTC+5) ── */
  const countdown = $('[data-countdown]');
  if (countdown) {
    const [y, m, d] = countdown.dataset.countdown.split('-').map(Number);
    const days = Math.ceil((Date.UTC(y, m - 1, d) - 5 * 3600e3 - Date.now()) / 864e5);
    const num = $('.countdown-num', countdown);
    const label = $('.countdown-label', countdown);
    if (days > 1) { num.textContent = days; label.textContent = 'days to go'; }
    else if (days === 1) { num.textContent = '1'; label.textContent = 'day to go'; }
    else if (days === 0) { num.textContent = ''; label.textContent = 'Today'; }
    else countdown.hidden = true;
  }

  /* ── Android has no native .ics handler; hand it to Google Calendar ── */
  const calendar = $('[data-calendar]');
  if (calendar && /android/i.test(navigator.userAgent)) {
    calendar.href = calendar.dataset.google;
    calendar.target = '_blank';
    calendar.rel = 'noopener';
  }

  /* ───────────────────────── particles ───────────────────────── */

  const fx = (() => {
    const canvas = $('.fx');
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = 1;
    let parts = [];
    let held = false; // keep the loop alive through the opening: a canvas going idle mid-animation can hitch
    let running = false;
    let last = 0;

    const PALETTE = EVENT === 'barat'
      ? { dust: '232, 204, 140', spark: ['#e9cf8e', '#d6b064', '#f7e7bd'] }
      : { dust: '236, 176, 176', spark: ['#efcf95', '#e9b4b6', '#f8e3c8'] };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = innerWidth;
      h = innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    addEventListener('resize', resize);

    const sprite = (size, draw) => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      g.translate(size / 2, size / 2);
      draw(g, size);
      return c;
    };

    const sparkSprites = PALETTE.spark.map((col) => sprite(40, (g) => {
      const glow = g.createRadialGradient(0, 0, 0, 0, 0, 20);
      glow.addColorStop(0, col);
      glow.addColorStop(0.3, col + '88');
      glow.addColorStop(1, col + '00');
      g.fillStyle = glow;
      g.beginPath(); g.arc(0, 0, 20, 0, Math.PI * 2); g.fill();
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, -18); g.quadraticCurveTo(2, -2, 18, 0); g.quadraticCurveTo(2, 2, 0, 18);
      g.quadraticCurveTo(-2, 2, -18, 0); g.quadraticCurveTo(-2, -2, 0, -18);
      g.fill();
    }));

    const dustSprite = sprite(24, (g) => {
      const glow = g.createRadialGradient(0, 0, 0, 0, 0, 12);
      glow.addColorStop(0, `rgba(${PALETTE.dust}, 1)`);
      glow.addColorStop(0.35, `rgba(${PALETTE.dust}, .55)`);
      glow.addColorStop(1, `rgba(${PALETTE.dust}, 0)`);
      g.fillStyle = glow;
      g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.fill();
    });

    const rand = (a, b) => a + Math.random() * (b - a);

    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.age += dt;
        if (p.kind === 'spark') {
          const k = 1 - p.age / p.life;
          if (k <= 0) { parts.splice(i, 1); continue; }
          p.vx *= 1 - 2.2 * dt;
          p.vy = p.vy * (1 - 1.6 * dt) + 420 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          const s = p.size * (0.55 + 0.45 * k);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = k;
          ctx.drawImage(p.sprite, -s / 2, -s / 2, s, s);
          ctx.restore();
        } else {
          if (p.dying) {
            p.fade -= dt * 1.8;
            if (p.fade <= 0) { parts.splice(i, 1); continue; }
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.y < -12) { p.y = h + 12; p.x = rand(0, w); }
          if (p.x < -12) p.x = w + 12; else if (p.x > w + 12) p.x = -12;
          const twinkle = 0.45 + 0.55 * Math.sin(p.age * p.tw + p.ph);
          ctx.globalAlpha = p.alpha * twinkle * p.fade * clamp(p.age / 1.2);
          ctx.drawImage(dustSprite, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
      }
      ctx.globalAlpha = 1;

      if (parts.length || held) requestAnimationFrame(frame);
      else { running = false; ctx.clearRect(0, 0, w, h); }
    };

    const run = () => {
      if (running) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    };

    return {
      hold(on) {
        held = on;
        if (on) run();
      },
      dust() {
        if (reduceMotion) return;
        const n = Math.round(clamp((w * h) / 18000, 10, 24));
        for (let i = 0; i < n; i++) {
          parts.push({
            kind: 'dust', x: rand(0, w), y: rand(0, h), size: rand(3, 8),
            vx: rand(-5, 5), vy: rand(-12, -4), alpha: rand(0.35, 0.8),
            tw: rand(0.8, 2.2), ph: rand(0, 6.28), age: 0, fade: 1,
          });
        }
        run();
      },
      stopDust() {
        for (const p of parts) if (p.kind === 'dust') p.dying = true;
      },
      burst(x, y) {
        if (reduceMotion) return;
        for (let i = 0; i < 28; i++) {
          const a = rand(0, Math.PI * 2);
          const speed = rand(80, 300);
          parts.push({
            kind: 'spark', sprite: sparkSprites[i % sparkSprites.length], x, y,
            vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 90,
            rot: rand(0, 6.28), vr: rand(-6, 6), size: rand(8, 18), life: rand(0.5, 1.05), age: 0,
          });
        }
        run();
      },
    };
  })();

  /* ───────────────────────── the envelope ───────────────────────── */

  const stage = $('.stage');
  const envBox = $('.env');
  const layers = $$('.env-layer');
  const clipBox = $('.card-clip');
  const card = $('.card');
  const cardImg = $('.card-art');
  const cardFull = $('.card-full');
  const flapLayer = $('.env-flap');
  const flap = $('.flap');
  const shadeFront = $('.flap-front .shade');
  const shadeBack = $('.flap-back .shade');
  const flapShadow = $('.flap-shadow');
  const seal = $('.seal');
  const sealWhole = $('.seal-whole');
  const sealL = $('.seal-half--l');
  const sealR = $('.seal-half--r');
  const intro = $('.intro');
  const cta = $('.cta');
  const decor = $$('.decor');
  const glow = $('.stage-glow');
  const finalCard = $('.final-card');
  const invite = $('.invite');

  // The barat artwork is torn paper on a surface; inside the envelope only the paper shows.
  const PAPER = EVENT === 'barat'
    ? { t: 0.026, r: 0.05, b: 0.026, l: 0.0507 }
    : { t: 0, r: 0, b: 0, l: 0 };

  // choreography, in ms
  const T = {
    settle: [0, 380],
    press: [0, 150],
    crack: [140, 780],
    cta: [0, 380],
    flap: [380, 1220],
    lower: [380, 1380],
    rise: [1080, 2520],
    intro: [900, 1500],
    sink: [2280, 3200],
    fly: [2480, 3700],
    decor: [2300, 3300],
    end: 3760,
  };

  let G = null;
  let state = 'idle';

  const safeTop = () => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    const px = probe.getBoundingClientRect().height;
    probe.remove();
    return px;
  };

  const currentSway = () => {
    const tr = getComputedStyle(layers[0]).transform;
    const m = tr && tr !== 'none' ? new DOMMatrixReadOnly(tr) : new DOMMatrixReadOnly();
    return { rot: (Math.atan2(m.b, m.a) * 180) / Math.PI, y: m.f };
  };

  function measure() {
    const vh = innerHeight;
    const e = envBox.getBoundingClientRect();
    const clipStyle = getComputedStyle(clipBox); // the clip box sways, so read its untransformed offset
    const c = { left: e.left + parseFloat(clipStyle.left), top: e.top + parseFloat(clipStyle.top) };
    const f = finalCard.getBoundingClientRect();
    const s = seal.getBoundingClientRect();
    const W = e.width, H = e.height;

    // lay the moving card out at its final size and scale it down, so it stays crisp
    card.style.width = `${f.width}px`;
    card.style.height = `${f.height}px`;

    const s0 = (0.9 * W) / ((1 - PAPER.l - PAPER.r) * f.width);
    const visibleH = (1 - PAPER.t - PAPER.b) * f.height * s0;
    const x0 = e.left + 0.05 * W - PAPER.l * f.width * s0;
    const y0 = e.top + 0.035 * H - PAPER.t * f.height * s0;

    // rise until about two-thirds of the card clears the pocket (its lowest point sits ~49.6% down)
    const target = e.top + 0.496 * H - 0.68 * visibleH;
    const R = e.top + 0.035 * H - target;
    const D1 = Math.max(0, safeTop() + 14 - target); // short screens: drop the envelope a little first

    return {
      s0, x0, y0, R, D1,
      D2: vh - (e.top + D1) + 60,
      drift: 14,
      xf: f.left, yf: f.top,
      cx: c.left, cy: c.top,
      sealX: s.left + s.width / 2, sealY: s.top + s.height / 2, sealS: s.width,
      sway: currentSway(),
    };
  }

  function render(t) {
    const g = G;

    // envelope: sway settles, (maybe) lowers, then sinks away
    const settle = 1 - ease.out(seg(t, T.settle));
    const lowered = g.D1 * ease.inOut(seg(t, T.lower));
    const dy = lowered + g.D2 * ease.in(seg(t, T.sink));
    const envTransform = `translate3d(0,${(dy + g.sway.y * settle).toFixed(2)}px,0) rotate(${(g.sway.rot * settle).toFixed(3)}deg)`;
    const envAlpha = (1 - seg(t, [lerp(T.sink[0], T.sink[1], 0.8), T.sink[1]])).toFixed(3); // only once it is clear of the card
    for (const el of layers) {
      el.style.transform = envTransform;
      el.style.opacity = envAlpha;
    }
    clipBox.style.transform = envTransform;

    // seal: a press, then it cracks in two and falls away
    const cracked = t >= T.crack[0];
    sealWhole.style.opacity = cracked ? '0' : '1';
    sealWhole.style.transform = `scale(${(1 - 0.08 * ease.out(seg(t, T.press))).toFixed(4)})`;
    if (cracked) {
      const p = seg(t, T.crack);
      const out = ease.out(p);
      const fall = p * p;
      const pop = lerp(0.92, 1, ease.out(seg(t, [T.crack[0], T.crack[0] + 140])));
      const alpha = (1 - seg(p, [0.5, 1])).toFixed(3);
      sealL.style.opacity = alpha;
      sealR.style.opacity = alpha;
      sealL.style.transform = `translate3d(${(-0.26 * g.sealS * out).toFixed(2)}px,${(0.85 * g.sealS * fall).toFixed(2)}px,0) rotate(${(-24 * out).toFixed(2)}deg) scale(${pop.toFixed(4)})`;
      sealR.style.transform = `translate3d(${(0.3 * g.sealS * out).toFixed(2)}px,${(0.95 * g.sealS * fall).toFixed(2)}px,0) rotate(${(19 * out).toFixed(2)}deg) scale(${pop.toFixed(4)})`;
    } else {
      sealL.style.opacity = '0';
      sealR.style.opacity = '0';
    }

    // flap swings up and over; once it passes vertical it tucks behind the card
    const angle = 180 * ease.inOut(seg(t, T.flap));
    const sin = Math.sin((angle * Math.PI) / 180);
    flap.style.transform = `rotateX(${angle.toFixed(2)}deg)`;
    flapLayer.style.zIndex = angle > 90 ? '0' : '4';
    shadeFront.style.opacity = angle <= 90 ? (0.26 * sin).toFixed(3) : '0';
    shadeBack.style.opacity = angle > 90 ? (0.3 * sin).toFixed(3) : '0';
    flapShadow.style.opacity = (1 - clamp((angle / 180) * 3)).toFixed(3);

    // card: rides with the envelope, slides out, then flies to its place on the page
    const rise = ease.inOut(seg(t, T.rise));
    const drift = g.drift * ease.out(seg(t, T.sink));
    const pathY = g.y0 + lowered - g.R * rise - drift;
    const fly = ease.inOut(seg(t, T.fly));
    const X = lerp(g.x0, g.xf, fly);
    const Y = lerp(pathY, g.yf, fly);
    const S = lerp(g.s0, 1, fly);
    card.style.transform = `translate3d(${(X - g.cx).toFixed(2)}px,${(Y - g.cy - dy).toFixed(2)}px,0) scale(${S.toFixed(5)})`;
    if (EVENT === 'barat') cardFull.style.opacity = seg(fly, [0.1, 0.9]).toFixed(3);

    // surroundings clear away
    cta.style.opacity = (1 - ease.out(seg(t, T.cta))).toFixed(3);
    intro.style.opacity = (1 - seg(t, T.intro)).toFixed(3);
    const decorAlpha = (1 - seg(t, T.decor)).toFixed(3);
    for (const el of decor) el.style.opacity = decorAlpha;
    glow.style.opacity = (1 - seg(t, T.fly)).toFixed(3);
  }

  const decoded = (img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve());
  // decode the artwork up front so nothing stalls mid-animation
  const artworkReady = Promise.all([decoded(cardImg), decoded(finalCard)]);

  function finish() {
    fx.hold(false);
    invite.inert = false;
    doc.classList.remove('is-sealed');
    doc.classList.add('is-open');
    stage.hidden = true;
    state = 'open';
    watchReveals();
  }

  function openQuietly() {
    invite.inert = false;
    doc.classList.remove('is-idle', 'is-sealed');
    doc.classList.add('is-open');
    stage.style.transition = 'opacity .6s ease';
    stage.style.opacity = '0';
    setTimeout(() => { stage.hidden = true; state = 'open'; watchReveals(); }, 650);
  }

  function open() {
    if (state !== 'idle') return;
    state = 'opening';
    if (reduceMotion) { openQuietly(); return; }

    G = measure();
    doc.classList.remove('is-idle');
    render(0);
    fx.stopDust();
    fx.hold(true);

    let ready = false;
    artworkReady.then(() => { ready = true; });

    let t = 0;
    let last = performance.now();
    let cracked = false;
    const tick = (now) => {
      t += Math.min(now - last, 80);
      last = now;
      if (!ready && t > T.rise[0]) t = T.rise[0]; // hold with the flap open until the card has loaded
      render(t);
      if (!cracked && t >= T.crack[0]) {
        cracked = true;
        fx.burst(G.sealX, G.sealY);
        if (navigator.vibrate) navigator.vibrate(12);
      }
      if (t >= T.end) finish();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function watchReveals() {
    const items = $$('.reveal');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -6% 0px' });
    items.forEach((el) => io.observe(el));
  }

  stage.addEventListener('click', open);
  envBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });
  $('.replay').addEventListener('click', () => {
    scrollTo(0, 0);
    location.reload();
  });

  invite.inert = true; // the opened page sits under the envelope until it is revealed
  doc.classList.add('is-idle');

  // tuck the card inside the envelope right away, so it is already painted when the flap opens
  const place = () => {
    if (state !== 'idle') return;
    G = measure();
    render(0);
  };
  place();
  addEventListener('resize', () => {
    clearTimeout(place.timer);
    place.timer = setTimeout(place, 150);
  });

  // ?t=<ms> freezes the opening at that moment; ?t=end shows the opened page (previewing only)
  const frozen = params.get('t');
  if (frozen !== null) {
    state = 'frozen';
    const fontsOrTimeout = Promise.race([document.fonts ? document.fonts.ready : null, new Promise((r) => setTimeout(r, 1200))]);
    Promise.all([fontsOrTimeout, artworkReady]).then(() => {
      if (frozen === 'end') { finish(); return; }
      G = measure();
      doc.classList.remove('is-idle');
      render(Number(frozen) || 0);
      window.inviteFrame = render; // scrub from the console while previewing
    });
  } else {
    fx.dust();
  }
})();
