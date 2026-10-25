// Checks for the E6B math: node brief/e6b/test.js
const E = require('./calc.js');
let fails = 0;
function near(name, got, want, tol) {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log((ok ? 'ok   ' : 'FAIL ') + name + ': ' + (typeof got === 'number' ? got.toFixed(4) : got) + ' (want ' + want + ' ±' + tol + ')');
}
function eq(name, got, want) {
  const ok = got === want;
  if (!ok) fails++;
  console.log((ok ? 'ok   ' : 'FAIL ') + name + ': ' + got + (ok ? '' : ' (want ' + want + ')'));
}

// Wind triangle: TC 090, TAS 120, wind 360/20 -> WCA -9.6, GS 118.3
let w = E.windTriangle(90, 120, 0, 20);
near('WCA', w.wca, -9.594, 0.01); near('TH', w.th, 80.406, 0.01); near('GS', w.gs, 118.32, 0.05);
w = E.windTriangle(360, 100, 360, 20); near('headwind GS', w.gs, 80, 1e-9);
eq('impossible wind', E.windTriangle(90, 50, 0, 80), null);
let fw = E.findWind(90, 118.32, 80.406, 120); near('find wind dir', E.hdg(fw.dir), 360, 0.05); near('find wind spd', fw.spd, 20, 0.05);

// Atmosphere
near('PA at 29.92', E.pressureAltitude(1000, 29.92126), 1000, 0.01);
near('PA at 30.42 (rule ~ -500)', E.pressureAltitude(0, 30.42), -458, 5);
near('DA std = PA', E.densityAltitude(5000, E.isaTemp(5000)), 5000, 15);
near('DA 5000ft 30C (rule of thumb 8000)', E.densityAltitude(5000, 30), 7900, 150);
let t = E.trueAirspeed(120, 0, 15); near('TAS at SL std', t.tas, 120, 0.05);
t = E.trueAirspeed(150, 10000, -5); near('TAS 150 @10k -5C', t.tas, 174.0, 0.5);
t = E.trueAirspeed(250, 30000, -44.4); near('Mach 250 KCAS FL300', t.mach, 0.668, 0.005);
near('CAS inverse', E.calibratedAirspeed(t.tas, 30000, -44.4), 250, 0.01);

// Crosswind
eq('rwy 27', E.runwayHeading('27'), 270); eq('rwy 09L', E.runwayHeading('09L'), 90); eq('hdg 045', E.runwayHeading('045'), 45);
let c = E.windComponents(270, 300, 20); near('xwind', c.cross, 10, 1e-9); near('head', c.head, 17.32, 0.01);

// Units / time
near('nm->sm', E.convert('distance', 1, 'nm', 'sm'), 1.15078, 1e-4);
near('kt->mph', E.convert('speed', 100, 'kt', 'mph'), 115.078, 1e-3);
near('inHg->hPa', E.convert('pressure', 29.92, 'inHg', 'hPa'), 1013.2, 0.1);
near('F->C', E.convertTemp(212, 'F', 'C'), 100, 1e-9);
near('time 1:30', E.parseTime('1:30'), 1.5, 1e-9); near('time 90', E.parseTime('90'), 1.5, 1e-9);
eq('fmt', E.formatTime(1.5), '1:30'); eq('fmt s', E.formatTime(1 + 1/60 + 5/3600), '1:01:05');

// Coordinates. Daytona Beach KDAB ARP ~ 29.1799, -81.0581
let p = E.parseLatLon('29.1799, -81.0581'); near('dd lat', p.lat, 29.1799, 1e-9); near('dd lon', p.lon, -81.0581, 1e-9);
p = E.parseLatLon("N29° 10.794' W081° 03.486'"); near('ddm lat', p.lat, 29.1799, 1e-4); near('ddm lon', p.lon, -81.0581, 1e-4);
p = E.parseLatLon('29 10 47.6N 81 03 29.2W'); near('dms lat', p.lat, 29.17989, 1e-4); near('dms lon', p.lon, -81.05811, 1e-4);
p = E.parseLatLon('291048N0810329W'); near('packed lat', p.lat, 29.18, 1e-3); near('packed lon', p.lon, -81.0581, 1e-3);
p = E.parseLatLon('W81.0581 N29.1799'); near('swapped lat', p.lat, 29.1799, 1e-9); near('swapped lon', p.lon, -81.0581, 1e-9);
p = E.parseLatLon('-33.8688 151.2093'); near('space lat', p.lat, -33.8688, 1e-9);
eq('bad', E.parseLatLon('hello'), null); eq('bad min', E.parseLatLon('29 61 N 81 W'), null);

eq('DDM fmt', E.formatDDM(29.1799, true), "N 29° 10.794'");
eq('DDM lon', E.formatDDM(-81.0581, false), "W 081° 03.486'");
eq('DMS fmt', E.formatDMS(-81.0581, false), 'W 081° 03\' 29.2"');
eq('DDM rollover', E.formatDDM(29.99999999, true), "N 30° 00.000'");

// UTM / MGRS reference values from pyproj and the mgrs package (GeoTrans)
let u = E.toUTM(40.689247, -74.044502);
eq('utm zone', u.zone + u.band, '18T'); near('utm E', u.easting, 580735.645, 0.01); near('utm N', u.northing, 4504700.381, 0.01);
let g = E.toMGRS(40.689247, -74.044502); eq('mgrs', g.text, '18T WL 80735 04700');
let back = E.fromMGRS('18TWL8073504700'); near('mgrs back lat', back.lat, 40.689247, 2e-5); near('mgrs back lon', back.lon, -74.044502, 2e-5);
g = E.toMGRS(-33.8688, 151.2093); eq('mgrs sydney', g.text, '56H LH 34368 50948');
eq('mgrs svalbard', E.toMGRS(78.2, 15.6).text, '33X WG 13696 80760');
eq('mgrs norway', E.toMGRS(60.0, 5.5).text, '32V LM 04838 56575');
back = E.fromMGRS(g.text); near('syd lat', back.lat, -33.8688, 2e-5); near('syd lon', back.lon, 151.2093, 2e-5);
// Round trip many points
let worst = 0;
for (let i = 0; i < 4000; i++) {
  const la = -79.9 + Math.random() * 163.8, lo = -180 + Math.random() * 359.99;
  const m = E.toMGRS(la, lo); const b = E.fromMGRS(m.text);
  const d = E.greatCircle(la, lo, b.lat, b.lon).km * 1000;
  if (d > worst) worst = d;
  if (d > 2) { console.log('round trip off', la, lo, m.text, b, d); fails++; break; }
}
console.log('     worst MGRS round trip m:', worst.toFixed(3));
let uu = E.parseUTM('18T 580741 4504692'); near('utm parse', uu.lat, 40.689247, 1e-4);
uu = E.parseUTM('56S 334396 6251251'); console.log('     56S south reading', uu);
let gc = E.greatCircle(29.1799, -81.0581, 28.4294, -81.3090); // KDAB -> KMCO
near('gc nm', gc.nm, 47.3, 1); near('gc course', gc.course, 196.5, 2);
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
