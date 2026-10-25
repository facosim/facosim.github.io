// Phaser scene: grid, aircraft, trails, predicted turn, and mouse input.
// World units are feet. Symbols and labels are drawn at a fixed screen size
// by dividing by the camera zoom.
(function (DL) {
  'use strict';

  const ICONS = {
    fighter:  [[0,-15],[2.5,-8],[3,-2],[13,7],[13,9.5],[3,6],[2.5,10],[6,14],[6,15.5],[-6,15.5],[-6,14],[-2.5,10],[-3,6],[-13,9.5],[-13,7],[-3,-2],[-2.5,-8]],
    cargo:    [[0,-16],[3,-13],[3,-5],[17,-4],[17,0],[3,0],[3,10],[8,13],[8,15],[-8,15],[-8,13],[-3,10],[-3,0],[-17,0],[-17,-4],[-3,-5],[-3,-13]],
    airliner: [[0,-17],[2.5,-13],[2.5,-4],[16,5],[16,7.5],[2.5,2],[2.5,10],[7,14],[7,16],[-7,16],[-7,14],[-2.5,10],[-2.5,2],[-16,7.5],[-16,5],[-2.5,-4],[-2.5,-13]],
    ga:       [[0,-11],[2,-9],[2,-5],[13,-5],[13,-2],[2,-2],[1.5,7],[5,8],[5,10],[-5,10],[-5,8],[-1.5,7],[-2,-2],[-13,-2],[-13,-5],[-2,-5],[-2,-9]],
  };

  // Top-down outlines of the named aircraft, after public three-view drawings.
  // Meters: the right half only, from the nose tip (0, 0) round the right
  // wing and tail back to the centerline; x out along the right wing, y aft.
  // Below they are mirrored, centered and scaled to screen pixels.
  const FLANKER = [   // Su-27; the J-11 and J-16 are the same airframe
    [0, 0], [0.3, 0.8], [0.55, 2.0], [0.68, 3.3], [0.74, 4.6],               // nose, cockpit
    [0.8, 5.4], [1.05, 6.6], [1.45, 7.8], [1.95, 8.9], [2.45, 9.8],          // ogive LERX
    [7.2, 14.1], [7.35, 14.0], [7.35, 15.65],                                // 42° wing, tip rail
    [2.4, 14.95], [2.3, 15.2], [2.3, 16.5],                                  // tail boom
    [4.94, 19.1], [4.94, 20.2], [2.3, 19.6],                                 // stabilator
    [1.95, 19.7], [1.92, 20.4], [0.78, 20.4], [0.75, 20.0],                  // nozzle
    [0.4, 20.0], [0.4, 21.5], [0.22, 21.9], [0, 21.9],                       // tail stinger
  ];
  const PLANFORMS = {
    f16: [
      [0, 0], [0.22, 0.5], [0.4, 1.3], [0.5, 2.2], [0.56, 3.2], [0.6, 4.0],
      [0.68, 4.9], [0.85, 5.8], [1.12, 6.6], [1.5, 7.2],                     // strake
      [4.62, 10.0], [4.75, 10.0], [4.75, 11.2],                              // 40° wing, tip launcher
      [1.0, 11.2], [0.9, 11.6], [0.88, 12.5],                                // unswept trailing edge
      [2.79, 14.1], [2.79, 14.75], [0.95, 14.7],                             // stabilator
      [0.62, 14.75], [0.55, 15.0], [0, 15.0],
    ],
    f15: [
      [0, 0], [0.25, 0.6], [0.45, 1.5], [0.58, 2.6], [0.65, 3.8], [0.68, 5.0],
      [0.72, 5.3], [1.42, 5.45], [1.5, 6.4], [1.52, 8.4],                   // box intakes
      [6.52, 13.4], [6.05, 15.1], [1.55, 14.2],                             // 45° wing, raked tip
      [1.6, 15.3], [4.3, 18.4], [4.3, 19.4], [1.65, 18.35],                 // stabilator on the boom
      [1.15, 18.5], [1.12, 19.05], [0.12, 19.05], [0.1, 18.75], [0, 18.75], // twin nozzles
    ],
    f22: [
      [0, 0], [0.25, 0.7], [0.5, 1.7], [0.72, 2.8], [0.9, 3.9], [1.08, 4.9], // chined nose
      [1.55, 5.6], [1.68, 6.4],                                              // caret intake
      [6.78, 11.0], [6.78, 12.7], [1.85, 14.2],                              // diamond wing
      [1.5, 14.5], [1.5, 14.75], [4.42, 17.4], [4.42, 18.0], [1.55, 18.85],  // diamond stabilator
      [1.05, 18.9], [0.9, 18.92], [0.12, 18.92], [0, 18.75],
    ],
    f35: [
      [0, 0], [0.3, 0.7], [0.55, 1.7], [0.76, 2.7], [0.93, 3.6],
      [1.15, 4.4], [1.36, 5.2], [1.45, 6.1],                                 // DSI intake
      [5.35, 8.8], [5.35, 10.3], [1.5, 11.3],                                // 35° wing, forward-swept TE
      [1.3, 11.7], [1.3, 12.6], [3.35, 14.0], [3.35, 14.7], [1.35, 15.25],   // stabilator
      [0.75, 15.2], [0.62, 15.7], [0, 15.7],
    ],
    a10: [
      [0, 0], [0.25, 0.15], [0.55, 0.7], [0.72, 1.6], [0.78, 3.0], [0.8, 5.9], // gun nose
      [8.65, 5.9], [8.77, 6.1], [8.77, 7.75], [8.6, 7.9],                   // straight wing, drooped tip
      [3.0, 8.95], [2.25, 8.95], [2.3, 9.6], [2.3, 12.4], [2.05, 13.1],     // engine pod
      [1.2, 13.1], [1.05, 12.4], [1.05, 9.3], [0.62, 9.3], [0.58, 13.4], [0.5, 13.65],
      [2.7, 13.65], [2.75, 13.1], [2.95, 13.1], [2.95, 16.2], [2.75, 16.2], [2.75, 15.6], // H-tail
      [0.45, 15.6], [0.35, 16.26], [0, 16.26],
    ],
    mig25: [
      [0, 0], [0.25, 0.7], [0.45, 1.8], [0.56, 3.0], [0.6, 4.2], [0.62, 5.0],
      [1.95, 5.55], [1.98, 7.0], [1.98, 10.1],                               // huge intakes
      [6.7, 14.25], [6.7, 13.8], [6.9, 13.5], [7.1, 13.8], [7.1, 16.7], [6.7, 16.6], [6.7, 16.35], // tip pods
      [1.98, 15.6], [1.8, 15.7], [1.75, 15.85],
      [4.3, 18.5], [4.3, 19.5], [1.75, 18.75],                               // stabilator
      [1.55, 18.9], [1.55, 19.75], [0.12, 19.75], [0, 19.55],
    ],
    mig29: [
      [0, 0], [0.25, 0.7], [0.45, 1.7], [0.56, 2.8], [0.62, 3.9],
      [0.66, 4.4], [0.8, 5.4], [1.05, 6.4], [1.35, 7.3], [1.75, 8.3], [2.0, 8.9], // LERX
      [5.7, 12.2], [5.7, 13.6], [2.0, 12.8],                                 // 42° wing
      [1.85, 12.95], [1.82, 13.4], [3.9, 15.85], [3.9, 16.75], [1.82, 15.95], // stabilator
      [1.48, 16.05], [1.45, 16.5], [0.55, 16.5], [0.5, 16.1], [0.3, 16.1],    // nozzles
      [0.3, 16.95], [0.15, 17.05], [0, 17.05],                               // chute housing
    ],
    su24: [
      [0, 0], [0.4, 0.4], [0.72, 1.3], [0.88, 2.6], [0.95, 3.9], [1.0, 5.3], // wide side-by-side nose
      [1.05, 5.9], [1.8, 6.2], [1.85, 7.6],                                  // intakes
      [3.15, 10.9], [7.25, 15.0], [7.25, 16.4], [3.15, 14.5],                // glove, wing swept to 45°
      [1.75, 14.6], [1.65, 15.5], [1.62, 16.9],
      [4.15, 19.9], [4.15, 20.9], [1.62, 20.1],                              // stabilator
      [1.4, 20.2], [1.35, 21.4], [0.1, 21.4], [0, 21.25],
    ],
    su25: [
      [0, 0], [0.28, 0.7], [0.48, 1.8], [0.6, 3.0], [0.66, 4.2], [0.7, 4.9],
      [1.22, 5.2], [1.3, 6.2], [1.32, 6.35],                                 // intakes
      [6.85, 8.35], [6.85, 7.7], [7.0, 7.4], [7.15, 7.7], [7.15, 10.5], [6.85, 10.4], [6.85, 9.75], // wing, tip pods
      [1.3, 9.35], [1.25, 11.0], [1.05, 11.6], [0.65, 11.6], [0.55, 12.2],   // engine nacelle
      [0.48, 12.9], [2.33, 14.0], [2.33, 14.8], [0.45, 14.55],               // tailplane
      [0.32, 15.5], [0, 15.5],
    ],
    su27: FLANKER,
    su30: [   // Su-30SM: the Flanker with canards on the LERX
      [0, 0], [0.3, 0.8], [0.55, 2.0], [0.68, 3.3], [0.74, 4.6],
      [0.8, 5.4], [1.05, 6.6], [1.12, 6.8], [3.2, 8.75], [3.2, 9.35], [1.61, 8.15], // canard
      [1.95, 8.9], [2.45, 9.8],
      [7.2, 14.1], [7.35, 14.0], [7.35, 15.65],
      [2.4, 14.95], [2.3, 15.2], [2.3, 16.5],
      [4.94, 19.1], [4.94, 20.2], [2.3, 19.6],
      [1.95, 19.7], [1.92, 20.4], [0.78, 20.4], [0.75, 20.0],
      [0.4, 20.0], [0.4, 21.5], [0.22, 21.9], [0, 21.9],
    ],
    su57: [
      [0, 0], [0.3, 0.8], [0.55, 1.9], [0.72, 3.0], [0.85, 4.1], [0.98, 5.0],
      [1.35, 5.9], [1.75, 7.0], [2.3, 8.4], [2.6, 9.1],                      // LEVCON
      [7.05, 14.0], [7.05, 15.5], [2.6, 15.4],                               // 48° wing
      [2.4, 15.55], [2.4, 15.8], [4.8, 18.2], [4.8, 19.05], [2.4, 19.35],    // stabilator
      [2.05, 19.35], [2.0, 19.65], [1.05, 19.65], [1.0, 18.9],               // widely spaced engines
      [0.45, 18.9], [0.45, 19.8], [0.25, 20.1], [0, 20.1],                   // stinger
    ],
    j10: [
      [0, 0], [0.25, 0.8], [0.45, 1.9], [0.56, 3.0], [0.62, 4.2], [0.7, 5.2],
      [0.75, 5.5], [2.7, 7.9], [2.7, 8.55], [0.85, 7.1],                     // close-coupled canard
      [0.88, 7.7], [4.85, 13.3], [4.85, 14.4], [0.9, 14.5],                  // delta wing
      [0.65, 14.8], [0.55, 15.9], [0, 15.9],
    ],
    t6: [    // T-6 Texan II, propeller drawn as a bar
      [0, 0], [0.22, 0.15], [0.3, 0.3], [1.35, 0.3], [1.35, 0.42], [0.42, 0.45], // spinner, prop blade
      [0.5, 0.8], [0.6, 1.6], [0.64, 2.5],                                   // cowling
      [0.68, 2.6], [5.1, 3.05], [5.1, 4.1], [0.66, 4.9],                     // tapered low wing
      [0.55, 6.0], [0.4, 7.4], [0.32, 8.4],
      [2.3, 8.95], [2.3, 9.6], [0.28, 9.95], [0.12, 10.15], [0, 10.15],      // tailplane
    ],
    t7: [    // T-7A Red Hawk
      [0, 0], [0.25, 0.8], [0.45, 1.9], [0.58, 3.0], [0.66, 4.0], [0.75, 4.6],
      [1.1, 5.6], [1.6, 6.8], [2.0, 7.6],                                    // LERX
      [5.05, 9.7], [5.05, 10.6], [1.4, 11.3],                                // swept wing
      [1.3, 11.8], [3.0, 13.2], [3.0, 13.9], [1.15, 13.6],                   // stabilator
      [0.95, 13.8], [0.6, 14.0], [0.55, 14.3], [0, 14.3],
    ],
    t38: [   // T-38 Talon
      [0, 0], [0.15, 0.8], [0.3, 2.0], [0.42, 3.2], [0.52, 4.2],             // needle nose
      [0.75, 5.2], [0.8, 5.6], [0.82, 6.2],                                  // intakes
      [3.85, 8.5], [3.85, 9.4], [0.8, 10.0],                                 // small trapezoid wing
      [0.74, 10.7], [0.78, 11.6],                                            // area-ruled waist
      [2.15, 12.8], [2.15, 13.4], [0.75, 13.3],                              // stabilator
      [0.68, 13.6], [0.6, 14.14], [0, 14.14],
    ],
    j11: FLANKER,
    j16: FLANKER,
    j17: [   // JF-17 Thunder
      [0, 0], [0.24, 0.7], [0.42, 1.7], [0.52, 2.8], [0.56, 3.8], [0.6, 4.2],
      [1.0, 4.55], [1.05, 5.4], [1.15, 6.4], [1.45, 7.3], [1.65, 7.75],      // DSI intake, LERX
      [4.6, 10.4], [4.72, 10.35], [4.72, 11.4], [1.05, 11.55],               // 42° wing, tip rail
      [0.85, 11.8], [0.8, 12.3], [2.65, 13.85], [2.65, 14.45], [0.82, 14.2], // stabilator
      [0.6, 14.3], [0.52, 14.9], [0, 14.9],
    ],
    j20: [
      [0, 0], [0.28, 0.9], [0.52, 2.1], [0.72, 3.3], [0.88, 4.5], [1.0, 5.5], // chined nose
      [1.5, 6.2], [1.6, 7.0], [1.62, 7.2],                                   // DSI intake
      [3.95, 9.75], [3.95, 10.55], [1.7, 9.4],                               // canard
      [1.85, 10.0], [2.4, 11.4],                                             // LERX
      [6.45, 15.9], [6.45, 17.3], [2.2, 18.0],                               // delta wing
      [1.5, 18.2], [1.3, 18.6], [1.25, 19.95], [0.1, 19.95], [0, 19.7],
    ],
  };
  // Mirror to a full outline, center it, and scale so the longest side is
  // about 32 px for a 17 m jet, growing with the square root of size, so
  // a Flanker reads bigger than a JF-17 without either getting lost.
  for (const k in PLANFORMS) {
    const half = PLANFORMS[k];
    const full = half.concat(half.slice(1, -1).reverse().map(([x, y]) => [-x, y]));
    let y0 = Infinity, y1 = -Infinity, x1 = 0;
    for (const [x, y] of full) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x1 = Math.max(x1, Math.abs(x)); }
    const dim = Math.max(y1 - y0, 2 * x1);
    const px = Math.min(38, Math.max(26, 32 * Math.sqrt(dim / 17)));
    const s = px / dim, cy = (y0 + y1) / 2;
    ICONS[k] = full.map(([x, y]) => [Math.round(x * s * 100) / 100, Math.round((y - cy) * s * 100) / 100]);
  }
  DL.ICONS = ICONS;
  const iconFor = type => ICONS[type] || ICONS.fighter;

  // Click radii, the heading handle's reach and the movement that turns a
  // press into a drag, in screen px. Touchscreen mode makes them finger-sized.
  const touch = () => !!(DL.ui && DL.ui.touch);
  const hitPx = () => (touch() ? 30 : 18);
  const handlePx = () => (touch() ? 64 : 46);
  const slopPx = () => (touch() ? 12 : 8);
  const MIN_ZOOM = 0.005, MAX_ZOOM = 3;

  const fmt = n => (Math.round(n) + 0).toLocaleString('en-US');

  class DebriefScene extends Phaser.Scene {
    constructor() { super('debrief'); }

    create() {
      DL.scene = this;
      this.cam = this.cameras.main;
      this.cam.setBackgroundColor('#0a0e13');
      this.cam.setZoom(0.12);
      this.cam.centerOn(0, 0);

      this.gridG = this.add.graphics().setDepth(0);
      this.radarG = this.add.graphics().setDepth(0.5);
      this.trailG = this.add.graphics().setDepth(1);
      this.evG = this.add.graphics().setDepth(3);
      this.predG = this.add.graphics().setDepth(2);
      this.acG = this.add.graphics().setDepth(5);
      this.textPool = [];
      this.textUsed = 0;

      this.drag = null;       // active mouse gesture
      this.spaceDown = false;
      this.hover = null;      // world point under cursor

      this.input.mouse.disableContextMenu();
      this.input.on('pointerdown', this.onDown, this);
      this.input.on('pointermove', this.onMove, this);
      this.input.on('pointerup', this.onUp, this);
      this.input.on('pointerupoutside', this.onUp, this);
      this.input.on('wheel', this.onWheel, this);
      // a second touch pointer, for two-finger pinch and pan
      if (this.input.addPointer) this.input.addPointer(1);
      this.pinch = null;

      window.__debrief = { ok: true, scene: this };
      DL.ui && DL.ui.refresh();
    }

    // ---------- coordinates ----------
    toWorld(p) {
      const c = this.cam;
      return { x: c.scrollX + c.width / 2 + (p.x - c.width / 2) / c.zoom,
               y: c.scrollY + c.height / 2 + (p.y - c.height / 2) / c.zoom };
    }

    snap(v) {
      const g = DL.settings.gridFt;
      return DL.settings.snap ? Math.round(v / g) * g : v;
    }

    hitAircraft(w) {
      const r = hitPx() / this.cam.zoom;
      let best = null, bd = r * r;
      const f = this.scrub || DL.cur();
      for (const id in f) {
        const s = f[id];
        const d = (s.x - w.x) ** 2 + (s.y - w.y) ** 2;
        if (d <= bd) { bd = d; best = id; }
      }
      return best;
    }

    hitHandle(w) {
      const id = DL.ui.selected;
      const s = id && DL.cur()[id];
      if (!s || !DL.canEditPose(id) || this.scrub) return false;
      const z = this.cam.zoom, h = s.hdg * DL.D2R;
      const hx = s.x + Math.sin(h) * handlePx() / z, hy = s.y - Math.cos(h) * handlePx() / z;
      return (hx - w.x) ** 2 + (hy - w.y) ** 2 <= ((touch() ? 24 : 10) / z) ** 2;
    }

    hitTick(w) {
      const r2 = ((touch() ? 26 : 14) / this.cam.zoom) ** 2;
      let best = null, bd = r2;
      for (const t of this.tickHits || []) {
        const d = (t.x - w.x) ** 2 + (t.y - w.y) ** 2;
        if (d <= bd) { bd = d; best = t; }
      }
      return best;
    }

    hitEvent(w) {
      const r2 = ((touch() ? 22 : 12) / this.cam.zoom) ** 2;
      let best = null, bd = r2;
      for (const e of this.evHits || []) {
        const d = (e.x - w.x) ** 2 + (e.y - w.y) ** 2;
        if (d <= bd) { bd = d; best = e; }
      }
      return best;
    }

    // A past frame's position marker under the cursor.
    hitFrame(w) {
      const r2 = ((touch() ? 20 : 10) / this.cam.zoom) ** 2;
      let best = null, bd = r2;
      for (let k = 0; k < DL.tl.current; k++) {
        const f = DL.tl.frames[k];
        for (const id in f) {
          const d = (f[id].x - w.x) ** 2 + (f[id].y - w.y) ** 2;
          if (d <= bd) { bd = d; best = { k, id }; }
        }
      }
      return best;
    }

    // ---------- input ----------
    // ---------- two-finger pinch and pan ----------
    touchesDown() {
      return [this.input.pointer1, this.input.pointer2].filter(q => q && q.isDown);
    }

    startPinch() {
      const ps = this.touchesDown();
      if (ps.length < 2) return false;
      this.drag = null;     // a second finger cancels the one-finger gesture
      DL.ui.hideTip();
      const [a, b] = ps;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.pinch = { d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), z0: this.cam.zoom, w: this.toWorld(mid) };
      return true;
    }

    movePinch() {
      const ps = this.touchesDown();
      if (ps.length < 2) return;
      const [a, b] = ps, pz = this.pinch;
      const d = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.cam.setZoom(DL.clamp(pz.z0 * d / pz.d0, MIN_ZOOM, MAX_ZOOM));
      // keep the map point that started between the fingers between them
      const now = this.toWorld(mid);
      this.cam.scrollX += pz.w.x - now.x;
      this.cam.scrollY += pz.w.y - now.y;
      DL.ui.refresh();
    }

    onDown(p) {
      this.lastPointer = { x: p.x, y: p.y };
      this.pressing = true;
      document.body.classList.add('map-gesture');
      if (this.startPinch() || this.pinch) return;
      if (touch()) DL.ui.hideTip();
      const ev = p.event || {};
      const w = this.toWorld(p);
      const tool = DL.ui.tool;
      const ctl = ev.ctrlKey || ev.metaKey;

      if (p.button === 1 || tool === 'pan' || this.spaceDown || (p.button === 2 && !ctl)) {
        this.drag = { mode: 'pan', sx: p.x, sy: p.y, scx: this.cam.scrollX, scy: this.cam.scrollY };
        return;
      }
      if (tool === 'zoom') {
        this.zoomAt(p, ev.shiftKey || ev.altKey ? 0.5 : 2);
        return;
      }
      if (tool === 'place') {
        const id = DL.addAircraft(DL.ui.placeType, this.snap(w.x), this.snap(w.y), 0);
        DL.ui.select(id);
        DL.ui.setScrub(0);
        this.drag = { mode: 'rotate', id, placing: true };
        return;
      }
      if (tool === 'path') {
        const hit = this.hitAircraft(w);
        if (hit) DL.ui.select(hit);
        if (DL.ui.selected && DL.cur()[DL.ui.selected]) {
          this.drag = { mode: 'path', id: DL.ui.selected, sx: p.x, sy: p.y, live: !hit };
          if (!hit) this.applyPath(w);
        }
        return;
      }
      // Select tool. Plain drag from an aircraft shapes its flight path.
      // Option/Ctrl/Cmd+drag turns it and Shift+drag moves it, but only on
      // the frame where it first appears.
      const mod = ev.altKey || ev.ctrlKey || ev.metaKey;
      if (this.hitHandle(w)) {
        this.drag = { mode: 'rotate', id: DL.ui.selected };
        return;
      }
      const hit = this.hitAircraft(w);
      const tick = !hit && this.hitTick(w);
      if (tick) {
        DL.ui.select(tick.id);
        const s0 = DL.tl.frames[tick.k][tick.id];
        this.drag = { mode: 'climb', k: tick.k, id: tick.id, sx: p.x, sy: p.y, g0: s0.gam || 0, moved: false };
        DL.ui.hideTip();
        return;
      }
      if (hit) {
        DL.ui.select(hit);
        const s = DL.cur()[hit];
        // on a touchscreen the panel's Drag buttons stand in for Shift and Option
        const dm = touch() ? DL.ui.dragMode : 'path';
        const wantMove = ev.shiftKey || dm === 'move', wantTurn = mod || dm === 'nose';
        if ((wantTurn || wantMove) && !DL.canEditPose(hit)) {
          DL.ui.flash('Heading and position are locked after an aircraft\'s first frame. Press Unlock in the panel to change them, or drag to shape the flight path.');
          this.drag = null;
        } else if (wantMove) {
          DL.ui.setScrub(0);
          this.drag = { mode: 'move', id: hit, ox: s.x - w.x, oy: s.y - w.y };
        } else if (wantTurn) {
          DL.ui.setScrub(0);
          this.drag = { mode: 'rotate', id: hit };
        } else {
          this.drag = { mode: 'path', id: hit, sx: p.x, sy: p.y, live: false };
        }
        return;
      }
      if (touch()) {
        // a tap shows a past frame's or marker's data, or deselects; a drag pans
        this.drag = { mode: 'pan', sx: p.x, sy: p.y, scx: this.cam.scrollX, scy: this.cam.scrollY, tap: true };
        return;
      }
      DL.ui.select(null);
      this.drag = { mode: 'pan', sx: p.x, sy: p.y, scx: this.cam.scrollX, scy: this.cam.scrollY };
    }

    onMove(p) {
      const w = this.toWorld(p);
      this.hover = w;
      DL.ui.cursor(w);
      if (this.pinch) { this.movePinch(); return; }
      const d = this.drag;
      if (!d) { if (!touch()) this.hoverInfo(p, w); return; }
      if (d.mode === 'climb') {
        // a click opens the vertical window; a drag sets the climb angle
        if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) < (touch() ? 10 : 5)) return;
        d.moved = true;
        const gam = Math.round(DL.clamp(d.g0 + (d.sy - p.y) / 3, -89, 89));
        DL.setClimb(d.k, d.id, gam);
        DL.ui.refresh();
        DL.ui.tip('<b>Climb angle ' + (gam > 0 ? '+' : '') + gam + '°</b><br>at frame ' + d.k + '. Drag up to climb, down to descend.', p);
        return;
      }
      if (d.mode === 'pan') {
        if (d.tap && Math.hypot(p.x - d.sx, p.y - d.sy) < slopPx()) return;
        d.tap = false;
        this.cam.scrollX = d.scx - (p.x - d.sx) / this.cam.zoom;
        this.cam.scrollY = d.scy - (p.y - d.sy) / this.cam.zoom;
      } else if (d.mode === 'move') {
        DL.editPose(d.id, { x: this.snap(w.x + d.ox), y: this.snap(w.y + d.oy) });
        d.moved = true;
        DL.ui.refresh();
      } else if (d.mode === 'rotate') {
        const s = DL.cur()[d.id];
        if (!s) return;
        const dx = w.x - s.x, dy = w.y - s.y;
        if (dx * dx + dy * dy < ((touch() ? 16 : 4) / this.cam.zoom) ** 2) return;
        let hdg = Math.atan2(dx, -dy) / DL.D2R;
        if ((p.event && p.event.shiftKey)) hdg = Math.round(hdg / 15) * 15;
        DL.editPose(d.id, { hdg: Math.round(hdg) });
        DL.ui.refresh();
      } else if (d.mode === 'path') {
        // ignore the small jitter of a plain click
        if (!d.live && Math.hypot(p.x - d.sx, p.y - d.sy) < slopPx()) return;
        d.live = true;
        this.applyPath(w);
      }
    }

    // Hover: data for a past frame, or a hint over the vertical ticks.
    hoverInfo(p, w) {
      const tool = DL.ui.tool;
      if (tool !== 'select' && tool !== 'path') { DL.ui.hideTip(); return; }
      const fr = this.hitFrame(w);
      if (fr) { DL.ui.frameTip(fr.k, fr.id, p); return; }
      const eh = this.hitEvent(w);
      if (eh) { DL.ui.eventTip(eh.ev, p); return; }
      const tick = tool === 'select' && this.hitTick(w);
      if (tick) {
        DL.ui.tip('Click to edit the next frame\'s vertical profile, or drag up/down to set its climb angle.', p);
        DL.ui.setCursor('ns-resize');
        return;
      }
      DL.ui.hideTip();
    }

    onUp(p) {
      if (!this.touchesDown().length) {
        this.pressing = false;
        document.body.classList.remove('map-gesture');
        if (DL.ui.pendingClear) { const id = DL.ui.pendingClear; DL.ui.pendingClear = null; this.keepClear(id); }
      }
      if (this.pinch) {
        // lifting a finger ends the pinch; the other finger starts nothing new
        if (!this.touchesDown().length) this.pinch = null;
        this.drag = null;
        return;
      }
      const d = this.drag;
      if (d && d.tap) {
        const q = p || this.lastPointer, w = this.toWorld(q);
        const fr = this.hitFrame(w), eh = !fr && this.hitEvent(w);
        if (fr) DL.ui.frameTip(fr.k, fr.id, q);
        else if (eh) DL.ui.eventTip(eh.ev, q);
        else { DL.ui.hideTip(); DL.ui.select(null); }
      }
      if (this.drag && this.drag.mode === 'climb') {
        DL.ui.hideTip();
        if (!this.drag.moved) DL.ui.openVertical(this.drag.k, this.drag.id, this.lastPointer);
      }
      if (this.drag && this.drag.placing) DL.ui.setTool('select');
      this.drag = null;
    }

    // Flight-path tool: choose the level turn whose arc passes through the
    // cursor. Cursor straight ahead (or behind) means wings level.
    applyPath(w) {
      const id = this.drag && this.drag.id;
      const s = id && DL.cur()[id];
      if (!s) return;
      const h = s.hdg * DL.D2R;
      const dx = w.x - s.x, dy = w.y - s.y;
      const fwd = dx * Math.sin(h) - dy * Math.cos(h);
      const right = dx * Math.cos(h) + dy * Math.sin(h);
      const type = DL.tl.aircraft[id].type;
      const tol = 6 / this.cam.zoom;
      let g = 1, bank = 0;
      if (Math.abs(right) > tol) {
        const radius = (fwd * fwd + right * right) / (2 * Math.abs(right));
        g = Math.min(DL.gForRadius(s.spd, radius, s.gam), DL.TYPES[type].maxG);
        g = Math.round(g * 10) / 10;
        bank = Math.sign(right) * Math.max(1, Math.round(DL.bankForG(g, s.gam)));
        if (g <= 1) bank = Math.sign(right) * 1;
      }
      DL.editControls(id, { g: Math.max(1, g), bank });
      DL.ui.refresh();
    }

    onWheel(p, over, dx, dy) {
      const ev = p.event || {};
      const id = DL.ui.selected;
      // Option/Alt + wheel: throttle. Shift + wheel: g. Plain wheel or pinch: zoom.
      if (id && DL.cur()[id] && (ev.altKey || ev.shiftKey)) {
        const s = DL.cur()[id];
        const delta = (dy || dx) > 0 ? -1 : 1;
        if (ev.altKey) DL.ui.setControl('thr', DL.clamp(s.ctl.thr + delta * 5, 0, 100));
        else DL.ui.setControl('g', DL.clamp(Math.round((s.ctl.g + delta * 0.5) * 10) / 10, 1, DL.TYPES[DL.tl.aircraft[id].type].maxG));
        if (ev.preventDefault) ev.preventDefault();
        return;
      }
      const k = Math.exp(-dy * (ev.ctrlKey ? 0.01 : 0.0015));
      this.zoomAt(p, k);
      if (ev.preventDefault) ev.preventDefault();
    }

    // After a selection, slide the map so the aircraft is not hidden under
    // the aircraft panel (the sheet on a phone, the side panel elsewhere).
    keepClear(id) {
      const s = DL.cur()[id], el = document.getElementById('panel');
      if (!s || !el.offsetWidth) return;
      const c = this.cam, cr = this.game.canvas.getBoundingClientRect(), r = el.getBoundingClientRect();
      const sx = cr.left + c.width / 2 + (s.x - c.scrollX - c.width / 2) * c.zoom;
      const sy = cr.top + c.height / 2 + (s.y - c.scrollY - c.height / 2) * c.zoom;
      const m = 30;
      if (sx < r.left - m || sx > r.right + m || sy < r.top - m || sy > r.bottom + m) return;
      if (r.width > cr.width * 0.6) c.scrollY += (sy - (cr.top + r.top) / 2) / c.zoom;
      else c.scrollX += (sx - (cr.left + r.left) / 2) / c.zoom;
      DL.ui.refresh();
    }

    zoomAt(p, k) {
      const before = this.toWorld(p);
      this.cam.setZoom(DL.clamp(this.cam.zoom * k, MIN_ZOOM, MAX_ZOOM));
      const after = this.toWorld(p);
      this.cam.scrollX += before.x - after.x;
      this.cam.scrollY += before.y - after.y;
      DL.ui.refresh();
    }

    zoomCenter(k) {
      this.zoomAt({ x: this.cam.width / 2, y: this.cam.height / 2 }, k);
    }

    // Frame the aircraft, their trails, and the next frame's prediction.
    fit() {
      const pts = [];
      for (let k = 0; k <= DL.tl.current; k++) {
        const f = DL.tl.frames[k];
        for (const id in f) pts.push([f[id].x, f[id].y]);
      }
      const f = DL.cur();
      for (const id in f) {
        const r = DL.step(DL.tl.aircraft[id].type, f[id], DL.frameDur(DL.tl.current));
        pts.push([r.x, r.y]);
      }
      if (!pts.length) { this.cam.setZoom(0.12); this.cam.centerOn(0, 0); DL.ui.refresh(); return; }
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      const w = Math.max(x1 - x0, 1500), h = Math.max(y1 - y0, 1500);
      // keep clear of the windows open on either side of the map, and of
      // full-width sheets above or below it (phones)
      const W = this.cam.width, H = this.cam.height, top0 = DL.ui.barH();
      let left = 0, right = 0, above = 0, below = 0;
      for (const id of ['panel', 'vwin', 'advwin', 'v3d']) {
        const el = document.getElementById(id);
        if (!el || !el.offsetWidth) continue;
        const r = el.getBoundingClientRect();
        if (r.width > W * 0.6) {
          if (r.top + r.height / 2 > top0 + H / 2) below = Math.max(below, top0 + H - r.top);
          else above = Math.max(above, r.bottom - top0);
        } else if (r.left + r.width / 2 < W / 2) left = Math.max(left, r.right);
        else right = Math.max(right, W - r.left);
      }
      const freeW = Math.max(120, W - left - right), freeH = Math.max(120, H - above - below);
      const availW = freeW - Math.min(120, freeW * 0.2), availH = freeH - Math.min(160, freeH * 0.25);
      const z = DL.clamp(Math.min(availW / w, availH / h), MIN_ZOOM, MAX_ZOOM);
      this.cam.setZoom(z);
      this.cam.centerOn((x0 + x1) / 2 + (right - left) / 2 / z, (y0 + y1) / 2 + (below - above) / 2 / z);
      DL.ui.refresh();
    }

    // ---------- drawing ----------
    text(str, x, y, color, size, originX, originY) {
      let t = this.textPool[this.textUsed];
      if (!t) {
        t = this.add.text(0, 0, '', { fontFamily: 'Menlo, Consolas, monospace', fontSize: '11px', color: '#ffffff' }).setDepth(8);
        this.textPool.push(t);
      }
      this.textUsed++;
      t.setText(str).setFontSize(size || 11).setColor(color || '#c9d4df')
        .setOrigin(originX || 0, originY || 0).setPosition(x, y).setScale(1 / this.cam.zoom).setVisible(true);
      return t;
    }

    update() {
      this.textUsed = 0;
      this.tickHits = [];
      this.evHits = [];
      DL.ui.syncScrub();
      // this frame's flight of every aircraft, used by several layers
      this.pred = {};
      const f = DL.cur();
      for (const id in f) this.pred[id] = DL.step(DL.tl.aircraft[id].type, f[id], DL.frameDur(DL.tl.current));
      this.scrub = this.scrubStates();
      this.drawGrid();
      this.drawRadar();
      this.drawTrails();
      this.drawPrediction();
      this.drawEvents();
      this.drawAircraft();
      for (let i = this.textUsed; i < this.textPool.length; i++) this.textPool[i].setVisible(false);
    }

    // Where every aircraft is part-way through the upcoming frame, at the
    // scrub time the title-bar slider shares with the 3D view: position,
    // heading, speed and altitude from the flight model's samples. Null
    // when the slider sits at the frame start.
    scrubStates() {
      const t = DL.scrubT ? DL.scrubT() : 0, st = DL.settings, tl = DL.tl;
      if (!(t > 0)) return null;
      const f = DL.cur(), out = {}, frac = Math.min(1, t / DL.frameDur(tl.current));
      for (const id in f) {
        const s = f[id], r = this.pred[id];
        const nx = tl.frames[tl.current + 1] && tl.frames[tl.current + 1][id];
        let p;
        if (nx && nx.pinned) {
          // the next frame was set by hand: slide straight along the dashed trail
          const dh = ((nx.hdg - s.hdg + 540) % 360) - 180;
          p = { x: s.x + (nx.x - s.x) * frac, y: s.y + (nx.y - s.y) * frac, hdg: DL.wrap360(s.hdg + dh * frac),
            spd: s.spd + (nx.spd - s.spd) * frac, alt: (s.alt || 0) + ((nx.alt || 0) - (s.alt || 0)) * frac };
        } else {
          const i = DL.clamp(Math.round(t / st.stepSec), 0, r.samples.length - 1);
          const smp = r.samples[i], att = DL.attitude(smp.v, smp.u, s.hdg);
          p = { x: r.path[i][0], y: r.path[i][1], hdg: att.hdg, spd: smp.spd, alt: smp.alt, gam: att.gam, bank: att.bank, n: smp.n };
        }
        out[id] = Object.assign({}, s, p);
      }
      return out;
    }

    drawGrid() {
      const g = this.gridG, c = this.cam, z = c.zoom;
      const vw = c.width / z, vh = c.height / z;
      const v = { x: c.scrollX + c.width / 2 - vw / 2, y: c.scrollY + c.height / 2 - vh / 2 };
      v.right = v.x + vw; v.bottom = v.y + vh;
      g.clear();
      const cell = DL.settings.gridFt;
      // Thin out lines when cells get too small to read.
      let minor = cell;
      while (minor * z < 7) minor *= (String(minor / cell).startsWith('1') ? 5 : 2);
      const major = minor * (String(minor / cell)[0] === '1' ? 10 : 2);
      const x0 = Math.floor(v.x / minor) * minor, x1 = v.right;
      const y0 = Math.floor(v.y / minor) * minor, y1 = v.bottom;
      const lw = 1 / z;
      const lines = (step, color, alpha) => {
        g.lineStyle(lw, color, alpha);
        g.beginPath();
        for (let x = Math.floor(v.x / step) * step; x <= x1; x += step) { g.moveTo(x, v.y); g.lineTo(x, y1); }
        for (let y = Math.floor(v.y / step) * step; y <= y1; y += step) { g.moveTo(v.x, y); g.lineTo(x1, y); }
        g.strokePath();
      };
      lines(minor, 0x1a2836, 1);
      lines(major, 0x27405a, 1);
      g.lineStyle(1.5 / z, 0x3a6488, 1);
      g.lineBetween(0, v.y, 0, y1);
      g.lineBetween(v.x, 0, x1, 0);
      // major-line distance labels along the top and left edges
      if ((x1 - x0) / major < 40) {
        for (let x = Math.ceil(v.x / major) * major; x <= x1; x += major) {
          this.text(DL.fmtFt(x), x + 3 / z, v.y + 4 / z, '#3d5f7d', 10);
        }
        for (let y = Math.ceil(v.y / major) * major; y <= y1; y += major) {
          if (y - v.y < 20 / z) continue;
          this.text(DL.fmtFt(-y), v.x + 4 / z, y + 3 / z, '#3d5f7d', 10);
        }
      }
      this.gridInfo = { minor, major };
    }

    iconPoints(type, x, y, hdg, scale) {
      const z = this.cam.zoom, h = hdg * DL.D2R, c = Math.cos(h), s = Math.sin(h);
      const k = (scale || 1) / z;
      return iconFor(type).map(([lx, ly]) => ({ x: x + (lx * c - ly * s) * k, y: y + (lx * s + ly * c) * k }));
    }

    dashed(g, pts, dash, gap) {
      let on = true, left = dash;
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        let [ax, ay] = pts[i - 1];
        const [bx, by] = pts[i];
        let seg = Math.hypot(bx - ax, by - ay);
        while (seg > 0) {
          const d = Math.min(seg, left);
          const t = d / seg;
          ax += (bx - ax) * t; ay += (by - ay) * t;
          if (on) g.lineTo(ax, ay); else g.moveTo(ax, ay);
          seg -= d; left -= d;
          if (left <= 1e-9) { on = !on; left = on ? dash : gap; }
        }
      }
      g.strokePath();
    }

    // Climb/descent marks across the middle of a frame's path. The first
    // tick is the reference; the next ones grow for a climb and shrink for a
    // descent. Two ticks = gentle, three = steep, one = level. The size step
    // grows with the altitude change over the frame.
    vertTicks(g, path, dAlt, color, alpha, hit) {
      const st = DL.settings;
      if (!st.showVertical || !path || path.length < 3 || dAlt === undefined) return;
      const z = this.cam.zoom;
      const a = Math.abs(dAlt);
      const count = a < st.vertLevelFt ? 1 : a < st.vertSteepFt ? 2 : 3;
      const stepPx = count === 1 ? 0 : DL.clamp(3 + 7 * a / st.vertSteepFt, 3, 8);
      const sign = dAlt >= 0 ? 1 : -1;
      const base = 20, gapPx = 7;
      // walk to the middle of the path by distance
      let total = 0;
      for (let i = 1; i < path.length; i++) total += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
      if (total * z < 30) return;
      const at = d => {
        for (let i = 1; i < path.length; i++) {
          const [ax, ay] = path[i - 1], [bx, by] = path[i];
          const l = Math.hypot(bx - ax, by - ay);
          if (d <= l || i === path.length - 1) {
            const t = l ? Math.min(1, d / l) : 0;
            return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, dx: (bx - ax) / (l || 1), dy: (by - ay) / (l || 1) };
          }
          d -= l;
        }
      };
      if (hit) {
        const m = at(total / 2);
        this.tickHits.push(Object.assign({ x: m.x, y: m.y }, hit));
        const vw = DL.ui.vw;
        if (vw && vw.k === hit.k && vw.id === hit.id) {
          g.lineStyle(1.5 / z, 0xffd166, 0.9);
          g.strokeCircle(m.x, m.y, 18 / z);
        }
      }
      const start = total / 2 - (count - 1) * gapPx / z / 2;
      g.lineStyle(2 / z, color, Math.min(1, alpha + 0.1));
      for (let k = 0; k < count; k++) {
        const p = at(start + k * gapPx / z);
        const half = (base + sign * k * stepPx) / 2 / z;
        g.lineBetween(p.x - p.dy * half, p.y + p.dx * half, p.x + p.dy * half, p.y - p.dx * half);
      }
    }

    drawTrails() {
      const g = this.trailG, z = this.cam.zoom, tl = DL.tl;
      g.clear();
      for (let k = 1; k <= tl.current; k++) {
        const a = tl.frames[k - 1], b = tl.frames[k];
        for (const id in b) {
          const s = b[id], ac = tl.aircraft[id];
          if (!ac) continue;
          const age = tl.current - k;
          const alpha = Math.max(0.3, 0.9 - age * 0.06);
          const col = DL.colorAt(k - 1, id);   // the color it wore while flying this segment
          g.lineStyle(2 / z, col, alpha);
          if (s.path) {
            g.strokePoints(s.path.map(([x, y]) => ({ x, y })));
            this.vertTicks(g, s.path, s.dAlt, col, alpha);
          } else if (a[id]) {
            this.dashed(g, [[a[id].x, a[id].y], [s.x, s.y]], 8 / z, 6 / z);
          }
        }
      }
      // frame marks: ghost symbol at every past frame position
      for (let k = 0; k < tl.current; k++) {
        const f = tl.frames[k];
        for (const id in f) {
          const s = f[id], ac = tl.aircraft[id];
          if (!ac) continue;
          const col = s.color || ac.color;
          if (DL.settings.showGhosts) {
            g.fillStyle(col, 0.28);
            g.fillPoints(this.iconPoints(ac.type, s.x, s.y, s.hdg, 0.7), true);
          }
          g.fillStyle(col, 0.9);
          g.fillCircle(s.x, s.y, 2.5 / z);
          if (DL.settings.showLabels && z * 300 > 8) this.text(String(k), s.x + 8 / z, s.y + 6 / z, '#7d8a96', 10);
        }
      }
    }

    drawPrediction() {
      const g = this.predG, z = this.cam.zoom, st = DL.settings;
      g.clear();
      const f = DL.cur();
      for (const id in f) {
        const s = f[id], ac = DL.tl.aircraft[id];
        const sel = id === DL.ui.selected;
        const col = s.color || ac.color;
        const r = this.pred[id] || DL.step(ac.type, s, DL.frameDur(DL.tl.current));
        if (st.showPrediction) {
          g.lineStyle((sel ? 2 : 1.5) / z, col, sel ? 0.9 : 0.55);
          this.dashed(g, r.path, 10 / z, 7 / z);
          this.vertTicks(g, r.path, r.dAlt, col, sel ? 1 : 0.7, { k: DL.tl.current, id });
          g.lineStyle(1.5 / z, col, sel ? 0.8 : 0.45);
          g.strokePoints(this.iconPoints(ac.type, r.x, r.y, r.hdg, 0.8), true);
        }
        // whole-maneuver preview: keep flying until a reversal rolls out
        if (st.showPrediction && (s.ctl.maneuver || s.rev || r.rev)) {
          const ahead = DL.predictAhead(DL.tl.current, id, 10);
          for (let i = 1; i < ahead.length; i++) {
            g.lineStyle(1.5 / z, col, 0.4);
            this.dashed(g, ahead[i].path, 6 / z, 6 / z);
            this.vertTicks(g, ahead[i].path, ahead[i].dAlt, col, 0.4);
          }
          const last = ahead[ahead.length - 1];
          if (ahead.length > 1) {
            g.lineStyle(1.5 / z, col, 0.5);
            g.strokePoints(this.iconPoints(ac.type, last.x, last.y, last.hdg, 0.8), true);
          }
          if (sel && last.rolledOut) {
            let tAhead = 0;
            for (let i = 0; i < ahead.length; i++) tAhead += DL.frameDur(DL.tl.current + i);
            this.text('rolls out +' + DL.fmtSec(tAhead) + 's  ' + String(Math.round(last.hdg)).padStart(3, '0') + '°  ' + fmt(last.alt) + ' ft',
              last.x + 14 / z, last.y - 18 / z, '#ffd166', 10);
          }
        }
        const ti = DL.turnInfo(ac.type, s.spd, s.ctl, s.gam);
        if (ti.dir !== 0 && (st.showCircles === 'all' || (st.showCircles === 'selected' && sel))) {
          const h = s.hdg * DL.D2R;
          const cx = s.x + Math.cos(h) * ti.radius * ti.dir;
          const cy = s.y + Math.sin(h) * ti.radius * ti.dir;
          g.lineStyle(1 / z, col, 0.3);
          g.strokeCircle(cx, cy, ti.radius);
          g.lineStyle(1 / z, 0xffffff, 0.45);
          this.dashed(g, [[s.x, s.y], [cx, cy]], 5 / z, 4 / z);
          g.fillStyle(0xffffff, 0.7);
          g.fillCircle(cx, cy, 2.5 / z);
          const mx = (s.x + cx) / 2, my = (s.y + cy) / 2;
          this.text('R ' + fmt(ti.radius) + ' ft', mx, my, '#e6edf3', 11, 0.5, 1.2);
          this.text(Math.abs(ti.rateDps).toFixed(1) + '°/s', cx, cy + 6 / z, '#9fb3c5', 10, 0.5, 0);
        }
        if (st.showPrediction && sel) {
          const dh = r.dHdg;
          this.text('+' + DL.fmtSec(DL.frameDur(DL.tl.current)) + 's  Δhdg ' + (dh >= 0 ? '+' : '') + dh.toFixed(0) + '°  ' + fmt(r.spd) + ' kt  Δalt ' + (r.dAlt >= 0 ? '+' : '') + fmt(r.dAlt) + ' ft',
            r.x + 14 / z, r.y + 10 / z, '#9fb3c5', 10);
        }
      }
    }

    // Radar sector ahead of an aircraft: the field of view as a grey wedge
    // with range arcs and a fan of rays; rays that reach another aircraft
    // inside the sector are drawn bright up to it, like a return on the
    // scope. While scrubbing it follows the aircraft along the frame.
    drawRadar() {
      const g = this.radarG, z = this.cam.zoom, rd = DL.adv && DL.adv.radar;
      g.clear();
      if (!rd || !rd.on) return;
      const f = this.scrub || DL.cur();
      const GREY = 0xb0b6bd, GREYS = '#b0b6bd';
      const ids = rd.who === 'all' ? Object.keys(f) : (DL.ui.selected && f[DL.ui.selected] ? [DL.ui.selected] : []);
      for (const id of ids) {
        const s = f[id], ac = DL.tl.aircraft[id];
        const R = rd.rangeNm * DL.NM, half = rd.fovDeg / 2 * DL.D2R;
        const h = s.hdg * DL.D2R, a0 = h - Math.PI / 2;
        g.fillStyle(GREY, 0.06);
        g.slice(s.x, s.y, R, a0 - half, a0 + half, false);
        g.fillPath();
        g.lineStyle(1.5 / z, GREY, 0.6);
        g.slice(s.x, s.y, R, a0 - half, a0 + half, false);
        g.strokePath();
        // range arcs at each quarter
        for (let q = 1; q <= 3; q++) {
          const r = R * q / 4;
          g.lineStyle(1 / z, GREY, 0.25);
          g.beginPath(); g.arc(s.x, s.y, r, a0 - half, a0 + half, false); g.strokePath();
          if (q === 2 || rd.rangeNm >= 20) {
            const nm = rd.rangeNm * q / 4;
            this.text((nm % 1 ? nm.toFixed(1) : nm) + '', s.x + Math.sin(h) * r + 4 / z, s.y - Math.cos(h) * r - 12 / z, GREYS, 10);
          }
        }
        this.text(rd.rangeNm + ' nm', s.x + Math.sin(h) * R + 4 / z, s.y - Math.cos(h) * R - 12 / z, GREYS, 10);
        // ray fan
        const contacts = DL.radarContacts(id, undefined, f);
        const stepDeg = rd.fovDeg > 180 ? 10 : 5;
        for (let d = -rd.fovDeg / 2; d <= rd.fovDeg / 2 + 1e-6; d += stepDeg) {
          const ang = h + d * DL.D2R;
          let len = R, bright = false;
          for (const c of contacts) {
            if (c.detected && Math.abs(c.rel - d) <= stepDeg / 2) { len = Math.min(len, c.range); bright = true; }
          }
          g.lineStyle((bright ? 1.5 : 1) / z, bright ? 0xffffff : GREY, bright ? 0.7 : 0.1);
          g.lineBetween(s.x, s.y, s.x + Math.sin(ang) * len, s.y - Math.cos(ang) * len);
        }
        // contact brackets and readouts
        for (const c of contacts) {
          if (!c.detected) continue;
          const b = 14 / z;
          g.lineStyle(1.5 / z, 0xffffff, 0.9);
          g.strokeRect(c.x - b, c.y - b, 2 * b, 2 * b);
          this.text(c.rangeNm < 10 ? c.rangeNm.toFixed(1) + ' nm' : Math.round(c.rangeNm) + ' nm', c.x + b + 4 / z, c.y - b, '#ffffff', 10);
          this.text((c.dAlt >= 0 ? '+' : '') + fmt(c.dAlt) + ' ft  ' + (c.closure >= 0 ? '+' : '') + fmt(c.closure) + ' kt', c.x + b + 4 / z, c.y - b + 12 / z, '#9fb3c5', 10);
        }
        if (ids.length > 1) this.text(ac.callsign + ' radar', s.x + Math.sin(h) * R * 0.5 + 4 / z, s.y - Math.cos(h) * R * 0.5, GREYS, 10);
      }
    }

    starburst(g, x, y, r) {
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 4;
        g.lineBetween(x - Math.cos(a) * r, y - Math.sin(a) * r, x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
    }

    // Event markers for every frame up to the current one.
    drawEvents() {
      const g = this.evG, z = this.cam.zoom, tl = DL.tl, kc = tl.current;
      const kcf = kc + (DL.scrubT ? DL.scrubT() : 0) / DL.frameDur(kc);   // fractional frame while scrubbing
      g.clear();
      if (!tl.events || !DL.EVENT_KINDS) return;
      const stack = {};   // events on the same aircraft and frame stack their labels
      for (const ev of tl.events) {
        if (ev.k > kc) continue;
        const kind = DL.EVENT_KINDS[ev.kind];
        const s = tl.frames[ev.k][ev.ac], ac = tl.aircraft[ev.ac];
        if (!s || !ac) continue;
        const age = kc - ev.k;
        const h = s.hdg * DL.D2R;
        const key = ev.k + ':' + ev.ac, row = stack[key] || 0;
        stack[key] = row + 1;
        const label = (txt, x, y, col) => this.text(txt, x + 10 / z, y - 16 / z - row * 12 / z, col || '#' + kind.color.toString(16).padStart(6, '0'), 10);
        if (ev.kind === 'gun') {
          const alpha = age === 0 ? 1 : 0.45;
          const ex = s.x + Math.sin(h) * ev.len, ey = s.y - Math.cos(h) * ev.len;
          g.lineStyle(1 / z, kind.color, alpha * 0.5);
          g.lineBetween(s.x, s.y, ex, ey);
          // short tracer dashes along the line
          g.lineStyle(2.5 / z, kind.color, alpha);
          for (let i = 1; i <= 5; i++) {
            const t0 = (i - 0.35) / 5.5, t1 = i / 5.5;
            g.lineBetween(s.x + (ex - s.x) * t0, s.y + (ey - s.y) * t0, s.x + (ex - s.x) * t1, s.y + (ey - s.y) * t1);
          }
          g.lineStyle(1.5 / z, kind.color, alpha);
          g.strokeCircle(ex, ey, 5 / z);
          g.lineBetween(ex - 8 / z, ey, ex + 8 / z, ey); g.lineBetween(ex, ey - 8 / z, ex, ey + 8 / z);
          label('GUNS', ex, ey);
          this.evHits.push({ x: ex, y: ey, ev });
        } else if (ev.kind === 'flare') {
          // dropped one by one along the path flown during the frame. While
          // that frame is scrubbed they appear as the aircraft passes; the
          // ones still to come are drawn faint.
          const prog = age > 0 ? 1 : kcf - kc;
          const pred = ev.k === kc ? this.pred[ev.ac] : null;
          let lx = s.x, ly = s.y;
          for (let i = 0; i < ev.count; i++) {
            const fr = (i + 0.5) / ev.count;
            const p = DL.posAt(ev.ac, ev.k + fr, pred);
            if (!p) break;
            const q0 = DL.posAt(ev.ac, ev.k + Math.max(0, fr - 0.03), pred), q1 = DL.posAt(ev.ac, ev.k + Math.min(1, fr + 0.03), pred);
            let dx = q1.x - q0.x, dy = q1.y - q0.y, L = Math.hypot(dx, dy);
            if (L < 1e-6) { dx = Math.sin(h); dy = -Math.cos(h); L = 1; }
            const side = (i % 2 ? 1 : -1) * 7 / z;
            const fx = p.x - dy / L * side, fy = p.y + dx / L * side;
            const out = fr <= prog + 1e-9;
            g.lineStyle((out ? 1.5 : 1) / z, kind.color, out ? (age === 0 ? 1 : 0.5) : 0.3);
            this.starburst(g, fx, fy, (out ? 5 : 4) / z);
            if (i === 0) { lx = fx; ly = fy; }
          }
          label('FLARES ×' + ev.count, lx, ly);
          this.evHits.push({ x: lx, y: ly, ev });
        } else if (ev.kind === 'shot') {
          const st = DL.shotState(ev, kcf);
          if (!st) continue;
          const col = kind.color;
          // launch point
          g.lineStyle(1.5 / z, col, 0.9);
          g.strokeCircle(st.launch.x, st.launch.y, 6 / z);
          g.fillStyle(col, 0.9);
          g.fillCircle(st.launch.x, st.launch.y, 2 / z);
          const tgtName = ev.target && tl.aircraft[ev.target] ? ' → ' + tl.aircraft[ev.target].callsign : '';
          label('SHOT' + tgtName + '  F' + ev.k, st.launch.x, st.launch.y);
          this.evHits.push({ x: st.launch.x, y: st.launch.y, ev });
          if (st.tgt) {
            // path flown so far and the symbol
            g.lineStyle(1.5 / z, col, 0.8);
            this.dashed(g, [[st.launch.x, st.launch.y], [st.at.x, st.at.y]], 6 / z, 5 / z);
            if (!st.done) {
              g.lineStyle(1 / z, col, 0.3);
              this.dashed(g, [[st.at.x, st.at.y], [st.tgt.x, st.tgt.y]], 3 / z, 6 / z);
            }
            const mh = st.hdg * DL.D2R, L = 9 / z, W = 3 / z;
            const pts = [[0, -L], [W, L * 0.4], [0, L], [-W, L * 0.4]].map(([px, py]) =>
              ({ x: st.at.x + px * Math.cos(mh) - py * Math.sin(mh), y: st.at.y + px * Math.sin(mh) + py * Math.cos(mh) }));
            if (!st.done) {
              g.fillStyle(col, 1);
              g.fillPoints(pts, true);
              label(Math.round(st.p * ev.tof) + ' / ' + ev.tof + ' s', st.at.x, st.at.y + 26 / z, '#e6edf3');
            } else {
              // end of flight: result marker set by the user
              const ex = st.at.x, ey = st.at.y;
              if (ev.result === 'hit') {
                g.lineStyle(2 / z, col, 1);
                this.starburst(g, ex, ey, 10 / z);
                g.strokeCircle(ex, ey, 5 / z);
                label('HIT', ex, ey + 26 / z);
              } else if (ev.result === 'miss') {
                g.lineStyle(2 / z, 0x9fb3c5, 1);
                g.lineBetween(ex - 7 / z, ey - 7 / z, ex + 7 / z, ey + 7 / z);
                g.lineBetween(ex - 7 / z, ey + 7 / z, ex + 7 / z, ey - 7 / z);
                label('MISS', ex, ey + 26 / z, '#9fb3c5');
              } else {
                g.lineStyle(1.5 / z, col, 0.9);
                g.strokeCircle(ex, ey, 7 / z);
                label('end of flight ?', ex, ey + 26 / z, '#e6edf3');
              }
              this.evHits.push({ x: ex, y: ey, ev });
            }
          } else {
            // no target chosen: arrow ahead of the nose at launch
            const ax = st.launch.x + Math.sin(h) * 40 / z, ay = st.launch.y - Math.cos(h) * 40 / z;
            g.lineStyle(1.5 / z, col, 0.8);
            g.lineBetween(st.launch.x, st.launch.y, ax, ay);
            g.fillStyle(col, 0.9);
            g.fillTriangle(ax + Math.sin(h) * 8 / z, ay - Math.cos(h) * 8 / z,
              ax + Math.cos(h) * 4 / z, ay + Math.sin(h) * 4 / z, ax - Math.cos(h) * 4 / z, ay - Math.sin(h) * 4 / z);
          }
        }
      }
    }

    drawAircraft() {
      const g = this.acG, z = this.cam.zoom;
      g.clear();
      const f = this.scrub || DL.cur();
      for (const id in f) {
        const s = f[id], ac = DL.tl.aircraft[id];
        const sel = id === DL.ui.selected;
        const acol = s.color || ac.color;
        if (this.scrub) {
          // faint symbol where the frame starts while the slider moves it along
          const s0 = DL.cur()[id];
          g.fillStyle(acol, 0.28);
          g.fillPoints(this.iconPoints(ac.type, s0.x, s0.y, s0.hdg, 0.7), true);
        }
        const pts = this.iconPoints(ac.type, s.x, s.y, s.hdg, 1);
        g.fillStyle(acol, 1);
        g.fillPoints(pts, true);
        g.lineStyle(1 / z, 0xffffff, sel ? 0.95 : 0.4);
        g.strokePoints(pts, true);
        if (sel) {
          g.lineStyle(1 / z, 0xffffff, 0.5);
          g.strokeCircle(s.x, s.y, 24 / z);
        }
        if (sel && DL.canEditPose(id) && !this.scrub) {
          const h = s.hdg * DL.D2R;
          const hx = s.x + Math.sin(h) * handlePx() / z, hy = s.y - Math.cos(h) * handlePx() / z;
          g.lineStyle(1.5 / z, 0xffd166, 0.9);
          g.lineBetween(s.x + Math.sin(h) * 20 / z, s.y - Math.cos(h) * 20 / z, hx, hy);
          g.fillStyle(0xffd166, 1);
          g.fillCircle(hx, hy, (touch() ? 9 : 5) / z);
        }
        if (DL.settings.showLabels) {
          const ti = DL.turnInfo(ac.type, s.spd, s.ctl, s.gam);
          const lines = [
            ac.callsign,
            fmt(s.spd) + ' kt  ' + String(Math.round(s.hdg)).padStart(3, '0') + '°  ' + (s.n != null ? s.n : ti.n).toFixed(1) + ' g',
          ];
          const gam = s.gam || 0;
          lines.push(fmt(s.alt || 0) + ' ft' + (Math.abs(gam) >= 0.5 ? '  ' + (gam > 0 ? '▲' : '▼') + Math.abs(gam).toFixed(0) + '°' : ''));
          if (ti.dir) lines.push('R ' + fmt(ti.radius) + ' ft  ' + Math.abs(ti.rateDps).toFixed(1) + '°/s');
          if (s.ctl.sb) lines.push('SPEEDBRAKE');
          const col = '#' + acol.toString(16).padStart(6, '0');
          this.text(lines.join('\n'), s.x + 22 / z, s.y - 26 / z, col, 11).setLineSpacing(1);
        }
      }
      // placement preview
      if (DL.ui.tool === 'place' && this.hover && !this.drag) {
        const pts = this.iconPoints(DL.ui.placeType, this.snap(this.hover.x), this.snap(this.hover.y), 0, 1);
        g.lineStyle(1.5 / z, 0xffffff, 0.6);
        g.strokePoints(pts, true);
      }
    }
  }

  DL.fmtFt = function (ft) {
    const a = Math.abs(ft);
    if (a >= 10000 && a % 1000 === 0) return (ft / 1000) + "k'";
    return fmt(ft) + "'";
  };

  DL.DebriefScene = DebriefScene;
})(window.DL);
