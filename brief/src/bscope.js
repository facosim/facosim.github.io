(function (DL) {
  'use strict';

  const $ = id => document.getElementById(id);
  const NM = 6076.12;
  const BRIGHT = '#8dff8d', MID = '#38c238', DIM = '#145a14', FAINT = '#0b3a0b';
  const R = DL.adv.radar;
  R.elevDeg = 0;
  R.beamDeg = 8;
  R.tags = true;

  const bs = { raf: 0, t0: 0, last: 0, sweep: null, trail: document.createElement('canvas'), w: 0, h: 0 };

  const clampElev = v => DL.clamp(Math.round(v), -60, 60);
  const signed = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);

  function geometry(w, h) {
    return { x0: 40, x1: w - 48, y0: 12, y1: h - 24 };
  }

  function contacts() {
    const id = DL.ui.selected;
    if (!id || !DL.cur()[id]) return null;
    const half = R.fovDeg / 2, max = R.rangeNm * NM;
    return DL.radarContacts(id).map(c => {
      const elev = Math.atan2(c.dAlt, Math.max(c.range, 1)) / DL.D2R;
      const seen = c.range <= max && Math.abs(c.rel) <= half;
      return Object.assign(c, { elev, seen, hit: seen && Math.abs(elev - R.elevDeg) <= R.beamDeg / 2 });
    });
  }

  function fit(cv) {
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = bs.trail.width = Math.round(w * dpr);
      cv.height = bs.trail.height = Math.round(h * dpr);
    }
    bs.w = w; bs.h = h; bs.dpr = dpr;
  }

  function frame(now) {
    bs.raf = 0;
    if (!win.isOpen()) return;
    const cv = $('bs-canvas'), ctx = cv.getContext('2d'), tctx = bs.trail.getContext('2d');
    fit(cv);
    const { w, h, dpr } = bs, g = geometry(w, h);
    const dt = bs.last ? Math.min(0.1, (now - bs.last) / 1000) : 0.016;
    bs.last = now;
    const half = R.fovDeg / 2, max = R.rangeNm * NM, pw = g.x1 - g.x0, ph = g.y1 - g.y0;
    const X = rel => g.x0 + (rel / half + 1) / 2 * pw, Y = range => g.y1 - range / max * ph;
    const list = contacts();

    const T = Math.max(1.2, R.fovDeg / 90), tm = (now - (bs.t0 || (bs.t0 = now))) / 1000;
    const phase = (tm % (2 * T)) / T, sweep = phase < 1 ? -half + phase * R.fovDeg : half - (phase - 1) * R.fovDeg;
    const prev = bs.sweep === null ? sweep : bs.sweep;
    bs.sweep = sweep;

    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tctx.globalCompositeOperation = 'destination-out';
    tctx.fillStyle = `rgba(0,0,0,${1 - Math.exp(-dt / 1.7)})`;
    tctx.fillRect(0, 0, w, h);
    tctx.globalCompositeOperation = 'source-over';
    if (list) {
      for (let i = 0; i < 70 * dt * 6; i++) {
        tctx.fillStyle = `rgba(110,255,110,${0.1 + Math.random() * 0.22})`;
        tctx.fillRect(g.x0 + Math.random() * pw, g.y0 + Math.random() * ph, 1.4, 1.4);
      }
      const lo = Math.min(prev, sweep), hi = Math.max(prev, sweep);
      for (const c of list) {
        if (!c.hit || c.rel < lo || c.rel > hi) continue;
        const x = X(c.rel), y = Y(c.range);
        const gl = tctx.createRadialGradient(x, y, 0, x, y, 9);
        gl.addColorStop(0, 'rgba(120,255,120,.55)'); gl.addColorStop(1, 'rgba(120,255,120,0)');
        tctx.fillStyle = gl; tctx.fillRect(x - 9, y - 9, 18, 18);
        tctx.fillStyle = BRIGHT; tctx.fillRect(x - 2, y - 3.5, 4, 7);
        if (R.tags) {
          tctx.font = '10px Menlo, Consolas, monospace'; tctx.textBaseline = 'middle';
          tctx.fillStyle = MID;
          tctx.fillText(c.callsign + ' ' + signed(Math.round(c.dAlt / 100) / 10) + 'k', x + 7, y);
        }
      }
    }

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
      ctx.fillStyle = MID; ctx.textAlign = 'right'; ctx.fillText(String(+(R.rangeNm * i / 4).toFixed(1)), g.x0 - 5, y);
    }
    ctx.strokeStyle = MID; ctx.strokeRect(g.x0 + 0.5, g.y0 + 0.5, pw, ph);
    ctx.fillStyle = DIM; ctx.textAlign = 'left'; ctx.fillText('NM', 6, g.y0 + 4);

    ctx.drawImage(bs.trail, 0, 0, bs.trail.width, bs.trail.height, 0, 0, w, h);

    if (list) {
      const sx = X(sweep), wedge = ctx.createLinearGradient(sx - 26 * Math.sign(sweep - prev || 1), 0, sx, 0);
      wedge.addColorStop(0, 'rgba(110,255,110,0)'); wedge.addColorStop(1, 'rgba(110,255,110,.16)');
      ctx.fillStyle = wedge; ctx.fillRect(Math.min(sx, sx - 26 * Math.sign(sweep - prev || 1)), g.y0, 26, ph);
      ctx.strokeStyle = 'rgba(160,255,160,.85)'; ctx.beginPath(); ctx.moveTo(sx, g.y0); ctx.lineTo(sx, g.y1); ctx.stroke();
      ctx.fillStyle = BRIGHT;
      ctx.beginPath(); ctx.moveTo(X(0), g.y1); ctx.lineTo(X(0) - 4, g.y1 + 6); ctx.lineTo(X(0) + 4, g.y1 + 6); ctx.fill();
    } else {
      ctx.fillStyle = MID; ctx.textAlign = 'center'; ctx.font = '12px Menlo, Consolas, monospace';
      ctx.fillText('SELECT AN AIRCRAFT', (g.x0 + g.x1) / 2, (g.y0 + g.y1) / 2);
    }

    const ex = w - 30, EY = e => g.y1 - (e + 60) / 120 * ph;
    ctx.strokeStyle = MID; ctx.strokeRect(ex + 0.5, g.y0 + 0.5, 12, ph);
    ctx.fillStyle = 'rgba(110,255,110,.35)';
    const top = EY(Math.min(60, R.elevDeg + R.beamDeg / 2)), bot = EY(Math.max(-60, R.elevDeg - R.beamDeg / 2));
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
    $('bs-info').textContent = list
      ? `ELEV ${signed(R.elevDeg)}° ±${R.beamDeg / 2}° · RNG ${R.rangeNm} NM · AZ ±${half}° · ${n} of ${list.filter(c => c.seen).length} in sector`
      : 'Select an aircraft to see its radar.';
    $('bs-elev-v').textContent = signed(R.elevDeg) + '°';
    bs.raf = requestAnimationFrame(frame);
  }

  function setElev(v) {
    R.elevDeg = clampElev(v);
    $('bs-elev').value = R.elevDeg;
  }

  const win = {
    init() {
      $('bs-close').onclick = () => this.close();
      $('bs-elev').oninput = e => setElev(+e.target.value);
      $('bs-level').onclick = () => setElev(0);
      $('bs-beam').onchange = e => { R.beamDeg = +e.target.value; };
      $('bs-labels').onchange = e => { R.tags = e.target.checked; };
      document.querySelectorAll('[data-bsrange]').forEach(b => {
        b.onclick = () => { R.rangeNm = +b.dataset.bsrange; this.sync(); if (DL.advWin) DL.advWin.refresh(); };
      });
      const cv = $('bs-canvas');
      cv.addEventListener('wheel', e => { e.preventDefault(); setElev(R.elevDeg + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 5 : 1)); }, { passive: false });
      let drag = null;
      cv.addEventListener('pointerdown', e => { drag = { y: e.clientY, e0: R.elevDeg }; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', e => { if (drag) setElev(drag.e0 - (e.clientY - drag.y) * 0.5); });
      for (const t of ['pointerup', 'pointercancel']) cv.addEventListener(t, () => { drag = null; });
      DL.ui.dragWindow($('bscope'), document.querySelector('#bscope .vw-h'));
      $('bs-beam').value = R.beamDeg;
      this.sync();
    },

    isOpen() { return $('bscope').classList.contains('open'); },

    sync() {
      document.querySelectorAll('[data-bsrange]').forEach(b => b.classList.toggle('on', +b.dataset.bsrange === R.rangeNm));
      $('bs-elev').value = R.elevDeg;
    },

    open() {
      if (!R.on) return;
      DL.ui.soloWindow('bscope');
      $('bscope').classList.add('open');
      bs.last = 0; bs.sweep = null; bs.t0 = 0;
      this.sync();
      DL.ui.layout();
      if (!bs.raf) bs.raf = requestAnimationFrame(frame);
      if (DL.advWin) DL.advWin.refresh();
    },

    close() {
      $('bscope').classList.remove('open');
      if (DL.advWin) DL.advWin.refresh();
    },

    contacts,

    toggle() { if (this.isOpen()) this.close(); else this.open(); },
  };
  DL.bscope = win;
})(window.DL);
