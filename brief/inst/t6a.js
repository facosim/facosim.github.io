(function (FI) {
  'use strict';

  const D2R = FI.D2R, clamp = FI.clamp, V = FI.VF;
  const W = 900, H = 900;
  const WHITE = 0xf4f6f8, GREEN = 0x46e046, AMBER = 0xf5b82e, MAGENTA = 0xd248e6, CYAN = 0x32e0d6;
  const PALE = 0xc9eef2, SKY = 0x1f33d8, BLACK = 0x000000, RED = 0xe53935, DIM = 0x6f7c88;

  const ASI = { x: 124, y: 176, r: 115 };
  const ALT = { x: 776, y: 180, r: 118 };
  const ADI = { x: 450, y: 212, r: 156 };
  const ARC = { x: 450, y: 387, r: 101 };
  const HSI = { x: 450, y: 706, r: 140 };
  const VSI = { x: 776, y: 520, w: 234, h: 220, r: 84 };
  const BARBER = 316;

  const px = (r, a) => r * Math.sin(a * D2R), py = (r, a) => -r * Math.cos(a * D2R);
  const pad3 = FI.pad3;
  const text = (g, s, x, y, cap, color, align, o) => V.draw(g, s, x, y, cap, color, Object.assign({ align: align || 'center', weight: 0.17 }, o));

  function interp(table, v) {
    if (v <= table[0][0]) return table[0][1];
    for (let i = 1; i < table.length; i++) {
      if (v <= table[i][0]) {
        const [x0, y0] = table[i - 1], [x1, y1] = table[i];
        return y0 + (y1 - y0) * (v - x0) / (x1 - x0);
      }
    }
    return table[table.length - 1][1];
  }
  const ASI_SCALE = [[40, 23], [300, 298.6], [320, 314.6], [350, 337.6], [400, 358]];
  const asiAng = v => interp(ASI_SCALE, v);
  const VSI_SCALE = [[0, 0], [0.5, 30], [1, 70], [2, 111], [4, 152], [6, 180]];
  const vsiAng = k => 270 + Math.sign(k) * interp(VSI_SCALE, Math.min(Math.abs(k), 6));

  function clipped(g, yMax) {
    const inside = p => p.y <= yMax;
    const cut = (a, b) => ({ x: a.x + (b.x - a.x) * (yMax - a.y) / (b.y - a.y), y: yMax });
    const segment = (a, b) => {
      if (inside(a) && inside(b)) return [a, b];
      if (!inside(a) && !inside(b)) return null;
      return inside(a) ? [a, cut(a, b)] : [cut(a, b), b];
    };
    const ring = (cx, cy, r) => Array.from({ length: 72 }, (_, i) => ({ x: cx + r * Math.cos(i * Math.PI / 36), y: cy + r * Math.sin(i * Math.PI / 36) }));
    const self = {
      clear() { g.clear(); },
      lineStyle(...a) { g.lineStyle(...a); },
      fillStyle(...a) { g.fillStyle(...a); },
      lineBetween(x0, y0, x1, y1) {
        const s = segment({ x: x0, y: y0 }, { x: x1, y: y1 });
        if (s) g.lineBetween(s[0].x, s[0].y, s[1].x, s[1].y);
      },
      strokePoints(pts, closed) {
        if (pts.every(inside)) { g.strokePoints(pts, closed); return; }
        if (!pts.some(inside)) return;
        const n = closed ? pts.length : pts.length - 1;
        for (let i = 0; i < n; i++) {
          const s = segment(pts[i], pts[(i + 1) % pts.length]);
          if (s) g.lineBetween(s[0].x, s[0].y, s[1].x, s[1].y);
        }
      },
      fillPoints(pts) {
        const out = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          if (inside(a)) out.push(a);
          if (inside(a) !== inside(b)) out.push(cut(a, b));
        }
        if (out.length > 2) g.fillPoints(out, true);
      },
      fillCircle(cx, cy, r) { self.fillPoints(ring(cx, cy, r)); },
      strokeCircle(cx, cy, r) { self.strokePoints(ring(cx, cy, r), true); },
    };
    return self;
  }

  function taper(g, cx, cy, a, r0, r1, w0, w1, color) {
    const dx = Math.sin(a * D2R), dy = -Math.cos(a * D2R), nx = -dy, ny = dx;
    const P = (r, w) => ({ x: cx + dx * r + nx * w, y: cy + dy * r + ny * w });
    g.fillStyle(color, 1);
    g.fillPoints([P(r0, -w0), P(r1, -w1), P(r1, w1), P(r0, w0)], true);
  }

  function segment(Rr, yl, above) {
    if (yl <= -Rr) return above ? null : 'full';
    if (yl >= Rr) return above ? 'full' : null;
    const xi = Math.sqrt(Rr * Rr - yl * yl), tr = Math.atan2(yl, xi), tl = Math.PI - tr;
    const pts = [], N = 48;
    const t0 = tr, t1 = above ? tl - 2 * Math.PI : tl;
    for (let i = 0; i <= N; i++) { const t = t0 + (t1 - t0) * i / N; pts.push({ x: Math.cos(t) * Rr, y: Math.sin(t) * Rr }); }
    return pts;
  }
  function clipH(Rr, y, x0, x1) {
    if (Math.abs(y) >= Rr) return null;
    const xi = Math.sqrt(Rr * Rr - y * y);
    const a = Math.max(x0, -xi), b = Math.min(x1, xi);
    return a < b ? [a, b] : null;
  }

  function hatch(g, x0, y0, x1, y1, gap) {
    const h = y1 - y0;
    for (let c = x0 - h; c < x1; c += gap) {
      const xs = Math.max(c, x0), xe = Math.min(c + h, x1);
      if (xs < xe) g.lineBetween(xs, y1 - (xs - c), xe, y1 - (xe - c));
    }
  }

  const PLANE = (() => {
    const half = [[0, -1], [0.07, -0.88], [0.10, -0.55], [0.10, -0.18], [0.55, 0.12], [0.55, 0.26], [0.10, 0.16], [0.10, 0.50],
      [0.26, 0.72], [0.26, 0.84], [0.07, 0.78], [0, 0.9]];
    return half.concat(half.slice(1, -1).reverse().map(([x, y]) => [-x, y]));
  })();
  function plane(g, cx, cy, k, color) {
    const pts = PLANE.map(([x, y]) => ({ x: cx + x * k, y: cy + y * k }));
    g.fillStyle(BLACK, 1); g.fillPoints(pts, true);
    g.lineStyle(Math.max(2, k * 0.2), color, 1); g.strokePoints(pts, true);
  }

  const navName = n => n.kind === 'LOC' ? 'LOC' : (n.kind === 'TACAN' || (!n.kind && n.src === 'TCN')) ? 'TCN' : n.kind === 'DME' ? 'DME' : 'VOR';

  FI.T6A = function (scene) {
    const root = scene.add.container(0, 0);
    const gfx = () => { const g = scene.add.graphics(); root.add(g); return g; };

    const frame = gfx();
    frame.fillStyle(BLACK, 1); frame.fillRect(0, 0, W, H);
    frame.lineStyle(3, 0x30363d, 1); frame.strokeRect(1.5, 1.5, W - 3, H - 3);

    const asi = (() => {
      const { x, y, r } = ASI;
      const g = gfx();
      g.lineStyle(3, WHITE, 1);
      for (let v = 40; v <= 400; v += 10) {
        const major = v <= 300 ? v % 20 === 0 : (v === 320 || v === 350 || v === 400);
        const a = asiAng(v), len = (major ? 0.17 : 0.11) * r;
        g.lineBetween(x + px(r, a), y + py(r, a), x + px(r - len, a), y + py(r - len, a));
      }
      const labels = [];
      for (let v = 40; v <= 300; v += 20) labels.push(v);
      labels.push(320, 350, 400);
      for (const v of labels) { const a = asiAng(v); text(g, String(v), x + px(0.68 * r, a), y + py(0.68 * r, a), 13, WHITE); }
      g.lineStyle(2.5, WHITE, 1); g.strokeRect(x - 0.06 * r, y - 0.40 * r, 0.39 * r, 0.21 * r);
      g.fillStyle(WHITE, 1); g.fillCircle(x - 0.1 * r, y - 0.28 * r, 2.5);
      text(g, 'MACH', x + 0.14 * r, y - 0.48 * r, 8.5, WHITE);
      text(g, 'KNOTS', x + 0.06 * r, y + 0.33 * r, 11, WHITE);
      const ba = asiAng(BARBER);
      for (let r0 = 0.1 * r, i = 0; r0 < 0.88 * r; r0 += 0.075 * r, i++) {
        taper(g, x, y, ba, r0, Math.min(r0 + 0.075 * r, 0.88 * r), 0.032 * r, 0.032 * r, i % 2 ? WHITE : RED);
      }
      const needle = gfx();
      return {
        update(s, ov) {
          const a = asiAng(clamp(s.ias, 40, 400));
          needle.clear();
          taper(needle, x, y, a, 0.06 * r, 0.9 * r, 0.04 * r, 0.02 * r, WHITE);
          taper(needle, x, y, a + 180, 0, 0.1 * r, 0.04 * r, 0.04 * r, WHITE);
          const t = 288.15 - 1.98 * s.alt / 1000;
          const m = s.tas / (38.967 * Math.sqrt(t));
          if (m >= 0.4) text(ov, `.${String(Math.round(m * 100)).padStart(2, '0')}`, x + 0.135 * r, y - 0.295 * r, 0.13 * r, WHITE);
        },
      };
    })();

    const alt = (() => {
      const { x, y, r } = ALT;
      const g = gfx();
      g.lineStyle(3, WHITE, 1);
      for (let i = 0; i < 50; i++) {
        const a = i * 7.2, len = (i % 5 ? 0.09 : 0.14) * r;
        g.lineBetween(x + px(r, a), y + py(r, a), x + px(r - len, a), y + py(r - len, a));
      }
      for (let i = 0; i < 10; i++) text(g, String(i), x + px(0.75 * r, i * 36), y + py(0.75 * r, i * 36), 0.17 * r, WHITE);
      g.fillStyle(BLACK, 1); g.fillRect(x - 0.6 * r, y - 0.5 * r, 1.22 * r, 0.37 * r);
      g.lineStyle(2.5, WHITE, 1); g.strokeRect(x - 0.6 * r, y - 0.5 * r, 1.22 * r, 0.37 * r);
      g.lineStyle(2, WHITE, 1);
      g.strokeRect(x - 0.57 * r, y - 0.47 * r, 0.3 * r, 0.31 * r);
      hatch(g, x - 0.57 * r, y - 0.47 * r, x - 0.27 * r, y - 0.16 * r, 6);
      for (const [bx, bw, label, lx, val] of [[-0.68, 0.48, 'MB', -0.44, '1013'], [0.13, 0.53, 'IN HG', 0.4, '29.92']]) {
        g.fillStyle(BLACK, 1); g.fillRect(x + bx * r, y + 0.33 * r, bw * r, 0.17 * r);
        g.lineStyle(2, WHITE, 1); g.strokeRect(x + bx * r, y + 0.33 * r, bw * r, 0.17 * r);
        text(g, label, x + lx * r, y + 0.25 * r, 7.5, WHITE);
        text(g, val, x + (bx + bw / 2) * r, y + 0.415 * r, 11, WHITE);
      }
      text(g, 'ALT', x, y + 0.16 * r, 10, WHITE);
      const hand = gfx();
      return {
        update(s, ov) {
          const a = Math.max(0, s.alt), ang = (a % 1000) / 1000 * 360;
          hand.clear();
          const dx = Math.sin(ang * D2R), dy = -Math.cos(ang * D2R), nx = -dy, ny = dx;
          const P = (rr, w) => ({ x: x + dx * rr + nx * w, y: y + dy * rr + ny * w });
          hand.fillStyle(WHITE, 1);
          hand.fillPoints([P(-0.18 * r, -0.03 * r), P(0.45 * r, -0.03 * r), P(0.62 * r, -0.07 * r), P(0.9 * r, 0), P(0.62 * r, 0.07 * r), P(0.45 * r, 0.03 * r), P(-0.18 * r, 0.03 * r)], true);
          const v = Math.round(a / 20) * 20, rest = String(v % 1000).padStart(3, '0');
          text(ov, v >= 1000 ? `${Math.floor(v / 1000) % 10},${rest}` : rest, x + 0.58 * r, y - 0.315 * r, 0.21 * r, WHITE, 'right');
        },
      };
    })();

    const vsi = (() => {
      const { x, y, w, h, r } = VSI;
      const g = gfx();
      g.fillStyle(0x0a1517, 1); g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 16);
      g.lineStyle(1.5, 0x1d2c30, 1); g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 16);
      g.lineStyle(2.5, WHITE, 1); g.strokeCircle(x, y, r);
      const ticks = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.5, 3, 3.5, 4, 5, 6];
      const major = new Set([0.5, 1, 2, 4, 6]);
      const tick = k => {
        const a = vsiAng(k), len = major.has(Math.abs(k)) ? 12 : 6;
        g.lineBetween(x + px(r, a), y + py(r, a), x + px(r + len, a), y + py(r + len, a));
      };
      g.lineStyle(2.5, WHITE, 1);
      g.lineBetween(x - r, y, x - r - 12, y);
      for (const k of ticks) { tick(k); if (k !== 6) tick(-k); }
      text(g, '0', x - r - 20, y, 11, WHITE);
      for (const [k, s] of [[0.5, '.5'], [1, '1'], [2, '2'], [4, '4']]) for (const sg of [1, -1]) {
        const a = vsiAng(sg * k);
        text(g, s, x + px(r + 21, a), y + py(r + 21, a), 11, WHITE);
      }
      text(g, '6', x + r + 20, y, 11, WHITE);
      text(g, 'ABOVE', x - w / 2 + 9, y - h / 2 + 14, 9.5, CYAN, 'left');
      text(g, 'RNG 10', x + w / 2 - 9, y - h / 2 + 14, 9.5, CYAN, 'right');
      text(g, 'TA', x - w / 2 + 9, y + h / 2 - 30, 9.5, CYAN, 'left');
      text(g, 'ONLY', x - w / 2 + 9, y + h / 2 - 15, 9.5, CYAN, 'left');
      const cy = y + 0.32 * r;
      g.fillStyle(CYAN, 1);
      for (let i = 0; i < 12; i++) g.fillCircle(x + px(22, i * 30), cy + py(22, i * 30), 1.8);
      g.fillPoints([{ x, y: cy - 7 }, { x: x + 2, y: cy - 2 }, { x: x + 7, y: cy + 2 }, { x: x + 7, y: cy + 4 }, { x: x + 2, y: cy + 2.5 },
        { x: x + 1.5, y: cy + 6 }, { x: x + 4, y: cy + 8 }, { x: x + 4, y: cy + 9 }, { x, y: cy + 8 }, { x: x - 4, y: cy + 9 }, { x: x - 4, y: cy + 8 },
        { x: x - 1.5, y: cy + 6 }, { x: x - 2, y: cy + 2.5 }, { x: x - 7, y: cy + 4 }, { x: x - 7, y: cy + 2 }, { x: x - 2, y: cy - 2 }], true);
      const needle = gfx();
      return {
        update(s) {
          const a = vsiAng(clamp(s.vs, -6000, 6000) / 1000);
          needle.clear();
          taper(needle, x, y, a, 0, 0.74 * r, 1.8, 1.8, WHITE);
          taper(needle, x, y, a, 0.72 * r, 0.97 * r, 8, 0, WHITE);
          needle.fillStyle(WHITE, 1); needle.fillCircle(x, y, 3);
        },
      };
    })();

    function makeGS(cx, cy, step, labelDy, indexTo) {
      const g = gfx();
      return (n, ov) => {
        g.clear();
        if (!(n.gsShow && n.loc && n.loc.hasGs)) return;
        text(ov, 'GS', cx, cy + labelDy, 14, n.gsFlag ? RED : WHITE);
        g.lineStyle(2.5, WHITE, 1);
        for (const d of [-2, -1, 1, 2]) g.strokeCircle(cx, cy + d * step, step * 0.14);
        if (indexTo) g.lineBetween(cx - step * 0.5, cy, indexTo, cy);
        if (!n.gsFlag) {
          const yy = cy + clamp(n.gsDots / 5 * 2, -2.4, 2.4) * step;
          g.fillStyle(GREEN, 1);
          g.fillPoints([{ x: cx + step * 0.14, y: yy }, { x: cx + step * 0.58, y: yy - step * 0.26 }, { x: cx + step * 0.58, y: yy + step * 0.26 }], true);
        }
      };
    }

    function makeReadouts(lx, ly, rx, ry) {
      const BIG = 15, SMALL = 10.5, ROW = 22;
      return (s, n, nv, ov) => {
        const line = (i, val, unit) => {
          text(ov, val, lx, ly + i * ROW, BIG, GREEN, 'left');
          if (unit) text(ov, unit, lx + V.width(val, BIG) + 5, ly + i * ROW + 1, SMALL, GREEN, 'left');
        };
        const d = n.kind === 'LOC' && n.nav2 && n.nav2.dmeValid ? n.nav2 : n;
        line(0, d.dmeValid ? d.dme.toFixed(1) : '--.-', d === n ? 'NM' : 'NM N2');
        line(1, String(Math.round(s.gs)), 'KT');
        let ete = '-:--';
        if (d.dmeValid && s.gs > 20) { const m = Math.floor(d.dme / s.gs * 60); ete = `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; }
        line(2, ete);
        const right = (i, label, val, color) => {
          text(ov, val, rx, ry + i * ROW, BIG, color, 'right');
          text(ov, label, rx - V.width(val, BIG) - 5, ry + i * ROW + 1, SMALL, color, 'right');
        };
        right(0, 'CRS', pad3(n.course), GREEN);
        right(1, 'HDG', pad3(nv.bug), AMBER);
      };
    }

    function makeHSI(c) {
      const { x: x0, y: y0, r: R, arc } = c;
      const spacing = arc ? 0.30 : 0.225;
      const clipY = c.clipY == null ? null : y0 + c.clipY * R;
      const wrap = g => clipY == null ? g : clipped(g, clipY);
      const card = wrap(gfx());
      const mid = wrap(gfx());
      const fixed = gfx();
      fixed.fillStyle(PALE, 1);
      fixed.fillTriangle(x0, y0 - R - 0.04 * R, x0 - 0.075 * R, y0 - R - 0.13 * R, x0 + 0.075 * R, y0 - R - 0.13 * R);
      fixed.lineStyle(3, WHITE, 1);
      for (const a of arc ? [90, 270] : [90, 180, 270]) fixed.lineBetween(x0 + px(R * 1.04, a), y0 + py(R * 1.04, a), x0 + px(R * 1.16, a), y0 + py(R * 1.16, a));
      plane(fixed, x0, y0 + 0.02 * R, 0.14 * R, AMBER);
      const names = ['N', '3', '6', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33'];
      return {
        update(s, n, nv) {
          const hdgM = FI.toMag(s.hdg), rot = a => a - hdgM;
          const vis = q => !arc || Math.abs(FI.norm180(q)) <= 112;
          card.clear(); mid.clear();
          card.lineStyle(Math.max(2, 0.02 * R), WHITE, 1);
          for (let a = 0; a < 360; a += 5) {
            const q = rot(a); if (!vis(q)) continue;
            const len = (a % 10 ? 0.07 : 0.12) * R;
            card.lineBetween(x0 + px(R, q), y0 + py(R, q), x0 + px(R - len, q), y0 + py(R - len, q));
          }
          names.forEach((nm, i) => {
            const q = rot(i * 30);
            if (vis(q)) text(card, nm, x0 + px(0.72 * R, q), y0 + py(0.72 * R, q), 0.155 * R, WHITE, 'center', { rot: q * D2R });
          });
          const bq = rot(nv.bug);
          if (vis(bq)) {
            const B = (da, rr) => ({ x: x0 + px(rr * R, bq + da), y: y0 + py(rr * R, bq + da) });
            mid.fillStyle(AMBER, 1);
            mid.fillPoints([B(-6, 0.87), B(-6, 1.02), B(0, 0.94), B(6, 1.02), B(6, 0.87)], true);
          }
          const A = n.adf;
          if (A.valid) {
            const aq = rot(A.brgM), d = { x: Math.sin(aq * D2R), y: -Math.cos(aq * D2R) }, nr = { x: -d.y, y: d.x };
            const Q = (al, ac) => ({ x: x0 + R * (d.x * al + nr.x * ac), y: y0 + R * (d.y * al + nr.y * ac) });
            mid.lineStyle(2.5, MAGENTA, 1);
            if (vis(aq)) {
              for (const ac of [-0.025, 0.025]) { const a0 = Q(0.88, ac), a1 = Q(0.5, ac); mid.lineBetween(a0.x, a0.y, a1.x, a1.y); }
              const t = Q(0.9, 0), l = Q(0.76, -0.07), rr = Q(0.76, 0.07);
              mid.lineBetween(t.x, t.y, l.x, l.y); mid.lineBetween(t.x, t.y, rr.x, rr.y);
            }
            if (!arc) for (const ac of [-0.025, 0.025]) { const a0 = Q(-0.88, ac), a1 = Q(-0.5, ac); mid.lineBetween(a0.x, a0.y, a1.x, a1.y); }
          }
          const cq = rot(n.course), d = { x: Math.sin(cq * D2R), y: -Math.cos(cq * D2R) }, nr = { x: -d.y, y: d.x };
          const P = (al, ac) => ({ x: x0 + R * (d.x * al + nr.x * ac), y: y0 + R * (d.y * al + nr.y * ac) });
          mid.lineStyle(2.5, WHITE, 1);
          for (const k of [-2, -1, 1, 2]) { const p = P(0, k * spacing); mid.strokeCircle(p.x, p.y, 0.035 * R); }
          const quad = (a0, a1, w, off) => [P(a0, off - w), P(a1, off - w), P(a1, off + w), P(a0, off + w)];
          mid.fillStyle(GREEN, 1);
          mid.fillPoints([P(0.75, 0), P(0.55, -0.075), P(0.55, 0.075)], true);
          mid.fillPoints(quad(0.56, 0.3, 0.028, 0), true);
          mid.fillPoints(quad(-0.32, -0.72, 0.028, 0), true);
          if (!n.flag) {
            const dev = clamp(n.dots / 5 * 2, -2.4, 2.4) * spacing;
            mid.fillPoints(quad(0.3, -0.3, 0.022, dev), true);
          }
          if (n.toFrom) {
            const k = n.toFrom === 'TO' ? 1 : -1;
            mid.fillStyle(PALE, 1);
            mid.fillPoints([P(k * 0.33, 0), P(k * 0.19, -0.075), P(k * 0.19, 0.075)], true);
          }
        },
      };
    }

    const adi = (() => {
      const { x, y, r } = ADI;
      const ball = scene.add.container(x, y); root.add(ball);
      const sky = scene.add.graphics(); ball.add(sky);
      const lad = scene.add.graphics(); ball.add(lad);
      const ptr = scene.add.graphics(); ball.add(ptr);
      ptr.fillStyle(WHITE, 1);
      ptr.fillPoints([{ x: 0, y: -(r - 4) }, { x: -10, y: -(r - 20) }, { x: 10, y: -(r - 20) }], true);

      const fx = gfx();
      fx.lineStyle(3, WHITE, 1); fx.strokeCircle(x, y, r);
      for (const a of [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60]) {
        const len = (a % 30 === 0 ? 0.12 : 0.07) * r;
        fx.lineBetween(x + px(r + 3, a), y + py(r + 3, a), x + px(r + 3 + len, a), y + py(r + 3 + len, a));
      }
      fx.fillStyle(AMBER, 1);
      fx.fillTriangle(x, y - r - 2, x - 9, y - r - 19, x + 9, y - r - 19);
      fx.lineStyle(3, WHITE, 1);
      fx.lineBetween(x - r - 0.16 * r, y, x - r, y);
      fx.lineBetween(x + r, y, x + r + 0.3 * r, y);
      fx.fillStyle(AMBER, 1);
      for (const sd of [-1, 1]) {
        fx.fillRect(x + (sd < 0 ? -0.78 * r : 0.24 * r), y - 3.5, 0.54 * r, 7);
        fx.lineStyle(5, AMBER, 1);
        fx.lineBetween(x + sd * 0.24 * r, y, x + sd * 0.12 * r, y + 0.13 * r);
        fx.lineBetween(x + sd * 0.12 * r, y + 0.13 * r, x + sd * 0.02 * r, y + 0.04 * r);
      }
      fx.lineStyle(3, AMBER, 1); fx.strokeCircle(x, y, 0.05 * r);

      const disc = clipped(gfx(), ARC.y + 0.18 * ARC.r);
      disc.fillStyle(BLACK, 1); disc.fillCircle(ARC.x, ARC.y, ARC.r * 1.1);

      const arcHsi = makeHSI({ x: ARC.x, y: ARC.y, r: ARC.r, arc: true, clipY: 0.18 });
      const gs = makeGS(x + 1.16 * r, y, 0.253 * r, -0.7 * r, null);
      const readouts = makeReadouts(x - 170, y - 170, x + 200, y - 170);

      return {
        update(s, n, nv, ov) {
          ball.setRotation(-s.bank * D2R);
          const ppd = 0.0298 * r, off = clamp(s.pitch, -45, 45) * ppd, Rr = r - 1.5;
          sky.clear();
          const poly = segment(Rr, off, true);
          sky.fillStyle(SKY, 1);
          if (poly === 'full') sky.fillCircle(0, 0, Rr); else if (poly) sky.fillPoints(poly, true);
          lad.clear();
          lad.lineStyle(3, WHITE, 1);
          const hz = clipH(Rr, off, -Rr, Rr);
          if (hz) lad.lineBetween(hz[0], off, hz[1], off);
          for (let p = -35; p <= 35; p += 2.5) {
            if (!p) continue;
            const yy = off - p * ppd, ap = Math.abs(p), m10 = ap % 10 === 0, m5 = ap % 5 === 0;
            const half = (m10 ? (ap >= 20 ? 0.245 : 0.158) : m5 ? 0.112 : 0.06) * r;
            const seg = clipH(r - 6, yy, -half, half);
            if (seg) {
              lad.lineStyle(3, WHITE, 1);
              if (p > 0) lad.lineBetween(seg[0], yy, seg[1], yy);
              else {
                const dash = 0.045 * r, gap = 0.032 * r, cnt = Math.max(1, Math.round((2 * half + gap) / (dash + gap)));
                const total = cnt * dash + (cnt - 1) * gap;
                for (let i = 0; i < cnt; i++) {
                  const a = -total / 2 + i * (dash + gap), c0 = Math.max(a, seg[0]), c1 = Math.min(a + dash, seg[1]);
                  if (c0 < c1) lad.lineBetween(c0, yy, c1, yy);
                }
              }
            }
            if (m10 || ap === 5) for (const sd of [-1, 1]) {
              const lx = sd * (half + 0.1 * r);
              if (Math.hypot(lx, yy) < r - 14) text(lad, String(ap), lx, yy, 12.5, WHITE);
            }
          }
          arcHsi.update(s, n, nv);
          gs(n, ov);
          const name = navName(n), col = n.flag ? RED : GREEN;
          [-1, 0, 1].forEach(i => text(ov, name[i + 1], x - 1.19 * r, y + i * 30, 18, col, 'center', { weight: 0.2 }));
          readouts(s, n, nv, ov);
        },
      };
    })();

    const hsi = (() => {
      const { x, y, r } = HSI;
      const h = makeHSI({ x, y, r, arc: false });
      const gs = makeGS(x + 1.35 * r, y, 0.25 * r, -0.75 * r, x + 1.48 * r);
      const readouts = makeReadouts(x - 1.25 * r, y - 1.28 * r, x + 1.31 * r, y - 1.28 * r);
      const bx = x + 0.78 * r, by = y + 1.16 * r;
      const mg = gfx();
      return {
        update(s, n, nv, ov) {
          h.update(s, n, nv);
          gs(n, ov);
          const name = navName(n), col = n.flag ? RED : GREEN;
          [-1, 0, 1].forEach(i => text(ov, name[i + 1], x - 1.33 * r, y + i * 0.26 * r, 0.19 * r, col, 'center', { weight: 0.2 }));
          readouts(s, n, nv, ov);
          const A = n.adf, any = A.valid || !!nv.khz;
          mg.clear();
          if (A.valid) {
            mg.fillStyle(MAGENTA, 1); mg.lineStyle(3, MAGENTA, 1);
            mg.lineBetween(bx - 3, by + 14, bx - 3, by - 8); mg.lineBetween(bx + 3, by + 14, bx + 3, by - 8);
            mg.fillTriangle(bx, by - 18, bx - 9, by - 6, bx + 9, by - 6);
          }
          if (any) {
            text(ov, 'ADF', bx + 18, by - 7, 9.5, MAGENTA, 'left');
            text(ov, A.valid ? `${A.dist.toFixed(1)} NM` : 'NO SIG', bx + 18, by + 10, 11, A.valid ? MAGENTA : DIM, 'left');
          }
        },
      };
    })();

    const overlay = gfx();

    return {
      root,
      update() {
        const s = FI.state, n = FI.navOut, nv = FI.nav;
        if (!n) return;
        overlay.clear();
        asi.update(s, overlay); alt.update(s, overlay); vsi.update(s);
        adi.update(s, n, nv, overlay); hsi.update(s, n, nv, overlay);
      },
    };
  };
})(window.FI);
