// Phaser scene: the instrument panel. Drawn at a fixed design size (3 x 3
// cells of 300 px: the six-pack over the nav indicator and its readout)
// inside one container that is scaled to fit the space the layout gives
// it. Static faces are drawn once; needles, cards and the attitude ball are
// redrawn every frame.
(function (FI) {
  'use strict';

  const D2R = FI.D2R, clamp = FI.clamp;
  const W = 900, H = 900, CELL = 300, R = 135;
  const MONO = 'Menlo, Consolas, monospace';
  const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const WHITE = 0xf2f5f8, FACE = 0x0b0f14, BEZEL = 0x242c36, RING = 0x3a4654;

  // polar helpers: angle in degrees clockwise from the top
  const px = (r, a) => r * Math.sin(a * D2R), py = (r, a) => -r * Math.cos(a * D2R);
  const rad = a => (a - 90) * D2R;      // canvas angle for arcs

  // A tapered needle from the hub toward `len` at angle `a`, with a short tail.
  function needle(g, a, len, w, color, tail) {
    const s = Math.sin(a * D2R), c = -Math.cos(a * D2R);
    const nx = -c, ny = s;   // perpendicular
    g.fillStyle(color, 1);
    g.fillPoints([
      { x: s * len, y: c * len },
      { x: nx * w / 2 - s * (tail || 0), y: ny * w / 2 - c * (tail || 0) },
      { x: -nx * w / 2 - s * (tail || 0), y: -ny * w / 2 - c * (tail || 0) },
    ], true);
  }
  function tick(g, a, r0, r1) { g.lineBetween(px(r0, a), py(r0, a), px(r1, a), py(r1, a)); }

  // The part of the circle of radius R on one side of the horizontal line y = yl.
  function segment(Rr, yl, above) {
    if (yl <= -Rr) return above ? null : 'full';
    if (yl >= Rr) return above ? 'full' : null;
    const xi = Math.sqrt(Rr * Rr - yl * yl), tr = Math.atan2(yl, xi), tl = Math.PI - tr;
    const pts = [], N = 40;
    const t0 = tr, t1 = above ? tl - 2 * Math.PI : tl;
    for (let i = 0; i <= N; i++) { const t = t0 + (t1 - t0) * i / N; pts.push({ x: Math.cos(t) * Rr, y: Math.sin(t) * Rr }); }
    return pts;
  }
  // Clip a horizontal line at y to the circle of radius Rr, between x0..x1.
  function clipH(Rr, y, x0, x1) {
    if (Math.abs(y) >= Rr) return null;
    const xi = Math.sqrt(Rr * Rr - y * y);
    const a = Math.max(x0, -xi), b = Math.min(x1, xi);
    return a < b ? [a, b] : null;
  }

  class PanelScene extends Phaser.Scene {
    constructor() { super('panel'); }

    create() {
      FI.panel = this;
      this.cam = this.cameras.main;
      this.root = this.add.container(0, 0);
      const bg = this.plate = this.add.graphics();
      this.root.add(bg);
      this.paintPlate();
      this.inst = {};
      this.buildASI(0, 0); this.buildAI(1, 0); this.buildALT(2, 0);
      this.buildTC(0, 1); this.buildHI(1, 1); this.buildVSI(2, 1);
      this.buildCDI(0, 2); this.buildADF(1, 2); this.buildReadout(2, 2);
      // the glass cockpit shares the design size and the layout; only one shows
      this.glass = FI.Glass(this);
      this.setMode(FI.panelMode);
      if (this.pending) this.layout(this.pending);
    }

    layout(L) {
      if (!this.cam) { this.pending = L; return; }
      this.cam.setViewport(L.x, L.y, L.w, L.h);
      const s = Math.min(L.w / W, L.h / H);
      for (const r of [this.root, this.glass.root]) r.setScale(s).setPosition((L.w - W * s) / 2, (L.h - H * s) / 2);
    }

    // 'analog' shows the six-pack, 'glass' the G1000-style display
    setMode(mode) {
      this.mode = mode === 'glass' ? 'glass' : 'analog';
      this.root.setVisible(this.mode === 'analog');
      this.glass.root.setVisible(this.mode === 'glass');
      this.paintPlate();
    }

    // The panel plate behind the gauges: dark, or light grey in light mode.
    // The gauges and the glass display keep their real colours.
    paintPlate() {
      const light = !!(window.facoTheme && facoTheme.isLight);
      this.lightPlate = light;
      this.cam.setBackgroundColor(this.mode === 'glass' ? (light ? '#c3cad2' : '#05070a') : (light ? '#c3cad2' : '#141a21'));
      this.plate.clear();
      this.plate.fillStyle(light ? 0xa9b2bc : 0x1a212a, 1);
      this.plate.fillRoundedRect(4, 4, W - 8, H - 8, 14);
      (this.plateLabels || []).forEach(t => t.setColor(light ? '#2c3540' : '#aeb9c4'));
    }

    // ---------- building blocks ----------
    cell(col, row) {
      const c = this.add.container(CELL / 2 + col * CELL, CELL / 2 + row * CELL);
      this.root.add(c);
      return c;
    }
    bezel(c, label) {
      const g = this.add.graphics();
      g.fillStyle(BEZEL, 1); g.fillCircle(0, 0, R + 12);
      g.lineStyle(2, RING, 1); g.strokeCircle(0, 0, R + 12);
      g.fillStyle(FACE, 1); g.fillCircle(0, 0, R);
      g.lineStyle(1.5, 0x1f2833, 1); g.strokeCircle(0, 0, R);
      // four screws
      g.fillStyle(0x4a5664, 1);
      for (const a of [45, 135, 225, 315]) g.fillCircle(px(R + 2, a) * 1.0, py(R + 2, a) * 1.0, 3.5);
      c.add(g);
      return g;
    }
    txt(c, str, x, y, size, color, font, ox, oy) {
      const t = this.add.text(x, y, str, { fontFamily: font || MONO, fontSize: `${size}px`, color: color || '#e6edf3', align: 'center' })
        .setOrigin(ox == null ? 0.5 : ox, oy == null ? 0.5 : oy);
      c.add(t);
      return t;
    }
    hub(c, r) { const g = this.add.graphics(); g.fillStyle(0x1b222b, 1); g.fillCircle(0, 0, r || 7); g.lineStyle(1, 0x5d6b78, 1); g.strokeCircle(0, 0, r || 7); c.add(g); }

    // ---------- airspeed ----------
    buildASI(col, row) {
      const c = this.cell(col, row); this.bezel(c);
      const A = FI.AC, ang = v => v * 1.7 - 170;
      const g = this.add.graphics();
      const arc = (v0, v1, r, w, color) => { g.lineStyle(w, color, 1); g.beginPath(); g.arc(0, 0, r, rad(ang(v0)), rad(ang(v1)), false); g.strokePath(); };
      arc(A.vS0, A.vFe, R - 24, 7, 0xe6edf3);        // white: flaps
      arc(A.vS1, A.vNo, R - 14, 9, 0x2fa84f);        // green: normal
      arc(A.vNo, A.vNe, R - 14, 9, 0xf2c94c);        // yellow: caution
      g.lineStyle(4, 0xe53935, 1); tick(g, ang(A.vNe), R - 22, R - 6);   // red line
      g.lineStyle(2, WHITE, 1);
      for (let v = 0; v <= 200; v += 10) tick(g, ang(v), R - (v % 20 ? 8 : 14), R - 2);
      c.add(g);
      for (let v = 0; v <= 200; v += 20) this.txt(c, String(v), px(R - 34, ang(v)), py(R - 34, ang(v)), 17);
      this.txt(c, 'AIRSPEED', 0, -48, 11, '#aeb9c4', SANS);
      this.txt(c, 'KNOTS', 0, 48, 11, '#aeb9c4', SANS);
      const n = this.add.graphics(); c.add(n); this.hub(c);
      this.inst.asi = { n, ang };
    }

    // ---------- attitude ----------
    buildAI(col, row) {
      const c = this.cell(col, row); this.bezel(c);
      const ball = this.add.container(0, 0); c.add(ball);
      const bg = this.add.graphics(); ball.add(bg);
      const labels = [];
      for (const p of [-20, -10, 10, 20]) {
        const l = this.txt(ball, String(Math.abs(p)), -40, 0, 13, '#ffffff'), r = this.txt(ball, String(Math.abs(p)), 40, 0, 13, '#ffffff');
        labels.push({ p, l, r });
      }
      // sky pointer rotates with the ball; the bank scale is fixed to the case
      const ptr = this.add.graphics(); ptr.fillStyle(WHITE, 1); ptr.fillPoints([{ x: 0, y: -R + 4 }, { x: -8, y: -R + 20 }, { x: 8, y: -R + 20 }], true); ball.add(ptr);
      const fixed = this.add.graphics();
      fixed.lineStyle(2.5, WHITE, 1);
      for (const a of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) tick(fixed, a, R - 2, R - (a % 30 === 0 || a === 0 ? 20 : 11));
      fixed.fillStyle(WHITE, 1); fixed.fillPoints([{ x: 0, y: -R + 2 }, { x: -7, y: -R - 10 }, { x: 7, y: -R - 10 }], true);
      // miniature airplane
      fixed.fillStyle(0xffb547, 1);
      fixed.fillRect(-70, -3, 44, 6); fixed.fillRect(26, -3, 44, 6);
      fixed.fillRect(-26, -3, 6, 10); fixed.fillRect(20, -3, 6, 10);
      fixed.fillCircle(0, 0, 4);
      c.add(fixed);
      this.inst.ai = { ball, bg, labels };
    }

    // ---------- altimeter ----------
    buildALT(col, row) {
      const c = this.cell(col, row); this.bezel(c);
      const g = this.add.graphics(); g.lineStyle(2, WHITE, 1);
      for (let i = 0; i < 50; i++) tick(g, i * 7.2, R - (i % 5 ? 8 : 16), R - 2);
      c.add(g);
      for (let i = 0; i < 10; i++) this.txt(c, String(i), px(R - 36, i * 36), py(R - 36, i * 36), 20);
      // Kollsman window
      const k = this.add.graphics(); k.fillStyle(0x161d26, 1); k.fillRect(56, -12, 52, 24); k.lineStyle(1, 0x5d6b78, 1); k.strokeRect(56, -12, 52, 24); c.add(k);
      this.txt(c, '29.92', 82, 0, 13, '#e6edf3');
      this.txt(c, 'ALT', 0, -54, 12, '#aeb9c4', SANS);
      this.txt(c, 'FEET', 0, 54, 11, '#aeb9c4', SANS);
      const n = this.add.graphics(); c.add(n); this.hub(c, 8);
      this.inst.alt = { n };
    }

    // ---------- turn coordinator ----------
    buildTC(col, row) {
      const c = this.cell(col, row); this.bezel(c);
      const g = this.add.graphics(); g.lineStyle(4, WHITE, 1);
      for (const side of [-1, 1]) {
        g.lineBetween(side * (R - 4), 0, side * (R - 26), 0);     // wings-level marks
        tick(g, side > 0 ? 110 : 250, R - 26, R - 4);              // standard-rate marks, 20° below level
      }
      c.add(g);
      this.txt(c, 'L', px(R - 40, 250 + 8), py(R - 40, 250 + 8), 15);
      this.txt(c, 'R', px(R - 40, 110 - 8), py(R - 40, 110 - 8), 15);
      this.txt(c, 'TURN COORDINATOR', 0, -62, 11, '#aeb9c4', SANS);
      this.txt(c, '2 MIN', 0, 60, 11, '#aeb9c4', SANS);
      this.txt(c, 'NO PITCH\nINFORMATION', 0, 102, 9, '#7d8a96', SANS);
      // inclinometer: a curved tube with the ball centered (the model flies coordinated)
      const tube = this.add.graphics();
      tube.lineStyle(16, 0x1a222c, 1); tube.beginPath(); tube.arc(0, -40, 122, rad(160), rad(200), false); tube.strokePath();
      tube.lineStyle(1.5, 0x5d6b78, 1); tube.beginPath(); tube.arc(0, -40, 122, rad(160), rad(200), false); tube.strokePath();
      tube.lineStyle(2, WHITE, 1); tube.lineBetween(-7, 68, -7, 96); tube.lineBetween(7, 68, 7, 96);
      tube.fillStyle(0x111111, 1); tube.fillCircle(0, 82, 6); tube.lineStyle(1, 0x888888, 1); tube.strokeCircle(0, 82, 6);
      c.add(tube);
      // the miniature airplane banks to show the rate of turn
      const plane = this.add.container(0, 0); c.add(plane);
      const ac = this.add.graphics();
      ac.lineStyle(7, WHITE, 1); ac.lineBetween(-84, 0, 84, 0);                 // wings
      ac.lineStyle(5, WHITE, 1); ac.lineBetween(0, -22, 0, 10);                 // fin
      ac.lineBetween(-20, 10, 20, 10);                                          // tail
      ac.fillStyle(WHITE, 1); ac.fillCircle(0, 0, 9);
      plane.add(ac);
      this.inst.tc = { plane };
    }

    // ---------- heading indicator ----------
    buildHI(col, row) {
      const c = this.cell(col, row); this.bezel(c);
      const card = this.add.container(0, 0); c.add(card);
      const g = this.add.graphics(); g.lineStyle(2, WHITE, 1);
      for (let a = 0; a < 360; a += 5) tick(g, a, R - (a % 10 ? 8 : 16), R - 2);
      card.add(g);
      const names = ['N', '3', '6', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33'];
      names.forEach((s, i) => this.txt(card, s, px(R - 34, i * 30), py(R - 34, i * 30), 'NESW'.includes(s) ? 22 : 17, 'NESW'.includes(s) ? '#ffffff' : '#e6edf3').setRotation(i * 30 * D2R));
      const bug = this.add.graphics(); card.add(bug);
      const fixed = this.add.graphics();
      fixed.fillStyle(WHITE, 1); fixed.fillPoints([{ x: 0, y: -R - 8 }, { x: -7, y: -R - 20 }, { x: 7, y: -R - 20 }], true);
      fixed.lineStyle(2, WHITE, 1); fixed.lineBetween(0, -R - 8, 0, -R + 22);
      for (const a of [45, 90, 135, 180, 225, 270, 315]) tick(fixed, a, R + 3, R + 11);
      // miniature airplane
      fixed.lineStyle(4, 0xffb547, 1);
      fixed.lineBetween(0, -40, 0, 30); fixed.lineBetween(-44, 4, 44, 4); fixed.lineBetween(-14, 26, 14, 26);
      c.add(fixed);
      this.inst.hi = { card, bug };
    }

    // ---------- vertical speed ----------
    buildVSI(col, row) {
      const c = this.cell(col, row); this.bezel(c);
      const ang = vs => -90 + vs / 2000 * 170;
      const g = this.add.graphics(); g.lineStyle(2, WHITE, 1);
      for (let v = -2000; v <= 2000; v += 100) tick(g, ang(v), R - (v % 500 ? 8 : 16), R - 2);
      c.add(g);
      for (const v of [0, 500, 1000, 1500, 2000]) {
        this.txt(c, String(v / 100), px(R - 36, ang(v)), py(R - 36, ang(v)), 18);
        if (v) this.txt(c, String(v / 100), px(R - 36, ang(-v)), py(R - 36, ang(-v)), 18);
      }
      this.txt(c, 'UP', -58, -34, 12, '#aeb9c4', SANS);
      this.txt(c, 'DOWN', -58, 34, 12, '#aeb9c4', SANS);
      this.txt(c, 'VERTICAL SPEED', 36, -40, 11, '#aeb9c4', SANS);
      this.txt(c, '100 FEET PER MINUTE', 36, 40, 10, '#aeb9c4', SANS);
      const n = this.add.graphics(); c.add(n); this.hub(c);
      this.inst.vsi = { n, ang };
    }

    // ---------- VOR / ILS indicator ----------
    buildCDI(col, row) {
      const c = this.cell(col, row); this.bezel(c);
      const card = this.add.container(0, 0); c.add(card);
      const g = this.add.graphics(); g.lineStyle(2, WHITE, 1);
      for (let a = 0; a < 360; a += 5) tick(g, a, R - (a % 10 ? 7 : 14), R - 2);
      card.add(g);
      const names = ['N', '3', '6', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33'];
      names.forEach((s, i) => this.txt(card, s, px(R - 30, i * 30), py(R - 30, i * 30), 'NESW'.includes(s) ? 18 : 14).setRotation(i * 30 * D2R));
      // fixed: course index, reciprocal, dots
      const f = this.add.graphics();
      f.fillStyle(WHITE, 1);
      f.fillPoints([{ x: 0, y: -R + 2 }, { x: -8, y: -R - 10 }, { x: 8, y: -R - 10 }], true);
      f.fillPoints([{ x: 0, y: R - 2 }, { x: -6, y: R + 10 }, { x: 6, y: R + 10 }], true);
      f.lineStyle(1.5, WHITE, 1); f.strokeCircle(0, 0, 5);
      for (let i = 1; i <= 5; i++) { f.fillCircle(i * 14, 0, 3); f.fillCircle(-i * 14, 0, 3); }
      c.add(f);
      const gsDots = this.add.graphics(); gsDots.fillStyle(WHITE, 1);
      for (let i = 1; i <= 5; i++) for (const x of [-84, 84]) { gsDots.fillCircle(x, i * 14, 3); gsDots.fillCircle(x, -i * 14, 3); }
      c.add(gsDots);
      // flags
      const flags = this.add.container(0, 0); c.add(flags);
      const toFrom = this.add.graphics(); flags.add(toFrom);
      const navFlag = this.flag(flags, -42, 44, 'NAV');
      const gsFlag = this.flag(flags, -42, -44, 'GS');
      const toTxt = this.txt(flags, 'TO', 42, 60, 10, '#aeb9c4', SANS);
      const n = this.add.graphics(); c.add(n);
      (this.plateLabels = this.plateLabels || []).push(this.txt(c, 'OBS', -R + 22, R - 18, 10, '#aeb9c4', SANS));
      this.inst.cdi = { card, n, toFrom, navFlag, gsFlag, gsDots, toTxt };
    }
    flag(c, x, y, label) {
      const k = this.add.container(x, y);
      const g = this.add.graphics(); g.fillStyle(0xc62828, 1); g.fillRect(-20, -10, 40, 20); k.add(g);
      this.txt(k, label, 0, 0, 11, '#ffffff', SANS);
      c.add(k);
      return k;
    }

    // ---------- ADF (fixed card) ----------
    // The card is fixed with 0 at the nose; the needle points at the NDB, so
    // it reads relative bearing. Magnetic bearing to the station is heading
    // plus relative bearing.
    buildADF(col, row) {
      const c = this.cell(col, row); this.bezel(c);
      const g = this.add.graphics(); g.lineStyle(2, WHITE, 1);
      for (let a = 0; a < 360; a += 5) tick(g, a, R - (a % 10 ? 7 : 14), R - 2);
      c.add(g);
      for (let i = 0; i < 12; i++) this.txt(c, String(i * 3), px(R - 30, i * 30), py(R - 30, i * 30), i % 3 ? 14 : 18).setRotation(i * 30 * D2R);
      const f = this.add.graphics(); f.lineStyle(3, 0xffb547, 1);
      f.lineBetween(0, -40, 0, 26); f.lineBetween(-30, -6, 30, -6); f.lineBetween(-12, 22, 12, 22);     // little airplane
      c.add(f);
      (this.plateLabels = this.plateLabels || []).push(this.txt(c, 'ADF', -R + 26, R - 18, 10, '#aeb9c4', SANS));
      const id = this.txt(c, '', 0, 52, 12, '#e6edf3', MONO);
      const n = this.add.graphics(); c.add(n); this.hub(c);
      this.inst.adf = { n, id };
    }

    // ---------- nav readout ----------
    buildReadout(col, row) {
      const c = this.cell(col, row), w = 272, h = 272;
      const g = this.add.graphics();
      g.fillStyle(0x0b0f14, 1); g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      g.lineStyle(2, RING, 1); g.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
      c.add(g);
      const keys = ['nav', 'tcn', 'crs', 'rad', 'dme', 'flag', 'adf', 'hdg', 'trk', 'wind'];
      const labels = { nav: 'NAV1', tcn: 'TACAN', crs: 'COURSE', rad: 'RADIAL', dme: 'DME', flag: 'FLAGS', adf: 'ADF', hdg: 'HDG/BUG', trk: 'TRK/GS', wind: 'WIND' };
      const t = {};
      keys.forEach((k, i) => {
        const y = -h / 2 + 22 + i * 25.5;
        this.txt(c, labels[k], -w / 2 + 12, y, 10, '#7d8a96', SANS, 0, 0.5);
        t[k] = this.txt(c, '', w / 2 - 12, y, 13, '#e6edf3', MONO, 1, 0.5);
      });
      this.inst.ro = t;
    }

    // ---------- per frame ----------
    update() {
      if (!!(window.facoTheme && facoTheme.isLight) !== this.lightPlate) this.paintPlate();
      const s = FI.state, n = FI.navOut, nv = FI.nav, I = this.inst;
      if (!n || !I.asi) return;
      if (this.mode === 'glass') { this.glass.update(); return; }
      // ASI
      I.asi.n.clear(); needle(I.asi.n, I.asi.ang(clamp(s.ias, 0, 200)), R - 22, 9, WHITE, 18);
      // AI
      const ai = I.ai, ppd = R / 30, off = clamp(s.pitch, -25, 25) * ppd;
      ai.ball.setRotation(-s.bank * D2R);
      const g = ai.bg; g.clear();
      const Rr = R - 1;
      const sky = segment(Rr, off, true), gnd = segment(Rr, off, false);
      g.fillStyle(0x2d7fd1, 1); if (sky === 'full') g.fillCircle(0, 0, Rr); else if (sky) g.fillPoints(sky, true);
      g.fillStyle(0x8a5a2b, 1); if (gnd === 'full') g.fillCircle(0, 0, Rr); else if (gnd) g.fillPoints(gnd, true);
      g.lineStyle(2.5, WHITE, 1);
      let hz = clipH(Rr, off, -Rr, Rr); if (hz) g.lineBetween(hz[0], off, hz[1], off);
      for (const p of [-20, -15, -10, -5, 5, 10, 15, 20]) {
        const y = off - p * ppd, half = p % 10 ? 14 : 28;
        const seg = clipH(Rr - 24, y, -half, half);
        if (seg) { g.lineStyle(2, WHITE, 1); g.lineBetween(seg[0], y, seg[1], y); }
      }
      for (const l of ai.labels) { const y = off - l.p * ppd, vis = Math.abs(y) < Rr - 30; l.l.setY(y).setVisible(vis); l.r.setY(y).setVisible(vis); }
      // ALT
      const a = Math.max(0, s.alt); I.alt.n.clear();
      const a10k = (a % 100000) / 100000 * 360;
      I.alt.n.lineStyle(2.5, WHITE, 1); tick(I.alt.n, a10k, 0, R - 20);
      I.alt.n.fillStyle(WHITE, 1); I.alt.n.fillPoints([{ x: px(R - 4, a10k), y: py(R - 4, a10k) }, { x: px(R - 18, a10k - 4), y: py(R - 18, a10k - 4) }, { x: px(R - 18, a10k + 4), y: py(R - 18, a10k + 4) }], true);
      needle(I.alt.n, (a % 10000) / 10000 * 360, R - 60, 16, WHITE, 10);
      needle(I.alt.n, (a % 1000) / 1000 * 360, R - 20, 8, WHITE, 18);
      // TC
      I.tc.plane.setRotation(clamp(s.turnRate / 3, -1.6, 1.6) * 20 * D2R);
      // HI
      const hdgM = FI.toMag(s.hdg);
      I.hi.card.setRotation(-hdgM * D2R);
      const bg2 = I.hi.bug; bg2.clear(); bg2.fillStyle(0xff8c1a, 1);
      const b = nv.bug;
      bg2.fillPoints([{ x: px(R - 2, b - 5), y: py(R - 2, b - 5) }, { x: px(R - 2, b + 5), y: py(R - 2, b + 5) }, { x: px(R - 14, b + 5), y: py(R - 14, b + 5) },
        { x: px(R - 10, b + 1.5), y: py(R - 10, b + 1.5) }, { x: px(R - 10, b - 1.5), y: py(R - 10, b - 1.5) }, { x: px(R - 14, b - 5), y: py(R - 14, b - 5) }], true);
      // VSI
      I.vsi.n.clear(); needle(I.vsi.n, I.vsi.ang(clamp(s.vs, -2000, 2000)), R - 22, 9, WHITE, 18);
      // CDI
      const cd = I.cdi;
      const az = n.kind === 'VOR' || n.kind === 'TACAN';
      cd.card.setRotation(-nv.obs * D2R);
      cd.navFlag.setVisible(n.flag);
      cd.gsFlag.setVisible(n.gsShow && n.gsFlag);
      cd.gsDots.setVisible(n.gsShow);
      cd.toTxt.setVisible(n.kind !== 'LOC');
      cd.toFrom.clear();
      if (n.toFrom) {
        cd.toFrom.fillStyle(WHITE, 1);
        const up = n.toFrom === 'TO';
        cd.toFrom.fillPoints(up ? [{ x: 42, y: 34 }, { x: 32, y: 50 }, { x: 52, y: 50 }] : [{ x: 42, y: 50 }, { x: 32, y: 34 }, { x: 52, y: 34 }], true);
        cd.toTxt.setText(n.toFrom);
      } else cd.toTxt.setText(n.kind !== 'LOC' ? 'OFF' : '');
      const nd = cd.n; nd.clear();
      if (n.gsShow && !n.gsFlag) { const y = n.gsDots * 14; nd.fillStyle(WHITE, 1); nd.fillRect(-92, y - 2, 184, 4); }
      const x = n.dots * 14; nd.fillStyle(WHITE, 1); nd.fillRect(x - 2, -78, 4, 156);
      // ADF needle: relative bearing, parked at 90° with no signal
      const ad = I.adf, A = n.adf;
      ad.n.clear(); needle(ad.n, A.valid ? A.rel : 90, R - 24, 9, A.valid ? 0xffd166 : 0x6a7684, 40);
      ad.id.setText(nv.khz ? `${nv.khz} kHz\n${A.valid ? A.id : 'NO SIG'}` : 'OFF');
      // readout
      const ro = I.ro, nm = v => v == null ? '---' : `${v.toFixed(1)} nm`;
      const tcnSt = n.src === 'TCN' ? n.ident : null;
      ro.nav.setText(`${FI.fmtMhz(nv.mhz)} ${n.src === 'NAV' ? (n.ident || '---') : ''}`).setColor(n.src === 'NAV' ? '#26e05a' : '#e6edf3');
      ro.tcn.setText(`${nv.chan || '---'} ${tcnSt || ''}`).setColor(n.src === 'TCN' ? '#26e05a' : '#e6edf3');
      ro.crs.setText(n.kind === 'LOC' ? `LOC ${FI.pad3(n.course)}°` : `OBS ${FI.pad3(nv.obs)}°`);
      ro.rad.setText(n.radial != null && az ? `${FI.pad3(n.radial)}° FR ${n.ident}` : '---');
      ro.dme.setText(n.dmeValid ? `${nm(n.dme)} ${n.dmeId}` : 'no DME');
      let fl;
      if (!n.station) fl = 'no station';
      else if (az) fl = n.flag ? (n.cone ? 'OFF, over stn' : 'OFF, no signal') : n.toFrom;
      else if (n.kind === 'LOC') fl = n.flag ? 'NAV OFF' : (n.front ? 'LOC' : 'BACK CRS') + (n.loc.hasGs ? (n.gsFlag ? ', GS OFF' : ', GS') : ', no GS');
      else fl = 'DME only';
      ro.flag.setText(fl);
      ro.flag.setColor(n.flag || (n.kind === 'LOC' && n.gsFlag) ? '#ffb547' : '#e6edf3');
      ro.adf.setText(A.valid ? `${A.id} ${FI.pad3(A.brgM)}° TO` : nv.khz ? `${nv.khz} no sig` : 'off');
      ro.hdg.setText(`${FI.pad3(hdgM)}° / ${FI.pad3(nv.bug)}°`);
      ro.trk.setText(`${FI.pad3(FI.toMag(s.trk))}° ${Math.round(s.gs)} kt`);
      ro.wind.setText(FI.wind.kt > 0 ? `${FI.pad3(FI.wind.dir)}°T ${Math.round(FI.wind.kt)} kt` : 'calm');
    }
  }

  FI.PanelScene = PanelScene;
})(window.FI);
