(function (DL) {
  'use strict';

  const NM = 6076.12;
  const BRIGHT = '#8dff8d', MID = '#38c238', DIM = '#145a14', FAINT = '#0b3a0b';
  const R = DL.adv.radar;
  const hex = c => '#' + c.toString(16).padStart(6, '0');
  const signed = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
  const clampElev = v => DL.clamp(Math.round(v), -60, 60);

  const TEMPLATE = `
  <div class="vw-h"><span class="sw"></span><b class="bs-title">B-Scope</b><button class="icon bs-close" title="Close this B-Scope">×</button></div>
  <canvas class="bs-canvas" title="Scroll, or drag up and down, to change the elevation angle"></canvas>
  <div class="bs-info mono"></div>
  <div class="bs-ctl">
    <label>Elevation</label>
    <input class="bs-elev" type="range" min="-60" max="60" step="1" value="0" aria-label="Elevation angle">
    <span class="bs-elev-v mono"></span>
    <button class="bs-level" title="Point the beam at the horizon">0°</button>
  </div>
  <div class="bs-ctl">
    <span class="dim">Range</span>
    <div class="seg"><button data-bsrange="5">5</button><button data-bsrange="10">10</button><button data-bsrange="20">20</button><button data-bsrange="40">40</button></div>
    <span class="dim">nm</span>
    <span class="dim adv-right">Beam</span>
    <select class="bs-beam" title="Vertical beamwidth: contacts are returned only inside it" aria-label="Beamwidth"><option value="4">4°</option><option value="8">8°</option><option value="16">16°</option></select>
    <label class="check"><input class="bs-labels" type="checkbox" checked> Tags</label>
  </div>`;

  const scopes = [];
  let raf = 0;

  function liveStates() {
    return (DL.scene && DL.scene.scrub) || DL.cur();
  }

  function contactsFor(sc) {
    const states = liveStates();
    if (!states[sc.id]) return null;
    const half = R.fovDeg / 2, max = sc.rangeNm * NM;
    return DL.radarContacts(sc.id, undefined, states).map(c => {
      const elev = Math.atan2(c.dAlt, Math.max(c.range, 1)) / DL.D2R;
      const seen = c.range <= max && Math.abs(c.rel) <= half;
      return Object.assign(c, { elev, seen, hit: seen && Math.abs(elev - sc.elevDeg) <= sc.beamDeg / 2 });
    });
  }

  function geometry(w, h) {
    return { x0: 40, x1: w - 48, y0: 12, y1: h - 24 };
  }

  function fit(sc) {
    const cv = sc.cv, dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    sc.w = w; sc.h = h; sc.dpr = dpr;
  }

  function noise(seed) {
    let t = seed >>> 0;
    return () => {
      t = (t + 0x6D2B79F5) >>> 0;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function draw(sc, now) {
    const ctx = sc.cv.getContext('2d');
    fit(sc);
    const { w, h, dpr } = sc, g = geometry(w, h);
    if (!w || !h) return;
    const half = R.fovDeg / 2, max = sc.rangeNm * NM, pw = g.x1 - g.x0, ph = g.y1 - g.y0;
    const X = rel => g.x0 + (rel / half + 1) / 2 * pw, Y = range => g.y1 - range / max * ph;
    const list = contactsFor(sc);
    const tick = Math.floor(now / 110);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#020a02'; ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1; ctx.font = '10px Menlo, Consolas, monospace'; ctx.textBaseline = 'middle';
    for (let a = Math.ceil(-half / 10) * 10; a <= half; a += 10) {
      const major = a % 30 === 0, x = Math.round(X(a)) + 0.5;
      ctx.strokeStyle = major ? DIM : FAINT;
      ctx.beginPath(); ctx.moveTo(x, g.y0); ctx.lineTo(x, g.y1); ctx.stroke();
      if (major) { ctx.fillStyle = MID; ctx.textAlign = 'center'; ctx.fillText(String(a), x, g.y1 + 11); }
    }
    for (let i = 1; i <= 4; i++) {
      const rng = max * i / 4, y = Math.round(Y(rng)) + 0.5;
      ctx.strokeStyle = i === 4 ? DIM : FAINT;
      ctx.beginPath(); ctx.moveTo(g.x0, y); ctx.lineTo(g.x1, y); ctx.stroke();
      ctx.fillStyle = MID; ctx.textAlign = 'right'; ctx.fillText(String(+(sc.rangeNm * i / 4).toFixed(1)), g.x0 - 5, y);
    }
    ctx.strokeStyle = MID; ctx.strokeRect(g.x0 + 0.5, g.y0 + 0.5, pw, ph);
    ctx.fillStyle = DIM; ctx.textAlign = 'left'; ctx.fillText('NM', 6, g.y0 + 4);

    if (list) {
      const rnd = noise(tick * 7919 + sc.seed);
      for (let i = 0; i < 160; i++) {
        const near = rnd() ** 2.2;
        ctx.fillStyle = `rgba(110,255,110,${(0.05 + rnd() * 0.2) * (1 - near * 0.55)})`;
        ctx.fillRect(g.x0 + rnd() * pw, g.y1 - near * ph, 1.4, 1.4);
      }
      for (const c of list) {
        if (!c.hit) continue;
        const x = X(c.rel), y = Y(c.range), k = 1 - 0.55 * Math.min(1, c.range / max), shimmer = 0.92 + 0.08 * Math.sin(tick * 1.7 + x);
        const gl = ctx.createRadialGradient(x, y, 0, x, y, 11);
        gl.addColorStop(0, `rgba(120,255,120,${0.5 * k})`); gl.addColorStop(1, 'rgba(120,255,120,0)');
        ctx.fillStyle = gl; ctx.fillRect(x - 11, y - 11, 22, 22);
        ctx.globalAlpha = Math.min(1, k * shimmer + 0.15);
        ctx.fillStyle = BRIGHT; ctx.fillRect(x - 2.5, y - 4, 5, 8);
        ctx.globalAlpha = 1;
        if (sc.tags) {
          ctx.font = '10px Menlo, Consolas, monospace'; ctx.textAlign = 'left';
          ctx.fillStyle = MID;
          ctx.fillText(c.callsign + ' ' + signed(Math.round(c.dAlt / 100) / 10) + 'k', x + 8, y);
        }
      }
      ctx.fillStyle = BRIGHT;
      ctx.beginPath(); ctx.moveTo(X(0), g.y1); ctx.lineTo(X(0) - 4, g.y1 + 6); ctx.lineTo(X(0) + 4, g.y1 + 6); ctx.fill();
    } else {
      ctx.fillStyle = MID; ctx.textAlign = 'center'; ctx.font = '12px Menlo, Consolas, monospace';
      ctx.fillText('AIRCRAFT NOT IN THIS FRAME', (g.x0 + g.x1) / 2, (g.y0 + g.y1) / 2);
    }

    const ex = w - 30, EY = e => g.y1 - (e + 60) / 120 * ph;
    ctx.strokeStyle = MID; ctx.strokeRect(ex + 0.5, g.y0 + 0.5, 12, ph);
    ctx.fillStyle = 'rgba(110,255,110,.35)';
    const top = EY(Math.min(60, sc.elevDeg + sc.beamDeg / 2)), bot = EY(Math.max(-60, sc.elevDeg - sc.beamDeg / 2));
    ctx.fillRect(ex + 1, top, 11, Math.max(2, bot - top));
    ctx.fillStyle = MID; ctx.textAlign = 'left';
    for (const e of [-60, -30, 0, 30, 60]) { ctx.fillText(signed(e), ex + 16, EY(e)); ctx.fillRect(ex - 3, Math.round(EY(e)), 3, 1); }
    ctx.fillText('EL', ex, g.y1 + 11);
    if (list) for (const c of list) {
      if (!c.seen) continue;
      const y = DL.clamp(EY(c.elev), g.y0, g.y1);
      ctx.fillStyle = c.hit ? BRIGHT : DIM; ctx.fillRect(ex - 6, y - 1, 5, 3);
    }

    const n = list ? list.filter(c => c.hit).length : 0;
    sc.info.textContent = list
      ? `ELEV ${signed(sc.elevDeg)}° ±${sc.beamDeg / 2}° · RNG ${sc.rangeNm} NM · AZ ±${half}° · ${n} return${n === 1 ? '' : 's'} (${list.filter(c => c.seen).length} in sector)`
      : 'This aircraft is not in the current frame.';
    sc.elevV.textContent = signed(sc.elevDeg) + '°';
  }

  function title(sc) {
    const ac = DL.tl.aircraft[sc.id], s = DL.cur()[sc.id];
    const name = ac ? ac.callsign : '?';
    if (sc.name !== name) { sc.name = name; sc.titleEl.textContent = 'B-Scope · ' + name; }
    const col = hex((s && s.color) || (ac && ac.color) || 0x8dff8d);
    if (sc.col !== col) { sc.col = col; sc.sw.style.background = col; }
  }

  function loop(now) {
    raf = 0;
    for (const sc of scopes.slice()) {
      if (!DL.tl.aircraft[sc.id]) { close(sc); continue; }
      title(sc);
      draw(sc, now);
    }
    if (scopes.length) raf = requestAnimationFrame(loop);
  }

  function front(sc) {
    const i = scopes.indexOf(sc);
    if (i >= 0) { scopes.splice(i, 1); scopes.push(sc); }
    scopes.forEach((s, j) => { s.el.style.zIndex = String(10 + Math.min(j, 5)); });
  }

  function setElev(sc, v) {
    sc.elevDeg = clampElev(v);
    sc.elevIn.value = sc.elevDeg;
  }

  function syncButtons(sc) {
    sc.el.querySelectorAll('[data-bsrange]').forEach(b => b.classList.toggle('on', +b.dataset.bsrange === sc.rangeNm));
  }

  function create(id) {
    const el = document.createElement('div');
    el.className = 'bsw open';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'B-Scope');
    el.innerHTML = TEMPLATE;
    document.body.appendChild(el);
    const q = s => el.querySelector(s);
    const sc = {
      id, el, cv: q('.bs-canvas'), seed: scopes.length * 977 + 1, info: q('.bs-info'), elevIn: q('.bs-elev'), elevV: q('.bs-elev-v'),
      titleEl: q('.bs-title'), sw: q('.sw'), elevDeg: 0, beamDeg: 8, rangeNm: R.rangeNm, tags: true, name: null, col: null,
    };
    q('.bs-beam').value = String(sc.beamDeg);
    q('.bs-close').onclick = () => close(sc);
    sc.elevIn.oninput = e => setElev(sc, +e.target.value);
    q('.bs-level').onclick = () => setElev(sc, 0);
    q('.bs-beam').onchange = e => { sc.beamDeg = +e.target.value; };
    q('.bs-labels').onchange = e => { sc.tags = e.target.checked; };
    el.querySelectorAll('[data-bsrange]').forEach(b => { b.onclick = () => { sc.rangeNm = +b.dataset.bsrange; syncButtons(sc); }; });
    sc.cv.addEventListener('wheel', e => { e.preventDefault(); setElev(sc, sc.elevDeg + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 5 : 1)); }, { passive: false });
    let drag = null;
    sc.cv.addEventListener('pointerdown', e => { drag = { y: e.clientY, e0: sc.elevDeg }; sc.cv.setPointerCapture(e.pointerId); });
    sc.cv.addEventListener('pointermove', e => { if (drag) setElev(sc, drag.e0 - (e.clientY - drag.y) * 0.5); });
    for (const t of ['pointerup', 'pointercancel']) sc.cv.addEventListener(t, () => { drag = null; });
    el.addEventListener('pointerdown', () => front(sc), true);
    DL.ui.dragWindow(el, q('.vw-h'));
    syncButtons(sc);
    return sc;
  }

  function close(sc) {
    const i = scopes.indexOf(sc);
    if (i < 0) return;
    scopes.splice(i, 1);
    sc.el.remove();
    DL.ui.layout();
    if (DL.advWin) DL.advWin.refresh();
  }

  const api = {
    scopes,
    contactsFor,

    forAircraft(id) { return scopes.find(s => s.id === id) || null; },
    has(id) { return !!this.forAircraft(id); },
    isOpen() { return scopes.length > 0; },

    open(id) {
      if (!R.on || !id || !DL.cur()[id]) return null;
      const have = this.forAircraft(id);
      if (have) { front(have); return have; }
      DL.ui.soloWindow('bscope');
      const sc = create(id);
      scopes.push(sc);
      front(sc);
      DL.ui.layout();
      if (!raf) raf = requestAnimationFrame(loop);
      if (DL.advWin) DL.advWin.refresh();
      return sc;
    },

    closeFor(id) { const sc = this.forAircraft(id); if (sc) close(sc); },

    closeAll() { for (const sc of scopes.slice()) close(sc); },

    toggleFor(id) { if (this.has(id)) this.closeFor(id); else this.open(id); },
  };
  DL.bscope = api;
})(window.DL);
