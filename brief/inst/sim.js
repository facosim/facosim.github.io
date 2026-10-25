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

  // ---------- navaids ----------
  // One VOR/DME at the origin and one airport to the south-east with an ILS
  // to runway 27. The runway is at sea level.
  const VOR = FI.VOR = { x: 0, y: 0, id: 'FCO', freq: '113.00', range: 40 };
  const RWY = FI.RWY = (() => {
    const thrX = 10 * NM, y = 4 * NM, len = 5000, course = 270;
    return {
      id: 'FCO', name: 'ILS RWY 27', freq: '110.30', course, y, len, width: 150, elev: 0,
      thr: { x: thrX, y },                       // threshold of 27 (east end)
      end: { x: thrX - len, y },                 // west end
      loc: { x: thrX - len - 1000, y },          // localizer antenna past the far end
      gs: { x: thrX - 1000, y: y - 400 },        // glideslope antenna beside the touchdown zone
      gsAngle: 3, tch: 50, da: 200,              // 3° path, 50 ft threshold crossing, 200 ft DA
      locFull: 2.5, gsFull: 0.7,                 // full-scale deflection, degrees
    };
  })();

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
  FI.nav = { source: 'VOR', obs: 90, bug: 0 };         // receiver and bugs the student sets
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

  // ---------- nav receiver ----------
  // The VOR needle: deviation of the OBS course from the radial, full scale
  // 10°, with TO when the radial is within 90° of the reciprocal course.
  // The localizer is ±2.5° about the extended centerline, measured from the
  // antenna, and the same side of the centerline deflects the needle the
  // same way whether the aircraft is on the front or the back course, so a
  // back course reads backwards. The glideslope is ±0.7° about 3°.
  function computeNav() {
    const n = {}, nv = FI.nav;
    const e = S.x - VOR.x, nn = -(S.y - VOR.y);
    n.radial = norm360(Math.atan2(e, nn) * R2D);
    n.dist = Math.hypot(e, nn) / NM;
    n.cone = n.dist * NM < S.alt;                        // over the station
    n.vorValid = n.dist <= VOR.range && !n.cone;
    const d = norm180(n.radial - nv.obs);
    n.to = Math.abs(d) > 90;
    n.cdiVor = n.to ? norm180(d - 180) : -d;             // degrees, needle right positive

    const le = S.x - RWY.loc.x, ln = -(S.y - RWY.loc.y);
    const ld = Math.hypot(le, ln);
    n.locDev = -Math.asin(clamp(ln / Math.max(ld, 1), -1, 1)) * R2D;
    n.front = le > 0;
    n.locValid = ld / NM <= 25 && Math.abs(ln) <= Math.abs(le) * Math.tan(35 * D2R) + 1500;
    const gd = Math.hypot(S.x - RWY.gs.x, S.y - RWY.gs.y);
    n.gsDev = Math.atan2(S.alt - RWY.elev - RWY.tch, Math.max(gd, 1)) * R2D - RWY.gsAngle;   // above positive
    n.gsValid = n.front && S.x > RWY.gs.x && gd / NM <= 10 && Math.abs(n.locDev) <= 8 && Math.abs(n.gsDev) <= 5;

    n.source = nv.source;
    if (nv.source === 'VOR') {
      n.cdi = n.cdiVor; n.full = 10; n.flag = !n.vorValid; n.toFrom = n.vorValid ? (n.to ? 'TO' : 'FROM') : null;
      n.dme = Math.hypot(n.dist * NM, S.alt) / NM;
      n.gsShow = false; n.gsFlag = true;
    } else {
      n.cdi = n.locDev; n.full = RWY.locFull; n.flag = !n.locValid; n.toFrom = null;
      n.dme = Math.hypot(ld, S.alt - RWY.elev) / NM;
      n.gsShow = true; n.gsFlag = !n.gsValid;
    }
    n.dots = clamp(n.cdi / n.full * 5, -5.5, 5.5);
    n.gsDots = n.gsValid ? clamp(n.gsDev / RWY.gsFull * 5, -5.5, 5.5) : 0;
    n.course = nv.source === 'VOR' ? nv.obs : RWY.course;
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
      t.track = nv.source === 'VOR' ? { course: nv.obs, x: VOR.x, y: VOR.y } : { course: RWY.course, x: RWY.loc.x, y: RWY.loc.y };
      if (nv.source === 'ILS') t.gs = true;
    } else if (ap.hdg) t.hdg = nv.bug;
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
      vsTgt = clamp(-S.gs * KT2FPM * Math.tan(RWY.gsAngle * D2R) - 600 * n.gsDev, -1500, 300);
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
    S.alt = Math.max(RWY.elev, S.alt + S.vs / 60 * dt);
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
  const pos = (radial, nm) => ({ x: VOR.x + Math.sin(radial * D2R) * nm * NM, y: VOR.y - Math.cos(radial * D2R) * nm * NM });
  const viaVor = course => ({ course, x: VOR.x, y: VOR.y });
  const viaLoc = { course: RWY.course, x: RWY.loc.x, y: RWY.loc.y };
  const level = (alt, hdg) => ({ name: `Hold heading ${pad3(hdg)}, ${fmtAlt(alt)} ft`, hdg, alt, ias: 100 });
  const pad3 = h => String(Math.round(norm360(h)) % 360 || 360).padStart(3, '0');
  const fmtAlt = a => Math.round(a).toLocaleString('en-US');
  FI.pad3 = pad3;

  FI.SCENARIOS = [
    {
      id: 'level', name: 'Straight and level across the VOR',
      brief: 'Hold heading 045 at 3,000 ft and 100 kt. Watch the TO flag flip to FROM as you cross the station.',
      start: { ...pos(225, 6), hdg: 45, alt: 3000, ias: 100 }, nav: { source: 'VOR', obs: 45, bug: 45 },
      steps: [{ name: 'Straight and level, heading 045', hdg: 45, alt: 3000, ias: 100 }],
    },
    {
      id: 'turn360', name: 'Standard-rate 360° turn',
      brief: 'A right turn at 3° per second: about 15° of bank at 100 kt, two minutes around. Watch the turn coordinator and the heading indicator.',
      start: { ...pos(180, 5), hdg: 360, alt: 3000, ias: 100 }, nav: { source: 'VOR', obs: 360, bug: 360 },
      steps: [
        { name: 'Standard-rate turn to the right', bank: 'std', alt: 3000, ias: 100, until: (c) => c.turned >= 360 - S.bank / 2 },
        { name: 'Roll out on heading 360', hdg: 360, alt: 3000, ias: 100 },
      ],
    },
    {
      id: 'climb', name: 'Climb 1,000 ft and level off',
      brief: 'Climb from 3,000 to 4,000 ft at 500 fpm and 90 kt, then level off. Watch the VSI lead and the altimeter catch up.',
      start: { ...pos(270, 6), hdg: 90, alt: 3000, ias: 100 }, nav: { source: 'VOR', obs: 90, bug: 90 },
      steps: [
        { name: 'Climb to 4,000 ft at 500 fpm, 90 kt', hdg: 90, alt: 4000, vsMax: 500, ias: 90, until: () => Math.abs(S.alt - 4000) < 30 && Math.abs(S.vs) < 80 },
        { name: 'Level at 4,000 ft, 100 kt', hdg: 90, alt: 4000, ias: 100 },
      ],
    },
    {
      id: 'radialOut', name: 'Intercept and track the 090 radial outbound',
      brief: 'OBS 090. From south of the course the needle is left: fly toward it with a 30° intercept, then track outbound with the FROM flag.',
      start: { ...pos(160, 4), hdg: 360, alt: 3000, ias: 100 }, nav: { source: 'VOR', obs: 90, bug: 60 },
      steps: [
        { name: 'Intercept the 090 radial, heading 060', track: viaVor(90), alt: 3000, ias: 100, until: () => Math.abs(xtk(90, VOR.x, VOR.y)) < 0.15 },
        { name: 'Track the 090 radial outbound', track: viaVor(90), alt: 3000, ias: 100, until: () => FI.navOut.dist >= 12 },
        level(3000, 90),
      ],
    },
    {
      id: 'direct', name: 'Direct to the VOR and station passage',
      brief: 'Inbound on the 300 radial with course 120 set: the needle is centered with TO. Over the station the OFF flag shows, then FROM as you go outbound.',
      start: { ...pos(300, 8), hdg: 120, alt: 3000, ias: 100 }, nav: { source: 'VOR', obs: 120, bug: 120 },
      steps: [
        { name: 'Track inbound on the 300 radial, course 120', track: viaVor(120), alt: 3000, ias: 100, until: () => FI.navOut.dist < 0.4 },
        { name: 'Station passage: TO becomes FROM', track: viaVor(120), alt: 3000, ias: 100, until: () => FI.navOut.dist > 1 },
        { name: 'Track outbound on the 120 radial', track: viaVor(120), alt: 3000, ias: 100, until: () => FI.navOut.dist >= 8 },
        level(3000, 120),
      ],
    },
    {
      id: 'ils', name: 'ILS runway 27',
      brief: 'Heading 240 cuts the localizer at 30°. Track it inbound, capture the 3° glideslope from below at 90 kt, descend to the 200 ft decision altitude and go around.',
      start: { x: RWY.thr.x + 16 * NM, y: RWY.y - 3 * NM, hdg: 240, alt: 3000, ias: 100 }, nav: { source: 'ILS', obs: 270, bug: 240 },
      steps: [
        { name: 'Intercept the localizer, heading 240', hdg: 240, alt: 3000, ias: 100, until: () => FI.navOut.locValid && Math.abs(FI.navOut.locDev) < 1.2 },
        { name: 'Track the localizer, glideslope armed', track: viaLoc, alt: 3000, gs: true, ias: 90, until: () => FI.ap.gsCap },
        { name: 'Descend on the glideslope, 90 kt', track: viaLoc, gs: true, ias: 90, until: () => S.alt <= RWY.elev + RWY.da },
        { name: 'Missed approach: climb to 3,000 ft on runway heading', hdg: 270, alt: 3000, vsMax: 700, ias: 80 },
      ],
    },
    {
      id: 'xwind', name: 'Track a radial in a crosswind',
      brief: 'Wind from the north at 20 kt. To keep the needle centered on course 090 the nose points about 12° left of the track: heading and track differ by the wind correction angle.',
      start: { ...pos(270, 8), hdg: 78, alt: 3000, ias: 100 }, nav: { source: 'VOR', obs: 90, bug: 78 }, wind: { dir: 360, kt: 20 },
      steps: [
        { name: 'Track course 090 to the VOR, crabbed into the wind', track: viaVor(90), alt: 3000, ias: 100, until: () => FI.navOut.dist < 0.4 },
        { name: 'Track the 090 radial outbound, still crabbed', track: viaVor(90), alt: 3000, ias: 100 },
      ],
    },
  ];

  FI.loadScenario = function (def) {
    const st = def.start;
    Object.assign(S, { x: st.x, y: st.y, hdg: st.hdg, alt: st.alt, ias: st.ias, vs: 0, bank: 0, cmdBank: 0, turnRate: 0, t: 0 });
    S.pitch = S.cmdPitch = aoa(S.ias);
    S.power = clamp(drag(S.ias) * S.ias / AC.kT, 0, 100);
    Object.assign(FI.nav, def.nav);
    if (def.wind) Object.assign(FI.wind, def.wind);
    Object.assign(FI.ap, { hdg: false, alt: false, nav: false, gsCap: false, info: null });
    FI.trail.length = 0; trailT = 0; acc = 0;
    FI.scn = { def, i: 0, step: def.steps[0], ctx: newCtx(), off: false, done: false };
    FI.msg = '';
    FI.paused = false;
    computeNav();
    physics(0);
    computeNav();
  };
  // Clear everything and leave the aircraft at the given start, flown by hand.
  FI.freeFlight = function () {
    FI.scn = null;
    Object.assign(S, { ...pos(225, 6), hdg: 45, alt: 3000, ias: 100, vs: 0, bank: 0, cmdBank: 0, turnRate: 0, t: 0 });
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
    const sc = FI.scn, ap = FI.ap;
    if (sc && !sc.off) return (sc.done ? 'Scenario complete · ' : 'Autopilot: ') + sc.step.name;
    const m = [];
    if (ap.nav) m.push('NAV ' + (FI.nav.source === 'VOR' ? 'course ' + pad3(FI.nav.obs) : 'LOC 27' + (ap.gsCap ? ' + GS' : '')));
    else if (ap.hdg) m.push('HDG ' + pad3(FI.nav.bug));
    if (ap.alt && !(ap.gsCap && ap.nav)) m.push('ALT ' + fmtAlt(ap.altTgt));
    return m.length ? 'Autopilot: ' + m.join(' · ') : (FI.msg || 'You have control');
  };
})(window.FI);
