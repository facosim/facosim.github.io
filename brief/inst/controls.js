(function (FI) {
  'use strict';

  const clamp = FI.clamp;
  const ease = (from, to, dt) => from + (to - from) * (1 - Math.exp(-dt / 0.05));

  const STICK = `<svg viewBox="0 0 120 120" aria-hidden="true">
  <defs>
    <radialGradient id="fi-ball" cx="36%" cy="30%" r="72%">
      <stop offset="0" stop-color="#ffb4ae"/>
      <stop offset=".32" stop-color="#e8423d"/>
      <stop offset="1" stop-color="#7d110e"/>
    </radialGradient>
    <filter id="fi-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
  </defs>
  <rect class="s-plate" x="3" y="3" width="114" height="114" rx="22"/>
  <circle class="s-screw" cx="13" cy="13" r="2.4"/><circle class="s-screw" cx="107" cy="13" r="2.4"/>
  <circle class="s-screw" cx="13" cy="107" r="2.4"/><circle class="s-screw" cx="107" cy="107" r="2.4"/>
  <rect class="s-gate" x="22" y="22" width="76" height="76" rx="14"/>
  <path class="s-cross" d="M60 26V94M26 60H94"/>
  <text class="s-lab s-top" x="60" y="15.5">NOSE UP</text>
  <text class="s-lab s-bottom" x="60" y="112.5">NOSE DN</text>
  <text class="s-lab" x="11" y="63">L</text>
  <text class="s-lab" x="109" y="63">R</text>
  <circle class="s-boot" cx="60" cy="60" r="11"/>
  <circle class="s-shade" r="15" filter="url(#fi-soft)"/>
  <line class="s-shaft" x1="60" y1="60" x2="60" y2="60"/>
  <line class="s-shaft-hi" x1="60" y1="60" x2="60" y2="60"/>
  <g class="s-ball">
    <circle r="15" fill="url(#fi-ball)" stroke="rgba(0,0,0,.4)" stroke-width="1"/>
    <ellipse cx="-5.5" cy="-6.5" rx="6.2" ry="3.6" transform="rotate(-35 -5.5 -6.5)" fill="#fff" opacity=".55"/>
  </g>
</svg>`;

  const LEVER = `<svg viewBox="0 0 56 120" aria-hidden="true">
  <defs>
    <linearGradient id="fi-grip" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5a6677"/>
      <stop offset=".5" stop-color="#2f3844"/>
      <stop offset="1" stop-color="#1b222b"/>
    </linearGradient>
  </defs>
  <rect class="l-plate" x="1" y="1" width="54" height="118" rx="12"/>
  <path class="l-tick" d="M5 26H13M5 43H11M5 60H13M5 77H11M5 94H13M51 26H43M51 43H45M51 60H43M51 77H45M51 94H43"/>
  <text class="l-lab" x="28" y="11.5">MAX</text>
  <text class="l-lab" x="28" y="115.5">IDLE</text>
  <rect class="l-slot" x="23" y="20" width="10" height="80" rx="5"/>
  <rect class="l-fill" x="24.5" y="94" width="7" height="4" rx="3"/>
  <g class="l-grip" transform="translate(28 94)">
    <rect class="l-body" x="-17" y="-10" width="34" height="20" rx="6"/>
    <path class="l-groove" d="M-11 -5H11M-11 5H11"/>
    <path class="l-mark" d="M-11 0H11"/>
  </g>
</svg>`;

  function drag(el, h) {
    let id = null;
    const stop = e => {
      if (id === null || e.pointerId !== id) return;
      id = null;
      el.classList.remove('active');
      h.end();
    };
    el.addEventListener('pointerdown', e => {
      if (id !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      const focused = document.activeElement;
      if (focused && focused !== document.body && focused !== el) focused.blur();
      id = e.pointerId;
      try { el.setPointerCapture(id); } catch (err) { }
      el.classList.add('active');
      h.start(e);
    });
    el.addEventListener('pointermove', e => { if (e.pointerId === id) h.move(e); });
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, stop);
    el.addEventListener('contextmenu', e => e.preventDefault());
    return { get active() { return id !== null; } };
  }

  FI.Stick = function (el, h) {
    el.innerHTML = STICK;
    const q = s => el.querySelector(s);
    const ball = q('.s-ball'), shade = q('.s-shade'), shafts = [q('.s-shaft'), q('.s-shaft-hi')], top = q('.s-top'), bottom = q('.s-bottom');
    const C = 60, R = 34, GRAB = 19, DEAD = 0.09, AXES = ['x', 'y'];
    const shown = { x: 0, y: 0 }, want = { x: 0, y: 0 }, held = { x: false, y: false }, start = { x: 0, y: 0 }, off = { x: 0, y: 0 };
    let raf = 0, last = 0;

    const render = () => {
      const x = C + shown.x * R, y = C - shown.y * R;
      ball.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      shade.setAttribute('cx', (x + 3).toFixed(2));
      shade.setAttribute('cy', (y + 6).toFixed(2));
      for (const s of shafts) { s.setAttribute('x2', x.toFixed(2)); s.setAttribute('y2', y.toFixed(2)); }
    };
    const frame = now => {
      raf = 0;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      let busy = false;
      for (const a of AXES) {
        if (held[a]) continue;
        if (Math.abs(want[a] - shown[a]) > 0.002) { shown[a] = ease(shown[a], want[a], dt); busy = true; } else shown[a] = want[a];
      }
      render();
      if (busy) raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };

    const locate = e => {
      const r = el.getBoundingClientRect(), k = 120 / r.width;
      return { x: ((e.clientX - r.left) * k - C) / R, y: -((e.clientY - r.top) * k - C) / R };
    };
    const track = p => {
      let moved = false;
      for (const a of AXES) {
        const v = clamp(p[a] + off[a], -1, 1);
        if (!held[a] && Math.abs(v - start[a]) >= DEAD) held[a] = true;
        if (held[a]) { shown[a] = v; h.axis(a, v); moved = true; }
      }
      if (moved) { render(); h.changed(); }
    };

    const pointer = drag(el, {
      start(e) {
        const p = locate(e), near = Math.hypot(p.x - shown.x, p.y - shown.y) * R <= GRAB;
        for (const a of AXES) { off[a] = near ? shown[a] - p[a] : 0; start[a] = shown[a]; held[a] = false; }
        track(p);
      },
      move(e) { track(locate(e)); },
      end() {
        const used = { x: held.x, y: held.y };
        held.x = held.y = false;
        h.release(used);
        kick();
      },
    });

    render();
    return {
      set(x, y) { want.x = clamp(x, -1, 1); want.y = clamp(y, -1, 1); kick(); },
      setLabels(up, down) { top.textContent = up; bottom.textContent = down; },
      setHold(on) { el.classList.toggle('hold', on); },
      get active() { return pointer.active; },
    };
  };

  FI.Lever = function (el, h) {
    el.innerHTML = LEVER;
    const q = s => el.querySelector(s);
    const grip = q('.l-grip'), fill = q('.l-fill');
    const TOP = 26, BOT = 94, SPAN = BOT - TOP, GRAB = 15, DEAD = 0.015;
    let shown = 0, want = 0, held = false, start = 0, off = 0, raf = 0, last = 0;

    const render = () => {
      const y = BOT - shown * SPAN;
      grip.setAttribute('transform', `translate(28 ${y.toFixed(2)})`);
      fill.setAttribute('y', y.toFixed(2));
      fill.setAttribute('height', Math.max(0, 98 - y).toFixed(2));
    };
    const frame = now => {
      raf = 0;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (!held) {
        if (Math.abs(want - shown) > 0.002) { shown = ease(shown, want, dt); raf = requestAnimationFrame(frame); } else shown = want;
      }
      render();
    };
    const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };

    const locate = e => {
      const r = el.getBoundingClientRect();
      return (BOT - (e.clientY - r.top) * (120 / r.height)) / SPAN;
    };
    const track = t => {
      const v = clamp(t + off, 0, 1);
      if (!held && Math.abs(v - start) >= DEAD) held = true;
      if (held) { shown = v; render(); h.change(Math.round(v * 100)); }
    };

    const pointer = drag(el, {
      start(e) {
        const t = locate(e);
        off = Math.abs(t - shown) * SPAN <= GRAB ? shown - t : 0;
        start = shown; held = false;
        track(t);
      },
      move(e) { track(locate(e)); },
      end() { held = false; h.release(); kick(); el.blur(); },
    });

    el.addEventListener('keydown', e => {
      const step = e.shiftKey ? 1 : 5, d = { ArrowUp: step, ArrowDown: -step, PageUp: 10, PageDown: -10 }[e.key];
      if (d !== undefined) h.nudge(d);
      else if (e.key === 'Home') h.change(0);
      else if (e.key === 'End') h.change(100);
      else return;
      e.preventDefault();
      e.stopPropagation();
    });

    render();
    return {
      set(v) {
        want = clamp(v, 0, 1);
        el.setAttribute('aria-valuenow', String(Math.round(want * 100)));
        el.setAttribute('aria-valuetext', `${Math.round(want * 100)}%`);
        kick();
      },
      get active() { return pointer.active; },
    };
  };
})(window.FI);
