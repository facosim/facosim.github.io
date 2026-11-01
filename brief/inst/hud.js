(function (FI) {
  'use strict';

  const D2R = FI.D2R, clamp = FI.clamp, V = FI.VF;
  const W = 900, H = 900;
  const GREEN = 0x3dff7a, AMBER = 0xffc23d, BLACK = 0x000000;
  const SKY_TOP = 0x1b3a5c, SKY_HORIZON = 0x4a7fa8, GROUND_NEAR = 0x232f20, GROUND_HAZE = 0x46573a;
  const SKY_BANDS = 9, SKY_DEPTH = 150, GROUND_BANDS = 6, GROUND_DEPTH = 110;

  const mix = (a, b, t) => {
    const ch = s => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
  };

  const HC = { x: 450, y: 452 };
  const PPD = 12;
  const FIELD = { x0: 292, x1: 608, y0: 204, y1: 702 };
  const HEAD = { y: 108, ppd: 7, half: 200 };
  const SPD = { x: 236, cy: 452, ppk: 3.2, top: 272, bot: 632 };
  const ALT = { x: 664, cy: 452, ppf: 0.42, top: 272, bot: 632 };
  const VS = { x: 846, cy: 452, ppf: 0.06 };
  const BANK_R = 268;

  const pad3 = FI.pad3;
  const fmtAlt = v => Math.round(v).toLocaleString('en-US');
  const sgn = v => (v < 0 ? '-' : '+');

  function clipHalf(pts, f) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], fa = f(a), fb = f(b);
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); }
    }
    return out;
  }
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

  FI.HUD = function (scene) {
    const root = scene.add.container(0, 0);
    const bg = scene.add.graphics(); root.add(bg);
    const g = scene.add.graphics(); root.add(g);
    const frame = scene.add.graphics(); root.add(frame);
    frame.lineStyle(3, 0x1b2330, 1); frame.strokeRect(1.5, 1.5, W - 3, H - 3);
    frame.lineStyle(2, GREEN, 0.5);
    for (const [cx, cy, sx, sy] of [[22, 22, 1, 1], [W - 22, 22, -1, 1], [22, H - 22, 1, -1], [W - 22, H - 22, -1, -1]]) {
      frame.strokePoints([{ x: cx, y: cy + sy * 26 }, { x: cx, y: cy }, { x: cx + sx * 26, y: cy }], false);
    }

    const style = (lw, a, c) => g.lineStyle(lw, c == null ? GREEN : c, a == null ? 1 : a);
    const fill = (a, c) => g.fillStyle(c == null ? GREEN : c, a == null ? 1 : a);
    const T = (str, x, y, cap, o) => V.draw(g, str, x, y, cap, o && o.color != null ? o.color : GREEN, Object.assign({ align: 'center', weight: 0.15 }, o));
    const line = (x0, y0, x1, y1) => g.lineBetween(x0, y0, x1, y1);
    const poly = (pts, solid) => { if (solid) g.fillPoints(pts, true); else g.strokePoints(pts, true); };
    const box = (x0, y0, w, h) => {
      g.fillStyle(BLACK, 0.5); g.fillRect(x0, y0, w, h);
      style(2); g.strokeRect(x0, y0, w, h);
    };

    function update() {
      const s = FI.state, n = FI.navOut, nv = FI.nav, ap = FI.ap, sc = FI.scn, A = FI.AC;
      if (!n) return;
      const run = sc && !sc.off && !sc.done ? sc.step : null;
      const hdg = FI.toMag(s.hdg), trk = FI.toMag(s.trk);
      const r = -s.bank * D2R, cr = Math.cos(r), sr = Math.sin(r);
      const toS = (u, v) => ({ x: HC.x + u * cr - v * sr, y: HC.y + u * sr + v * cr });
      const toB = p => { const x = p.x - HC.x, y = p.y - HC.y; return { x: x * cr + y * sr, y: -x * sr + y * cr }; };
      const off = clamp(s.pitch, -60, 60) * PPD;

      bg.clear();
      const rect = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
      const sky = clipHalf(rect, p => off - toB(p).y), gnd = clipHalf(rect, p => toB(p).y - off);
      if (sky.length > 2) {
        bg.fillStyle(SKY_TOP, 1); bg.fillPoints(sky, true);
        for (let i = 0; i < SKY_BANDS; i++) {
          const d = SKY_DEPTH * (SKY_BANDS - i) / SKY_BANDS, band = clipHalf(sky, p => toB(p).y - (off - d));
          if (band.length > 2) { bg.fillStyle(mix(SKY_TOP, SKY_HORIZON, Math.pow((i + 1) / SKY_BANDS, 1.4)), 1); bg.fillPoints(band, true); }
        }
      }
      if (gnd.length > 2) {
        bg.fillStyle(GROUND_NEAR, 1); bg.fillPoints(gnd, true);
        for (let i = 0; i < GROUND_BANDS; i++) {
          const d = GROUND_DEPTH * (GROUND_BANDS - i) / GROUND_BANDS, band = clipHalf(gnd, p => (off + d) - toB(p).y);
          if (band.length > 2) { bg.fillStyle(mix(GROUND_NEAR, GROUND_HAZE, Math.pow((i + 1) / GROUND_BANDS, 1.4)), 1); bg.fillPoints(band, true); }
        }
      }

      g.clear();

      const altSel = ap.alt ? ap.altTgt : run && run.alt != null ? run.alt : null;
      const spdSel = ap.spd ? ap.spdTgt : run && run.ias != null ? run.ias : null;
      const hdgOn = run ? run.hdg != null : ap.hdg;
      const hdgSel = run && run.hdg != null ? FI.toMag(run.hdg) : nv.bug;
      const navOn = run ? !!run.track : ap.nav;
      const anyAp = hdgOn || navOn || altSel != null || spdSel != null;

      const ladLine = (u0, v0, u1, v1) => {
        const a = toS(u0, v0), b = toS(u1, v1), c = clipSeg(a.x, a.y, b.x, b.y, FIELD);
        if (c) line(c[0], c[1], c[2], c[3]);
      };
      for (let p = -45; p <= 45; p += 5) {
        const v = (s.pitch - p) * PPD;
        if (Math.abs(v) > 420) continue;
        if (p === 0) { style(2.2); ladLine(-196, v, -34, v); ladLine(34, v, 196, v); continue; }
        const major = p % 10 === 0, half = major ? 68 : 42, gap = 26;
        style(2);
        if (p > 0) {
          ladLine(-half, v, -gap, v); ladLine(gap, v, half, v);
          ladLine(-half, v, -half, v + 9); ladLine(half, v, half, v + 9);
        } else {
          for (let u = gap; u < half - 2; u += 17) {
            const e = Math.min(u + 10, half);
            ladLine(u, v, e, v); ladLine(-u, v, -e, v);
          }
          ladLine(-half, v, -half, v - 9); ladLine(half, v, half, v - 9);
        }
        for (const sd of [-1, 1]) {
          const q = toS(sd * (half + 16), v);
          if (q.x > FIELD.x0 + 8 && q.x < FIELD.x1 - 8 && q.y > FIELD.y0 + 8 && q.y < FIELD.y1 - 8) T(String(Math.abs(p)), q.x, q.y, 12, { rot: r });
        }
      }

      style(2.2);
      line(HC.x - 24, HC.y, HC.x - 9, HC.y); line(HC.x + 9, HC.y, HC.x + 24, HC.y);
      line(HC.x, HC.y + 9, HC.x, HC.y + 15);
      fill(); g.fillCircle(HC.x, HC.y, 2);

      const aoa = FI.aoa(s.ias), drift = FI.norm180(s.trk - s.hdg);
      const fp = toS(clamp(drift * PPD, -190, 190), clamp(aoa * PPD, -190, 190));
      style(2.4);
      g.strokeCircle(fp.x, fp.y, 8.5);
      line(fp.x - 8.5, fp.y, fp.x - 22, fp.y); line(fp.x + 8.5, fp.y, fp.x + 22, fp.y); line(fp.x, fp.y - 8.5, fp.x, fp.y - 18);

      style(2);
      g.strokePoints(Array.from({ length: 31 }, (_, i) => { const a = (-45 + i * 3) * D2R; return { x: HC.x + BANK_R * Math.sin(a), y: HC.y - BANK_R * Math.cos(a) }; }), false);
      for (const a of [-45, -30, -20, -10, 0, 10, 20, 30, 45]) {
        const len = a === 0 ? 14 : Math.abs(a) % 30 === 0 || Math.abs(a) === 45 ? 11 : 7, rr = a * D2R;
        line(HC.x + BANK_R * Math.sin(rr), HC.y - BANK_R * Math.cos(rr), HC.x + (BANK_R - len) * Math.sin(rr), HC.y - (BANK_R - len) * Math.cos(rr));
      }
      {
        const ba = clamp(-s.bank, -50, 50) * D2R, ux = Math.sin(ba), uy = -Math.cos(ba), tx = -uy, ty = ux;
        const P = (rr, w) => ({ x: HC.x + ux * rr + tx * w, y: HC.y + uy * rr + ty * w });
        fill(); poly([P(BANK_R - 3, 0), P(BANK_R - 16, -6), P(BANK_R - 16, 6)], true);
      }

      const hy = HEAD.y;
      style(2);
      for (let a = Math.floor((hdg - 31) / 5) * 5; a <= hdg + 31; a += 5) {
        const x = HC.x + (a - hdg) * HEAD.ppd;
        if (Math.abs(x - HC.x) > HEAD.half) continue;
        const major = ((a % 10) + 10) % 10 === 0;
        line(x, hy, x, hy + (major ? 13 : 7));
        if (major) {
          const d = ((a % 360) + 360) % 360, lab = d % 90 === 0 ? 'NESW'[d / 90] : String(d / 10).padStart(2, '0');
          T(lab, x, hy - 14, 11);
        }
      }
      line(HC.x - HEAD.half, hy, HC.x - HEAD.half + 10, hy); line(HC.x + HEAD.half, hy, HC.x + HEAD.half - 10, hy);
      box(HC.x - 44, 46, 88, 32);
      T(pad3(hdg), HC.x, 62, 20);
      fill(); poly([{ x: HC.x, y: hy + 17 }, { x: HC.x - 7, y: hy + 28 }, { x: HC.x + 7, y: hy + 28 }], true);
      const tapeX = b => HC.x + clamp(FI.norm180(b - hdg) * HEAD.ppd, -HEAD.half, HEAD.half);
      style(2);
      {
        const x = tapeX(hdgSel);
        g.strokePoints([{ x: x - 8, y: hy + 15 }, { x: x - 8, y: hy - 5 }, { x: x + 8, y: hy - 5 }, { x: x + 8, y: hy + 15 }], false);
      }
      {
        const x = tapeX(n.course), yy = hy + 40;
        poly([{ x, y: yy - 7 }, { x: x + 6, y: yy }, { x, y: yy + 7 }, { x: x - 6, y: yy }], false);
        const tx = tapeX(trk);
        fill(); g.fillCircle(tx, yy, 3);
      }
      if (n.adf.valid) {
        const x = tapeX(n.adf.brgM), yy = hy + 53;
        style(2); g.strokeCircle(x, yy, 5); line(x, yy - 5, x, yy - 10);
      }
      if (n.nav2.valid) {
        const x = tapeX(n.nav2.brgM), yy = hy + 53;
        style(2); poly([{ x, y: yy - 6 }, { x: x + 6, y: yy + 5 }, { x: x - 6, y: yy + 5 }], false); line(x, yy - 6, x, yy - 11);
      }
      style(2);
      {
        const ty = hy + 66, tr = clamp(s.turnRate, -4.5, 4.5);
        line(HC.x - 40, ty, HC.x + 40, ty);
        for (const k of [-3, 0, 3]) line(HC.x + k * 12, ty - 5, HC.x + k * 12, ty + 5);
        fill(); g.fillRect(HC.x + tr * 12 - 3.5, ty - 3.5, 7, 7);
      }

      const ias = s.ias;
      style(2); line(SPD.x, SPD.top, SPD.x, SPD.bot);
      for (let v = Math.max(0, Math.ceil((ias - 60) / 5) * 5); v <= ias + 60; v += 5) {
        const y = SPD.cy - (v - ias) * SPD.ppk;
        if (y < SPD.top + 3 || y > SPD.bot - 3 || Math.abs(y - SPD.cy) < 21) continue;
        const major = v % 10 === 0;
        style(2); line(SPD.x, y, SPD.x - (major ? 14 : 7), y);
        if (major) T(String(v), SPD.x - 19, y, 11, { align: 'right' });
      }
      const yStall = SPD.cy - (A.vS1 - ias) * SPD.ppk, yNe = SPD.cy - (A.vNe - ias) * SPD.ppk, yNo = SPD.cy - (A.vNo - ias) * SPD.ppk;
      if (yNo > SPD.top && yNe < SPD.bot) { style(2, 1, AMBER); line(SPD.x + 4, clamp(yNe, SPD.top, SPD.bot), SPD.x + 4, clamp(yNo, SPD.top, SPD.bot)); }
      style(4, 1, AMBER);
      if (yStall < SPD.bot) line(SPD.x + 4, Math.max(yStall, SPD.top), SPD.x + 4, SPD.bot);
      if (yNe > SPD.top) line(SPD.x + 4, SPD.top, SPD.x + 4, Math.min(yNe, SPD.bot));
      const spdWarn = ias < A.vS1 + 2 || ias > A.vNo;
      box(112, SPD.cy - 18, 94, 36);
      T(String(Math.round(ias)), 198, SPD.cy, 22, { align: 'right', color: spdWarn ? AMBER : GREEN });
      style(2); line(206, SPD.cy, SPD.x - 13, SPD.cy);
      fill(); poly([{ x: SPD.x, y: SPD.cy }, { x: SPD.x - 13, y: SPD.cy - 7 }, { x: SPD.x - 13, y: SPD.cy + 7 }], true);
      if (spdSel != null) {
        const y = clamp(SPD.cy - (spdSel - ias) * SPD.ppk, SPD.top, SPD.bot);
        style(2); poly([{ x: SPD.x + 4, y }, { x: SPD.x + 17, y: y - 7 }, { x: SPD.x + 17, y: y + 7 }], false);
      }
      T(spdSel != null ? `SEL ${Math.round(spdSel)}` : 'SEL ---', 160, SPD.top - 20, 11, { alpha: spdSel != null ? 1 : 0.45 });

      style(2); line(ALT.x, ALT.top, ALT.x, ALT.bot);
      for (let h = Math.max(0, Math.floor((s.alt - 450) / 20) * 20); h <= s.alt + 450; h += 20) {
        const y = ALT.cy - (h - s.alt) * ALT.ppf;
        if (y < ALT.top + 3 || y > ALT.bot - 3 || Math.abs(y - ALT.cy) < 23) continue;
        const major = h % 100 === 0;
        style(2); line(ALT.x, y, ALT.x + (major ? 13 : 6), y);
        if (major) T(fmtAlt(h), ALT.x + 19, y, 11, { align: 'left' });
      }
      const yGnd = ALT.cy - ((FI.groundElev || 0) - s.alt) * ALT.ppf;
      if (yGnd > ALT.top && yGnd < ALT.bot) {
        style(3); line(ALT.x - 8, yGnd, ALT.x + 40, yGnd);
        style(1.5); for (let x = ALT.x - 4; x < ALT.x + 40; x += 9) line(x, yGnd, x - 8, Math.min(yGnd + 12, ALT.bot));
      }
      box(690, ALT.cy - 20, 104, 40);
      T(fmtAlt(Math.round(s.alt / 10) * 10), 742, ALT.cy, 23);
      style(2); line(ALT.x + 13, ALT.cy, 690, ALT.cy);
      fill(); poly([{ x: ALT.x, y: ALT.cy }, { x: ALT.x + 13, y: ALT.cy - 7 }, { x: ALT.x + 13, y: ALT.cy + 7 }], true);
      if (altSel != null) {
        const y = clamp(ALT.cy - (altSel - s.alt) * ALT.ppf, ALT.top, ALT.bot);
        style(2); poly([{ x: ALT.x - 4, y }, { x: ALT.x - 17, y: y - 7 }, { x: ALT.x - 17, y: y + 7 }], false);
      }
      T(altSel != null ? `SEL ${fmtAlt(altSel)}` : 'SEL ----', 735, ALT.top - 20, 11, { alpha: altSel != null ? 1 : 0.45 });

      style(2); line(VS.x, VS.cy - 124, VS.x, VS.cy + 124);
      for (let k = -2000; k <= 2000; k += 500) {
        const y = VS.cy - k * VS.ppf, len = k % 1000 === 0 ? (Math.abs(k) === 2000 ? 13 : 9) : 5;
        style(2); line(VS.x, y, VS.x - len, y);
        if (k !== 0 && k % 1000 === 0) T(String(Math.abs(k) / 1000), VS.x + 24, y, 9);
      }
      {
        const y = VS.cy - clamp(s.vs, -2200, 2200) * VS.ppf;
        fill(); poly([{ x: VS.x - 1, y }, { x: VS.x + 12, y: y - 6 }, { x: VS.x + 12, y: y + 6 }], true);
      }
      T(`V/S ${sgn(s.vs)}${Math.abs(Math.round(s.vs / 50) * 50)}`, 866, VS.cy + 142, 11, { align: 'right' });

      {
        const cx = HC.x, cy = 746, d = 42;
        style(2);
        for (const k of [-2, -1, 1, 2]) g.strokeCircle(cx + k * d, cy, 4.5);
        line(cx, cy - 9, cx, cy + 9);
        if (!n.flag) {
          const x = cx + clamp(n.dots / 5 * 2, -2.4, 2.4) * d;
          fill(); poly([{ x, y: cy - 12 }, { x: x + 7, y: cy }, { x, y: cy + 12 }, { x: x - 7, y: cy }], true);
        } else T('NAV', cx, cy - 24, 11, { color: AMBER });
        if (n.toFrom) {
          const k = n.toFrom === 'TO' ? 1 : -1;
          fill(); poly([{ x: cx + 118, y: cy - k * 6 }, { x: cx + 111, y: cy + k * 6 }, { x: cx + 125, y: cy + k * 6 }], true);
          T(n.toFrom, cx + 142, cy, 11, { align: 'left' });
        }
        T(n.kind === 'LOC' ? 'LOC' : n.kind === 'TACAN' || (!n.kind && n.src === 'TCN') ? 'TCN' : n.kind === 'DME' ? 'DME' : 'VOR', cx - 112, cy, 12, { align: 'right', color: n.flag ? AMBER : GREEN });
        T(`CRS ${pad3(n.course)}`, cx, cy + 28, 12);
      }
      if (n.gsShow && n.loc && n.loc.hasGs) {
        const gx = 632, d = 40;
        style(2);
        for (const k of [-2, -1, 1, 2]) g.strokeCircle(gx, HC.y + k * d, 4.5);
        line(gx - 10, HC.y, gx + 10, HC.y);
        if (!n.gsFlag) {
          const y = HC.y + clamp(n.gsDots / 5 * 2, -2.4, 2.4) * d;
          fill(); poly([{ x: gx, y: y - 12 }, { x: gx + 7, y }, { x: gx, y: y + 12 }, { x: gx - 7, y }], true);
        }
        T('GS', gx, HC.y - 2 * d - 20, 11, { color: n.gsFlag ? AMBER : GREEN });
      }

      const tcn = n.src === 'TCN', adf = n.adf;
      const radio = [
        [`NAV1 ${FI.fmtMhz(nv.mhz)}${!tcn && n.ident ? ' ' + n.ident : ''}`, tcn ? 0.5 : 1],
        [`TCN  ${nv.chan || '---'}${tcn && n.ident ? ' ' + n.ident : ''}`, tcn ? 1 : 0.5],
        [`ADF  ${nv.khz ? nv.khz + (adf.valid ? ' ' + adf.id : ' NO SIG') : 'OFF'}`, nv.khz ? 1 : 0.5],
        [`NAV2 ${nv.mhz2 ? FI.fmtMhz(nv.mhz2) + (n.nav2.ident ? ' ' + n.nav2.ident : '') + (n.nav2.dmeValid ? ' ' + n.nav2.dme.toFixed(1) + 'NM' : '') : 'OFF'}`, nv.mhz2 ? 1 : 0.5],
      ];
      radio.forEach(([str, a], i) => T(str, 34, 56 + i * 20, 11, { align: 'left', alpha: a }));

      const mode = (str, on) => ({ str, a: on ? 1 : 0.38 });
      const lat = navOn ? (n.kind === 'LOC' ? 'LOC' : n.kind === 'TACAN' ? 'TCN' : 'VOR') : 'HDG';
      const apRows = [
        { str: anyAp ? 'AP ON' : 'AP OFF', a: anyAp ? 1 : 0.5 },
        mode(`HDG ${pad3(hdgSel)}`, hdgOn && !navOn),
        mode(navOn ? `${ap.appr ? 'APPR' : 'NAV'} ${lat}${ap.gsCap ? ' GS' : ''}` : 'NAV ---', navOn),
        mode(altSel != null ? `ALT ${fmtAlt(altSel)}` : 'ALT ----', altSel != null),
        mode(spdSel != null ? `SPD ${Math.round(spdSel)}` : 'SPD ---', spdSel != null),
      ];
      apRows.forEach((row, i) => T(row.str, 866, 56 + i * 20, 11, { align: 'right', alpha: row.a }));

      const tas = s.tas, mach = FI.machOf(tas, s.alt);
      [`GS ${Math.round(s.gs)}`, `TAS ${Math.round(tas)}`, `M ${mach.toFixed(2).replace(/^0/, '')}`, `AOA ${aoa.toFixed(1)}`].forEach((str, i) => T(str, 116, 662 + i * 21, 12, { align: 'left' }));
      [`BARO 29.92`, `AGL ${fmtAlt(Math.max(0, s.alt - (FI.groundElev || 0)))}`].forEach((str, i) => T(str, 676, 662 + i * 21, 12, { align: 'left' }));

      const warn = ias < A.vS1 ? 'STALL' : ias > A.vNe ? 'OVERSPEED' : null;
      if (warn) {
        const bw = V.width(warn, 22) + 32;
        g.fillStyle(BLACK, 0.85); g.fillRect(HC.x - bw / 2, 672, bw, 36);
        style(2.5, 1, AMBER); g.strokeRect(HC.x - bw / 2, 672, bw, 36);
        T(warn, HC.x, 690, 22, { color: AMBER });
      }

      {
        const cx = 76, cy = 800;
        if (FI.wind.kt > 0) {
          const wa = (FI.wind.dir + 180 - s.hdg) * D2R, ux = Math.sin(wa), uy = -Math.cos(wa);
          style(2.5);
          line(cx - ux * 22, cy - uy * 22, cx + ux * 18, cy + uy * 18);
          fill(); poly([{ x: cx + ux * 26, y: cy + uy * 26 }, { x: cx + ux * 12 - uy * 8, y: cy + uy * 12 + ux * 8 }, { x: cx + ux * 12 + uy * 8, y: cy + uy * 12 - ux * 8 }], true);
          T(`WIND ${pad3(FI.wind.dir)}/${Math.round(FI.wind.kt)}`, 118, cy - 8, 12, { align: 'left' });
        } else T('WIND CALM', 118, cy - 8, 12, { align: 'left' });
        T(`TRK ${pad3(trk)}`, 118, cy + 14, 12, { align: 'left' });
      }

      const az = n.kind === 'VOR' || n.kind === 'TACAN';
      let ete = '-:--';
      if (n.dmeValid && s.gs > 20) { const m = Math.floor(n.dme / s.gs * 60); ete = `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; }
      [
        `DME ${n.dmeValid ? n.dme.toFixed(1) + ' NM' : '---.- NM'}`,
        `RAD ${az && n.vorValid ? pad3(n.radial) : '---'}`,
        `ETE ${ete}`,
        adf.valid ? `BRG ${pad3(adf.brgM)} ${adf.dist.toFixed(1)}NM` : 'BRG ---',
      ].forEach((str, i) => T(str, 866, 774 + i * 20, 12, { align: 'right' }));
    }

    return { root, update };
  };
})(window.FI);
