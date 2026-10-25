// The glass cockpit: a G1000-style primary flight display drawn from the
// same state as the six-pack. Built inside the panel scene at the same
// 900 x 900 design size, so the panel's layout scales both the same way.
// Everything that moves is redrawn every frame with plain Graphics and a
// small pool of text objects, clipped by hand (no masks), so nothing spills
// outside the screen when the panel is letterboxed.
(function (FI) {
  'use strict';

  const D2R = FI.D2R, clamp = FI.clamp;
  const W = 900, H = 900;
  const TOP = 44, BOT = 856;               // nav/AFCS bar above, data bar below
  const CX = 450, CY = 290;                // attitude center (the aircraft symbol)
  const PPD = 9;                           // pitch ladder, px per degree
  const MONO = 'Menlo, Consolas, monospace';
  const SANS = 'Arial, Helvetica, sans-serif';
  const WHITE = 0xffffff, CYAN = 0x00e5ff, GREEN = 0x26e05a, MAGENTA = 0xff3cf0, YELLOW = 0xffd400, BLACK = 0x000000;
  const SKY = 0x2b6fd6, GROUND = 0x7a4b1e;
  const C = { white: '#ffffff', cyan: '#00e5ff', green: '#26e05a', magenta: '#ff3cf0', yellow: '#ffd400', dim: '#9aa6b2', red: '#ff3b30' };

  // tapes
  const TAPE_T = CY - 200, TAPE_B = CY + 200;
  const ASI = { x0: 70, x1: 180, ppk: 4.4 };          // px per knot
  const ALT = { x0: 700, x1: 810, ppf: 0.44 };        // px per foot
  const VSI = { x0: 816, x1: 862, half: 150 };        // ±2000 fpm over ±half px
  // HSI
  const HX = 450, HY = 700, HR = 148;
  const DOT = 30;                                      // HSI and glideslope dot spacing

  const px = (r, a) => r * Math.sin(a * D2R), py = (r, a) => -r * Math.cos(a * D2R);
  const pad3 = FI.pad3 || (v => String(Math.round(FI.norm360(v)) % 360 || 360).padStart(3, '0'));

  // Clip polygon `pts` to the half plane f(p) >= 0, f linear.
  function clipHalf(pts, f) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], fa = f(a), fb = f(b);
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); }
    }
    return out;
  }
  // Liang-Barsky: clip a segment to a rectangle.
  function clipSeg(x0, y0, x1, y1, r) {
    let t0 = 0, t1 = 1;
    const dx = x1 - x0, dy = y1 - y0;
    for (const [p, q] of [[-dx, x0 - r.x0], [dx, r.x1 - x0], [-dy, y0 - r.y0], [dy, r.y1 - y0]]) {
      if (p === 0) { if (q < 0) return null; continue; }
      const t = q / p;
      if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
    }
    return [x0 + dx * t0, y0 + dy * t0, x0 + dx * t1, y0 + dy * t1];
  }

  FI.Glass = function (scene) {
    const root = scene.add.container(0, 0);
    const add = o => (root.add(o), o);
    const gfx = () => add(scene.add.graphics());
    const txt = (str, x, y, size, color, font, ox, oy) => add(scene.add.text(x, y, str,
      { fontFamily: font || SANS, fontSize: `${size}px`, color: color || C.white, fontStyle: 'bold' })
      .setOrigin(ox == null ? 0.5 : ox, oy == null ? 0.5 : oy));
    const pool = (n, size, color, ox) => Array.from({ length: n }, () => txt('', 0, 0, size, color, SANS, ox, 0.5));
    const SCREEN = { x0: 0, x1: W, y0: TOP, y1: BOT };

    // ---------- layers, back to front ----------
    const att = gfx();                                   // sky, ground, horizon, ladder
    const ladderTxt = pool(12, 15, C.white);
    const attFixed = gfx();                              // roll scale, aircraft symbol
    const rollPtr = gfx();
    const boxes = gfx();                                 // tape backgrounds
    const tapes = gfx();
    const asiTxt = pool(12, 19, C.white, 1);
    const altTxt = pool(12, 19, C.white, 1);
    const tapeFix = gfx();                               // value boxes on top of the tapes
    const vsiTxt = [];
    const hsi = gfx();
    const hsiTxt = pool(12, 17, C.white);
    const hsiFix = gfx();
    const frame = gfx();                                 // top and bottom bars

    // ---------- static: roll scale and aircraft symbol ----------
    {
      const g = attFixed, r = 190;
      g.lineStyle(2.5, WHITE, 1);
      g.beginPath(); g.arc(CX, CY, r, (-60 - 90) * D2R, (60 - 90) * D2R, false); g.strokePath();
      for (const a of [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60]) {
        const len = a % 30 === 0 ? 20 : 11;
        g.lineBetween(CX + px(r, a), CY + py(r, a), CX + px(r + len, a), CY + py(r + len, a));
      }
      // zero: an inverted triangle above the arc
      g.fillStyle(WHITE, 1); g.fillTriangle(CX, CY - r - 1, CX - 10, CY - r - 18, CX + 10, CY - r - 18);
      // single-cue aircraft symbol: a yellow inverted V with a black outline, and wing bars
      const sym = [{ x: 0, y: 0 }, { x: -110, y: 38 }, { x: -70, y: 38 }, { x: 0, y: 14 }, { x: 70, y: 38 }, { x: 110, y: 38 }];
      g.fillStyle(YELLOW, 1); g.lineStyle(2, BLACK, 1);
      const L = [sym[0], sym[1], sym[2], sym[3]].map(p => ({ x: CX + p.x, y: CY + p.y }));
      const R = [sym[0], sym[3], sym[4], sym[5]].map(p => ({ x: CX + p.x, y: CY + p.y }));
      g.fillPoints(L, true); g.strokePoints(L, true); g.fillPoints(R, true); g.strokePoints(R, true);
      for (const s of [-1, 1]) { g.fillRect(CX + s * 150 - (s < 0 ? 40 : 0), CY - 4, 40, 8); g.strokeRect(CX + s * 150 - (s < 0 ? 40 : 0), CY - 4, 40, 8); }
    }

    // ---------- static: tape backgrounds and labels ----------
    boxes.fillStyle(BLACK, 0.42);
    boxes.fillRect(ASI.x0, TAPE_T, ASI.x1 - ASI.x0, TAPE_B - TAPE_T);
    boxes.fillRect(ALT.x0, TAPE_T, ALT.x1 - ALT.x0, TAPE_B - TAPE_T);
    boxes.fillRect(VSI.x0, CY - VSI.half - 10, VSI.x1 - VSI.x0, 2 * VSI.half + 20);
    // TAS under the airspeed tape, baro and selected altitude around the altitude tape
    boxes.fillStyle(BLACK, 0.85);
    boxes.fillRect(ASI.x0, TAPE_B, ASI.x1 - ASI.x0, 30);
    boxes.fillRect(ALT.x0, TAPE_T - 34, ALT.x1 - ALT.x0, 34);
    boxes.fillRect(ALT.x0, TAPE_B, ALT.x1 - ALT.x0, 30);
    boxes.lineStyle(1.5, 0x8899aa, 1);
    boxes.strokeRect(ASI.x0, TAPE_B, ASI.x1 - ASI.x0, 30);
    boxes.strokeRect(ALT.x0, TAPE_T - 34, ALT.x1 - ALT.x0, 34);
    boxes.strokeRect(ALT.x0, TAPE_B, ALT.x1 - ALT.x0, 30);
    txt('TAS', ASI.x0 + 8, TAPE_B + 15, 14, C.white, SANS, 0, 0.5);
    const tasTxt = txt('', ASI.x1 - 8, TAPE_B + 15, 16, C.white, SANS, 1, 0.5);
    const selAltTxt = txt('', (ALT.x0 + ALT.x1) / 2, TAPE_T - 17, 19, C.cyan);
    txt('29.92IN', (ALT.x0 + ALT.x1) / 2, TAPE_B + 15, 16, C.cyan);
    // VSI scale
    for (const v of [-2000, -1000, 1000, 2000]) vsiTxt.push(txt(String(Math.abs(v) / 1000), VSI.x0 + 22, CY - v / 2000 * VSI.half, 14, C.white, SANS, 0, 0.5));
    boxes.lineStyle(2, WHITE, 1);
    for (let v = -2000; v <= 2000; v += 500) {
      const y = CY - v / 2000 * VSI.half, len = v % 1000 ? 6 : 12;
      boxes.lineBetween(VSI.x0, y, VSI.x0 + len, y);
    }

    // current value boxes: drawn once, text updated every frame
    {
      const g = tapeFix; g.fillStyle(BLACK, 1); g.lineStyle(2, WHITE, 1);
      const a = [{ x: ASI.x0 + 4, y: CY - 22 }, { x: ASI.x1 - 14, y: CY - 22 }, { x: ASI.x1 - 14, y: CY - 10 }, { x: ASI.x1 - 2, y: CY },
        { x: ASI.x1 - 14, y: CY + 10 }, { x: ASI.x1 - 14, y: CY + 22 }, { x: ASI.x0 + 4, y: CY + 22 }];
      g.fillPoints(a, true); g.strokePoints(a, true);
      const b = [{ x: ALT.x0 + 2, y: CY }, { x: ALT.x0 + 14, y: CY - 10 }, { x: ALT.x0 + 14, y: CY - 22 }, { x: ALT.x1 + 2, y: CY - 22 },
        { x: ALT.x1 + 2, y: CY + 22 }, { x: ALT.x0 + 14, y: CY + 22 }, { x: ALT.x0 + 14, y: CY + 10 }];
      g.fillPoints(b, true); g.strokePoints(b, true);
    }
    const iasTxt = txt('', ASI.x1 - 18, CY, 28, C.white, SANS, 1, 0.5);
    const altValTxt = txt('', ALT.x1 - 2, CY, 26, C.white, SANS, 1, 0.5);
    const vsVal = gfx();
    const vsValTxt = txt('', VSI.x1 - 2, 0, 13, C.white, SANS, 1, 0.5);
    // glideslope scale, left of the altitude tape
    const gs = gfx();
    const gsLbl = txt('G', ALT.x0 - 18, CY - 2 * DOT - 22, 16, C.green);

    // ---------- HSI ----------
    const navLbl = txt('', HX - 70, HY - 40, 16, C.green);
    const hdgBoxTxt = txt('', HX, HY - HR - 26, 22, C.white);
    const hdgSel = txt('', HX - HR - 30, HY - HR + 4, 17, C.cyan, SANS, 1, 0.5);
    const crsSel = txt('', HX + HR + 30, HY - HR + 4, 17, C.green, SANS, 0, 0.5);
    const navFlag = txt('', HX + 60, HY - 40, 15, C.red);
    const toFromTxt = txt('', HX + 62, HY + 40, 14, C.green);
    {
      const g = hsiFix;
      // lubber and heading box
      g.fillStyle(BLACK, 1); g.lineStyle(2, WHITE, 1);
      g.fillRect(HX - 40, HY - HR - 44, 80, 34); g.strokeRect(HX - 40, HY - HR - 44, 80, 34);
      g.fillStyle(WHITE, 1); g.fillTriangle(HX, HY - HR + 2, HX - 8, HY - HR - 10, HX + 8, HY - HR - 10);
      // fixed 45° marks outside the rose
      g.lineStyle(3, WHITE, 1);
      for (const a of [45, 90, 135, 180, 225, 270, 315]) g.lineBetween(HX + px(HR + 4, a), HY + py(HR + 4, a), HX + px(HR + 16, a), HY + py(HR + 16, a));
      // aircraft symbol
      g.fillStyle(WHITE, 1);
      g.fillRect(HX - 3, HY - 22, 6, 40); g.fillRect(HX - 24, HY - 6, 48, 6); g.fillRect(HX - 10, HY + 14, 20, 4);
      // standard-rate marks on the turn rate arc: 6 s ahead at 1.5°/s and 3°/s
      g.lineStyle(2, WHITE, 1);
      for (const a of [-18, -9, 9, 18]) g.lineBetween(HX + px(HR + 2, a), HY + py(HR + 2, a), HX + px(HR + 12, a), HY + py(HR + 12, a));
    }
    // side boxes: wind on the left, DME on the right
    const side = gfx();
    side.fillStyle(BLACK, 0.8); side.lineStyle(1.5, 0x8899aa, 1);
    side.fillRect(20, 726, 150, 116); side.strokeRect(20, 726, 150, 116);
    side.fillRect(730, 726, 150, 116); side.strokeRect(730, 726, 150, 116);
    const windArrow = gfx();
    const windTxt = txt('', 95, 822, 16, C.white);
    txt('WIND', 95, 740, 13, C.dim);
    const dmeHdr = txt('', 805, 742, 14, C.green);
    const dmeTxt = txt('', 805, 772, 22, C.white);
    const radTxt = txt('', 805, 808, 15, C.white);
    // BRG1 box above the wind box
    side.fillRect(20, 610, 150, 100); side.strokeRect(20, 610, 150, 100);
    const brgHdr = txt('', 95, 626, 13, C.cyan);
    const brgId = txt('', 95, 656, 15, C.white);
    const brgTxt = txt('', 95, 688, 20, C.cyan);

    // ---------- frame: top bar and bottom bar ----------
    {
      const g = frame;
      g.fillStyle(0x05070a, 1);
      g.fillRect(0, 0, W, TOP); g.fillRect(0, BOT, W, H - BOT);
      g.lineStyle(1.5, 0x56636f, 1);
      g.lineBetween(0, TOP, W, TOP); g.lineBetween(0, BOT, W, BOT);
      g.lineBetween(250, 4, 250, TOP - 4); g.lineBetween(650, 4, 650, TOP - 4);
      g.lineStyle(3, 0x30363d, 1); g.strokeRect(1.5, 1.5, W - 3, H - 3);
    }
    const nav1 = txt('', 12, 14, 14, C.white, MONO, 0, 0.5);
    const nav2 = txt('', 12, 32, 14, C.white, MONO, 0, 0.5);
    const apLbl = txt('', 450, TOP / 2, 18, C.green);
    const latTxt = txt('', 300, TOP / 2, 18, C.green);
    const armTxt = txt('', 380, TOP / 2, 15, C.white);
    const vertTxt = txt('', 600, TOP / 2, 18, C.green);
    const vArmTxt = txt('', 530, TOP / 2, 15, C.white);
    const topRight = txt('', W - 12, TOP / 2, 15, C.white, MONO, 1, 0.5);
    const bottom = txt('', W / 2, (BOT + H) / 2, 15, C.white, MONO);

    // trend vectors need rates of change; smooth them over about a second
    const trend = { ias: 0, alt: 0, lastIas: null, lastAlt: null, lastT: null };

    // ---------- per frame ----------
    function update() {
      const s = FI.state, n = FI.navOut, nv = FI.nav, ap = FI.ap, sc = FI.scn;
      if (!n) return;
      const run = sc && !sc.off && !sc.done ? sc.step : null;

      // rates for the trend vectors (6 seconds ahead, like the G1000)
      if (trend.lastT != null && s.t > trend.lastT) {
        const dt = s.t - trend.lastT, k = Math.min(1, dt / 1);
        trend.ias += ((s.ias - trend.lastIas) / dt - trend.ias) * k;
        trend.alt += ((s.alt - trend.lastAlt) / dt - trend.alt) * k;
      } else if (trend.lastT != null && s.t < trend.lastT) { trend.ias = trend.alt = 0; }
      trend.lastT = s.t; trend.lastIas = s.ias; trend.lastAlt = s.alt;

      // ----- attitude -----
      const r = -s.bank * D2R, cr = Math.cos(r), sr = Math.sin(r);
      const toS = (x, y) => ({ x: CX + x * cr - y * sr, y: CY + x * sr + y * cr });
      const toB = p => { const x = p.x - CX, y = p.y - CY; return { x: x * cr + y * sr, y: -x * sr + y * cr }; };
      const off = clamp(s.pitch, -40, 40) * PPD;
      const rect = [{ x: 0, y: TOP }, { x: W, y: TOP }, { x: W, y: BOT }, { x: 0, y: BOT }];
      const above = p => off - toB(p).y, below = p => toB(p).y - off;
      const g = att; g.clear();
      const sky = clipHalf(rect, above), gnd = clipHalf(rect, below);
      if (sky.length > 2) { g.fillStyle(SKY, 1); g.fillPoints(sky, true); }
      if (gnd.length > 2) { g.fillStyle(GROUND, 1); g.fillPoints(gnd, true); }
      const a0 = toS(-2000, off), a1 = toS(2000, off), hz = clipSeg(a0.x, a0.y, a1.x, a1.y, SCREEN);
      if (hz) { g.lineStyle(2.5, WHITE, 1); g.lineBetween(hz[0], hz[1], hz[2], hz[3]); }
      // ladder: every 2.5° near the nose, shown within about 20° of it
      let li = 0;
      g.lineStyle(2, WHITE, 1);
      for (let p = -50; p <= 50; p += 2.5) {
        if (!p) continue;
        const y = off - p * PPD;
        if (Math.abs(y) > 150) continue;
        const half = p % 10 === 0 ? 60 : p % 5 === 0 ? 30 : 14;
        const e0 = toS(-half, y), e1 = toS(half, y);
        g.lineBetween(e0.x, e0.y, e1.x, e1.y);
        if (p % 10 === 0) for (const sx of [-1, 1]) {
          const t = ladderTxt[li++]; if (!t) continue;
          const q = toS(sx * (half + 20), y);
          t.setText(String(Math.abs(p))).setPosition(q.x, q.y).setRotation(r).setVisible(true);
        }
      }
      while (li < ladderTxt.length) ladderTxt[li++].setVisible(false);
      // roll pointer and slip/skid bar (always centered: the model flies coordinated)
      const rp = rollPtr; rp.clear();
      const tri = [toS(0, -189), toS(-10, -171), toS(10, -171)];
      rp.fillStyle(WHITE, 1); rp.fillPoints(tri, true);
      const sl = [toS(-12, -166), toS(12, -166), toS(14, -160), toS(-14, -160)];
      rp.fillPoints(sl, true);

      // ----- airspeed tape -----
      const t = tapes; t.clear();
      const A = FI.AC, yI = v => CY - (v - s.ias) * ASI.ppk;
      const inTape = y => y > TAPE_T + 2 && y < TAPE_B - 2;
      const band = (v0, v1, x, w, color) => {
        const y0 = clamp(yI(v1), TAPE_T, TAPE_B), y1 = clamp(yI(v0), TAPE_T, TAPE_B);
        if (y1 > y0) { t.fillStyle(color, 1); t.fillRect(x, y0, w, y1 - y0); }
      };
      band(0, A.vS0, ASI.x1 - 8, 8, 0xe53935);
      band(A.vS0, A.vFe, ASI.x1 - 14, 5, WHITE);
      band(A.vS1, A.vNo, ASI.x1 - 8, 8, 0x2fa84f);
      band(A.vNo, A.vNe, ASI.x1 - 8, 8, YELLOW);
      band(A.vNe, 400, ASI.x1 - 8, 8, 0xe53935);
      t.lineStyle(2, WHITE, 1);
      let ai = 0;
      const v0 = Math.floor((s.ias - 50) / 5) * 5;
      for (let v = Math.max(20, v0); v <= s.ias + 50; v += 5) {
        const y = yI(v); if (!inTape(y)) continue;
        t.lineBetween(ASI.x1 - 14 - (v % 10 ? 10 : 18), y, ASI.x1 - 14, y);
        if (v % 10 === 0 && Math.abs(y - CY) > 26) { const k = asiTxt[ai++]; if (k) k.setText(String(v)).setPosition(ASI.x1 - 38, y).setVisible(true); }
      }
      while (ai < asiTxt.length) asiTxt[ai++].setVisible(false);
      const it = clamp(trend.ias * 6, -45, 45);
      if (Math.abs(it) > 1) { t.fillStyle(MAGENTA, 1); t.fillRect(ASI.x1 - 2, Math.min(CY, CY - it * ASI.ppk), 5, Math.abs(it * ASI.ppk)); }
      iasTxt.setText(String(Math.round(s.ias)));
      iasTxt.setColor(s.ias > A.vNe ? C.red : s.ias > A.vNo ? C.yellow : C.white);
      tasTxt.setText(`${Math.round(s.tas)}KT`);

      // ----- altitude tape -----
      const yA = h => CY - (h - s.alt) * ALT.ppf;
      let al = 0;
      const h0 = Math.floor((s.alt - 500) / 20) * 20;
      t.lineStyle(2, WHITE, 1);
      for (let h = h0; h <= s.alt + 500; h += 20) {
        const y = yA(h); if (!inTape(y)) continue;
        t.lineBetween(ALT.x0, y, ALT.x0 + (h % 100 ? 8 : 18), y);
        if (h % 100 === 0 && Math.abs(y - CY) > 26) { const k = altTxt[al++]; if (k) k.setText(String(h)).setPosition(ALT.x1 - 8, y).setVisible(true); }
      }
      while (al < altTxt.length) altTxt[al++].setVisible(false);
      const selAlt = ap.alt ? ap.altTgt : run && run.alt != null ? run.alt : null;
      if (selAlt != null) {
        const y = clamp(yA(selAlt), TAPE_T + 10, TAPE_B - 10);
        t.fillStyle(CYAN, 1);
        t.fillPoints([{ x: ALT.x0, y: y - 12 }, { x: ALT.x0 + 10, y: y - 12 }, { x: ALT.x0 + 10, y: y - 5 }, { x: ALT.x0 + 4, y }, { x: ALT.x0 + 10, y: y + 5 }, { x: ALT.x0 + 10, y: y + 12 }, { x: ALT.x0, y: y + 12 }], true);
        selAltTxt.setText(`${Math.round(selAlt)}FT`);
      } else selAltTxt.setText('----FT');
      const at = clamp(trend.alt * 6, -450, 450);
      if (Math.abs(at) > 10) { t.fillStyle(MAGENTA, 1); t.fillRect(ALT.x0 - 5, Math.min(CY, CY - at * ALT.ppf), 5, Math.abs(at * ALT.ppf)); }
      altValTxt.setText(String(Math.round(s.alt / 10) * 10));

      // ----- vertical speed -----
      const vy = CY - clamp(s.vs, -2050, 2050) / 2000 * VSI.half;
      vsVal.clear(); vsVal.fillStyle(BLACK, 1); vsVal.lineStyle(1.5, WHITE, 1);
      const vp = [{ x: VSI.x0 + 2, y: vy }, { x: VSI.x0 + 12, y: vy - 11 }, { x: VSI.x1 + 2, y: vy - 11 }, { x: VSI.x1 + 2, y: vy + 11 }, { x: VSI.x0 + 12, y: vy + 11 }];
      vsVal.fillPoints(vp, true); vsVal.strokePoints(vp, true);
      const vsr = Math.round(s.vs / 50) * 50;
      vsValTxt.setText(Math.abs(vsr) >= 100 ? String(vsr) : '').setY(vy);
      // the scale labels hide under the pointer
      for (const k of vsiTxt) k.setVisible(Math.abs(k.y - vy) > 14);

      // ----- glideslope -----
      gs.clear();
      gsLbl.setVisible(n.gsShow);
      if (n.gsShow) {
        const gx = ALT.x0 - 18;
        gs.fillStyle(BLACK, 0.45); gs.fillRect(gx - 12, CY - 2 * DOT - 12, 24, 4 * DOT + 24);
        gs.lineStyle(2, WHITE, 1);
        for (const d of [-2, -1, 1, 2]) gs.strokeCircle(gx, CY + d * DOT, 5);
        gs.lineBetween(gx - 10, CY, gx + 10, CY);
        if (!n.gsFlag) {
          // needle below center means fly down: the diamond shows where the path is
          const y = CY + clamp(n.gsDots / 5 * 2, -2.4, 2.4) * DOT;
          gs.fillStyle(GREEN, 1); gs.fillPoints([{ x: gx, y: y - 10 }, { x: gx + 9, y }, { x: gx, y: y + 10 }, { x: gx - 9, y }], true);
        } else {
          gs.lineStyle(2, 0xff3b30, 1); gs.lineBetween(gx - 9, CY - 2 * DOT, gx + 9, CY + 2 * DOT); gs.lineBetween(gx + 9, CY - 2 * DOT, gx - 9, CY + 2 * DOT);
        }
      }

      // ----- HSI -----
      const hg = hsi; hg.clear();
      hg.fillStyle(0x1a1f26, 0.82); hg.fillCircle(HX, HY, HR);
      hg.lineStyle(2, 0x56636f, 1); hg.strokeCircle(HX, HY, HR);
      const hdgM = FI.toMag(s.hdg);
      const rot = a => a - hdgM;                      // card angle (magnetic) to screen angle
      hg.lineStyle(2, WHITE, 1);
      for (let a = 0; a < 360; a += 5) {
        const q = rot(a), len = a % 10 ? 8 : 16;
        hg.lineBetween(HX + px(HR - 2, q), HY + py(HR - 2, q), HX + px(HR - 2 - len, q), HY + py(HR - 2 - len, q));
      }
      const names = ['N', '3', '6', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33'];
      names.forEach((nm, i) => {
        const q = rot(i * 30);
        hsiTxt[i].setText(nm).setFontSize('NESW'.includes(nm) ? 20 : 17).setPosition(HX + px(HR - 34, q), HY + py(HR - 34, q)).setRotation(q * D2R);
      });
      // heading bug
      const bq = rot(nv.bug);
      const bug = [[-6, HR + 1], [6, HR + 1], [6, HR - 10], [2, HR - 6], [-2, HR - 6], [-6, HR - 10]].map(([d, rr]) => ({ x: HX + px(rr, bq + d * 0.6), y: HY + py(rr, bq + d * 0.6) }));
      hg.fillStyle(CYAN, 1); hg.fillPoints(bug, true);
      // ground track: a magenta diamond on the rose
      const tq = rot(FI.toMag(s.trk));
      hg.fillStyle(MAGENTA, 1);
      hg.fillPoints([{ x: HX + px(HR - 4, tq), y: HY + py(HR - 4, tq) }, { x: HX + px(HR - 12, tq - 3), y: HY + py(HR - 12, tq - 3) },
        { x: HX + px(HR - 20, tq), y: HY + py(HR - 20, tq) }, { x: HX + px(HR - 12, tq + 3), y: HY + py(HR - 12, tq + 3) }], true);
      // turn rate trend: where the heading will be in 6 seconds
      const tr = clamp(s.turnRate * 6, -24, 24);
      if (Math.abs(tr) > 0.5) {
        hg.lineStyle(5, MAGENTA, 1); hg.beginPath();
        hg.arc(HX, HY, HR + 7, (-90) * D2R, (tr - 90) * D2R, tr < 0); hg.strokePath();
      }
      // course pointer and deviation bar (green: VOR and localizer)
      const cq = rot(n.course), cs = Math.sin(cq * D2R), cc = -Math.cos(cq * D2R);
      const P = (along, across) => ({ x: HX + cs * along - cc * across, y: HY + cc * along + cs * across });
      hg.lineStyle(1.5, WHITE, 1);
      for (const d of [-2, -1, 1, 2]) { const p = P(0, d * DOT); hg.strokeCircle(p.x, p.y, 5); }
      hg.fillStyle(GREEN, 1); hg.lineStyle(1, BLACK, 1);
      const head = [P(HR - 14, 0), P(HR - 40, -10), P(HR - 40, -3), P(HR - 40, 3), P(HR - 40, 10)];
      hg.fillPoints([head[0], head[1], head[4]], true);
      const rect4 = (a0, a1, w) => [P(a0, -w), P(a1, -w), P(a1, w), P(a0, w)];
      hg.fillPoints(rect4(HR - 40, 62, 3), true);
      hg.fillPoints(rect4(-62, -(HR - 18), 3), true);
      if (!n.flag) {
        const dev = clamp(n.dots / 5 * 2, -2.4, 2.4) * DOT;
        hg.fillPoints(rect4(-56, 56, 3).map(p => ({ x: p.x - cc * dev, y: p.y + cs * dev })), true);
      }
      // TO / FROM: a small triangle along the course, ahead for TO, behind for FROM
      if (n.toFrom) {
        const k = n.toFrom === 'TO' ? 1 : -1;
        hg.fillStyle(GREEN, 1);
        hg.fillPoints([P(k * 92, 0), P(k * 78, -10), P(k * 78, 10)], true);
      }
      // BRG1: the ADF bearing pointer, a cyan line through the rose
      const adf = n.adf;
      if (adf.valid) {
        const bq = rot(adf.brgM), bs = Math.sin(bq * D2R), bc = -Math.cos(bq * D2R);
        const Q = r => ({ x: HX + bs * r, y: HY + bc * r });
        hg.lineStyle(3, CYAN, 1);
        const t0 = Q(HR - 8), t1 = Q(HR - 60), b0 = Q(-(HR - 60)), b1 = Q(-(HR - 8));
        hg.lineBetween(t0.x, t0.y, t1.x, t1.y); hg.lineBetween(b0.x, b0.y, b1.x, b1.y);
        const w0 = { x: -bc * 10, y: bs * 10 }, h0 = Q(HR - 30);
        hg.lineBetween(t0.x, t0.y, h0.x + w0.x, h0.y + w0.y); hg.lineBetween(t0.x, t0.y, h0.x - w0.x, h0.y - w0.y);
      }
      brgHdr.setText('BRG1 ADF');
      brgId.setText(nv.khz ? `${nv.khz} ${adf.valid ? adf.id : ''}` : 'OFF');
      brgTxt.setText(adf.valid ? `${pad3(adf.brgM)}°` : nv.khz ? 'NO SIG' : '').setColor(adf.valid ? C.cyan : C.dim);

      const vor = n.kind !== 'LOC', az = n.kind === 'VOR' || n.kind === 'TACAN';
      navLbl.setText(n.kind === 'LOC' ? 'LOC1' : n.kind === 'TACAN' || n.src === 'TCN' ? 'TCN1' : 'VOR1');
      navFlag.setText(n.flag ? (az && n.cone ? 'OVER STN' : n.kind === 'DME' ? 'DME ONLY' : 'NO SIG') : (!vor && !n.front ? 'BC' : ''));
      toFromTxt.setText(n.toFrom || '');
      hdgBoxTxt.setText(`${pad3(hdgM)}°`);
      hdgSel.setText(`HDG ${pad3(nv.bug)}°`);
      crsSel.setText(`CRS ${pad3(n.course)}°`);

      // wind box: arrow relative to the nose, then direction and speed
      windArrow.clear();
      if (FI.wind.kt > 0) {
        const wa = FI.wind.dir + 180 - s.hdg, cx = 95, cy = 780;
        const sx = Math.sin(wa * D2R), sy = -Math.cos(wa * D2R);
        windArrow.lineStyle(3, WHITE, 1); windArrow.lineBetween(cx - sx * 24, cy - sy * 24, cx + sx * 20, cy + sy * 20);
        windArrow.fillStyle(WHITE, 1);
        windArrow.fillTriangle(cx + sx * 28, cy + sy * 28, cx + sx * 14 - sy * 9, cy + sy * 14 + sx * 9, cx + sx * 14 + sy * 9, cy + sy * 14 - sx * 9);
        windTxt.setText(`${pad3(FI.wind.dir)}° ${Math.round(FI.wind.kt)}KT`);
      } else windTxt.setText('NO WIND');
      windTxt.setY(FI.wind.kt > 0 ? 822 : 790);

      dmeHdr.setText(`DME  ${n.dmeId || ''}`);
      dmeTxt.setText(n.dmeValid ? `${n.dme.toFixed(1)}NM` : '---.-NM');
      radTxt.setText(az && n.radial != null ? `RAD ${pad3(n.radial)}° FR` : '');

      // ----- top bar: nav frequencies and the autopilot annunciator -----
      const tcn = n.src === 'TCN';
      nav1.setText(`NAV1 ${FI.fmtMhz(nv.mhz)} ${!tcn && n.ident ? n.ident : ''}`).setColor(tcn ? C.white : C.green);
      nav2.setText(`TCN  ${(nv.chan || '---').padStart(4)}   ${tcn && n.ident ? n.ident : ''}`).setColor(tcn ? C.green : C.white);
      let lat = '', lArm = '', vert = '', vArm = '';
      const anyAp = ap.hdg || ap.alt || ap.nav || !!run;
      if (run) {
        lat = run.track ? (run.mode || (n.kind === 'LOC' ? 'LOC' : n.kind === 'TACAN' ? 'TCN' : 'VOR')) : run.hdg != null ? 'HDG' : 'ROL';
        vert = ap.gsCap ? 'GS' : run.alt != null ? 'ALT' : run.vs != null ? 'VS' : 'PIT';
        if (run.gs && !ap.gsCap) vArm = 'GS';
      } else if (anyAp) {
        lat = ap.nav ? (n.kind === 'LOC' ? 'LOC' : n.kind === 'TACAN' ? 'TCN' : 'VOR') : ap.hdg ? 'HDG' : 'ROL';
        vert = ap.gsCap ? 'GS' : ap.alt ? 'ALT' : 'PIT';
        if (ap.nav && n.kind === 'LOC' && !ap.gsCap) vArm = 'GS';
      }
      apLbl.setText(anyAp ? 'AP' : '');
      latTxt.setText(lat); armTxt.setText(lArm); vertTxt.setText(vert); vArmTxt.setText(vArm);
      topRight.setText(n.dist != null ? `DIS ${n.dist.toFixed(1)}NM` : 'DIS ---.-NM');

      // ----- bottom bar -----
      const wca = FI.norm180(s.trk - s.hdg);
      bottom.setText(`TRK ${pad3(FI.toMag(s.trk))}°   GS ${Math.round(s.gs)}KT   CRAB ${Math.abs(wca) < 0.5 ? '0°' : Math.abs(Math.round(wca)) + '°' + (wca < 0 ? 'R' : 'L')}   XPDR 1200 ALT   OAT 15°C`);
    }

    return { root, update };
  };
})(window.FI);
