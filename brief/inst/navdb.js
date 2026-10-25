// Real US navaids and ILS approaches from FAA NASR data (navdata.js), placed
// on the sim's flat map. The map is a local flat projection around a home
// airport: x feet east, y feet south of it. That is accurate to well under
// a percent within 100 nm, which covers everything the receivers can hear.
// Training use only, not for navigation.
(function (FI) {
  'use strict';

  const NM = FI.NM, D2R = FI.D2R, R2D = FI.R2D, norm360 = FI.norm360, norm180 = FI.norm180, clamp = FI.clamp;
  const DATA = FI.NAVDATA || { nav: [], apt: [] };
  const REACH = 4.5;                     // degrees of latitude around home to load (about 270 nm)

  const O = FI.origin = { lat: 0, lon: 0, cos: 1 };
  const toXY = (lat, lon) => ({ x: (lon - O.lon) * 60 * NM * O.cos, y: -(lat - O.lat) * 60 * NM });
  const toLL = (x, y) => ({ lat: O.lat - y / (60 * NM), lon: O.lon + x / (60 * NM * O.cos) });
  FI.toXY = toXY; FI.toLL = toLL;

  // Magnetic variation, east positive: magnetic = true - variation.
  FI.magVar = 0;
  FI.toMag = t => norm360(t - FI.magVar);
  FI.toTrue = m => norm360(m + FI.magVar);

  // TACAN channel <-> paired VHF frequency. 17-59 pair with 108.00-112.25,
  // 70-126 with 112.30-117.95; X channels on the .x0, Y on the .x5.
  FI.chanToMhz = function (ch) {
    const m = /^(\d{1,3})([XY])$/.exec(String(ch || '').toUpperCase().trim());
    if (!m) return null;
    const n = +m[1], y = m[2] === 'Y' ? 0.05 : 0;
    if (n >= 17 && n <= 59) return Math.round((108 + (n - 17) * 0.1 + y) * 100) / 100;
    if (n >= 70 && n <= 126) return Math.round((112.3 + (n - 70) * 0.1 + y) * 100) / 100;
    return null;
  };
  FI.mhzToChan = function (f) {
    const k = Math.round(f * 20);                 // 50 kHz steps
    const y = k % 2 ? 'Y' : 'X', base = (k - (k % 2)) / 20;
    let n = null;
    if (base >= 108 && base < 112.3 - 1e-6) n = 17 + Math.round((base - 108) * 10);
    else if (base >= 112.3 && base <= 117.9 + 1e-6) n = 70 + Math.round((base - 112.3) * 10);
    return n == null ? null : n + y;
  };
  FI.fmtMhz = f => (f == null ? '---.--' : f.toFixed(2));

  // ---------- service volumes ----------
  // Standard service volumes by class, in nm, at a height above the station,
  // and never beyond radio line of sight (1.23 * sqrt(feet)).
  function ssv(cls, agl) {
    switch (cls) {
      case 'T': return 25;
      case 'L': return 40;
      case 'VL': case 'DL': return agl >= 5000 ? 70 : 40;
      case 'H': return agl < 14500 ? 40 : agl < 18000 ? 100 : 130;
      case 'VH': case 'DH': return agl < 5000 ? 40 : agl < 14500 ? 70 : agl < 18000 ? 100 : 130;
      default: return 40;
    }
  }
  const los = agl => 1.23 * Math.sqrt(Math.max(agl, 200));
  FI.vhfRange = (cls, agl) => Math.min(ssv(cls, agl), los(agl));
  // NDBs by class: HH 75 nm, H 50, MH 25, compass locators 15.
  FI.ndbRange = cls => {
    const c = cls || '';
    if (/^HH/.test(c)) return 75;
    if (/^H/.test(c)) return 50;
    if (/^MH/.test(c)) return 25;
    if (/^L(OM|MM)|^LOMW/.test(c)) return 15;
    return 25;
  };

  // ---------- the loaded area ----------
  FI.stations = [];       // VOR, VOR/DME, VORTAC, TACAN, DME, NDB, NDB/DME
  FI.ilsList = [];        // localizers (ILS, LOC, LDA, SDF), with glideslope where there is one
  FI.airports = [];       // airports with an approach, with their runways
  FI.home = null;

  function station(r) {
    const [id, type, name, lat, lon, elev, mhz, khz, chan, varE, vorCls, dmeCls, ndbCls] = r;
    const p = toXY(lat, lon);
    const s = {
      id, type, name, lat, lon, x: p.x, y: p.y, elev: elev || 0, khz, chan,
      mhz: mhz != null ? mhz : (chan ? FI.chanToMhz(chan) : null),
      varE: varE != null ? varE : FI.magVar, vorCls, dmeCls, ndbCls,
      vor: type === 'VOR' || type === 'VOR/DME' || type === 'VORTAC',
      tacan: type === 'TACAN' || type === 'VORTAC',
      dme: type === 'VOR/DME' || type === 'VORTAC' || type === 'TACAN' || type === 'DME' || type === 'NDB/DME',
      ndb: type === 'NDB' || type === 'NDB/DME',
    };
    if (s.ndb) s.mhz = chan ? FI.chanToMhz(chan) : null;
    return s;
  }

  // A localizer from a runway end: the threshold (moved in for a displaced
  // threshold), the antenna 1,000 ft past the far end, and the glideslope
  // antenna beside the touchdown zone where the path crosses the threshold
  // at the published height.
  function localizer(a, rw, e) {
    const [endId, ident, sys, mhz, crsM, gsAngle, tch, disp, dmeChan] = e;
    const r = a.runways.find(w => w.ends[0] === endId || w.ends[1] === endId);
    if (!r) return null;
    const first = r.ends[0] === endId;
    const A = first ? r.a : r.b, B = first ? r.b : r.a, elev = first ? r.elevA : r.elevB;
    const L = Math.hypot(B.x - A.x, B.y - A.y);
    if (L < 500) return null;
    const ux = (B.x - A.x) / L, uy = (B.y - A.y) / L;            // landing direction on the map
    const geo = norm360(Math.atan2(ux, -uy) * R2D);              // true course of the centerline
    const dataTrue = norm360(crsM + a.varE);
    const offset = Math.abs(norm180(dataTrue - geo)) > 3;        // offset localizer, LDA or SDF
    const course = offset ? dataTrue : geo;
    const thr = { x: A.x + ux * disp, y: A.y + uy * disp };
    const loc = { x: B.x + ux * 1000, y: B.y + uy * 1000 };
    let gs = null;
    if (gsAngle) {
      const d = clamp(tch / Math.tan(gsAngle * D2R), 700, 1600);
      gs = { x: thr.x + ux * d - uy * 400, y: thr.y + uy * d + ux * 400 };   // 400 ft right of the centerline
    }
    const dThr = Math.hypot(loc.x - thr.x, loc.y - thr.y);
    // full scale: 350 ft either side at the threshold, between 1.5 and 3 degrees (SDF wider)
    const locFull = sys === 'SDF' ? 5 : clamp(Math.atan(350 / dThr) * R2D, 1.5, 3);
    const hasDme = !!dmeChan || /DME/.test(sys);
    return {
      kind: 'LOC', id: ident, apt: a, rwy: endId, sys, mhz, crsM, course, offset, thr, end: B, loc, gs, elev,
      gsAngle: gsAngle || 3, hasGs: !!gs, tch, locFull, gsFull: 0.7, da: elev + 200,
      dme: hasDme ? (gs || loc) : null, chan: dmeChan, width: r.width, x: loc.x, y: loc.y,
      name: `${sys === 'LDA' || sys === 'LDA/DME' ? 'LDA' : sys === 'SDF' ? 'SDF' : gs ? 'ILS' : 'LOC'} RWY ${endId}`,
    };
  }

  function airport(r) {
    const [faa, icao, name, lat, lon, elev, varE, rws, ils] = r;
    const p = toXY(lat, lon);
    const a = { faa, icao, code: icao || faa, name, lat, lon, x: p.x, y: p.y, elev, varE, runways: [], ils: [] };
    for (const w of rws) {
      const [id, la, lo, ea, lb, lob, eb, width] = w;
      const ends = id.split('/');
      a.runways.push({ id, ends: [ends[0], ends[1] || ''], a: toXY(la, lo), b: toXY(lb, lob), elevA: ea, elevB: eb, width });
    }
    for (const e of ils) { const L = localizer(a, a.runways, e); if (L) a.ils.push(L); }
    return a;
  }

  // Find an airport (ICAO or FAA code) in the data, without loading it.
  FI.findAirport = function (code) {
    const c = String(code || '').toUpperCase().trim();
    if (!c) return null;
    return DATA.apt.find(a => a[1] === c || a[0] === c || (c.length === 4 && c[0] === 'K' && a[0] === c.slice(1))) || null;
  };
  FI.airportCodes = () => DATA.apt.map(a => ({ code: a[1] || a[0], name: a[2] }));
  FI.airportApproaches = function (code) {
    const r = FI.findAirport(code);
    return r ? r[8].map(e => ({ rwy: e[0], ident: e[1], sys: e[2], mhz: e[3] })) : [];
  };
  FI.dataCycle = DATA.cycle || '';

  // Load the area around an airport and make it home: the origin of the
  // map, the magnetic variation used for headings, and the approach and
  // stations the scenarios use.
  FI.setHome = function (code, rwy) {
    const r = FI.findAirport(code) || FI.findAirport('KDAB') || DATA.apt[0];
    if (!r) return null;
    const [, , , lat, lon, , varE] = r;
    O.lat = lat; O.lon = lon; O.cos = Math.cos(lat * D2R);
    FI.magVar = varE || 0;
    const near = (la, lo) => Math.abs(la - lat) < REACH && Math.abs(lo - lon) * O.cos < REACH;
    FI.stations = DATA.nav.filter(s => near(s[3], s[4])).map(station);
    FI.airports = DATA.apt.filter(a => near(a[3], a[4])).map(airport);
    FI.ilsList = [].concat(...FI.airports.map(a => a.ils));
    const apt = FI.airports.find(a => a.faa === r[0]);
    const ils = apt.ils.find(l => l.rwy === rwy) || apt.ils.find(l => l.hasGs) || apt.ils[0];
    const dist = s => Math.hypot(s.x - apt.x, s.y - apt.y) / NM;
    const nearest = (pred, max) => FI.stations.filter(s => pred(s) && dist(s) <= max).sort((a, b) => dist(a) - dist(b))[0] || null;
    FI.home = {
      apt, ils, elev: apt.elev,
      vor: nearest(s => s.vor, 40) || nearest(s => s.vor, 150),
      tacan: nearest(s => s.tacan, 40),
      ndb: nearest(s => s.ndb, 30),
    };
    FI.groundElev = apt.elev;
    if (FI.buildScenarios) FI.buildScenarios();
    return FI.home;
  };

  // Stations and localizers near a point, nearest first, for the tuning list.
  FI.nearby = function (x, y, maxNm) {
    const out = [];
    for (const s of FI.stations) { const d = Math.hypot(s.x - x, s.y - y) / NM; if (d <= maxNm) out.push({ s, d }); }
    for (const l of FI.ilsList) { const d = Math.hypot(l.thr.x - x, l.thr.y - y) / NM; if (d <= maxNm) out.push({ s: l, d }); }
    return out.sort((a, b) => a.d - b.d);
  };
})(window.FI);
