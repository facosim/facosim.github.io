// Phaser scene: the top-down map. World units are feet; symbols and labels
// are drawn at a fixed screen size by dividing by the camera zoom.
(function (FI) {
  'use strict';

  const NM = FI.NM, D2R = FI.D2R, clamp = FI.clamp;
  const MIN_ZOOM = 0.002, MAX_ZOOM = 0.5;
  // top-down outline of a light single, screen px at zoom 1 (from Combat Lines)
  const GA = [[0,-11],[2,-9],[2,-5],[13,-5],[13,-2],[2,-2],[1.5,7],[5,8],[5,10],[-5,10],[-5,8],[-1.5,7],[-2,-2],[-13,-2],[-13,-5],[-2,-5],[-2,-9]];
  const touch = () => !!(FI.ui && FI.ui.touch);

  class MapScene extends Phaser.Scene {
    constructor() { super('map'); }

    create() {
      FI.map = this;
      this.cam = this.cameras.main;
      this.cam.setBackgroundColor('#0a0e13');
      this.view = { x: 0, y: 0, w: this.scale.width, h: this.scale.height };
      this.cam.setZoom(FI.startZoom || 0.012);
      this.gridG = this.add.graphics().setDepth(0);
      this.navG = this.add.graphics().setDepth(1);
      this.trailG = this.add.graphics().setDepth(2);
      this.acG = this.add.graphics().setDepth(5);
      this.hudG = this.add.graphics().setDepth(7);
      this.textPool = []; this.textUsed = 0;
      this.follow = true;
      this.drag = null; this.pinch = null;

      this.input.mouse && this.input.mouse.disableContextMenu();
      this.input.on('pointerdown', this.onDown, this);
      this.input.on('pointermove', this.onMove, this);
      this.input.on('pointerup', this.onUp, this);
      this.input.on('pointerupoutside', this.onUp, this);
      this.input.on('wheel', this.onWheel, this);
      if (this.input.addPointer) this.input.addPointer(1);

      this.scene.launch('panel');
      this.scale.on('resize', () => this.layout());
      this.layout();
      this.centerOnAircraft();
      window.__instruments = { ok: true, scene: this };
    }

    // The map takes the canvas left of the panel (wide screens) or above it.
    layout() {
      const W = this.scale.width, H = this.scale.height;
      const L = FI.layout(W, H);
      this.view = L.map;
      this.cam.setViewport(L.map.x, L.map.y, L.map.w, L.map.h);
      const p = this.scene.get('panel');
      if (p && p.layout) p.layout(L.panel);
    }

    inView(p) {
      const v = this.view;
      return p.x >= v.x && p.x < v.x + v.w && p.y >= v.y && p.y < v.y + v.h;
    }

    // ---------- coordinates ----------
    toWorld(p) {
      const c = this.cam;
      return { x: c.scrollX + c.width / 2 + (p.x - c.x - c.width / 2) / c.zoom,
               y: c.scrollY + c.height / 2 + (p.y - c.y - c.height / 2) / c.zoom };
    }
    toScreen(w) {
      const c = this.cam;
      return { x: c.x + c.width / 2 + (w.x - c.scrollX - c.width / 2) * c.zoom,
               y: c.y + c.height / 2 + (w.y - c.scrollY - c.height / 2) * c.zoom };
    }
    centerOnAircraft() { this.cam.centerOn(FI.state.x, FI.state.y); }

    hitAircraft(w) {
      const s = FI.state, r = (touch() ? 30 : 18) / this.cam.zoom;
      return (s.x - w.x) ** 2 + (s.y - w.y) ** 2 <= r * r;
    }
    handlePos() {
      const s = FI.state, z = this.cam.zoom, h = s.hdg * D2R, d = (touch() ? 64 : 46) / z;
      return { x: s.x + Math.sin(h) * d, y: s.y - Math.cos(h) * d };
    }
    hitHandle(w) {
      const hp = this.handlePos(), r = (touch() ? 24 : 10) / this.cam.zoom;
      return (hp.x - w.x) ** 2 + (hp.y - w.y) ** 2 <= r * r;
    }

    // ---------- input ----------
    touchesDown() { return [this.input.pointer1, this.input.pointer2].filter(q => q && q.isDown); }
    startPinch() {
      const ps = this.touchesDown();
      if (ps.length < 2) return false;
      this.drag = null;
      const [a, b] = ps, mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.pinch = { d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), z0: this.cam.zoom, w: this.toWorld(mid) };
      return true;
    }
    movePinch() {
      const ps = this.touchesDown();
      if (ps.length < 2) return;
      const [a, b] = ps, pz = this.pinch, mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.cam.setZoom(clamp(pz.z0 * Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)) / pz.d0, MIN_ZOOM, MAX_ZOOM));
      const now = this.toWorld(mid);
      this.cam.scrollX += pz.w.x - now.x; this.cam.scrollY += pz.w.y - now.y;
      this.setFollow(false);
    }

    onDown(p) {
      if (!this.inView(p)) return;
      if (this.startPinch() || this.pinch) return;
      const w = this.toWorld(p);
      if (this.hitHandle(w)) this.drag = { kind: 'nose' };
      else if (this.hitAircraft(w)) this.drag = { kind: 'move', dx: FI.state.x - w.x, dy: FI.state.y - w.y };
      else this.drag = { kind: 'pan', sx: this.cam.scrollX, sy: this.cam.scrollY, px: p.x, py: p.y };
      document.body.classList.add('map-gesture');
    }
    onMove(p) {
      if (this.pinch) { this.movePinch(); return; }
      const d = this.drag;
      if (!d || !p.isDown) {
        if (this.inView(p)) {
          const w = this.toWorld(p);
          this.game.canvas.style.cursor = this.hitHandle(w) || this.hitAircraft(w) ? 'grab' : 'default';
        }
        return;
      }
      const w = this.toWorld(p);
      if (d.kind === 'pan') {
        this.cam.scrollX = d.sx - (p.x - d.px) / this.cam.zoom;
        this.cam.scrollY = d.sy - (p.y - d.py) / this.cam.zoom;
        this.setFollow(false);
      } else if (d.kind === 'move') {
        FI.place(w.x + d.dx, w.y + d.dy, null);
      } else if (d.kind === 'nose') {
        const s = FI.state;
        let h = Math.atan2(w.x - s.x, -(w.y - s.y)) / D2R;
        if (p.event && p.event.shiftKey) h = Math.round(h / 15) * 15;
        FI.place(null, null, h);
      }
      FI.ui && FI.ui.refresh();
    }
    onUp() {
      if (this.pinch && !this.touchesDown().length) this.pinch = null;
      this.drag = null;
      document.body.classList.remove('map-gesture');
    }
    onWheel(p, over, dx, dy) {
      if (!this.inView(p)) return;
      const ev = p.event || {};
      this.zoomAt(p, Math.exp(-dy * (ev.ctrlKey ? 0.01 : 0.0015)));
      if (ev.preventDefault) ev.preventDefault();
    }
    zoomAt(p, k) {
      const before = this.toWorld(p);
      this.cam.setZoom(clamp(this.cam.zoom * k, MIN_ZOOM, MAX_ZOOM));
      const after = this.toWorld(p);
      if (!this.follow) { this.cam.scrollX += before.x - after.x; this.cam.scrollY += before.y - after.y; }
    }
    zoomCenter(k) { this.zoomAt({ x: this.cam.x + this.cam.width / 2, y: this.cam.y + this.cam.height / 2 }, k); }
    setFollow(on) { this.follow = on; FI.ui && FI.ui.refresh(); }

    // Frame the aircraft, the home airport and the stations it is tuned to.
    fit() {
      const s = FI.state, n = FI.navOut, pts = [[s.x, s.y], [FI.home.apt.x, FI.home.apt.y]];
      if (n && n.station) pts.push([n.station.x, n.station.y]);
      if (n && n.loc) pts.push([n.loc.thr.x - Math.sin(n.loc.course * D2R) * 12 * NM, n.loc.thr.y + Math.cos(n.loc.course * D2R) * 12 * NM]);
      if (n && n.adf.valid) pts.push([n.adf.st.x, n.adf.st.y]);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      const pad = 2.5 * NM;
      x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
      const z = clamp(Math.min(this.cam.width / (x1 - x0), this.cam.height / (y1 - y0)), MIN_ZOOM, MAX_ZOOM);
      this.cam.setZoom(z);
      this.cam.centerOn((x0 + x1) / 2, (y0 + y1) / 2);
      this.setFollow(false);
    }

    // ---------- drawing ----------
    text(str, x, y, color, size, ox, oy, rot) {
      let t = this.textPool[this.textUsed];
      if (!t) {
        t = this.add.text(0, 0, '', { fontFamily: 'Menlo, Consolas, monospace', fontSize: '11px', color: '#ffffff' }).setDepth(8);
        this.textPool.push(t);
      }
      this.textUsed++;
      t.setVisible(true).setText(str).setPosition(x, y).setOrigin(ox == null ? 0.5 : ox, oy == null ? 0.5 : oy);
      t.setScale(1 / this.cam.zoom).setRotation(rot || 0);
      t.setColor(color || '#c9d4df');
      t.setFontSize(size || 11);
      return t;
    }
    endText() { for (let i = this.textUsed; i < this.textPool.length; i++) this.textPool[i].setVisible(false); this.textUsed = 0; }

    update(time, delta) {
      FI.advance(delta);
      if (this.follow) this.centerOnAircraft();
      const z = this.cam.zoom, c = this.cam;
      const tl = this.toWorld({ x: c.x, y: c.y }), br = this.toWorld({ x: c.x + c.width, y: c.y + c.height });
      const v = { x0: tl.x, y0: tl.y, x1: br.x, y1: br.y };
      this.drawGrid(v, z);
      this.drawNav(v, z);
      this.drawAircraft(z);
      this.drawHud(v, z);
      this.endText();
      FI.ui && FI.ui.tick();
    }

    // 1 nm grid. Lines thin out when the squares get small.
    drawGrid(v, z) {
      const g = this.gridG; g.clear();
      let step = NM;
      while (step * z < 40) step *= 2;
      const dim = clamp((step * z - 40) / 80, 0, 1);
      g.lineStyle(1 / z, 0x1b2733, 0.6 + 0.4 * dim);
      const x0 = Math.floor(v.x0 / step) * step, y0 = Math.floor(v.y0 / step) * step;
      for (let x = x0; x <= v.x1; x += step) g.lineBetween(x, v.y0, x, v.y1);
      for (let y = y0; y <= v.y1; y += step) g.lineBetween(v.x0, y, v.x1, y);
      // nm labels down the left edge and along the bottom
      if (step * z >= 50) {
        for (let x = x0; x <= v.x1; x += step) {
          const nm = Math.round(x / NM); if (!nm) continue;
          this.text(`${nm > 0 ? 'E' : 'W'} ${Math.abs(nm)}`, x, v.y1 - 4 / z, '#3a4d62', 10, 0.5, 1);
        }
        for (let y = y0; y <= v.y1; y += step) {
          const nm = Math.round(y / NM); if (!nm) continue;
          this.text(`${nm > 0 ? 'S' : 'N'} ${Math.abs(nm)}`, v.x0 + 4 / z, y, '#3a4d62', 10, 0, 0.5);
        }
      }
    }

    // Airports and runways, localizer feathers, navaids with chart-style
    // symbols, and for the tuned station its compass rose (turned to its
    // magnetic north), the selected course and the radial you are on.
    drawNav(v, z) {
      const g = this.navG; g.clear();
      const nv = FI.nav, n = FI.navOut, s0 = FI.state;
      const m = 30 / z, inV = (x, y, r) => x > v.x0 - m - (r || 0) && x < v.x1 + m + (r || 0) && y > v.y0 - m - (r || 0) && y < v.y1 + m + (r || 0);
      const pxNm = NM * z, labels = pxNm >= 7;
      const tuned = n && n.station, tunedLoc = n && n.loc;

      // --- runways ---
      for (const a of FI.airports) {
        if (!inV(a.x, a.y, 3 * NM)) continue;
        for (const r of a.runways) {
          const dx = r.b.x - r.a.x, dy = r.b.y - r.a.y, L = Math.hypot(dx, dy) || 1, hw = Math.max(r.width, 4 / z) / 2;
          const nx = -dy / L * hw, ny = dx / L * hw;
          g.fillStyle(0x6a7684, 1);
          g.fillPoints([{ x: r.a.x + nx, y: r.a.y + ny }, { x: r.b.x + nx, y: r.b.y + ny }, { x: r.b.x - nx, y: r.b.y - ny }, { x: r.a.x - nx, y: r.a.y - ny }], true);
          if (pxNm > 150) {
            this.text(r.ends[0], r.a.x - dx / L * 14 / z, r.a.y - dy / L * 14 / z, '#8fb3d1', 10);
            if (r.ends[1]) this.text(r.ends[1], r.b.x + dx / L * 14 / z, r.b.y + dy / L * 14 / z, '#8fb3d1', 10);
          }
        }
        if (labels) this.text(a.code, a.x, a.y + 14 / z, a === FI.home.apt ? '#e6f1ff' : '#8fb3d1', a === FI.home.apt ? 12 : 10, 0.5, 0);
      }

      // --- localizer feathers ---
      for (const L of FI.ilsList) {
        const act = L === tunedLoc;
        if (!act && (!labels || Math.hypot(L.thr.x - s0.x, L.thr.y - s0.y) > 60 * NM)) continue;
        const c = L.course * D2R, dx = Math.sin(c), dy = -Math.cos(c), rx = Math.cos(c), ry = Math.sin(c);
        const fl = (act ? 18 : 10) * NM, half = Math.tan(L.locFull * D2R) * fl;
        const tip = { x: L.loc.x - dx * fl, y: L.loc.y - dy * fl };
        if (!inV(L.loc.x, L.loc.y, fl)) continue;
        const pts = [{ x: L.loc.x, y: L.loc.y }, { x: tip.x + rx * half, y: tip.y + ry * half }, { x: tip.x - rx * half, y: tip.y - ry * half }];
        g.lineStyle((act ? 1.5 : 1) / z, act ? 0x4da3ff : 0x3a5470, act ? 0.9 : 0.7);
        g.strokePoints(pts, true);
        if (act) {
          g.fillStyle(0x4da3ff, 0.15); g.fillPoints(pts, true);
          g.lineStyle(1 / z, 0x4da3ff, 0.9);
          this.dashed(g, L.thr.x, L.thr.y, tip.x, tip.y, 18 / z, 10 / z);
          // glideslope check altitudes every 2 nm from the threshold
          if (L.hasGs) {
            for (let d = 2; d <= 10; d += 2) {
              const x = L.thr.x - dx * d * NM, y = L.thr.y - dy * d * NM;
              const gd = Math.hypot(x - L.gs.x, y - L.gs.y), alt = Math.round((L.elev + gd * Math.tan(L.gsAngle * D2R)) / 10) * 10;
              g.lineBetween(x - rx * 6 / z, y - ry * 6 / z, x + rx * 6 / z, y + ry * 6 / z);
              this.text(`${d} nm\n${alt.toLocaleString('en-US')} ft`, x + rx * 10 / z, y + ry * 10 / z, '#4da3ff', 10, 0, 0.5);
            }
          }
          g.fillStyle(0xe6f1ff, 1);
          g.fillCircle(L.loc.x, L.loc.y, 2.5 / z);
          this.text('LOC', L.loc.x + dx * 10 / z, L.loc.y + dy * 10 / z, '#8fb3d1', 10);
          if (L.gs) { g.fillCircle(L.gs.x, L.gs.y, 2.5 / z); this.text('GS', L.gs.x + rx * 12 / z, L.gs.y + ry * 12 / z, '#8fb3d1', 10); }
          this.text(`${L.apt.code} ${L.name}\n${L.id} ${FI.fmtMhz(L.mhz)}  ${FI.pad3(L.crsM)}°`, tip.x, tip.y - 8 / z, '#e6f1ff', 11, 0.5, 1);
        } else if (pxNm >= 25) this.text(`${L.id} ${FI.fmtMhz(L.mhz)}`, tip.x, tip.y, '#3a5470', 10);
      }

      // --- navaids ---
      for (const st of FI.stations) {
        if (!inV(st.x, st.y)) continue;
        const on = st === tuned || (n.adf.valid && st === n.adf.st);
        this.symbol(g, st, z, on);
        if (labels || on) {
          const f = st.ndb ? `${st.khz}` : st.vor ? FI.fmtMhz(st.mhz) : `${FI.fmtMhz(st.mhz)} ${st.chan}`;
          const ch = st.tacan && st.vor ? ` ${st.chan}` : '';
          this.text(`${st.id} ${f}${ch}`, st.x, st.y + 13 / z, on ? '#e6f1ff' : st.ndb ? '#b98ac9' : '#8fb3d1', on ? 11 : 10, 0.5, 0);
        }
      }

      // --- the tuned VOR or TACAN: rose, range, selected course, current radial ---
      if (tuned && (n.kind === 'VOR' || n.kind === 'TACAN')) {
        const V = tuned, rr = 70 / z, vr = V.varE;
        g.lineStyle(1.5 / z, 0x8fb3d1, 0.9);
        g.strokeCircle(V.x, V.y, rr);
        for (let a = 0; a < 360; a += 10) {
          const t = (a + vr) * D2R, s = Math.sin(t), c = Math.cos(t), len = a % 30 ? 5 / z : 10 / z;
          g.lineBetween(V.x + s * rr, V.y - c * rr, V.x + s * (rr - len), V.y - c * (rr - len));
          if (a % 30 === 0) this.text(FI.pad3(a), V.x + s * (rr + 11 / z), V.y - c * (rr + 11 / z), '#8fb3d1', 10);
        }
        const R = FI.vhfRange(V.vorCls || V.dmeCls, FI.state.alt - V.elev) * NM;
        g.lineStyle(1 / z, 0x233244, 1); g.strokeCircle(V.x, V.y, R);
        const a = (nv.obs + vr) * D2R, s = Math.sin(a), c = Math.cos(a);
        g.lineStyle(1.5 / z, 0x4da3ff, 0.9);
        this.dashed(g, V.x - s * R, V.y + c * R, V.x + s * R, V.y - c * R, 18 / z, 10 / z);
        this.text(`R-${FI.pad3(nv.obs)}`, V.x + s * (rr + 46 / z), V.y - c * (rr + 46 / z), '#4da3ff', 11);
        this.text(`R-${FI.pad3(nv.obs + 180)}`, V.x - s * (rr + 46 / z), V.y + c * (rr + 46 / z), '#4da3ff', 11);
        if (n.radial != null) {
          const ra = (n.radial + vr) * D2R;
          g.lineStyle(1 / z, 0xffb547, 0.5);
          g.lineBetween(V.x, V.y, V.x + Math.sin(ra) * n.dist * NM, V.y - Math.cos(ra) * n.dist * NM);
        }
      }
      // the ADF bearing: a thin line from the aircraft to the NDB
      if (n.adf.valid) {
        g.lineStyle(1 / z, 0xb98ac9, 0.7);
        this.dashed(g, s0.x, s0.y, n.adf.st.x, n.adf.st.y, 8 / z, 6 / z);
      }
    }

    // Chart-style navaid symbols at a fixed screen size.
    symbol(g, st, z, on) {
      const k = 1 / z, x = st.x, y = st.y, col = on ? 0xe6f1ff : st.ndb ? 0xb98ac9 : 0x8fb3d1;
      g.lineStyle(1.5 * k, col, 1); g.fillStyle(col, 1);
      if (st.ndb) {
        for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; g.fillCircle(x + Math.cos(a) * 9 * k, y + Math.sin(a) * 9 * k, 0.9 * k); }
        for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 + 0.3; g.fillCircle(x + Math.cos(a) * 5.5 * k, y + Math.sin(a) * 5.5 * k, 0.8 * k); }
        g.fillCircle(x, y, 2 * k);
        if (st.dme) g.strokeRect(x - 11 * k, y - 11 * k, 22 * k, 22 * k);
        return;
      }
      const hex = []; for (let i = 0; i < 6; i++) hex.push({ x: x + Math.cos(i * Math.PI / 3) * 7 * k, y: y + Math.sin(i * Math.PI / 3) * 7 * k });
      if (st.vor) { g.strokePoints(hex, true); g.fillCircle(x, y, 1.5 * k); }
      if (st.tacan) {
        // three blocks on alternate sides of the hexagon
        for (const i of [0, 2, 4]) {
          const a = hex[i], b = hex[(i + 1) % 6], mx = (a.x + b.x) / 2 - x, my = (a.y + b.y) / 2 - y, L = Math.hypot(mx, my), ox = mx / L * 4 * k, oy = my / L * 4 * k;
          g.fillPoints([a, b, { x: b.x + ox, y: b.y + oy }, { x: a.x + ox, y: a.y + oy }], true);
        }
        if (!st.vor) g.strokePoints(hex, true);
      } else if (st.dme) g.strokeRect(x - 9 * k, y - 9 * k, 18 * k, 18 * k);
      if (!st.vor && !st.tacan) g.fillCircle(x, y, 1.5 * k);
    }

    dashed(g, x0, y0, x1, y1, on, off) {
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
      if (!L) return;
      const ux = dx / L, uy = dy / L;
      for (let t = 0; t < L; t += on + off) {
        const e = Math.min(L, t + on);
        g.lineBetween(x0 + ux * t, y0 + uy * t, x0 + ux * e, y0 + uy * e);
      }
    }

    drawAircraft(z) {
      const s = FI.state, g = this.acG, tg = this.trailG;
      tg.clear(); g.clear();
      // trail
      const tr = FI.trail;
      if (tr.length > 1) {
        tg.lineStyle(1.5 / z, 0xffd166, 0.7);
        tg.strokePoints(tr.concat([{ x: s.x, y: s.y }]));
      }
      // track line (dashed) and heading line
      const L = 70 / z, t = s.trk * D2R, h = s.hdg * D2R;
      if (FI.wind.kt > 0) {
        g.lineStyle(1.5 / z, 0x4da3ff, 0.9);
        this.dashed(g, s.x, s.y, s.x + Math.sin(t) * L * 1.3, s.y - Math.cos(t) * L * 1.3, 6 / z, 4 / z);
      }
      g.lineStyle(1.5 / z, 0xffd166, 0.9);
      g.lineBetween(s.x, s.y, s.x + Math.sin(h) * L, s.y - Math.cos(h) * L);
      // nose handle
      const hp = this.handlePos();
      g.fillStyle(0xffd166, 1); g.fillCircle(hp.x, hp.y, (touch() ? 9 : 5) / z);
      // symbol
      const k = 1.1 / z, pts = GA.map(([px, py]) => ({ x: s.x + (px * Math.cos(h) - py * Math.sin(h)) * k, y: s.y + (px * Math.sin(h) + py * Math.cos(h)) * k }));
      g.fillStyle(0xffd166, 1); g.fillPoints(pts, true);
      g.lineStyle(1 / z, 0x0a0e13, 1); g.strokePoints(pts, true);
      // data block
      this.text(`${FI.pad3(FI.toMag(s.hdg))}° ${Math.round(s.ias)} kt\n${Math.round(s.alt).toLocaleString('en-US')} ft`, s.x + 22 / z, s.y + 14 / z, '#e6edf3', 11, 0, 0);
    }

    // wind arrow in the top-left corner of the map
    drawHud(v, z) {
      const g = this.hudG; g.clear();
      const w = FI.wind;
      const cx = v.x0 + 46 / z, cy = v.y0 + 46 / z;
      g.lineStyle(1 / z, 0x3a5470, 1); g.strokeCircle(cx, cy, 26 / z);
      if (w.kt > 0) {
        const a = (w.dir + 180) * D2R, s = Math.sin(a), c = Math.cos(a), r = 22 / z;
        g.lineStyle(2 / z, 0x4da3ff, 1);
        g.lineBetween(cx - s * r, cy + c * r, cx + s * r, cy - c * r);
        const tx = cx + s * r, ty = cy - c * r, b = 7 / z;
        g.fillStyle(0x4da3ff, 1);
        g.fillPoints([{ x: tx, y: ty }, { x: tx - s * b * 1.6 + c * b * 0.6, y: ty + c * b * 1.6 + s * b * 0.6 }, { x: tx - s * b * 1.6 - c * b * 0.6, y: ty + c * b * 1.6 - s * b * 0.6 }], true);
        this.text(`Wind ${FI.pad3(w.dir)}/${Math.round(w.kt)}`, cx, cy + 34 / z, '#4da3ff', 10, 0.5, 0);
      } else this.text('Calm', cx, cy + 34 / z, '#7d8a96', 10, 0.5, 0);
    }
  }

  FI.MapScene = MapScene;
})(window.FI);
