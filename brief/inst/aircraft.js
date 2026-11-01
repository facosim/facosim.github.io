window.FI = window.FI || {};

(function (FI) {
  'use strict';

  const G = 19.06;
  const KT = 1.6878099;
  const KT2FPM = 101.269;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const BASE = {
    prop: false, capK: 1.05, tIdle: 0, tDecay: 0, lapse: 1, dragC: 0, ab: null,
    cfgFrom: 0, cfgFull: 0, cfgDrag: 0, aoa0: 0.5,
  };

  const SPECS = {
    c172: {
      name: 'Cessna 172', maker: 'Cessna 172 Skyhawk',
      vS0: 40, vS1: 48, vFe: 85, vNo: 129, vNe: 163, mmo: 0.3, capK: 1.25,
      prop: true, kT: 3.88, tMax: 4.0, vRef: 100, dragA: 1.824, dragB: 0.39, lapse: 1.7,
      maxBank: 30, rollRate: 15, pitchRate: 3, pitchMin: -10, pitchMax: 15,
      aoaK: 4.5, aoaV: 85,
      speeds: { cruise: 100, climb: 90, int: 100, appr: 90, missed: 80, turn: 100 },
      spdMin: 60, spdMax: 125, spdStep: 10, climbFpm: 500, descFpm: 700, climbBy: 1000,
      dial: 200, dialStep: 20,
    },
    t6a: {
      name: 'T-6A Texan II', maker: 'Beechcraft T-6A Texan II',
      vS0: 75, vS1: 90, vFe: 150, vNo: 316, vNe: 316, mmo: 0.67,
      prop: true, kT: 5.2, tMax: 7.2, vRef: 150, dragA: 0.45, dragB: 0.9, lapse: 1.25,
      cfgFrom: 150, cfgFull: 110, cfgDrag: 0.8,
      maxBank: 60, rollRate: 45, pitchRate: 6, pitchMin: -25, pitchMax: 35,
      aoaK: 5, aoaV: 130,
      speeds: { cruise: 200, climb: 170, int: 160, appr: 120, missed: 130, turn: 150 },
      spdMin: 100, spdMax: 300, spdStep: 20, climbFpm: 1500, descFpm: 1000, climbBy: 2000,
      dial: 400, dialStep: 40,
    },
    f16: {
      name: 'F-16', maker: 'General Dynamics F-16 Fighting Falcon',
      vS0: 105, vS1: 115, vFe: 300, vNo: 800, vNe: 800, mmo: 2.0,
      tMax: 22.9, tIdle: 0.04, lapse: 1.1, ab: { at: 85, mil: 0.6 },
      vRef: 300, dragA: 1.0, dragB: 1.1, dragC: 0.31,
      cfgFrom: 250, cfgFull: 180, cfgDrag: 0.9,
      maxBank: 80, rollRate: 120, pitchRate: 15, pitchMin: -30, pitchMax: 45,
      aoaK: 11.5, aoaV: 165,
      speeds: { cruise: 350, climb: 350, int: 220, appr: 165, missed: 190, turn: 250 },
      spdMin: 130, spdMax: 700, spdStep: 25, climbFpm: 3000, descFpm: 1200, climbBy: 3000,
      dial: 800, dialStep: 100,
    },
    b738: {
      name: 'Boeing 737', maker: 'Boeing 737-800',
      vS0: 105, vS1: 125, vFe: 250, vNo: 340, vNe: 340, mmo: 0.82,
      tMax: 6.0, tIdle: 0.05, tDecay: 0.12, lapse: 0.9,
      vRef: 250, dragA: 0.56, dragB: 0.56,
      cfgFrom: 200, cfgFull: 150, cfgDrag: 0.55,
      maxBank: 35, rollRate: 6, pitchRate: 2.5, pitchMin: -12, pitchMax: 22,
      aoaK: 6.5, aoaV: 145,
      speeds: { cruise: 250, climb: 250, int: 190, appr: 145, missed: 160, turn: 200 },
      spdMin: 130, spdMax: 330, spdStep: 10, climbFpm: 2000, descFpm: 800, climbBy: 2000,
      dial: 400, dialStep: 40,
    },
  };

  const AC = FI.AC = {};
  FI.AIRCRAFT = SPECS;
  FI.AIRCRAFT_IDS = Object.keys(SPECS);

  FI.setAircraft = function (id) {
    if (!SPECS[id]) id = 'c172';
    for (const k of Object.keys(AC)) delete AC[k];
    Object.assign(AC, BASE, SPECS[id], { id });
    AC.vMin = Math.round(AC.vS1 * 0.94);
    return AC;
  };

  const sigma = alt => Math.pow(Math.max(0.05, 1 - 6.8755856e-6 * alt), 4.2559);
  const ratio = alt => 1 + 0.02 * alt / 1000;
  const sound = alt => 38.967 * Math.sqrt(Math.max(216.65, 288.15 - 1.98 * alt / 1000));

  const frac = p => {
    const x = clamp(p, 0, 100), ab = AC.ab;
    if (!ab) return AC.tIdle + (1 - AC.tIdle) * x / 100;
    return x <= ab.at ? AC.tIdle + (ab.mil - AC.tIdle) * x / ab.at : ab.mil + (1 - ab.mil) * (x - ab.at) / (100 - ab.at);
  };

  const thrust = (V, p, alt) => {
    const f = frac(p), lap = Math.pow(sigma(alt || 0), AC.lapse);
    if (AC.prop) return Math.min(AC.tMax, AC.kT * f * AC.vRef / Math.max(V, AC.vMin)) * lap;
    return AC.tMax * f * Math.max(0.4, 1 - AC.tDecay * V / 100) * lap;
  };

  const drag = V => {
    const v = Math.max(V, AC.vMin) / AC.vRef;
    let d = AC.dragA * v * v + AC.dragB / (v * v) + AC.dragC * v * v * v * v;
    if (AC.cfgDrag) d *= 1 + AC.cfgDrag * clamp((AC.cfgFrom - V) / (AC.cfgFrom - AC.cfgFull), 0, 1);
    return d;
  };

  const powerFor = (T, V, alt) => {
    if (thrust(V, 100, alt) <= T) return 100;
    if (thrust(V, 0, alt) >= T) return 0;
    let lo = 0, hi = 100;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (thrust(V, mid, alt) < T) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  };

  const energy = (ias, vs) => ias * 0.00002 * vs / 60;
  const aoa = V => AC.aoa0 + AC.aoaK * Math.pow(AC.aoaV / Math.max(V, AC.vS0), 2);
  const vCap = alt => Math.min(AC.vNe * AC.capK, AC.mmo * sound(alt) / ratio(alt));

  const climb = (alt, ias, p) => {
    const tas = ias * ratio(alt), extra = ias * 0.00002 * tas * KT;
    const s = (thrust(ias, p, alt) - drag(ias)) / (G + extra);
    return { sin: s, fpm: tas * KT2FPM * s };
  };

  FI.model = { G, KT, KT2FPM, sigma, ratio, sound, thrust, drag, powerFor, energy, vCap, climb, frac };
  FI.aoa = aoa;
  FI.machOf = (tas, alt) => tas / sound(alt);

  FI.setAircraft('c172');
})(window.FI);
