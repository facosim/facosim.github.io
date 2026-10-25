// Small 3D view of the selected aircraft: a low-poly model drawn with the
// 2D canvas, rolled and pitched to the attitude the flight model flies.
// A scrubber plays through the upcoming frame. No WebGL or libraries.
(function (DL) {
  'use strict';

  const $ = id => document.getElementById(id);
  const D2R = Math.PI / 180;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  // ---------- models (body axes: x = right wing, y = canopy up, z = nose) ----------
  // A fuselage is a list of diamond cross-sections [z, halfWidth, halfHeight].
  // Flat parts are polygons; 'mirror' copies them to the left side.
  const MODELS = {
    fighter: {
      body: [[7, 0, 0], [4.5, 0.5, 0.45], [1, 0.75, 0.6], [-4, 0.65, 0.5], [-5.5, 0.45, 0.35]],
      canopy: [3.6, 0.5],        // z where the canopy starts, length forward
      wing: [[0.6, 0, 1.6], [5.2, 0, -2.4], [5.2, 0, -3.1], [0.6, 0, -3.2]],
      htail: [[0.5, 0, -4.0], [2.6, 0, -5.4], [2.6, 0, -5.8], [0.5, 0, -5.5]],
      vtail: [[0, 0.5, -3.2], [0, 3.0, -5.2], [0, 3.0, -5.8], [0, 0.4, -5.5]],
    },
    cargo: {
      body: [[7, 0, 0], [6, 0.8, 0.8], [3, 1.1, 1.1], [-3, 1.1, 1.1], [-6.5, 0.4, 0.7]],
      canopy: [5.2, 0.9],
      wing: [[0.8, 1.0, 1.4], [8.5, 1.0, 0.8], [8.5, 1.0, -0.4], [0.8, 1.0, -0.8]],
      htail: [[0.3, 3.0, -5.4], [3.2, 3.0, -6.0], [3.2, 3.0, -6.8], [0.3, 3.0, -6.8]],
      vtail: [[0, 0.8, -3.8], [0, 3.0, -5.4], [0, 3.0, -6.8], [0, 0.7, -6.5]],
    },
    airliner: {
      body: [[7.5, 0, 0], [6.3, 0.8, 0.8], [4, 0.95, 0.95], [-4, 0.95, 0.95], [-7.5, 0.3, 0.6]],
      canopy: [5.8, 0.7],
      wing: [[0.8, -0.4, 1.8], [8.5, 0.2, -2.6], [8.5, 0.2, -3.4], [0.8, -0.4, -1.4]],
      htail: [[0.4, 0.3, -5.8], [3.4, 0.4, -7.2], [3.4, 0.4, -7.8], [0.4, 0.3, -7.4]],
      vtail: [[0, 0.8, -4.6], [0, 3.6, -7.0], [0, 3.6, -7.8], [0, 0.6, -7.5]],
    },
    attack: {   // straight wing, A-10 / Su-25
      body: [[6, 0, 0], [4.5, 0.6, 0.6], [1, 0.8, 0.7], [-3.5, 0.7, 0.6], [-5.5, 0.4, 0.4]],
      canopy: [4.2, 1.2],
      wing: [[0.7, -0.1, 1.2], [7.5, -0.1, 0.6], [7.5, -0.1, -1.0], [0.7, -0.1, -1.6]],
      htail: [[0.4, 0.2, -4.2], [3.4, 0.2, -4.8], [3.4, 0.2, -5.6], [0.4, 0.2, -5.4]],
      vtail: [[0, 0.4, -3.6], [0, 2.6, -5.0], [0, 2.6, -5.6], [0, 0.3, -5.5]],
    },
    delta: {    // canard delta, J-10 / J-20 (the 'htail' slot holds the canards)
      body: [[7.5, 0, 0], [5, 0.55, 0.5], [1, 0.8, 0.65], [-4, 0.7, 0.5], [-5.5, 0.45, 0.35]],
      canopy: [3.8, 1.3],
      wing: [[0.7, 0, 0.4], [6.5, 0, -4.2], [6.5, 0, -4.8], [0.7, 0, -5.0]],
      htail: [[0.6, 0.1, 3.8], [3.0, 0.1, 2.6], [3.0, 0.1, 2.2], [0.6, 0.1, 2.8]],
      vtail: [[0, 0.5, -3.2], [0, 2.8, -5.0], [0, 2.8, -5.6], [0, 0.4, -5.4]],
    },
    prop: {     // low-wing turboprop trainer, T-6
      body: [[5.2, 0, 0], [4.6, 0.45, 0.5], [2, 0.62, 0.72], [-2, 0.45, 0.55], [-5, 0.15, 0.3]],
      canopy: [3.0, 3.0],
      wing: [[0.55, -0.45, 1.5], [5.6, -0.05, 1.0], [5.6, -0.05, -0.1], [0.55, -0.45, -0.9]],
      htail: [[0.2, 0.05, -3.9], [2.4, 0.05, -4.3], [2.4, 0.05, -4.9], [0.2, 0.05, -5.0]],
      vtail: [[0, 0.3, -3.2], [0, 2.1, -4.4], [0, 2.1, -5.0], [0, 0.3, -5.0]],
    },
    ga: {
      body: [[5, 0, 0], [4.4, 0.6, 0.6], [2, 0.75, 0.85], [-2, 0.5, 0.6], [-5, 0.2, 0.35]],
      canopy: [2.4, 1.6],
      wing: [[0.6, 0.85, 1.8], [6.5, 0.85, 1.6], [6.5, 0.85, 0.2], [0.6, 0.85, 0.2]],
      htail: [[0.2, 0.1, -4.2], [2.4, 0.1, -4.3], [2.4, 0.1, -5.1], [0.2, 0.1, -5.1]],
      vtail: [[0, 0.3, -3.4], [0, 2.2, -4.6], [0, 2.2, -5.2], [0, 0.3, -5.1]],
    },
  };

  // Build a list of faces: { pts:[[x,y,z]...], kind, n } in body axes.
  function buildModel(m) {
    const faces = [];
    const ring = ([z, w, h]) => [[w, 0, z], [0, h, z], [-w, 0, z], [0, -h, z]];
    const rings = m.body.map(ring);
    for (let i = 0; i < rings.length - 1; i++) {
      const a = rings[i], b = rings[i + 1];
      for (let j = 0; j < 4; j++) {
        const k = (j + 1) % 4;
        faces.push({ pts: [a[j], b[j], b[k], a[k]], kind: j < 2 ? 'top' : 'body' });
      }
    }
    const last = rings[rings.length - 1];
    faces.push({ pts: last.slice().reverse(), kind: 'body' });
    // canopy: a dark raised diamond on top so "up" is easy to read
    const [cz, cl] = m.canopy;
    const sec = m.body.find(s => s[0] <= cz) || m.body[1];
    const ch = sec[2], cw = sec[1] * 0.55;
    faces.push({ pts: [[0, ch * 1.45, cz - cl * 0.2], [cw, ch * 1.02, cz - cl * 0.5], [0, ch * 1.02, cz + cl * 0.5], [-cw, ch * 1.02, cz - cl * 0.5]], kind: 'canopy' });
    faces.push({ pts: [[0, ch * 1.45, cz - cl * 0.2], [cw, ch * 1.02, cz - cl * 0.5], [0, ch * 1.02, cz - cl * 1.6], [-cw, ch * 1.02, cz - cl * 0.5]], kind: 'canopy' });
    const mirror = poly => poly.map(([x, y, z]) => [-x, y, z]).reverse();
    for (const part of ['wing', 'htail']) {
      faces.push({ pts: m[part], kind: 'flat' });
      faces.push({ pts: mirror(m[part]), kind: 'flat' });
    }
    faces.push({ pts: m.vtail, kind: 'fin' });
    return faces;
  }
  const BUILT = {};
  for (const k in MODELS) BUILT[k] = buildModel(MODELS[k]);

  function shade(hexColor, k) {
    const r = (hexColor >> 16) & 255, g = (hexColor >> 8) & 255, b = hexColor & 255;
    const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }

  const view = {
    t: 0,              // seconds into the upcoming frame
    playing: false,
    orbitYaw: 30,      // degrees around the aircraft, 0 = straight behind
    orbitEl: 10,       // degrees above
    visible: true,

    init() {
      this.canvas = $('v3d-canvas');
      this.ctx = this.canvas.getContext('2d');
      $('v3d-close').onclick = () => this.setVisible(false);
      $('btn-3d').onclick = () => this.setVisible(!this.visible);
      $('v3d-play').onclick = () => DL.ui.togglePlay();
      $('v3d-scrub').oninput = e => { this.t = +e.target.value; this.playing = false; };
      $('v3d-reset').onclick = () => { this.orbitYaw = 30; this.orbitEl = 10; };
      let drag = null;
      this.canvas.addEventListener('pointerdown', e => {
        drag = { x: e.clientX, y: e.clientY, yaw: this.orbitYaw, el: this.orbitEl };
        this.canvas.setPointerCapture(e.pointerId);
      });
      this.canvas.addEventListener('pointermove', e => {
        if (!drag) return;
        this.orbitYaw = drag.yaw - (e.clientX - drag.x) * 0.6;
        this.orbitEl = DL.clamp(drag.el + (e.clientY - drag.y) * 0.4, -80, 80);
      });
      this.canvas.addEventListener('pointerup', () => { drag = null; });
      DL.ui.dragWindow($('v3d'), document.querySelector('#v3d .vw-h'));
      this.setVisible(!DL.ui.small());   // phones start with the 3D view closed
      const loop = ts => { this.frame(ts); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    },

    setVisible(on) {
      if (on && !this.visible) DL.ui.soloWindow('v3d');
      this.visible = on;
      $('btn-3d').classList.toggle('on', on);
      if (!on) { $('v3d').classList.remove('open'); this.playing = false; }
    },

    // Attitude sample at time t of the selected aircraft's upcoming frame.
    sample() {
      const id = DL.ui.selected;
      const s = id && DL.cur()[id];
      if (!s) return null;
      const a = DL.tl.aircraft[id];
      const r = DL.step(a.type, s, DL.frameDur(DL.tl.current));
      const dt = DL.settings.stepSec;
      const i = DL.clamp(Math.round(this.t / dt), 0, r.samples.length - 1);
      return { a, s, r, smp: r.samples[i], i };
    },

    frame(ts) {
      // play time runs whether or not the 3D card is showing; the timeline's
      // Play button uses it too
      const fs = DL.frameDur(DL.tl.current);
      if (this.playing && Object.keys(DL.cur()).length) {
        if (this.lastTs != null) this.t += (ts - this.lastTs) / 1000;
        this.lastTs = ts;
        if (this.t >= fs) { this.t = fs; this.playing = false; }
      } else { this.playing = false; this.lastTs = null; }
      const el = $('v3d');
      const data = this.visible ? this.sample() : null;
      const was = el.classList.contains('open');
      el.classList.toggle('open', !!data);
      if (was !== !!data && DL.ui.layout) DL.ui.layout();
      if (!data) return;
      const sc = $('v3d-scrub');
      sc.max = fs;
      if (document.activeElement !== sc) sc.value = this.t;
      $('v3d-play').textContent = this.playing ? '❚❚' : '▶';
      $('v3d-time').textContent = 'T+' + (DL.timeAt(DL.tl.current) + this.t).toFixed(1) + 's';
      $('v3d-title').textContent = data.a.callsign + ' · 3D';
      this.draw(data);
    },

    draw({ a, s, smp }) {
      const cv = this.canvas, ctx = this.ctx;
      const dpr = window.devicePixelRatio || 1;
      const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // camera: behind the aircraft's frame-start heading, orbit adjustable
      const yaw = (s.hdg + this.orbitYaw) * D2R, elv = this.orbitEl * D2R;
      const f = [Math.sin(yaw) * Math.cos(elv), Math.cos(yaw) * Math.cos(elv), -Math.sin(elv)];
      const right = norm(DL.cross(f, [0, 0, 1]));
      const up = DL.cross(right, f);
      const dist = 21, focal = H * 1.1;
      const cam = [-f[0] * dist, -f[1] * dist, -f[2] * dist];
      const cx = W / 2, cy = H / 2 + 14;
      const project = p => {
        const d = sub(p, cam);
        const z = dot(d, f);
        return { x: cx + focal * dot(d, right) / z, y: cy - focal * dot(d, up) / z, z };
      };

      // sky and ground split at the horizon
      const hy = cy - focal * Math.tan(elv);
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#16324d'); sky.addColorStop(1, '#2a5578');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#2b2419';
      ctx.fillRect(0, DL.clamp(hy, -1, H + 1), W, H);
      ctx.strokeStyle = 'rgba(230,240,255,.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy); ctx.stroke();
      // ground lines for depth, running along the camera heading
      ctx.strokeStyle = 'rgba(255,220,170,.06)';
      for (let k = -6; k <= 6; k++) {
        const g0 = project([right[0] * k * 8 + f[0] * 4, right[1] * k * 8 + f[1] * 4, -14]);
        const g1 = project([right[0] * k * 8 + f[0] * 400, right[1] * k * 8 + f[1] * 400, -14]);
        if (g0.z > 1 && g1.z > 1) { ctx.beginPath(); ctx.moveTo(g0.x, g0.y); ctx.lineTo(g1.x, g1.y); ctx.stroke(); }
      }

      // body axes in world (east, north, up)
      const v = smp.v, u = smp.u, r = DL.cross(v, u);
      const toWorld = ([x, y, z]) => [x * r[0] + y * u[0] + z * v[0], x * r[1] + y * u[1] + z * v[1], x * r[2] + y * u[2] + z * v[2]];
      const light = norm([0.3, -0.4, 1]);
      const polys = [];
      const shape = BUILT[(DL.TYPES[a.type] && DL.TYPES[a.type].shape) || a.type] || BUILT.fighter;
      for (const fc of shape) {
        const wp = fc.pts.map(toWorld);
        const n = norm(DL.cross(sub(wp[1], wp[0]), sub(wp[2], wp[0])));
        const pp = wp.map(project);
        const depth = pp.reduce((m, p) => m + p.z, 0) / pp.length;
        const toCam = norm(sub(cam, wp[0]));
        const facing = dot(n, toCam);
        if ((fc.kind === 'body' || fc.kind === 'top') && facing <= 0) continue;
        // flat parts are two-sided: the upper surface takes the aircraft's
        // color and the underside is grey, so inverted flight is obvious
        let base = (s.color || a.color);
        if (fc.kind === 'flat') {
          const bodyUp = dot(n, u) >= 0;
          const seenTop = (facing >= 0) === bodyUp;
          base = seenTop ? (s.color || a.color) : 0x8a96a3;
        } else if (fc.kind === 'canopy') base = 0x10202e;
        else if (fc.kind === 'fin') base = (s.color || a.color);
        else if (fc.kind === 'body') base = 0x8a96a3;
        const lit = 0.55 + 0.45 * Math.abs(dot(n, light));
        polys.push({ pp, depth, fill: shade(base, lit) });
      }
      polys.sort((p, q) => q.depth - p.depth);
      ctx.lineJoin = 'round';
      for (const p of polys) {
        ctx.beginPath();
        p.pp.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.closePath();
        ctx.fillStyle = p.fill; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.5; ctx.stroke();
      }

      // lift vector: points out of the canopy, length grows with g
      const o = project([0, 0, 0]);
      const tip = project(toWorld([0, 3 + smp.n * 1.1, 0]));
      ctx.strokeStyle = '#ffd166'; ctx.fillStyle = '#ffd166'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
      const ang = Math.atan2(tip.y - o.y, tip.x - o.x);
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(tip.x - 7 * Math.cos(ang - 0.4), tip.y - 7 * Math.sin(ang - 0.4));
      ctx.lineTo(tip.x - 7 * Math.cos(ang + 0.4), tip.y - 7 * Math.sin(ang + 0.4));
      ctx.fill();
      ctx.font = '11px Menlo, Consolas, monospace';
      ctx.fillText(smp.n.toFixed(1) + ' g', tip.x + 6, tip.y - 4);

      // readouts
      const att = DL.attitude(v, u, s.hdg);
      const bank = Math.round(att.bank), pitch = Math.round(att.gam);
      const lines = [
        'Bank  ' + (bank === 0 ? 'level' : Math.abs(bank) + '° ' + (bank < 0 ? 'L' : 'R')),
        'Climb ' + (pitch > 0 ? '+' : '') + pitch + '°',
        'Hdg   ' + String(Math.round(att.hdg)).padStart(3, '0') + '°',
      ];
      const lines2 = [
        Math.round(smp.spd) + ' kt',
        Math.round(smp.alt).toLocaleString('en-US') + ' ft',
        Math.abs(bank) > 90 ? 'INVERTED' : '',
      ];
      ctx.fillStyle = 'rgba(8,12,18,.55)';
      ctx.fillRect(6, 6, 118, 46); ctx.fillRect(W - 100, 6, 94, 46);
      ctx.fillStyle = '#e6edf3';
      lines.forEach((l, i) => ctx.fillText(l, 12, 20 + i * 14));
      ctx.textAlign = 'right';
      lines2.forEach((l, i) => { ctx.fillStyle = l === 'INVERTED' ? '#ffb547' : '#e6edf3'; ctx.fillText(l, W - 12, 20 + i * 14); });
      ctx.textAlign = 'left';
    },
  };

  DL.view3d = view;
  // the scrub time shared with the map's title-bar slider
  DL.scrubT = () => view.t;
})(window.DL);
