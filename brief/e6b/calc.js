// E6B math: every calculation the E6B page shows, with no page code in it,
// so it can be checked on its own (node brief/e6b/test.js).
(function (root) {
  'use strict';

  var D2R = Math.PI / 180, R2D = 180 / Math.PI;

  function norm360(d) { d = d % 360; return d < 0 ? d + 360 : d; }
  // Headings show 360 rather than 000, as on a compass rose
  function hdg(d) { var r = Math.round(norm360(d)); return r === 0 ? 360 : r; }

  /* ---------- Wind triangle ---------- */

  // Heading and groundspeed for a true course, with the wind given as the
  // direction it blows FROM (true) and its speed.
  function windTriangle(tc, tas, wdir, wspd) {
    var rel = (wdir - tc) * D2R;
    var s = wspd * Math.sin(rel) / tas;
    if (!(tas > 0) || Math.abs(s) > 1) return null;   // wind too strong to hold the course
    var wca = Math.asin(s) * R2D;
    var gs = tas * Math.cos(wca * D2R) - wspd * Math.cos(rel);
    if (gs <= 0) return null;
    return { wca: wca, th: norm360(tc + wca), gs: gs };
  }

  // The wind, from the heading and TAS flown and the course and groundspeed made good
  function findWind(tc, gs, th, tas) {
    var ax = tas * Math.sin(th * D2R), ay = tas * Math.cos(th * D2R);
    var gx = gs * Math.sin(tc * D2R), gy = gs * Math.cos(tc * D2R);
    var wx = ax - gx, wy = ay - gy;                // points to where the wind comes from
    var spd = Math.hypot(wx, wy);
    return { dir: spd < 1e-9 ? 0 : norm360(Math.atan2(wx, wy) * R2D), spd: spd };
  }

  /* ---------- Standard atmosphere ---------- */

  var P0 = 29.92126;          // inHg, sea level standard
  var T0 = 288.15;            // K
  function isaTemp(pa) { return 15 - 1.98 * pa / 1000; }                    // degC
  function pressureRatio(pa) { return Math.pow(1 - 6.8755856e-6 * pa, 5.2558797); }
  function pressureAltitude(elev, altimInHg) {
    // Exact form; the rule of thumb is elev + (29.92 - altimeter) x 1000
    return elev + 145442.16 * (1 - Math.pow(altimInHg / P0, 0.190263));
  }
  function densityAltitude(pa, oatC) {
    var sigma = pressureRatio(pa) / ((oatC + 273.15) / T0);
    return 145442.16 * (1 - Math.pow(sigma, 0.234969));
  }

  // True airspeed from calibrated airspeed, pressure altitude and outside air
  // temperature, with compressibility, as an electronic E6B does it.
  function trueAirspeed(cas, pa, oatC) {
    var a0 = 661.4786;                             // kt, speed of sound at sea level
    var qc = Math.pow(1 + 0.2 * Math.pow(cas / a0, 2), 3.5) - 1;   // impact pressure / P0
    var dp = pressureRatio(pa);
    var mach = Math.sqrt(5 * (Math.pow(qc / dp + 1, 2 / 7) - 1));
    var a = 38.967854 * Math.sqrt(oatC + 273.15);  // kt, local speed of sound
    return { tas: mach * a, mach: mach };
  }
  // CAS needed for a wanted TAS (the inverse, by bisection)
  function calibratedAirspeed(tas, pa, oatC) {
    var lo = 0, hi = tas * 2 + 50;
    for (var i = 0; i < 60; i++) {
      var mid = (lo + hi) / 2;
      if (trueAirspeed(mid, pa, oatC).tas < tas) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /* ---------- Crosswind ---------- */

  // Runway "27" or "09L" means 270 / 090; a three-digit value is taken as a heading
  function runwayHeading(s) {
    var m = String(s).trim().toUpperCase().match(/^(\d{1,3})\s*[LRC]?$/);
    if (!m) return NaN;
    var n = +m[1];
    if (m[1].length <= 2 && n >= 1 && n <= 36) return n * 10;
    return n >= 0 && n <= 360 ? n : NaN;
  }
  function windComponents(rwyHdg, wdir, wspd) {
    var ang = (wdir - rwyHdg) * D2R;
    return { cross: wspd * Math.sin(ang), head: wspd * Math.cos(ang) };   // cross > 0: from the right
  }

  /* ---------- Units ---------- */

  // Each unit's size in the category's base unit
  var UNITS = {
    distance: { base: 'm', units: { nm: 1852, sm: 1609.344, km: 1000, m: 1, ft: 0.3048 } },
    speed: { base: 'kt', units: { kt: 1, mph: 1609.344 / 1852, 'km/h': 1000 / 1852, 'm/s': 3600 / 1852, 'ft/min': 0.3048 * 60 / 1852 } },
    volume: { base: 'L', units: { 'US gal': 3.785411784, L: 1, 'Imp gal': 4.54609, qt: 0.946352946 } },
    weight: { base: 'kg', units: { lb: 0.45359237, kg: 1 } },
    pressure: { base: 'hPa', units: { inHg: 33.8638866667, hPa: 1, mb: 1, mmHg: 1.33322387415, psi: 68.9475729 } },
  };
  function convert(cat, v, from, to) {
    var u = UNITS[cat].units;
    return v * u[from] / u[to];
  }
  var TEMPS = {
    C: { toC: function (v) { return v; }, fromC: function (c) { return c; } },
    F: { toC: function (v) { return (v - 32) * 5 / 9; }, fromC: function (c) { return c * 9 / 5 + 32; } },
    K: { toC: function (v) { return v - 273.15; }, fromC: function (c) { return c + 273.15; } },
  };
  function convertTemp(v, from, to) { return TEMPS[to].fromC(TEMPS[from].toC(v)); }
  // Fuel densities, lb per US gallon (FAA nominal values)
  var FUEL_DENSITY = { '100LL': 6.0, 'Jet A': 6.7, 'Mogas': 6.0, 'Oil': 7.5 };

  /* ---------- Time ---------- */

  // "1:30" is h:mm, "1:30:15" is h:mm:ss, a plain number is minutes. Returns hours.
  function parseTime(s) {
    s = String(s).trim();
    if (!s) return NaN;
    if (s.indexOf(':') >= 0) {
      var p = s.split(':');
      if (p.length > 3 || p.some(function (x) { return !/^\d*\.?\d*$/.test(x) || x === ''; })) return NaN;
      return +p[0] + (+p[1]) / 60 + (p.length > 2 ? +p[2] / 3600 : 0);
    }
    return /^\d*\.?\d+$/.test(s) ? +s / 60 : NaN;
  }
  function formatTime(hours) {
    var t = Math.round(hours * 3600);
    var h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), sec = t % 60;
    return h + ':' + (m < 10 ? '0' : '') + m + (sec ? ':' + (sec < 10 ? '0' : '') + sec : '');
  }

  /* ---------- Coordinates ---------- */

  var WGS84_A = 6378137, WGS84_F = 1 / 298.257223563;
  var E2 = WGS84_F * (2 - WGS84_F), EP2 = E2 / (1 - E2), K0 = 0.9996;

  function utmZone(lat, lon) {
    var z = Math.floor((lon + 180) / 6) + 1;
    if (z > 60) z = 60;
    if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) z = 32;                // Norway
    if (lat >= 72 && lat < 84 && lon >= 0 && lon < 42) {                       // Svalbard
      z = lon < 9 ? 31 : lon < 21 ? 33 : lon < 33 ? 35 : 37;
    }
    return z;
  }
  var BANDS = 'CDEFGHJKLMNPQRSTUVWX';
  function latBand(lat) { return BANDS[Math.min(19, Math.floor((lat + 80) / 8))]; }

  function meridianArc(phi) {
    var e4 = E2 * E2, e6 = e4 * E2;
    return WGS84_A * ((1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi
      - (3 * E2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi)
      + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi)
      - (35 * e6 / 3072) * Math.sin(6 * phi));
  }

  function toUTM(lat, lon, forceZone) {
    if (lat < -80 || lat > 84) return null;        // polar areas use UPS, not UTM
    var zone = forceZone || utmZone(lat, lon);
    var lon0 = ((zone - 1) * 6 - 180 + 3) * D2R;
    var phi = lat * D2R, lam = lon * D2R;
    var sin = Math.sin(phi), cos = Math.cos(phi), tan = Math.tan(phi);
    var N = WGS84_A / Math.sqrt(1 - E2 * sin * sin);
    var T = tan * tan, C = EP2 * cos * cos, A = cos * (lam - lon0);
    var M = meridianArc(phi);
    var x = K0 * N * (A + (1 - T + C) * Math.pow(A, 3) / 6
      + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * Math.pow(A, 5) / 120) + 500000;
    var y = K0 * (M + N * tan * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24
      + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * Math.pow(A, 6) / 720));
    if (lat < 0) y += 10000000;
    return { zone: zone, band: latBand(lat), hemi: lat < 0 ? 'S' : 'N', easting: x, northing: y };
  }

  function fromUTM(zone, south, easting, northing) {
    var x = easting - 500000, y = south ? northing - 10000000 : northing;
    var lon0 = ((zone - 1) * 6 - 180 + 3) * D2R;
    var e4 = E2 * E2, e6 = e4 * E2;
    var mu = y / K0 / (WGS84_A * (1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256));
    var e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
    var phi1 = mu + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu)
      + (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu)
      + (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu)
      + (1097 * Math.pow(e1, 4) / 512) * Math.sin(8 * mu);
    var sin = Math.sin(phi1), cos = Math.cos(phi1), tan = Math.tan(phi1);
    var N1 = WGS84_A / Math.sqrt(1 - E2 * sin * sin);
    var T1 = tan * tan, C1 = EP2 * cos * cos;
    var R1 = WGS84_A * (1 - E2) / Math.pow(1 - E2 * sin * sin, 1.5);
    var Dd = x / (N1 * K0);
    var lat = phi1 - (N1 * tan / R1) * (Dd * Dd / 2
      - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * Math.pow(Dd, 4) / 24
      + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * Math.pow(Dd, 6) / 720);
    var lon = lon0 + (Dd - (1 + 2 * T1 + C1) * Math.pow(Dd, 3) / 6
      + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * Math.pow(Dd, 5) / 120) / cos;
    return { lat: lat * R2D, lon: lon * R2D };
  }

  var MGRS_COLS = ['STUVWXYZ', 'ABCDEFGH', 'JKLMNPQR'];   // indexed by zone % 3
  var MGRS_ROWS = 'ABCDEFGHJKLMNPQRSTUV';

  // digits: 1 (10 km) to 5 (1 m) per coordinate
  function toMGRS(lat, lon, digits) {
    var u = toUTM(lat, lon);
    if (!u) return null;
    digits = digits || 5;
    var col = Math.floor(u.easting / 100000);
    var row = Math.floor(u.northing / 100000) % 20;
    if (u.zone % 2 === 0) row = (row + 5) % 20;
    var div = Math.pow(10, 5 - digits);
    var e = Math.floor((u.easting % 100000) / div), n = Math.floor((u.northing % 100000) / div);
    function pad(v) { v = String(v); while (v.length < digits) v = '0' + v; return v; }
    return {
      zone: u.zone, band: u.band, square: MGRS_COLS[u.zone % 3][col - 1] + MGRS_ROWS[row],
      e: pad(e), n: pad(n),
      text: u.zone + u.band + ' ' + MGRS_COLS[u.zone % 3][col - 1] + MGRS_ROWS[row] + ' ' + pad(e) + ' ' + pad(n),
    };
  }

  function fromMGRS(s) {
    var m = String(s).toUpperCase().replace(/\s+/g, '').match(/^(\d{1,2})([C-HJ-NP-X])([A-HJ-NP-Z])([A-HJ-NP-V])(\d*)$/);
    if (!m || m[5].length % 2 || m[5].length > 10) return null;
    var zone = +m[1], band = m[2];
    if (zone < 1 || zone > 60) return null;
    var colIdx = MGRS_COLS[zone % 3].indexOf(m[3]);
    var rowIdx = MGRS_ROWS.indexOf(m[4]);
    if (colIdx < 0 || rowIdx < 0) return null;
    if (zone % 2 === 0) rowIdx = (rowIdx + 15) % 20;
    var k = m[5].length / 2;
    var scale = Math.pow(10, 5 - k);
    // Place the point in the middle of the square the digits name
    var half = k < 5 ? scale / 2 : 0;
    var e = (colIdx + 1) * 100000 + (k ? +m[5].slice(0, k) * scale : 0) + (k ? half : 50000);
    var n = rowIdx * 100000 + (k ? +m[5].slice(k) * scale : 0) + (k ? half : 50000);
    // The row letters repeat every 2,000 km; the latitude band says which repeat it is
    var bandIdx = BANDS.indexOf(band);
    var south = bandIdx < 10;
    var bandLat = -80 + bandIdx * 8;
    var minN = toUTM(Math.max(-80, bandLat), (zone - 1) * 6 - 180 + 3, zone).northing;
    if (bandLat === 0) minN = 0;
    while (n < minN - 150000) n += 2000000;
    var ll = fromUTM(zone, south, e, n);
    return { lat: ll.lat, lon: ll.lon, precisionM: k ? scale : 100000 };
  }

  // Lat/lon in any common form: decimal degrees, deg-min, deg-min-sec, with
  // N/S/E/W before or after, or signed; also packed forms like 291121N0810327W.
  function parseLatLon(input) {
    var s = String(input).toUpperCase()
      .replace(/[°º˚'′’‘"″”“]/g, ' ')
      .replace(/(\d)\s*(DEG|D)\b/g, '$1 ')
      .replace(/;/g, ',').trim();
    if (!s) return null;
    // Packed aviation forms, e.g. 2911.36N 08103.45W or 291121N0810327W
    var pk = s.match(/^([NS]?)\s*(\d{4,6}(?:\.\d+)?)\s*([NS]?)[\s,]*([EW]?)\s*(\d{5,7}(?:\.\d+)?)\s*([EW]?)$/);
    if (pk && (pk[1] || pk[3]) && (pk[4] || pk[6]) && !(pk[1] && pk[3]) && !(pk[4] && pk[6])) {
      var la = unpack(pk[2], 2), lo = unpack(pk[5], 3);
      if (la == null || lo == null) return null;
      return check((pk[1] || pk[3]) === 'S' ? -la : la, (pk[4] || pk[6]) === 'W' ? -lo : lo);
    }
    var toks = s.match(/[NSEW]|[-+]?\d+(?:\.\d+)?|\.\d+|,/g);
    if (!toks) return null;
    if (s.replace(/[NSEW]|[-+]?\d+(?:\.\d+)?|\.\d+|[\s,]/g, '') !== '') return null;  // stray characters
    var letters = toks.filter(function (t) { return /^[NSEW]$/.test(t); });
    var groups = [];
    if (letters.length) {
      if (letters.length !== 2) return null;
      var prefix = /^[NSEW]$/.test(toks[0]);
      var cur = null;
      toks.forEach(function (t) {
        if (t === ',') return;
        if (/^[NSEW]$/.test(t)) {
          if (prefix) { cur = { h: t, n: [] }; groups.push(cur); }
          else { if (!cur) return; cur.h = t; groups.push(cur); cur = null; }
        } else {
          if (prefix) { if (!cur) return; cur.n.push(t); }
          else { if (!cur) cur = { n: [] }; cur.n.push(t); }
        }
      });
      if (!prefix && cur) return null;
      if (groups.length !== 2) return null;
    } else {
      var nums = [], halves = [[]];
      toks.forEach(function (t) { if (t === ',') halves.push([]); else { halves[halves.length - 1].push(t); nums.push(t); } });
      if (halves.length === 2 && halves[0].length && halves[1].length) {
        groups = [{ n: halves[0] }, { n: halves[1] }];
      } else if (halves.length === 1 && nums.length % 2 === 0 && nums.length <= 6) {
        var h = nums.length / 2;
        groups = [{ n: nums.slice(0, h) }, { n: nums.slice(h) }];
      } else return null;
    }
    var vals = groups.map(function (g) {
      if (!g.n.length || g.n.length > 3) return NaN;
      var neg = /^-/.test(g.n[0]);
      var d = Math.abs(+g.n[0]), mi = g.n.length > 1 ? +g.n[1] : 0, se = g.n.length > 2 ? +g.n[2] : 0;
      if (g.n.slice(1).some(function (x) { return /^[-+]/.test(x); })) return NaN;
      if (mi >= 60 || se >= 60) return NaN;
      if (g.n.length > 1 && d % 1) return NaN;             // 29.5 11 makes no sense
      if (g.n.length > 2 && mi % 1) return NaN;
      var v = d + mi / 60 + se / 3600;
      if (neg) v = -v;
      if (g.h === 'S' || g.h === 'W') { if (neg) return NaN; v = -v; }
      return v;
    });
    var lat = vals[0], lon = vals[1];
    if (groups[0].h) {
      var latFirst = /[NS]/.test(groups[0].h);
      if (latFirst === /[NS]/.test(groups[1].h)) return null;   // two latitudes
      if (!latFirst) { lat = vals[1]; lon = vals[0]; }
    }
    return check(lat, lon);

    function unpack(str, degDigits) {
      var parts = str.split('.'), ip = parts[0], frac = parts[1] ? '.' + parts[1] : '';
      var d = +ip.slice(0, degDigits), rest = ip.slice(degDigits);
      var mi, se = 0;
      if (rest.length === 2) mi = +(rest + frac);
      else if (rest.length === 4) { mi = +rest.slice(0, 2); se = +(rest.slice(2) + frac); }
      else return null;
      if (mi >= 60 || se >= 60) return null;
      return d + mi / 60 + se / 3600;
    }
    function check(lat, lon) {
      if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
      return { lat: lat, lon: lon };
    }
  }

  // UTM written as "17R 495000 3229000" or "17N 495000 3229000"
  function parseUTM(s) {
    var m = String(s).toUpperCase().trim().match(/^(\d{1,2})\s*([C-HJ-NP-X])\s+(\d{3,7}(?:\.\d+)?)\s*M?\s*E?\s*[, ]\s*(\d{1,8}(?:\.\d+)?)\s*M?\s*N?$/);
    if (!m) return null;
    var zone = +m[1];
    if (zone < 1 || zone > 60) return null;
    var e = +m[3], n = +m[4];
    if (e < 100000 || e > 900000 || n > 10000000) return null;
    // The letter is read as a latitude band (N and later are north). Some
    // people write S for the southern hemisphere instead; if the band does not
    // fit the northing, try that reading.
    var bi = BANDS.indexOf(m[2]);
    var ll = fromUTM(zone, bi < 10, e, n);
    var bandLat = -80 + bi * 8;
    if (m[2] === 'S' && !(ll.lat > bandLat - 1 && ll.lat < bandLat + 9)) ll = fromUTM(zone, true, e, n);
    if (!isFinite(ll.lat) || Math.abs(ll.lat) > 90) return null;
    return ll;
  }

  // Any format the page accepts
  function parseCoordinate(s) {
    var str = String(s).trim();
    if (!str) return null;
    var g = fromMGRS(str);
    if (g) return { lat: g.lat, lon: g.lon, from: 'MGRS', precisionM: g.precisionM };
    var u = parseUTM(str);
    if (u) return { lat: u.lat, lon: u.lon, from: 'UTM' };
    var ll = parseLatLon(str);
    if (ll) return { lat: ll.lat, lon: ll.lon, from: 'lat/lon' };
    return null;
  }

  function pad0(v, n) { v = String(v); while (v.length < n) v = '0' + v; return v; }
  function formatDD(lat, lon, dp) {
    dp = dp == null ? 6 : dp;
    return lat.toFixed(dp) + ', ' + lon.toFixed(dp);
  }
  // Degrees and decimal minutes, e.g. N 29° 10.800' W 081° 03.450'
  function formatDDM(v, isLat, dp) {
    dp = dp == null ? 3 : dp;
    var h = isLat ? (v < 0 ? 'S' : 'N') : (v < 0 ? 'W' : 'E');
    var f = Math.pow(10, dp);
    var totalMin = Math.round(Math.abs(v) * 60 * f) / f;
    var d = Math.floor(totalMin / 60 + 1e-12);
    var m = totalMin - d * 60;
    var ms = m.toFixed(dp);
    if (+ms >= 60) { d += 1; ms = (0).toFixed(dp); }
    return h + ' ' + pad0(d, isLat ? 2 : 3) + '° ' + pad0(ms, dp ? 3 + dp : 2) + "'";
  }
  function formatDMS(v, isLat, dp) {
    dp = dp == null ? 1 : dp;
    var h = isLat ? (v < 0 ? 'S' : 'N') : (v < 0 ? 'W' : 'E');
    var f = Math.pow(10, dp);
    var totalSec = Math.round(Math.abs(v) * 3600 * f) / f;
    var d = Math.floor(totalSec / 3600 + 1e-12);
    var rem = totalSec - d * 3600;
    var m = Math.floor(rem / 60 + 1e-12);
    var sec = rem - m * 60;
    var ss = sec.toFixed(dp);
    if (+ss >= 60) { ss = (0).toFixed(dp); m += 1; }
    if (m >= 60) { m = 0; d += 1; }
    return h + ' ' + pad0(d, isLat ? 2 : 3) + '° ' + pad0(m, 2) + "' " + pad0(ss, dp ? 3 + dp : 2) + '"';
  }

  // Great-circle distance (nm) and initial true course between two points
  function greatCircle(lat1, lon1, lat2, lon2) {
    var p1 = lat1 * D2R, p2 = lat2 * D2R, dl = (lon2 - lon1) * D2R;
    var a = Math.pow(Math.sin((p2 - p1) / 2), 2) + Math.cos(p1) * Math.cos(p2) * Math.pow(Math.sin(dl / 2), 2);
    var km = 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(a)));
    var y = Math.sin(dl) * Math.cos(p2);
    var x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return { nm: km / 1.852, km: km, course: norm360(Math.atan2(y, x) * R2D) };
  }

  var api = {
    norm360: norm360, hdg: hdg,
    windTriangle: windTriangle, findWind: findWind,
    isaTemp: isaTemp, pressureAltitude: pressureAltitude, densityAltitude: densityAltitude,
    trueAirspeed: trueAirspeed, calibratedAirspeed: calibratedAirspeed,
    runwayHeading: runwayHeading, windComponents: windComponents,
    UNITS: UNITS, convert: convert, convertTemp: convertTemp, FUEL_DENSITY: FUEL_DENSITY,
    parseTime: parseTime, formatTime: formatTime,
    toUTM: toUTM, fromUTM: fromUTM, toMGRS: toMGRS, fromMGRS: fromMGRS,
    parseLatLon: parseLatLon, parseUTM: parseUTM, parseCoordinate: parseCoordinate,
    formatDD: formatDD, formatDDM: formatDDM, formatDMS: formatDMS, greatCircle: greatCircle,
  };
  root.E6B = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(this);
