// Flight model and frame timeline. No Phaser here: pure math and data.
// Units: positions in feet (x east, y south, so north is up on screen),
// heading in degrees true (0 = north, clockwise), airspeed in knots.
window.DL = window.DL || {};

(function (DL) {
  'use strict';

  const G0 = 32.174;          // ft/s^2
  const KT = 1.6878099;       // ft/s per knot
  const D2R = Math.PI / 180;

  // Performance numbers are deliberately simple and editable in Settings.
  //   vStall: 1 g stall speed (kt). Available g = (V / vStall)^2, capped at maxG,
  //           so corner speed = vStall * sqrt(maxG).
  //   vMax:   top speed at full throttle in 1 g level flight (kt). The model has
  //           no altitude effects, so the named jets use low-altitude figures.
  //   accel:  full-throttle acceleration with no drag (kt/s) = thrust/weight x 19.06.
  //   induced: induced-drag factor; drag grows with g^2 and falls with speed^2.
  //           Sustained g at full throttle = (V/vStall) * sqrt((1 - (V/vMax)^2) / induced).
  //   brake:  speedbrake drag factor (0 = no speedbrake).
  //   defAlt: starting altitude for new aircraft (ft).
  //   shape:  3D model in the 3D view (fighter, attack, delta, prop, cargo, airliner, ga).
  //           The map symbol is each type's own outline (PLANFORMS in scene.js).
  // The named jets (heath, 2026-10-11) are built from public figures: 1 g stall and
  // corner speed at a combat weight, sea-level top speed, g limit, thrust/weight
  // in afterburner, and a drag factor tuned to the sustained turn each is known for.
  // The T-6 is a turboprop: its accel is propeller thrust near 200 kt, so it
  // climbs and accelerates far less than the jets.
  const TYPES = {
    fighter:  { name: 'Fighter',           callsign: 'KNIGHT', group: 'Generic', shape: 'fighter', vStall: 130, vMax: 800, maxG: 9.0, accel: 15,  induced: 0.15, brake: 2.0, defSpeed: 400, defAlt: 15000 },
    cargo:    { name: 'Cargo',             callsign: 'REACH',  group: 'Generic', shape: 'cargo',   vStall: 100, vMax: 320, maxG: 2.5, accel: 3,   induced: 0.12, brake: 1.0, defSpeed: 250, defAlt: 10000 },
    airliner: { name: 'Airliner',          callsign: 'HEAVY',  group: 'Generic', shape: 'airliner', vStall: 130, vMax: 500, maxG: 2.5, accel: 2.5, induced: 0.12, brake: 1.2, defSpeed: 280, defAlt: 20000 },
    ga:       { name: 'General aviation',  callsign: 'CESSNA', group: 'Generic', shape: 'ga',      vStall: 48,  vMax: 140, maxG: 3.8, accel: 2,   induced: 0.15, brake: 0,   defSpeed: 100, defAlt: 3000 },
    // United States
    f16:   { name: 'F-16 Viper',          callsign: 'VIPER',     group: 'United States', shape: 'fighter', vStall: 125, vMax: 800, maxG: 9.0, accel: 21,   induced: 0.16, brake: 1.5, defSpeed: 400, defAlt: 15000 },
    f15:   { name: 'F-15 Eagle',          callsign: 'EAGLE',     group: 'United States', shape: 'fighter', vStall: 120, vMax: 800, maxG: 9.0, accel: 22,   induced: 0.15, brake: 1.5, defSpeed: 420, defAlt: 20000 },
    f22:   { name: 'F-22 Raptor',         callsign: 'RAPTOR',    group: 'United States', shape: 'fighter', vStall: 110, vMax: 800, maxG: 9.0, accel: 24,   induced: 0.13, brake: 1.0, defSpeed: 450, defAlt: 25000 },
    f35:   { name: 'F-35 Lightning II',   callsign: 'LIGHTNING', group: 'United States', shape: 'fighter', vStall: 125, vMax: 700, maxG: 9.0, accel: 19,   induced: 0.18, brake: 1.0, defSpeed: 400, defAlt: 20000 },
    a10:   { name: 'A-10 Warthog',        callsign: 'HOG',       group: 'United States', shape: 'attack',  vStall: 110, vMax: 390, maxG: 7.3, accel: 7,    induced: 0.20, brake: 2.5, defSpeed: 300, defAlt: 8000 },
    // trainers (heath, 2026-10-11)
    t6:    { name: 'T-6 Texan II',        callsign: 'TEXAN',     group: 'United States', shape: 'prop',    vStall: 82,  vMax: 280, maxG: 7.0, accel: 4.5,  induced: 0.32, brake: 0,   defSpeed: 200, defAlt: 10000 },
    t7:    { name: 'T-7A Red Hawk',       callsign: 'REDHAWK',   group: 'United States', shape: 'fighter', vStall: 115, vMax: 620, maxG: 7.5, accel: 18,   induced: 0.17, brake: 1.5, defSpeed: 350, defAlt: 15000 },
    t38:   { name: 'T-38 Talon',          callsign: 'TALON',     group: 'United States', shape: 'fighter', vStall: 145, vMax: 650, maxG: 7.3, accel: 10,   induced: 0.21, brake: 1.2, defSpeed: 380, defAlt: 15000 },
    // Russia
    mig25: { name: 'MiG-25 Foxbat',       callsign: 'FOXBAT',    group: 'Russia', shape: 'fighter', vStall: 160, vMax: 650, maxG: 4.5, accel: 11.5, induced: 0.35, brake: 1.0, defSpeed: 500, defAlt: 30000 },
    mig29: { name: 'MiG-29 Fulcrum',      callsign: 'FULCRUM',   group: 'Russia', shape: 'fighter', vStall: 118, vMax: 810, maxG: 9.0, accel: 21,   induced: 0.15, brake: 1.5, defSpeed: 400, defAlt: 15000 },
    su24:  { name: 'Su-24 Fencer',        callsign: 'FENCER',    group: 'Russia', shape: 'fighter', vStall: 140, vMax: 740, maxG: 6.5, accel: 12.5, induced: 0.30, brake: 1.5, defSpeed: 420, defAlt: 5000 },
    su25:  { name: 'Su-25 Frogfoot',      callsign: 'FROGFOOT',  group: 'Russia', shape: 'attack',  vStall: 115, vMax: 520, maxG: 6.5, accel: 9.5,  induced: 0.28, brake: 2.0, defSpeed: 320, defAlt: 6000 },
    su27:  { name: 'Su-27 Flanker',       callsign: 'FLANKER',   group: 'Russia', shape: 'fighter', vStall: 110, vMax: 750, maxG: 9.0, accel: 21,   induced: 0.14, brake: 1.5, defSpeed: 420, defAlt: 20000 },
    su30:  { name: 'Su-30 Flanker-C',     callsign: 'FLANKER-C', group: 'Russia', shape: 'fighter', vStall: 115, vMax: 730, maxG: 9.0, accel: 19,   induced: 0.15, brake: 1.5, defSpeed: 420, defAlt: 20000 },
    su57:  { name: 'Su-57 Felon',         callsign: 'FELON',     group: 'Russia', shape: 'fighter', vStall: 105, vMax: 800, maxG: 9.0, accel: 22,   induced: 0.13, brake: 1.0, defSpeed: 450, defAlt: 25000 },
    // China
    j10:   { name: 'J-10 Firebird',       callsign: 'FIREBIRD',  group: 'China', shape: 'delta',   vStall: 125, vMax: 780, maxG: 9.0, accel: 20,   induced: 0.16, brake: 1.5, defSpeed: 400, defAlt: 15000 },
    j11:   { name: 'J-11 Flanker-L',      callsign: 'FLANKER-L', group: 'China', shape: 'fighter', vStall: 110, vMax: 750, maxG: 9.0, accel: 21,   induced: 0.14, brake: 1.5, defSpeed: 420, defAlt: 20000 },
    j16:   { name: 'J-16',                callsign: 'J16',       group: 'China', shape: 'fighter', vStall: 118, vMax: 730, maxG: 9.0, accel: 18,   induced: 0.16, brake: 1.5, defSpeed: 420, defAlt: 20000 },
    j17:   { name: 'JF-17 Thunder (J-17)', callsign: 'THUNDER',  group: 'China', shape: 'fighter', vStall: 125, vMax: 700, maxG: 8.0, accel: 18,   induced: 0.17, brake: 1.5, defSpeed: 380, defAlt: 15000 },
    j20:   { name: 'J-20 Mighty Dragon',  callsign: 'DRAGON',    group: 'China', shape: 'delta',   vStall: 110, vMax: 800, maxG: 9.0, accel: 19,   induced: 0.16, brake: 1.0, defSpeed: 450, defAlt: 25000 },
  };

  const settings = {
    gridFt: 100,          // one grid cell, feet
    frameSec: 5,          // default seconds per frame (each frame can set its own, tl.dur)
    stepSec: 0.05,        // integration step inside a frame
    snap: true,           // snap placed aircraft to grid intersections
    coordinated: false,   // lock bank to a level turn (no climb or descent)
    showCircles: 'selected', // 'all' | 'selected' | 'off'
    showPrediction: true,
    showLabels: true,
    showGhosts: true,
    showVertical: true,   // climb/descent ticks mid-frame
    vertLevelFt: 50,      // altitude change per frame below this reads as level
    vertSteepFt: 1000,    // altitude change per frame at or above this gets 3 ticks
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap360 = h => ((h % 360) + 360) % 360;

  function availG(type, spd) {
    const t = TYPES[type];
    return Math.max(1, Math.min(t.maxG, (spd / t.vStall) * (spd / t.vStall)));
  }

  // Split the lift vector into a turning part and a vertical part, in g.
  // Free (default): lift n tilted by the bank angle.
  //   lateral = n sin(bank), and the flight path bends up or down at
  //   (n cos(bank) - cos(gamma)) g. Bank past 90 degrees pulls the nose down.
  // Level-turn lock: bank always balances gravity, so gamma stays put.
  function liftSplit(type, spd, ctl, gam) {
    const n = clamp(ctl.g, 1, availG(type, spd));
    const cg = Math.cos(gam);
    if (settings.coordinated) {
      if (!ctl.bank) return { n, lat: 0, vert: 0 };
      return { n, lat: Math.sign(ctl.bank) * Math.sqrt(Math.max(0, n * n - cg * cg)), vert: 0 };
    }
    const b = ctl.bank * D2R;
    return { n, lat: n * Math.sin(b), vert: n * Math.cos(b) - cg };
  }

  // Speed change rate in kt/s, including gravity along a climb or dive.
  function accelKts(type, spd, ctl, gam) {
    const t = TYPES[type];
    const n = clamp(ctl.g, 1, availG(type, spd));
    const q = (spd / t.vMax) * (spd / t.vMax);
    const thrust = t.accel * ctl.thr / 100;
    const parasite = t.accel * q;
    const induced = t.induced * t.accel * n * n * (t.vStall / spd) * (t.vStall / spd);
    const brake = ctl.sb ? t.brake * t.accel * q : 0;
    return thrust - parasite - induced - brake - G0 * Math.sin(gam || 0) / KT;
  }

  // Instantaneous turn and vertical numbers for display. gamDeg is the
  // current flight path angle (positive = climbing).
  function turnInfo(type, spd, ctl, gamDeg) {
    const gam = (gamDeg || 0) * D2R;
    const { n, lat, vert } = liftSplit(type, spd, ctl, gam);
    const v = spd * KT, vh = v * Math.cos(gam);
    const out = { n, lat, vert, dir: 0, radius: Infinity, rateDps: 0,
      pitchRateDps: G0 * vert / v / D2R, vsFpm: v * Math.sin(gam) * 60 };
    if (Math.abs(lat) < 1e-6) return out;
    out.dir = Math.sign(lat);
    out.radius = vh * vh / (G0 * Math.abs(lat));
    out.rateDps = G0 * lat / Math.max(vh, 1) / D2R;
    return out;
  }

  // Throttle that holds a speed in steady flight at load factor n.
  function trimThrottle(type, spd, n) {
    const t = TYPES[type];
    const q = (spd / t.vMax) * (spd / t.vMax);
    const need = t.accel * q + t.induced * t.accel * n * n * (t.vStall / spd) * (t.vStall / spd);
    return clamp(Math.round(need / t.accel * 100), 0, 100);
  }

  function cornerSpeed(type) {
    const t = TYPES[type];
    return t.vStall * Math.sqrt(t.maxG);
  }

  // g needed to turn at the given horizontal radius (ft) at speed (kt)
  // while holding the current flight path angle.
  function gForRadius(spd, radius, gamDeg) {
    const cg = Math.cos((gamDeg || 0) * D2R);
    const vh = spd * KT * cg;
    const lat = vh * vh / (G0 * radius);
    return Math.sqrt(cg * cg + lat * lat);
  }

  // Bank that holds the flight path angle at load factor g.
  function bankForG(g, gamDeg) {
    const cg = Math.cos((gamDeg || 0) * D2R);
    return Math.acos(Math.min(1, cg / Math.max(1, g))) / D2R;
  }

  // ---------- 3D attitude helpers ----------
  // Vectors are [east, north, up]. v = unit velocity, u = unit "lift up"
  // direction of the aircraft (out of the canopy).
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return scale(a, 1 / l); };
  const UP = [0, 0, 1];

  function velVec(hdgDeg, gamDeg) {
    const h = hdgDeg * D2R, g = gamDeg * D2R;
    return [Math.sin(h) * Math.cos(g), Math.cos(h) * Math.cos(g), Math.sin(g)];
  }

  // Wings-level frame around a velocity: r0 = right wing, u0 = canopy up.
  function levelFrame(v, hdgDeg) {
    let r0 = cross(v, UP);
    if (Math.hypot(r0[0], r0[1], r0[2]) < 1e-4) {   // straight up or down
      const h = hdgDeg * D2R;
      r0 = [Math.cos(h), -Math.sin(h), 0];
    }
    r0 = norm(r0);
    return { r0, u0: cross(r0, v) };
  }

  function liftDir(v, hdgDeg, bankDeg) {
    const { r0, u0 } = levelFrame(v, hdgDeg);
    const b = bankDeg * D2R;
    return norm(add(scale(u0, Math.cos(b)), scale(r0, Math.sin(b))));
  }

  // Rotate vector a about unit axis k by angle th (Rodrigues).
  function rotate(a, k, th) {
    const c = Math.cos(th), s = Math.sin(th);
    return add(add(scale(a, c), scale(cross(k, a), s)), scale(k, dot(k, a) * (1 - c)));
  }

  function attitude(v, u, hdgFallback) {
    const hdg = Math.hypot(v[0], v[1]) > 1e-4 ? wrap360(Math.atan2(v[0], v[1]) / D2R) : hdgFallback;
    const gam = Math.asin(clamp(v[2], -1, 1)) / D2R;
    const { r0, u0 } = levelFrame(v, hdg);
    const bank = Math.atan2(dot(u, r0), dot(u, u0)) / D2R;
    return { hdg, gam, bank };
  }

  // Integrate one frame in 3D. Lift n·g acts along the canopy direction u;
  // the pilot holds the g and does not roll, so u turns with the velocity.
  // Once the bank passes 90° (rolled past inverted-to-the-horizon, or over
  // the top of a loop) the aircraft is reversing: it keeps pulling until the
  // nose is back on the horizon, then rolls wings level heading the other
  // way, as in a Split-S or Immelmann.
  function step(type, s, dur) {
    const t = TYPES[type];
    const dt = settings.stepSec;
    const nSteps = Math.max(1, Math.round((dur || settings.frameSec) / dt));
    const ctl = s.ctl;
    let x = s.x, y = s.y, spd = s.spd, alt = s.alt || 0, dist = 0;
    let v = velVec(s.hdg, s.gam || 0);
    let u = (ctl.auto && s.u) ? s.u.slice() : liftDir(v, s.hdg, ctl.bank);
    let hdg = s.hdg, gam = s.gam || 0, dHdg = 0;
    let rev = !!s.rev, armed = !!s.revArmed, rolledOut = false;
    const path = [[x, y]];
    // attitude samples through the frame, for the 3D view
    const samples = [{ t: 0, v: v.slice(), u: u.slice(), spd, alt, n: clamp(ctl.g, 1, availG(type, spd)) }];
    for (let i = 0; i < nSteps; i++) {
      const vf = spd * KT;
      let n = rolledOut ? 1 : clamp(ctl.g, 1, availG(type, spd));
      if (settings.coordinated && !rolledOut) {
        // bank always set to hold the climb angle
        const cg = Math.cos(gam * D2R);
        const b = ctl.bank ? Math.sign(ctl.bank) * Math.acos(Math.min(1, cg / n)) / D2R : 0;
        u = liftDir(v, hdg, b);
      }
      if (rolledOut) u = liftDir(v, hdg, 0);
      // acceleration in g: lift + gravity, keep the part across the velocity
      const acc = add(scale(u, n), scale(UP, -1));
      const aPerp = add(acc, scale(v, -dot(acc, v)));
      const omega = scale(cross(v, aPerp), G0 / vf);      // rad/s
      const wMag = Math.hypot(omega[0], omega[1], omega[2]);
      if (wMag > 1e-9) {
        const k = scale(omega, 1 / wMag);
        const vMid = norm(rotate(v, k, wMag * dt / 2));
        x += vf * vMid[0] * dt; y -= vf * vMid[1] * dt; alt += vf * vMid[2] * dt;
        dist += vf * Math.hypot(vMid[0], vMid[1]) * dt;
        v = norm(rotate(v, k, wMag * dt));
        u = rotate(u, k, wMag * dt);
      } else {
        x += vf * v[0] * dt; y -= vf * v[1] * dt; alt += vf * v[2] * dt;
        dist += vf * Math.hypot(v[0], v[1]) * dt;
      }
      u = norm(add(u, scale(v, -dot(u, v))));
      if (alt <= 0 && v[2] < 0) { alt = 0; v = norm([v[0], v[1], 0]); u = liftDir(v, hdg, 0); }
      const att = attitude(v, u, hdg);
      let dh = att.hdg - hdg;
      if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
      dHdg += dh;
      const prevGam = gam;
      hdg = att.hdg; gam = att.gam;
      // reversal logic
      if (!settings.coordinated && !rolledOut) {
        if (!rev && Math.abs(att.bank) > 90.5) { rev = true; armed = Math.abs(gam) > 3; }
        if (rev) {
          if (Math.abs(gam) > 3) armed = true;
          if (armed && (Math.sign(gam) !== Math.sign(prevGam) || Math.abs(gam) < 0.2)) {
            // nose on the horizon: roll out wings level
            v = norm([v[0], v[1], 0]);
            hdg = attitude(v, u, hdg).hdg; gam = 0;
            u = liftDir(v, hdg, 0);
            rev = false; armed = false; rolledOut = true;
          }
        }
      }
      spd = clamp(spd + accelKts(type, spd, rolledOut ? Object.assign({}, ctl, { g: 1 }) : ctl, gam * D2R) * dt, t.vStall, t.vMax * 1.15);
      path.push([x, y]);
      samples.push({ t: (i + 1) * dt, v: v.slice(), u: u.slice(), spd, alt, n });
    }
    const att = attitude(v, u, hdg);
    return { x, y, hdg, spd, alt, gam, bank: rolledOut ? 0 : att.bank, u, rev, revArmed: armed, rolledOut,
      path, samples, dist, dHdg, dAlt: alt - (s.alt || 0) };
  }

  // ---------- Aircraft registry and timeline ----------
  // aircraft: id -> { id, type, callsign, color }
  // frames[k]: id -> { x, y, hdg, spd, alt, gam, ctl:{thr,g,bank,sb}, path, pinned, dist, dHdg, dAlt }
  const PALETTE = [0x4da3ff, 0xff5a5a, 0x5fd38d, 0xffd166, 0xc78bff, 0xff9f43, 0x2fd6d6, 0xff7eb6];

  const tl = {
    aircraft: {},
    frames: [{}],
    current: 0,
    nextId: 1,
    counts: {},
    events: [],      // debrief markers: shots, gun bursts, flares (see advanced.js)
    nextEv: 1,
    dur: [],         // dur[k]: seconds frame k lasts (to frame k+1); unset = settings.frameSec
  };

  function cur() { return tl.frames[tl.current]; }

  // Seconds frame k lasts, from frame k to k+1. Frames without a time of
  // their own follow the default frame time in settings.
  function frameDur(k) { const d = tl.dur[k]; return d > 0 ? d : settings.frameSec; }

  function setFrameDur(k, sec) {
    tl.dur[k] = clamp(+sec || settings.frameSec, 0.5, 60);
    resim(k);
  }

  // Elapsed seconds at a (fractional) frame index, and the reverse.
  function timeAt(kf) {
    let t = 0, k = 0;
    for (; k + 1 <= kf; k++) t += frameDur(k);
    return t + (kf - k) * frameDur(k);
  }
  function frameAt(sec) {
    let t = 0, k = 0;
    while (t + frameDur(k) <= sec && k < 100000) { t += frameDur(k); k++; }
    return k + (sec - t) / frameDur(k);
  }
  const fmtSec = s => String(Math.round(s * 10) / 10);

  function addAircraft(type, x, y, hdg) {
    const t = TYPES[type];
    const id = 'a' + (tl.nextId++);
    tl.counts[type] = (tl.counts[type] || 0) + 1;
    const color = PALETTE[(tl.nextId - 2) % PALETTE.length];
    tl.aircraft[id] = { id, type, callsign: t.callsign + ' ' + tl.counts[type], color };
    const spd = t.defSpeed;
    cur()[id] = {
      x, y, hdg: wrap360(hdg), spd, alt: t.defAlt, gam: 0,
      ctl: { thr: trimThrottle(type, spd, 1), g: 1, bank: 0, sb: false },
      path: null, pinned: false, born: true, color,
    };
    resim(tl.current);
    return id;
  }

  // An aircraft's color at frame k. A change made at a frame applies from
  // that frame on; earlier frames keep the color they had (heath's call).
  function colorAt(k, id) {
    const s = tl.frames[k] && tl.frames[k][id], a = tl.aircraft[id];
    return (s && s.color) || (a && a.color) || 0xffffff;
  }

  function setColorAt(k, id, color) {
    const was = colorAt(k, id);
    for (let j = k; j < tl.frames.length; j++) {
      const s = tl.frames[j][id];
      if (!s) break;
      if (j > k && colorAt(j, id) !== was) break;   // a later change of its own stays
      s.color = color;
    }
    tl.aircraft[id].color = colorAt(tl.frames.length - 1, id);
  }

  function removeAircraft(id) {
    delete tl.aircraft[id];
    for (const f of tl.frames) delete f[id];
    tl.events = tl.events.filter(e => e.ac !== id);
    for (const e of tl.events) if (e.target === id) e.target = null;
  }

  // Simulate every later frame again from frame k, keeping each later
  // frame's own controls and any poses the user pinned there.
  // Frames the user hasn't edited carry on from how the last one ended:
  // same throttle, g and speedbrake, with the bank it actually flew to.
  // After a reversal rolls out, they fly 1 g wings level.
  function carryControls(ctl, r) {
    const c = Object.assign({}, ctl, { bank: Math.round(r.bank), auto: true });
    if (r.rolledOut) { c.g = 1; c.bank = 0; delete c.maneuver; }
    return c;
  }

  function stateFrom(r, ctl) {
    return { x: r.x, y: r.y, hdg: r.hdg, spd: r.spd, alt: r.alt, gam: r.gam, dAlt: r.dAlt,
      u: r.u, rev: r.rev, revArmed: r.revArmed, rolledOut: r.rolledOut, ctl,
      path: r.path, pinned: false, dist: r.dist, dHdg: r.dHdg };
  }

  // Fly ahead from frame k without changing the timeline, until a reversal
  // rolls out (or maxFrames). Used to preview a whole maneuver.
  function predictAhead(k, id, maxFrames) {
    const type = tl.aircraft[id].type;
    let s = tl.frames[k][id];
    const out = [];
    for (let i = 0; i < maxFrames; i++) {
      const r = step(type, s, frameDur(k + i));
      out.push(r);
      if (r.rolledOut || (!r.rev && !s.ctl.maneuver)) break;
      s = stateFrom(r, carryControls(s.ctl, r));
    }
    return out;
  }

  function resim(k) {
    for (let j = k; j < tl.frames.length - 1; j++) {
      const a = tl.frames[j], b = tl.frames[j + 1];
      for (const id in a) {
        const s = a[id];
        const r = step(tl.aircraft[id].type, s, frameDur(j));
        const old = b[id];
        if (old && old.pinned) {
          old.path = null;
          continue;
        }
        const carried = carryControls(s.ctl, r);
        b[id] = {
          x: r.x, y: r.y, hdg: r.hdg, spd: r.spd, alt: r.alt, gam: r.gam, dAlt: r.dAlt,
          u: r.u, rev: r.rev, revArmed: r.revArmed, rolledOut: r.rolledOut,
          ctl: old && !old.ctl.auto ? old.ctl : carried,
          color: (old && old.color) || s.color,
          path: r.path, pinned: false, unlocked: old ? !!old.unlocked : false, dist: r.dist, dHdg: r.dHdg,
        };
      }
    }
  }

  // Position, heading and speed can only be set on the frame an aircraft
  // first appears. After that it flies where its controls take it.
  // The user can unlock a later frame to correct a position by hand.
  function isFirstFrame(id) {
    const prev = tl.frames[tl.current - 1];
    return !!cur()[id] && !(prev && prev[id]);
  }

  function canEditPose(id) {
    const s = cur()[id];
    return !!s && (isFirstFrame(id) || !!s.unlocked);
  }

  function setUnlocked(id, on) {
    const s = cur()[id];
    if (s && !isFirstFrame(id)) s.unlocked = on;
  }

  // Drop a hand-set pose and put the aircraft back where it flew.
  function restoreFlown(id) {
    const s = cur()[id];
    if (!s || !s.pinned) return;
    s.pinned = false;
    s.unlocked = false;
    resim(tl.current - 1);
  }

  // The user moved, turned or re-sped an aircraft on its first frame.
  function editPose(id, patch) {
    const s = cur()[id];
    if (!s || !canEditPose(id)) return false;
    Object.assign(s, patch);
    if (patch.hdg !== undefined) s.hdg = wrap360(s.hdg);
    // a hand-set attitude starts fresh from the bank control
    delete s.u; s.rev = false; s.revArmed = false; s.ctl.auto = false;
    if (!isFirstFrame(id)) { s.pinned = true; s.path = null; }
    resim(tl.current);
    return true;
  }

  // Set the climb angle an aircraft starts frame k with (dragging the
  // vertical ticks). Position stays; everything after k is flown again.
  function setClimb(k, id, gam) {
    const s = tl.frames[k] && tl.frames[k][id];
    if (!s) return;
    s.gam = clamp(gam, -89, 89);
    delete s.u;
    resim(k);
  }

  // Edit the controls an aircraft flies frame k with (vertical window).
  function editControlsAt(k, id, patch) {
    const s = tl.frames[k] && tl.frames[k][id];
    if (!s) return;
    Object.assign(s.ctl, patch, { auto: false });
    resim(k);
  }

  function setAltAt(k, id, alt) {
    const s = tl.frames[k] && tl.frames[k][id];
    if (!s) return;
    s.alt = Math.max(0, alt);
    resim(k);
  }

  // Start a reversal at frame k: later frames go back to following the
  // maneuver until it rolls out.
  function startManeuverAt(k, id, patch) {
    for (let j = k + 1; j < tl.frames.length; j++) {
      const s = tl.frames[j][id];
      if (s && !s.pinned) s.ctl.auto = true;
    }
    editControlsAt(k, id, patch);
  }

  function editControls(id, patch) {
    const s = cur()[id];
    if (!s) return;
    Object.assign(s.ctl, patch, { auto: false });
    resim(tl.current);
  }

  function nextFrame() {
    if (tl.current === tl.frames.length - 1) {
      tl.frames.push({});
      resim(tl.current);
    }
    tl.current++;
  }

  function prevFrame() {
    if (tl.current > 0) tl.current--;
  }

  // Drop frames after the current one.
  function truncate() {
    tl.frames.length = tl.current + 1;
    if (tl.dur.length > tl.current + 1) tl.dur.length = tl.current + 1;
    tl.events = tl.events.filter(e => e.k <= tl.current);
  }

  function resimAll() { resim(0); }

  function reset() {
    tl.aircraft = {};
    tl.frames = [{}];
    tl.current = 0;
    tl.nextId = 1;
    tl.counts = {};
    tl.events = [];
    tl.nextEv = 1;
    tl.dur = [];
  }

  Object.assign(DL, {
    G0, KT, D2R, TYPES, settings, tl, clamp, wrap360, frameDur, setFrameDur, timeAt, frameAt, fmtSec,
    availG, liftSplit, accelKts, turnInfo, trimThrottle, cornerSpeed, gForRadius, bankForG, step,
    cross, attitude, cur, colorAt, setColorAt, isFirstFrame, canEditPose, setUnlocked, restoreFlown, addAircraft, removeAircraft, resim, resimAll, editPose, editControls, editControlsAt, setAltAt, startManeuverAt, predictAhead, setClimb, nextFrame, prevFrame, truncate, reset,
  });
})(window.DL);
