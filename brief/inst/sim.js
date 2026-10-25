// Flight model, navaids, nav receiver, autopilot and scenarios. No Phaser
// here: pure math and data, so it can be checked outside the page.
// Units: positions in feet (x east, y south, so north is up on screen),
// headings and bearings in degrees true (0 = north, clockwise), speeds in
// knots, altitude in feet, vertical speed in feet per minute.
window.FI = window.FI || {};

(function (FI) {
  'use strict';

  const NM = 6076.12;          // feet per nautical mile
  const KT = 1.6878099;        // ft/s per knot
  const KT2FPM = 101.269;      // vertical fpm per knot of vertical speed
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const norm360 = a => ((a % 360) + 360) % 360;
  const norm180 = a => { a = norm360(a); return a > 180 ? a - 360 : a; };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  Object.assign(FI, { NM, KT, KT2FPM, D2R, R2D, norm360, norm180, clamp });

  // ---------- aircraft: a 172-class trainer ----------
  // Thrust from a fixed-pitch prop falls with speed: T = kT * power / V.
  // Drag: parasite grows with V², induced falls with V². Both in kt/s of
  // speed change. Full power holds about 125 kt level, 65% about 106 kt,
  // and the glide at 68 kt is about 11:1.
  const AC = FI.AC = {
    name: 'Trainer', kT: 3.88, tMax: 4.0, dragA: 1.824, dragB: 0.39,
    vMin: 45, vNe: 163, vS0: 40, vS1: 48, vFe: 85, vNo: 129,
    rollRate: 15, pitchRate: 3, maxBank: 30, pitchMin: -10, pitchMax: 15,
  };
  const aoa = V => 0.5 + 4.5 * (85 / Math.max(V, 40)) ** 2;      // degrees, level flight
  const thrust = (V, p) => Math.min(AC.tMax, AC.kT * (p / 100) * (100 / Math.max(V, 40)));
  const drag = V => { const v = Math.max(V, 40) / 100; return AC.dragA * v * v + AC.dragB / (v * v); };
  FI.aoa = aoa;

  // ---------- state ----------
  const S = FI.state = {
    x: 0, y: 0, hdg: 0, ias: 100, alt: 3000, vs: 0, pitch: 3.5, bank: 0, power: 65,
    cmdBank: 0, cmdPitch: 3.5, tas: 100, gs: 100, trk: 0, turnRate: 0, t: 0,
  };
  // radios and bugs the student sets: CDI source, NAV MHz, TACAN channel,
  // ADF kHz, OBS and heading bug (magnetic)
  FI.nav = { src: 'NAV', mhz: 112.6, chan: '73X', khz: 0, obs: 90, bug: 0 };
  FI.wind = { dir: 0, kt: 0 };                           // wind from dir at kt
  FI.ap = { hdg: false, alt: false, nav: false, altTgt: 3000, gsCap: false };
  FI.trail = [];
  FI.paused = false;
  FI.speed = 1;
  FI.msg = '';
  FI.scn = null;                                         // running scenario, see loadScenario
  let trailT = 0;

  const stdBank = () => Math.atan(3 * S.tas / 1091) * R2D;  // bank for a standard-rate turn
  FI.stdBank = stdBank;

  // Heading that gives ground track T in the current wind.
  function headingFor(T) {
    const w = FI.wind;
    const x = w.kt * Math.sin((w.dir - T) * D2R) / Math.max(S.tas, 40);
    return norm360(T + Math.asin(clamp(x, -0.9, 0.9)) * R2D);
  }

  // Cross-track distance (nm, right of course positive) from the line with
  // direction `course` through (px, py).
  function xtk(course, px, py) {
    const pe = S.x - px, pn = -(S.y - py);
    return (pe * Math.cos(course * D2R) - pn * Math.sin(course * D2R)) / NM;
  }
  FI.xtk = xtk;

  // ---------- receivers ----------
  // The aircraft has a VHF nav radio (VOR and localizer by frequency, plus
  // the DME paired with it), a military TACAN receiver (azimuth and DME by
  // channel) and an ADF (NDB bearing by kHz). The CDI shows NAV or TCN.
  //
  // VOR and TACAN azimuth: the needle shows the OBS course against the
  // radial, full scale 10°, TO when the radial is within 90° of the
  // reciprocal of the course. Radials are magnetic with the station's own
  // variation. The localizer is about the extended centerline, measured from
  // the antenna, and the same side of the centerline deflects the needle the
  // same way on the front or the back course, so a back course reads
  // backwards. The glideslope is ±0.7° about the published angle.
  const same = (a, b) => a != null && b != null && Math.abs(a - b) < 0.001;
  const dNm = (s, x, y) => Math.hypot(S.x - (x != null ? x : s.x), S.y - (y != null ? y : s.y)) / NM;
  const agl = s => S.alt - (s.elev || 0);
  const inRange = s => dNm(s) <= FI.vhfRange(s.vorCls || s.dmeCls, agl(s));
  const dmeRange = s => dNm(s) <= FI.vhfRange(s.dmeCls || s.vorCls, agl(s));
  const bearingFrom = s => norm360(Math.atan2(S.x - s.x, -(S.y - s.y)) * R2D);   // true
  const nearestFirst = list => list.slice().sort((a, b) => dNm(a) - dNm(b));

  // The localizer on this frequency: the one whose front course we are on,
  // else the nearest. Opposite ends of a runway often share a frequency.
  function locSignal(L) {
    const c = L.course * D2R, vx = S.x - L.loc.x, vy = S.y - L.loc.y;
    const along = -(vx * Math.sin(c) - vy * Math.cos(c));          // ft before the antenna, front course positive
    const cross = vx * Math.cos(c) + vy * Math.sin(c);             // ft right of the course
    const d = Math.hypot(vx, vy), off = Math.atan2(Math.abs(cross), Math.abs(along)) * R2D;
    const valid = (d <= 18 * NM && off <= 10) || (d <= 10 * NM && off <= 35);
    return { along, cross, d, valid, front: along > 0, dev: -Math.asin(clamp(cross / Math.max(d, 1), -1, 1)) * R2D };
  }
  function pickLoc(list) {
    let best = null;
    for (const L of list) {
      const g = locSignal(L), score = (g.valid ? 0 : 1e9) + (g.front ? 0 : 1e8) + g.d;
      if (!best || score < best.score) best = { L, g, score };
    }
    return best;
  }

  function computeNav() {
    const n = {}, nv = FI.nav;
    n.src = nv.src;
    let st = null, loc = null, dmeSt = null, az = false;
    if (nv.src === 'TCN') {
      // TACAN channel: azimuth and DME from a TACAN or VORTAC, DME only from a DME
      const c = String(nv.chan || '').toUpperCase();
      const cands = nearestFirst(FI.stations.filter(s => (s.tacan || s.dme) && s.chan === c));
      st = cands.find(s => s.tacan && inRange(s)) || cands.find(s => dmeRange(s)) || cands[0] || null;
      if (st) { az = st.tacan; dmeSt = st; }
      n.kind = st ? (st.tacan ? 'TACAN' : 'DME') : null;
    } else {
      const f = nv.mhz;
      const locs = FI.ilsList.filter(l => same(l.mhz, f));
      const vors = nearestFirst(FI.stations.filter(s => s.vor && same(s.mhz, f)));
      const vor = vors.find(inRange) || vors[0] || null;
      const lp = locs.length ? pickLoc(locs) : null;
      if (lp && (lp.g.valid || !vor || !inRange(vor))) { loc = lp.L; n.locG = lp.g; }
      else if (vor) { st = vor; az = true; }
      // DME on the paired channel: the station's own, or a separate DME or TACAN
      if (loc && loc.dme) dmeSt = { id: loc.id, x: loc.dme.x, y: loc.dme.y, elev: loc.elev, dmeCls: 'T', ils: true };
      else if (st && st.dme) dmeSt = st;
      else {
        const ds = nearestFirst(FI.stations.filter(s => s.dme && !s.vor && same(s.mhz, f)));
        dmeSt = ds.find(dmeRange) || null;
        if (!st && !loc && ds[0]) { st = ds[0]; dmeSt = ds[0]; }
      }
      n.kind = loc ? 'LOC' : st ? (az ? 'VOR' : 'DME') : null;
    }
    n.station = loc || st;
    n.source = n.kind === 'LOC' ? 'ILS' : 'VOR';
    n.ident = n.station ? n.station.id : null;

    // azimuth (VOR or TACAN)
    n.radial = null; n.dist = n.station ? dNm(n.station, n.station.x, n.station.y) : null;
    n.cone = false; n.to = false; n.toFrom = null; n.vorValid = false;
    if (st && az) {
      n.radial = norm360(bearingFrom(st) - st.varE);
      n.cone = Math.max(agl(st), 0) > dNm(st) * NM * 1.2;           // inside the cone over the station
      n.vorValid = inRange(st) && !n.cone;
      const d = norm180(n.radial - nv.obs);
      n.to = Math.abs(d) > 90;
      n.cdiVor = n.to ? norm180(d - 180) : -d;
    }
    // localizer and glideslope
    n.locValid = false; n.gsValid = false; n.front = true; n.locDev = 0; n.gsDev = 0;
    if (loc) {
      const g = n.locG || locSignal(loc);
      n.locDev = g.dev; n.front = g.front; n.locValid = g.valid;
      if (loc.hasGs) {
        const gd = Math.hypot(S.x - loc.gs.x, S.y - loc.gs.y);
        const c = loc.course * D2R, past = -((S.x - loc.gs.x) * Math.sin(c) - (S.y - loc.gs.y) * Math.cos(c));
        n.gsDev = Math.atan2(S.alt - loc.elev, Math.max(gd, 1)) * R2D - loc.gsAngle;   // above positive
        n.gsValid = n.front && past > 0 && gd / NM <= 10 && Math.abs(n.locDev) <= 8 && Math.abs(n.gsDev) <= 5;
      }
    }
    // DME: slant range
    n.dmeId = dmeSt ? dmeSt.id : null;
    n.dmeValid = !!dmeSt && dmeRange(dmeSt);
    n.dme = n.dmeValid ? Math.hypot(dNm(dmeSt) * NM, agl(dmeSt)) / NM : null;

    if (n.kind === 'VOR' || n.kind === 'TACAN') {
      n.cdi = n.cdiVor; n.full = 10; n.flag = !n.vorValid; n.toFrom = n.vorValid ? (n.to ? 'TO' : 'FROM') : null;
      n.gsShow = false; n.gsFlag = true; n.course = nv.obs;
    } else if (n.kind === 'LOC') {
      n.cdi = n.locDev; n.full = loc.locFull; n.flag = !n.locValid;
      n.gsShow = true; n.gsFlag = !n.gsValid; n.course = Math.round(loc.crsM);
    } else {
      n.cdi = 0; n.full = 10; n.flag = true; n.gsShow = false; n.gsFlag = true; n.course = nv.obs;
    }
    n.loc = loc;
    n.dots = n.flag ? 0 : clamp(n.cdi / n.full * 5, -5.5, 5.5);
    n.gsDots = n.gsValid ? clamp(n.gsDev / loc.gsFull * 5, -5.5, 5.5) : 0;
    // what the autopilot's NAV mode follows, in true degrees
    n.track = (n.kind === 'VOR' || n.kind === 'TACAN') && n.vorValid ? { course: norm360(nv.obs + st.varE), x: st.x, y: st.y }
      : loc && n.locValid ? { course: loc.course, x: loc.loc.x, y: loc.loc.y } : null;

    // ADF: relative bearing to the NDB on the tuned frequency
    const ndbs = nearestFirst(FI.stations.filter(s => s.ndb && s.khz === nv.khz));
    const ndb = ndbs.find(s => dNm(s) <= FI.ndbRange(s.ndbCls)) || null;
    n.adf = ndb ? (() => {
      const brg = norm360(Math.atan2(ndb.x - S.x, -(ndb.y - S.y)) * R2D);  // true bearing to the station
      return { valid: true, id: ndb.id, name: ndb.name, rel: norm360(brg - S.hdg), brgM: FI.toMag(brg), dist: dNm(ndb), st: ndb };
    })() : { valid: false, id: ndbs[0] ? ndbs[0].id : null, rel: 90 };
    FI.navOut = n;
    return n;
  }
  FI.computeNav = computeNav;

  // ---------- autopilot ----------
  // Targets come from the running scenario step, or from the HDG, ALT and
  // NAV buttons. Lateral: bank toward a heading, a ground track that closes
  // on a course line (30° intercept, less when close), or a fixed bank.
  // Vertical: vertical speed toward an altitude, or down the glideslope once
  // it is captured from below. Speed: power for the target airspeed.
  function targets() {
    const sc = FI.scn, ap = FI.ap, nv = FI.nav;
    if (sc && !sc.off && sc.step) return sc.step;
    const t = {};
    if (ap.nav) {
      // follow the CDI: a radial or the localizer; with no signal, hold heading
      const n = FI.navOut;
      if (n && n.track) { t.track = n.track; if (n.kind === 'LOC') t.gs = true; }
      else t.hdg = S.hdg;
    } else if (ap.hdg) t.hdg = FI.toTrue(nv.bug);
    if (ap.alt) t.alt = ap.altTgt;
    return t;
  }

  function autopilot(dt, t, n) {
    const ap = FI.ap;
    // lateral
    let bank = null;
    if (t.bank != null) bank = t.bank === 'std' ? stdBank() : t.bank === '-std' ? -stdBank() : t.bank;
    else {
      let hdgTgt = null;
      if (t.track) {
        const off = xtk(t.track.course, t.track.x, t.track.y);
        const T = norm360(t.track.course - clamp(off * 30, -30, 30));
        hdgTgt = headingFor(T);
        ap.info = { xtk: off, trkTgt: T };
      } else if (t.hdg != null) hdgTgt = t.hdg;
      if (hdgTgt != null) {
        const lim = Math.min(AC.maxBank - 5, stdBank());
        bank = clamp(norm180(hdgTgt - S.hdg) * 1.2, -lim, lim);
      }
    }
    if (bank != null) S.cmdBank = bank;
    // vertical
    let vsTgt = null;
    if (t.gs && n.gsValid && n.gsDev >= -0.1) ap.gsCap = true;
    if (t.gs && ap.gsCap && n.gsValid) {
      vsTgt = clamp(-S.gs * KT2FPM * Math.tan(n.loc.gsAngle * D2R) - 600 * n.gsDev, -1500, 300);
    } else if (t.vs != null) vsTgt = t.vs;
    else if (t.alt != null) {
      const vmax = t.vsMax || 500;
      vsTgt = clamp((t.alt - S.alt) * 2, -vmax, vmax);
    }
    if (vsTgt != null) {
      const g = Math.asin(clamp(vsTgt / (S.tas * KT2FPM), -0.5, 0.5)) * R2D;
      S.cmdPitch = clamp(g + aoa(S.ias), AC.pitchMin, AC.pitchMax);
    }
    // speed
    if (t.ias != null) {
      const gamma = (S.pitch - aoa(S.ias)) * D2R;
      const need = (drag(S.ias) + 19.06 * Math.sin(gamma)) * S.ias / AC.kT;
      S.power = clamp(need + 2 * (t.ias - S.ias), 0, 100);
    }
  }

  // ---------- flight model ----------
  function physics(dt) {
    const w = FI.wind;
    // controls move toward their commands at fixed rates
    const db = clamp(S.cmdBank, -AC.maxBank, AC.maxBank) - S.bank;
    S.bank += clamp(db, -AC.rollRate * dt, AC.rollRate * dt);
    const dp = clamp(S.cmdPitch, AC.pitchMin, AC.pitchMax) - S.pitch;
    S.pitch += clamp(dp, -AC.pitchRate * dt, AC.pitchRate * dt);
    // turn
    S.tas = S.ias * (1 + 0.02 * S.alt / 1000);
    S.turnRate = 1091 * Math.tan(S.bank * D2R) / Math.max(S.tas, 40);
    S.hdg = norm360(S.hdg + S.turnRate * dt);
    // climb and speed from pitch and power
    const gamma = (S.pitch - aoa(S.ias)) * D2R;
    S.vs = S.tas * KT2FPM * Math.sin(gamma);
    S.alt = Math.max(FI.groundElev || 0, S.alt + S.vs / 60 * dt);   // no terrain: the home field's elevation is the ground
    const acc = thrust(S.ias, S.power) - drag(S.ias) - 19.06 * Math.sin(gamma);
    S.ias = clamp(S.ias + acc * dt, AC.vMin, 220);
    // ground track with wind
    const h = S.hdg * D2R, wd = w.dir * D2R;
    const ge = S.tas * Math.sin(h) - w.kt * Math.sin(wd), gn = S.tas * Math.cos(h) - w.kt * Math.cos(wd);
    S.gs = Math.hypot(ge, gn);
    S.trk = norm360(Math.atan2(ge, gn) * R2D);
    S.x += ge * KT * dt;
    S.y -= gn * KT * dt;
    S.t += dt;
    trailT += dt;
    if (trailT >= 0.5) { trailT = 0; FI.trail.push({ x: S.x, y: S.y }); if (FI.trail.length > 2400) FI.trail.shift(); }
  }

  const STEP = 0.05;
  let acc = 0;
  // Advance the simulation by `ms` of wall time, in fixed steps.
  FI.advance = function (ms) {
    if (FI.paused) return;
    acc += Math.min(ms, 250) / 1000 * FI.speed;
    while (acc >= STEP) {
      acc -= STEP;
      const n = computeNav();
      autopilot(STEP, targets(), n);
      physics(STEP);
      scenarioTick(STEP);
    }
    computeNav();
  };

  // ---------- student input ----------
  // Any stick, power or drag input ends a running scenario and shows
  // "You have control". Outside a scenario, a bank input releases the HDG
  // and NAV holds and a pitch input releases ALT.
  FI.takeover = function () {
    const sc = FI.scn, ap = FI.ap;
    if (sc && !sc.off) sc.off = true;
    ap.hdg = ap.alt = ap.nav = false; ap.gsCap = false; ap.info = null;
    FI.msg = 'You have control';
  };
  FI.setControl = function (axis, v) {
    const sc = FI.scn, ap = FI.ap;
    if (sc && !sc.off) FI.takeover();
    if (axis === 'bank') { S.cmdBank = clamp(v, -AC.maxBank, AC.maxBank); ap.hdg = ap.nav = false; ap.gsCap = false; }
    if (axis === 'pitch') { S.cmdPitch = clamp(v, AC.pitchMin, AC.pitchMax); ap.alt = false; ap.gsCap = false; }
    if (axis === 'power') S.power = clamp(v, 0, 100);
  };
  FI.place = function (x, y, hdg) {
    FI.takeover();
    if (x != null) { S.x = x; S.y = y; }
    if (hdg != null) S.hdg = norm360(hdg);
    FI.trail.length = 0;
    computeNav();
  };
  // HDG, ALT and NAV buttons outside a scenario.
  FI.setAp = function (mode, on) {
    const sc = FI.scn, ap = FI.ap;
    if (sc && !sc.off) FI.takeover();
    if (mode === 'alt') { ap.alt = on; if (on) ap.altTgt = Math.round(S.alt / 100) * 100; ap.gsCap = false; }
    if (mode === 'hdg') { ap.hdg = on; if (on) ap.nav = false; }
    if (mode === 'nav') { ap.nav = on; if (on) ap.hdg = false; ap.gsCap = false; }
    if (!on && mode !== 'alt') ap.info = null;
    FI.msg = '';
  };

  // ---------- scenarios ----------
  // Each scenario is a start state plus steps the autopilot flies in turn.
  // A step holds its targets until `until` is true; the last step holds on.
  // They are built around the home airport: its nearest VOR, TACAN and NDB
  // and the chosen approach. Headings and courses in the names are
  // magnetic; the steps hold true values for the autopilot.
  const pad3 = h => String(Math.round(norm360(h)) % 360 || 360).padStart(3, '0');
  const fmtAlt = a => Math.round(a).toLocaleString('en-US');
  FI.pad3 = pad3;
  FI.SCENARIOS = [];

  FI.buildScenarios = function () {
    const H = FI.home, apt = H.apt, M = FI.toTrue;
    const V = H.vor || { id: apt.code, x: apt.x, y: apt.y, varE: FI.magVar, mhz: 108, elev: apt.elev, type: 'VOR' };
    const A = Math.max(2000, Math.round((apt.elev + 3000) / 500) * 500);       // working altitude, about 3,000 ft above the field
    const vt = (s, m) => norm360(m + s.varE);                                  // magnetic course at a station -> true
    const posAt = (s, radial, nm) => { const b = vt(s, radial) * D2R; return { x: s.x + Math.sin(b) * nm * NM, y: s.y - Math.cos(b) * nm * NM }; };
    const pos = (radial, nm) => posAt(V, radial, nm);
    const via = (s, m) => ({ course: vt(s, m), x: s.x, y: s.y });
    const viaVor = m => via(V, m);
    const dist = s => Math.hypot(S.x - s.x, S.y - s.y) / NM;
    const level = (alt, hdg) => ({ name: `Hold heading ${pad3(hdg)}, ${fmtAlt(alt)} ft`, hdg: M(hdg), alt, ias: 100 });
    const radios = { src: 'NAV', mhz: V.mhz, chan: H.tacan ? H.tacan.chan : FI.nav.chan, khz: H.ndb ? H.ndb.khz : FI.nav.khz };
    const vorName = `${V.id} ${V.type || 'VOR'} ${FI.fmtMhz(V.mhz)}`;
    const list = [
      {
        id: 'level', name: `Straight and level across ${V.id}`,
        brief: `${vorName}. Hold heading 045 at ${fmtAlt(A)} ft and 100 kt. Watch the TO flag flip to FROM as you cross the station.`,
        start: { ...pos(225, 6), hdg: M(45), alt: A, ias: 100 }, nav: { ...radios, obs: 45, bug: 45 },
        steps: [{ name: 'Straight and level, heading 045', hdg: M(45), alt: A, ias: 100 }],
      },
      {
        id: 'turn360', name: 'Standard-rate 360° turn',
        brief: 'A right turn at 3° per second: about 15° of bank at 100 kt, two minutes around. Watch the turn coordinator and the heading indicator.',
        start: { ...pos(180, 5), hdg: M(360), alt: A, ias: 100 }, nav: { ...radios, obs: 360, bug: 360 },
        steps: [
          { name: 'Standard-rate turn to the right', bank: 'std', alt: A, ias: 100, until: (c) => c.turned >= 360 - S.bank / 2 },
          { name: 'Roll out on heading 360', hdg: M(360), alt: A, ias: 100 },
        ],
      },
      {
        id: 'climb', name: 'Climb 1,000 ft and level off',
        brief: `Climb from ${fmtAlt(A)} to ${fmtAlt(A + 1000)} ft at 500 fpm and 90 kt, then level off. Watch the VSI lead and the altimeter catch up.`,
        start: { ...pos(270, 6), hdg: M(90), alt: A, ias: 100 }, nav: { ...radios, obs: 90, bug: 90 },
        steps: [
          { name: `Climb to ${fmtAlt(A + 1000)} ft at 500 fpm, 90 kt`, hdg: M(90), alt: A + 1000, vsMax: 500, ias: 90, until: () => Math.abs(S.alt - A - 1000) < 30 && Math.abs(S.vs) < 80 },
          { name: `Level at ${fmtAlt(A + 1000)} ft, 100 kt`, hdg: M(90), alt: A + 1000, ias: 100 },
        ],
      },
      {
        id: 'radialOut', name: `Intercept and track the ${V.id} 090 radial outbound`,
        brief: `${vorName}, OBS 090. From south of the course the needle is left: fly toward it with a 30° intercept, then track outbound with the FROM flag.`,
        start: { ...pos(160, 4), hdg: M(360), alt: A, ias: 100 }, nav: { ...radios, obs: 90, bug: 60 },
        steps: [
          { name: 'Intercept the 090 radial, heading 060', track: viaVor(90), alt: A, ias: 100, until: () => Math.abs(xtk(vt(V, 90), V.x, V.y)) < 0.15 },
          { name: 'Track the 090 radial outbound', track: viaVor(90), alt: A, ias: 100, until: () => dist(V) >= 12 },
          level(A, 90),
        ],
      },
      {
        id: 'direct', name: `Direct to ${V.id} and station passage`,
        brief: `${vorName}. Inbound on the 300 radial with course 120 set: the needle is centered with TO. Over the station the flag shows, then FROM as you go outbound.`,
        start: { ...pos(300, 8), hdg: M(120), alt: A, ias: 100 }, nav: { ...radios, obs: 120, bug: 120 },
        steps: [
          { name: 'Track inbound on the 300 radial, course 120', track: viaVor(120), alt: A, ias: 100, until: () => dist(V) < 0.4 },
          { name: 'Station passage: TO becomes FROM', track: viaVor(120), alt: A, ias: 100, until: () => dist(V) > 1 },
          { name: 'Track outbound on the 120 radial', track: viaVor(120), alt: A, ias: 100, until: () => dist(V) >= 8 },
          level(A, 120),
        ],
      },
    ];
    // the approach
    const L = H.ils;
    if (L) {
      const c = L.course * D2R, dx = Math.sin(c), dy = -Math.cos(c), rx = Math.cos(c), ry = Math.sin(c);
      const viaLoc = { course: L.course, x: L.loc.x, y: L.loc.y };
      const crs = Math.round(L.crsM), ih = norm360(crs - 30);
      const da = L.hasGs ? L.da : L.elev + 500;
      const steps = [
        { name: `Intercept the localizer, heading ${pad3(ih)}`, hdg: norm360(L.course - 30), alt: A, ias: 100, until: () => FI.navOut.kind === 'LOC' && FI.navOut.locValid && Math.abs(FI.navOut.locDev) < 1.2 },
      ];
      if (L.hasGs) {
        steps.push({ name: 'Track the localizer, glideslope armed', track: viaLoc, alt: A, gs: true, ias: 90, until: () => FI.ap.gsCap });
        steps.push({ name: 'Descend on the glideslope, 90 kt', track: viaLoc, gs: true, ias: 90, until: () => S.alt <= da });
      } else {
        steps.push({ name: 'Track the localizer', track: viaLoc, alt: A, ias: 90, until: () => Math.hypot(S.x - L.thr.x, S.y - L.thr.y) / NM < 6 });
        steps.push({ name: `Descend to ${fmtAlt(da)} ft at 700 fpm`, track: viaLoc, alt: da, vsMax: 700, ias: 90, until: () => Math.hypot(S.x - L.thr.x, S.y - L.thr.y) / NM < 0.8 });
      }
      steps.push({ name: `Missed approach: climb to ${fmtAlt(A)} ft on runway heading`, hdg: L.course, alt: A, vsMax: 700, ias: 80 });
      list.push({
        id: 'ils', name: `${L.name} at ${apt.code}`,
        brief: `${L.id} ${FI.fmtMhz(L.mhz)}, course ${pad3(crs)}. Heading ${pad3(ih)} cuts the localizer at 30°. Track it inbound` +
          (L.hasGs ? `, capture the ${L.gsAngle}° glideslope from below at 90 kt, descend to the ${fmtAlt(da)} ft decision altitude and go around.` : `, descend to ${fmtAlt(da)} ft (no glideslope on this one) and go around.`),
        start: { x: L.thr.x - dx * 16 * NM + rx * 3 * NM, y: L.thr.y - dy * 16 * NM + ry * 3 * NM, hdg: norm360(L.course - 30), alt: A, ias: 100 },
        nav: { ...radios, src: 'NAV', mhz: L.mhz, obs: crs, bug: ih }, steps,
      });
    }
    list.push({
      id: 'xwind', name: 'Track a radial in a crosswind',
      brief: `Wind from the north at 20 kt. To keep the needle centered on course 090 to ${V.id} the nose points about 12° left of the track: heading and track differ by the wind correction angle.`,
      start: { ...pos(270, 8), hdg: norm360(vt(V, 90) - 12), alt: A, ias: 100 }, nav: { ...radios, obs: 90, bug: 78 }, wind: { dir: 360, kt: 20 },
      steps: [
        { name: 'Track course 090 to the station, crabbed into the wind', track: viaVor(90), alt: A, ias: 100, until: () => dist(V) < 0.4 },
        { name: 'Track the 090 radial outbound, still crabbed', track: viaVor(90), alt: A, ias: 100 },
      ],
    });
    const T = H.tacan;
    if (T) {
      list.push({
        id: 'tacan', name: `TACAN: ${T.id} channel ${T.chan}, 180 radial outbound`,
        brief: `${T.id} ${T.type}, channel ${T.chan}. The TACAN receiver gives azimuth and DME by channel. Inbound on the 360 radial with course 180 set, cross the station and track the 180 radial out to 10 DME.`,
        start: { ...posAt(T, 360, 8), hdg: M(180), alt: A, ias: 100 }, nav: { ...radios, src: 'TCN', chan: T.chan, obs: 180, bug: 180 },
        steps: [
          { name: 'Track inbound on the 360 radial, course 180', track: via(T, 180), alt: A, ias: 100, until: () => dist(T) < 0.4 },
          { name: 'Station passage: TO becomes FROM', track: via(T, 180), alt: A, ias: 100, until: () => dist(T) > 1 },
          { name: 'Track the 180 radial outbound to 10 DME', track: via(T, 180), alt: A, ias: 100, until: () => dist(T) >= 10 },
          level(A, 180),
        ],
      });
    }
    const N = H.ndb;
    if (N) {
      const p = posAt(N, 250, 10), brg = norm360(Math.atan2(N.x - p.x, -(N.y - p.y)) * R2D);
      list.push({
        id: 'ndb', name: `NDB: track to ${N.id} and station passage`,
        brief: `${N.id} NDB ${N.khz} kHz on the ADF. Turn until the needle points at the nose (0°), track to the beacon, and watch the needle swing to the tail (180°) over it.`,
        start: { ...p, hdg: norm360(brg + 60), alt: A, ias: 100 }, nav: { ...radios, khz: N.khz, obs: 90, bug: Math.round(FI.toMag(brg)) },
        steps: [
          { name: `Turn and track to ${N.id}, needle on the nose`, mode: 'TRK', track: { course: brg, x: N.x, y: N.y }, alt: A, ias: 100, until: () => dist(N) < 0.3 },
          { name: 'Station passage: the needle swings to the tail', mode: 'TRK', track: { course: brg, x: N.x, y: N.y }, alt: A, ias: 100, until: () => dist(N) > 4 },
          level(A, Math.round(FI.toMag(brg))),
        ],
      });
    }
    FI.SCENARIOS = list;
    FI.freeStart = { ...pos(225, 6), hdg: M(45), alt: A, ias: 100, nav: { ...radios } };
  };

  FI.loadScenario = function (def) {
    const st = def.start;
    Object.assign(S, { x: st.x, y: st.y, hdg: st.hdg, alt: st.alt, ias: st.ias, vs: 0, bank: 0, cmdBank: 0, turnRate: 0, t: 0 });
    S.pitch = S.cmdPitch = aoa(S.ias);
    S.power = clamp(drag(S.ias) * S.ias / AC.kT, 0, 100);
    Object.assign(FI.nav, def.nav);
    if (def.wind) Object.assign(FI.wind, def.wind);
    Object.assign(FI.ap, { hdg: false, alt: false, nav: false, gsCap: false, info: null, altTgt: st.alt });
    FI.trail.length = 0; trailT = 0; acc = 0;
    FI.scn = { def, i: 0, step: def.steps[0], ctx: newCtx(), off: false, done: false };
    FI.msg = '';
    FI.paused = false;
    computeNav();
    physics(0);
    computeNav();
  };
  // Clear everything and leave the aircraft southwest of the home VOR, flown by hand.
  FI.freeFlight = function () {
    FI.scn = null;
    const f = FI.freeStart;
    Object.assign(S, { x: f.x, y: f.y, hdg: f.hdg, alt: f.alt, ias: f.ias, vs: 0, bank: 0, cmdBank: 0, turnRate: 0, t: 0 });
    S.pitch = S.cmdPitch = aoa(S.ias); S.power = clamp(drag(S.ias) * S.ias / AC.kT, 0, 100);
    Object.assign(FI.ap, { hdg: false, alt: false, nav: false, gsCap: false, info: null });
    FI.trail.length = 0; trailT = 0; acc = 0; FI.msg = 'You have control'; FI.paused = false;
    physics(0); computeNav();
  };
  const newCtx = () => ({ t: 0, turned: 0, hdg0: S.hdg, alt0: S.alt });

  function scenarioTick(dt) {
    const sc = FI.scn;
    if (!sc || sc.off || sc.done) return;
    const c = sc.ctx;
    c.t += dt; c.turned += Math.abs(S.turnRate) * dt;
    if (sc.step.until && sc.step.until(c)) {
      if (sc.i + 1 < sc.def.steps.length) { sc.i++; sc.step = sc.def.steps[sc.i]; sc.ctx = newCtx(); }
      else sc.done = true;
    }
  }

  // Text for the status bar: what is flying the aircraft right now.
  FI.statusText = function () {
    const sc = FI.scn, ap = FI.ap, n = FI.navOut || {};
    if (sc && !sc.off) return (sc.done ? 'Scenario complete · ' : 'Autopilot: ') + sc.step.name;
    const m = [];
    if (ap.nav) m.push('NAV ' + (n.kind === 'LOC' ? `${n.loc.name}` + (ap.gsCap ? ' + GS' : '') : n.track ? `${n.ident} course ${pad3(FI.nav.obs)}` : 'no signal, holding heading'));
    else if (ap.hdg) m.push('HDG ' + pad3(FI.nav.bug));
    if (ap.alt && !(ap.gsCap && ap.nav)) m.push('ALT ' + fmtAlt(ap.altTgt));
    return m.length ? 'Autopilot: ' + m.join(' · ') : (FI.msg || 'You have control');
  };
})(window.FI);
