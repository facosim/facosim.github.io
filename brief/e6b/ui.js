// E6B page: reads the inputs, runs the math in calc.js and shows the answers.
(function () {
  'use strict';
  var E = window.E6B;
  var $ = function (id) { return document.getElementById(id); };
  var DASH = '—';
  var STORE = 'e6b-v1';

  /* ---------- Small helpers ---------- */

  function num(id) {
    var s = $(id).value.replace(/,/g, '').trim();
    return s === '' || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s) ? NaN : +s;
  }
  // Flags an input the user filled in with something unreadable
  function bad(id, isBad) {
    var box = $(id).closest('.in');
    if (box) box.classList.toggle('bad', !!isBad && $(id).value.trim() !== '');
  }
  function numChecked(id) { var v = num(id); bad(id, isNaN(v)); return v; }
  function fmt(v, dp) {
    if (!isFinite(v)) return DASH;
    return v.toLocaleString('en-US', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 });
  }
  function smart(v) {
    if (!isFinite(v)) return DASH;
    var a = Math.abs(v);
    var dp = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 10 ? 3 : a >= 0.01 || a === 0 ? 4 : 6;
    return v.toLocaleString('en-US', { maximumFractionDigits: dp });
  }
  function deg3(d) { var h = E.hdg(d); return (h < 10 ? '00' : h < 100 ? '0' : '') + h + '°'; }
  function set(id, html) { $(id).innerHTML = html; }
  function unit(u) { return ' <small>' + u + '</small>'; }
  function seg(id) { var b = $(id).querySelector('button.on'); return b ? b.getAttribute('data-v') : null; }
  function variation(valId, hemiId) {
    var v = num(valId);
    if (isNaN(v)) return NaN;
    return $(hemiId).value === 'W' ? Math.abs(v) : -Math.abs(v);   // amount to add to true
  }
  function timeText(h) {
    if (!isFinite(h) || h < 0) return DASH;
    if (h >= 1) h = Math.round(h * 60) / 60;        // past an hour, whole minutes are plenty
    return E.formatTime(h) + unit(fmt(h * 60, h * 60 < 10 ? 1 : 0) + ' min');
  }
  function headTail(v) {
    if (!isFinite(v)) return DASH;
    var r = Math.round(Math.abs(v));
    if (r === 0) return '0' + unit('kt');
    return r + unit('kt ' + (v > 0 ? 'headwind' : 'tailwind'));
  }

  /* ---------- Saved entries ---------- */

  var state = { v: {}, seg: {}, from: {} };
  function load() {
    try { var s = JSON.parse(localStorage.getItem(STORE) || 'null'); if (s) state = { v: s.v || {}, seg: s.seg || {}, from: s.from || {} }; }
    catch (e) { /* storage blocked: start from the examples */ }
    document.querySelectorAll('[data-save]').forEach(function (el) {
      if (state.v[el.id] != null) el.value = state.v[el.id];
    });
    document.querySelectorAll('[data-save-seg]').forEach(function (el) {
      var v = state.seg[el.id];
      if (v && el.querySelector('[data-v="' + v + '"]')) pick(el, v);
    });
  }
  function save() {
    document.querySelectorAll('[data-save]').forEach(function (el) { state.v[el.id] = el.value; });
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* not saved */ }
  }
  function pick(segEl, v) {
    segEl.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-v') === v); });
    state.seg[segEl.id] = v;
  }

  /* ---------- Wind correction ---------- */

  function wind() {
    var tc = numChecked('w-tc'), tas = numChecked('w-tas'), wd = numChecked('w-wd'), ws = numChecked('w-ws');
    var vr = variation('w-var', 'w-varh'), dist = num('w-dist');
    bad('w-var', isNaN(vr)); bad('w-dist', isNaN(dist));
    var out = ['w-th', 'w-gs', 'w-mh', 'w-hw', 'w-ete'];
    $('w-ete-box').classList.toggle('hidden', isNaN(dist));
    function clear(msg) { out.forEach(function (id) { set(id, DASH); }); set('w-wca', ''); set('w-msg', msg); $('w-dia').innerHTML = ''; }
    if ([tc, tas, wd, ws].some(isNaN)) return clear('Enter the course, true airspeed and wind.');
    if (tas <= 0) return clear('True airspeed must be more than zero.');
    if (ws < 0) return clear('Wind speed cannot be negative.');
    var r = E.windTriangle(tc, tas, wd, ws);
    if (!r) return clear('The wind is too strong for this airspeed to hold that course.');
    set('w-msg', '');
    set('w-th', deg3(r.th));
    var w = Math.round(r.wca);
    set('w-wca', 'Wind correction ' + (w === 0 ? 'none' : Math.abs(w) + '° ' + (w > 0 ? 'right' : 'left')) + ' (' + (r.wca >= 0 ? '+' : '−') + Math.abs(r.wca).toFixed(1) + '°)');
    set('w-gs', fmt(r.gs) + unit('kt'));
    set('w-mh', isNaN(vr) ? DASH : deg3(r.th + vr) + unit(Math.abs(vr) + '° ' + (vr >= 0 ? 'W' : 'E') + ' var'));
    set('w-hw', headTail(ws * Math.cos((wd - tc) * Math.PI / 180)));
    set('w-ete', isNaN(dist) ? DASH : timeText(dist / r.gs));
    drawTriangle(tc, tas, wd, ws, r);
  }

  var SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(parent, tag, attrs, text) {
    var el = document.createElementNS(SVGNS, tag);
    for (var k in attrs) {
      // Theme colours are CSS variables, which only work through style
      if ((k === 'fill' || k === 'stroke') && /^var\(/.test(attrs[k])) el.style[k] = attrs[k];
      else el.setAttribute(k, attrs[k]);
    }
    if (text != null) el.textContent = text;
    parent.appendChild(el);
    return el;
  }
  function markers(svg, defs) {
    var d = svgEl(svg, 'defs', {});
    defs.forEach(function (m) {
      var mk = svgEl(d, 'marker', { id: m[0], viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
      svgEl(mk, 'path', { d: 'M0,0 L10,5 L0,10 z', fill: m[1] });
    });
  }
  function northArrow(svg, x, y) {
    svgEl(svg, 'path', { d: 'M' + x + ',' + (y + 16) + ' L' + x + ',' + y, stroke: 'var(--dim)', 'stroke-width': 1.5, 'marker-end': 'url(#mk-n)' });
    svgEl(svg, 'text', { x: x, y: y + 28, fill: 'var(--dim)', 'text-anchor': 'middle' }, 'N');
  }

  function drawTriangle(tc, tas, wd, ws, r) {
    var svg = $('w-dia');
    svg.innerHTML = '';
    var R = Math.PI / 180;
    // Air vector (heading, TAS), then the wind (blowing toward wd+180) gives the ground vector
    var A = [Math.sin(r.th * R) * tas, -Math.cos(r.th * R) * tas];
    var G = [Math.sin(tc * R) * r.gs, -Math.cos(tc * R) * r.gs];
    var xs = [0, A[0], G[0]], ys = [0, A[1], G[1]];
    var minX = Math.min.apply(0, xs), maxX = Math.max.apply(0, xs), minY = Math.min.apply(0, ys), maxY = Math.max.apply(0, ys);
    var s = Math.min(230 / Math.max(maxX - minX, 1), 130 / Math.max(maxY - minY, 1));
    var ox = 150 - (minX + maxX) / 2 * s, oy = 84 - (minY + maxY) / 2 * s;
    function P(p) { return [ox + p[0] * s, oy + p[1] * s]; }
    var o = P([0, 0]), a = P(A), g = P(G);
    markers(svg, [['mk-air', 'var(--text)'], ['mk-gnd', 'var(--out)'], ['mk-wnd', 'var(--warn)'], ['mk-n', 'var(--dim)']]);
    northArrow(svg, 14, 8);
    function line(p, q, color, mk, dash) {
      svgEl(svg, 'line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: color, 'stroke-width': 2.2, 'marker-end': 'url(#' + mk + ')', 'stroke-dasharray': dash || '' });
    }
    line(o, a, 'var(--text)', 'mk-air');
    if (ws > 0.5) line(a, g, 'var(--warn)', 'mk-wnd', '5 3');
    line(o, g, 'var(--out)', 'mk-gnd');
    // Legend under the drawing
    [['var(--text)', 'Heading ' + deg3(r.th) + ' at ' + Math.round(tas) + ' kt TAS (air)'],
      ['var(--warn)', ws > 0.5 ? 'Wind ' + deg3(wd) + ' at ' + Math.round(ws) + ' kt' : 'Calm'],
      ['var(--out)', 'Course ' + deg3(tc) + ' at ' + Math.round(r.gs) + ' kt GS (ground)']].forEach(function (l, i) {
      var y = 176 + i * 16;
      svgEl(svg, 'line', { x1: 34, y1: y - 4, x2: 52, y2: y - 4, stroke: l[0], 'stroke-width': 2.2, 'stroke-dasharray': i === 1 ? '5 3' : '' });
      svgEl(svg, 'text', { x: 60, y: y, fill: l[0] }, l[1]);
    });
  }

  /* ---------- Find the wind ---------- */

  function findWind() {
    var tc = numChecked('fw-tc'), gs = numChecked('fw-gs'), th = numChecked('fw-th'), tas = numChecked('fw-tas');
    if ([tc, gs, th, tas].some(isNaN) || gs < 0 || tas <= 0) { ['fw-w', 'fw-wca', 'fw-hw'].forEach(function (id) { set(id, DASH); }); return; }
    var w = E.findWind(tc, gs, th, tas);
    set('fw-w', Math.round(w.spd) < 1 ? 'Calm' : deg3(w.dir) + ' at ' + Math.round(w.spd) + unit('kt'));
    var wca = ((th - tc + 540) % 360) - 180;
    set('fw-wca', Math.round(wca) === 0 ? '0°' : Math.abs(Math.round(wca)) + '°' + unit(wca > 0 ? 'right' : 'left'));
    set('fw-hw', headTail(w.spd * Math.cos((w.dir - tc) * Math.PI / 180)));
  }

  /* ---------- Time, speed, distance ---------- */

  function tsd() {
    var mode = seg('tsd-mode');
    document.querySelectorAll('#t-tsd [data-for]').forEach(function (el) { el.classList.toggle('hidden', el.getAttribute('data-for') === mode); });
    var gs = num('tsd-gs'), d = num('tsd-d'), t = E.parseTime($('tsd-t').value);
    if (mode !== 'speed') bad('tsd-gs', isNaN(gs));
    if (mode !== 'dist') bad('tsd-d', isNaN(d));
    if (mode !== 'time') bad('tsd-t', isNaN(t));
    var lbl = { time: 'Time', speed: 'Groundspeed', dist: 'Distance' }[mode];
    set('tsd-lbl', lbl);
    set('tsd-sub', ''); set('tsd-msg', '');
    var out = DASH;
    if (mode === 'time' && gs > 0 && d >= 0) { t = d / gs; out = timeText(t); }
    else if (mode === 'speed' && t > 0 && d >= 0) { gs = d / t; out = fmt(gs, gs < 10 ? 1 : 0) + unit('kt'); }
    else if (mode === 'dist' && gs >= 0 && t >= 0) { d = gs * t; out = fmt(d, 1) + unit('nm'); set('tsd-sub', fmt(E.convert('distance', d, 'nm', 'sm'), 1) + ' sm · ' + fmt(E.convert('distance', d, 'nm', 'km'), 1) + ' km'); }
    else {
      set('tsd-msg', mode === 'time' ? 'Enter a groundspeed above zero and a distance.' : mode === 'speed' ? 'Enter a distance and a time above zero.' : 'Enter a groundspeed and a time.');
      gs = NaN;
    }
    set('tsd-out', out);
    set('tsd-mpm', gs > 0 ? fmt(gs / 60, 2) + unit('nm/min') : DASH);
    set('tsd-m10', gs > 0 ? fmt(600 / gs, 1) + unit('min') : DASH);
  }

  /* ---------- Fuel ---------- */

  function fuel() {
    var mode = seg('fuel-mode');
    var u = $('fu-units').value, dens = E.FUEL_DENSITY[$('fu-type').value];
    document.querySelectorAll('#t-fuel .fu-u').forEach(function (el) { el.textContent = u; });
    document.querySelectorAll('#t-fuel [data-for]').forEach(function (el) { el.classList.toggle('hidden', el.getAttribute('data-for') === mode); });
    $('fu-res').closest('.f').classList.toggle('hidden', mode === 'rate');
    var rate = num('fu-rate'), t = E.parseTime($('fu-time').value), f = num('fu-fuel'), res = num('fu-res');
    if (mode !== 'rate') bad('fu-rate', isNaN(rate));
    if (mode !== 'time') bad('fu-time', isNaN(t));
    if (mode !== 'fuel') bad('fu-fuel', isNaN(f));
    if (mode !== 'rate') bad('fu-res', isNaN(res));
    if (isNaN(res)) res = 0;
    var dp = u === 'L' || u === 'kg' || u === 'lb' ? 0 : 1;
    function amt(v) { return fmt(v, v >= 100 ? 0 : dp) + unit(u); }
    // The other way of measuring: weight for volumes, volume for weights
    function other(v) {
      var lb = u === 'gal' ? v * dens : u === 'L' ? v / 3.785411784 * dens : u === 'lb' ? v : v / 0.45359237;
      if (u === 'gal' || u === 'L') return fmt(lb, 0) + unit('lb') + ' · ' + fmt(lb * 0.45359237, 0) + unit('kg');
      var gal = lb / dens;
      return fmt(gal, 1) + unit('gal') + ' · ' + fmt(gal * 3.785411784, 0) + unit('L');
    }
    var heavy = u === 'gal' || u === 'L';
    set('fu-msg', ''); set('fu-sub', '');
    var labels = {
      fuel: ['Fuel needed, with reserve', heavy ? 'Weight' : 'Volume', 'Trip fuel only'],
      time: ['Endurance, tanks to dry', 'Flight time keeping the reserve', 'Reserve fuel'],
      rate: ['Burn rate', heavy ? 'Weight per hour' : 'Volume per hour', 'Per minute'],
    }[mode];
    set('fu-lbl', labels[0]); set('fu-l2', labels[1]); set('fu-l3', labels[2]);
    var o1 = DASH, o2 = DASH, o3 = DASH;
    if (mode === 'fuel') {
      if (rate >= 0 && t >= 0) {
        var trip = rate * t, total = rate * (t + res / 60);
        o1 = amt(total); o2 = other(total); o3 = amt(trip);
        set('fu-sub', 'Trip ' + fmt(trip, dp) + ' + reserve ' + fmt(rate * res / 60, dp) + ' ' + u);
      } else set('fu-msg', 'Enter the fuel burn and flight time.');
    } else if (mode === 'time') {
      if (rate > 0 && f >= 0) {
        var end = f / rate, keep = end - res / 60;
        o1 = timeText(end); o3 = amt(rate * res / 60);
        o2 = keep > 0 ? timeText(keep) : 'None';
        if (keep <= 0) set('fu-msg', 'This fuel does not cover the reserve.');
      } else set('fu-msg', 'Enter the fuel on board and a burn rate above zero.');
    } else {
      if (t > 0 && f >= 0) {
        var r = f / t;
        o1 = fmt(r, 1) + unit(u + '/hr'); o2 = other(r).replace(/<\/small>/g, '/hr</small>'); o3 = fmt(r / 60, 2) + unit(u + '/min');
      } else set('fu-msg', 'Enter the fuel used and a flight time above zero.');
    }
    set('fu-out', o1); set('fu-o2', o2); set('fu-o3', o3);
  }

  /* ---------- Climb & descent ---------- */

  var FT_PER_NM = 6076.12;
  function climb() {
    var gs = numChecked('cl-gs'), g = numChecked('cl-g'), gu = $('cl-gu').value;
    var ftnm = gu === 'deg' ? Math.tan(g * Math.PI / 180) * FT_PER_NM : gu === 'pct' ? g / 100 * FT_PER_NM : g;
    var ok = !isNaN(gs) && !isNaN(ftnm) && (gu !== 'deg' || Math.abs(g) < 45);
    set('cl-fpm', ok ? fmt(gs * ftnm / 60) + unit('fpm') : DASH);
    set('cl-ftnm', ok ? fmt(ftnm) + unit('ft/nm') : DASH);
    set('cl-deg', ok ? fmt(Math.atan(ftnm / FT_PER_NM) * 180 / Math.PI, 1) + '°' + unit(fmt(ftnm / FT_PER_NM * 100, 1) + '%') : DASH);

    var a1 = numChecked('td-a1'), a2 = numChecked('td-a2'), tgs = numChecked('td-gs'), fpm = numChecked('td-fpm');
    var lose = a1 - a2;
    if ([a1, a2, tgs, fpm].some(isNaN) || lose <= 0 || fpm <= 0 || tgs <= 0) {
      set('td-d', lose <= 0 ? 'Already there' : DASH); set('td-t', DASH); set('td-g', DASH); return;
    }
    var min = lose / fpm, dist = tgs * min / 60;
    set('td-d', fmt(dist, 1) + unit('nm'));
    set('td-t', timeText(min / 60));
    set('td-g', fmt(lose / dist) + unit('ft/nm · ' + fmt(Math.atan(lose / dist / FT_PER_NM) * 180 / Math.PI, 1) + '°'));
  }

  /* ---------- True airspeed ---------- */

  function toC(v, u) { return u === 'F' ? E.convertTemp(v, 'F', 'C') : v; }
  function tempText(c, u) { return fmt(u === 'F' ? E.convertTemp(c, 'C', 'F') : c, 1) + '°' + u; }
  function tas() {
    var cas = numChecked('ta-cas'), pa = numChecked('ta-pa'), oat = numChecked('ta-oat'), ou = $('ta-ou').value;
    var ids = ['ta-tas', 'ta-da', 'ta-m', 'ta-isa', 'ta-rot'];
    if ([cas, pa, oat].some(isNaN) || cas < 0 || pa > 60000) { ids.forEach(function (id) { set(id, DASH); }); set('ta-sub', ''); return; }
    var c = toC(oat, ou);
    var r = E.trueAirspeed(cas, pa, c);
    set('ta-tas', fmt(r.tas) + unit('kt'));
    set('ta-sub', (r.tas >= cas ? '+' : '−') + fmt(Math.abs(r.tas - cas)) + ' kt compared with CAS');
    set('ta-da', fmt(Math.round(E.densityAltitude(pa, c) / 10) * 10) + unit('ft'));
    set('ta-m', r.mach.toFixed(3));
    set('ta-isa', tempText(E.isaTemp(pa), ou));
    set('ta-rot', fmt(cas * (1 + 0.02 * pa / 1000)) + unit('kt'));
  }

  /* ---------- Density altitude ---------- */

  function densityAlt() {
    var el = numChecked('da-el'), alt = numChecked('da-alt'), oat = numChecked('da-oat');
    var au = $('da-au').value, ou = $('da-ou').value;
    var ids = ['da-da', 'da-pa', 'da-isa', 'da-dev', 'da-rot'];
    set('da-msg', ''); set('da-sub', '');
    if ([el, alt, oat].some(isNaN)) { ids.forEach(function (id) { set(id, DASH); }); return; }
    var inHg = au === 'hPa' ? E.convert('pressure', alt, 'hPa', 'inHg') : alt;
    if (inHg < 25 || inHg > 33) {
      ids.forEach(function (id) { set(id, DASH); });
      set('da-msg', au === 'inHg' && alt > 850 && alt < 1100 ? 'That looks like hectopascals. Switch the unit to hPa.'
        : au === 'hPa' && alt > 25 && alt < 33 ? 'That looks like inches of mercury. Switch the unit to inHg.'
        : 'That altimeter setting is outside the normal range.');
      return;
    }
    var c = toC(oat, ou);
    var pa = E.pressureAltitude(el, inHg), isa = E.isaTemp(pa), da = E.densityAltitude(pa, c);
    var paRule = el + (29.92 - inHg) * 1000, daRule = paRule + 120 * (c - E.isaTemp(paRule));
    set('da-da', fmt(Math.round(da / 10) * 10) + unit('ft'));
    var diff = Math.round((da - el) / 10) * 10;
    set('da-sub', fmt(Math.abs(diff)) + ' ft ' + (diff >= 0 ? 'above' : 'below') + ' the elevation you entered');
    set('da-pa', fmt(Math.round(pa)) + unit('ft'));
    set('da-isa', tempText(isa, ou));
    var dev = c - isa;
    set('da-dev', (dev >= 0 ? '+' : '−') + fmt(Math.abs(ou === 'F' ? dev * 9 / 5 : dev), 1) + '°' + ou + unit(dev >= 0 ? 'warmer' : 'colder'));
    set('da-rot', fmt(Math.round(daRule / 10) * 10) + unit('ft'));
    if (da - el > 2000) set('da-msg', 'High density altitude: expect a longer takeoff roll and a weaker climb. Check your POH performance charts.');
  }

  /* ---------- Crosswind ---------- */

  function crosswind() {
    var rh = E.runwayHeading($('xw-rwy').value);
    bad('xw-rwy', isNaN(rh));
    var wd = numChecked('xw-wd'), ws = numChecked('xw-ws'), gu = num('xw-g'), lim = num('xw-max');
    bad('xw-g', isNaN(gu)); bad('xw-max', isNaN(lim));
    set('xw-msg', ''); set('xw-xs', ''); set('xw-hs', '');
    if (isNaN(rh) || isNaN(wd) || isNaN(ws) || ws < 0) {
      set('xw-x', DASH); set('xw-h', DASH); $('xw-dia').innerHTML = '';
      if ($('xw-rwy').value.trim() && isNaN(rh)) set('xw-msg', 'Enter a runway number like 25 or 07L, or a heading like 253.');
      return;
    }
    var c = E.windComponents(rh, wd, ws);
    var x = Math.round(Math.abs(c.cross)), h = Math.round(c.head);
    set('xw-x', x + unit('kt' + (x ? ' from the ' + (c.cross > 0 ? 'right' : 'left') : '')));
    set('xw-hl', h >= 0 ? 'Headwind' : 'Tailwind');
    set('xw-h', Math.abs(h) + unit('kt'));
    var gx = NaN;
    if (!isNaN(gu) && gu > ws) {
      var cg = E.windComponents(rh, wd, gu);
      gx = Math.abs(cg.cross);
      set('xw-xs', 'Up to ' + Math.round(gx) + ' kt in the gusts');
      set('xw-hs', (cg.head >= 0 ? 'Up to ' : 'Tailwind up to ') + Math.round(Math.abs(cg.head)) + ' kt in the gusts');
    }
    var worst = Math.max(Math.abs(c.cross), isNaN(gx) ? 0 : gx);
    var msgs = [];
    if (!isNaN(lim) && worst > lim) msgs.push('Crosswind is above your ' + lim + ' kt limit.');
    if (h < 0) msgs.push('Tailwind: consider the opposite runway, ' + rwyName(rh + 180) + '.');
    set('xw-msg', msgs.join(' '));
    drawRunway(rh, wd, ws);
  }
  function rwyName(h) { var n = Math.round(E.norm360(h) / 10); if (n === 0) n = 36; return (n < 10 ? '0' : '') + n; }

  function drawRunway(rh, wd, ws) {
    var svg = $('xw-dia');
    svg.innerHTML = '';
    markers(svg, [['mk-x', 'var(--warn)'], ['mk-n', 'var(--dim)']]);
    northArrow(svg, 18, 8);
    var cx = 150, cy = 112, L = 170, W = 24;
    var g = svgEl(svg, 'g', { transform: 'rotate(' + rh + ' ' + cx + ' ' + cy + ')' });
    svgEl(g, 'rect', { x: cx - W / 2, y: cy - L / 2, width: W, height: L, rx: 2, fill: 'var(--rwy)', stroke: 'var(--rwy-edge)' });
    svgEl(g, 'line', { x1: cx, y1: cy - L / 2 + 22, x2: cx, y2: cy + L / 2 - 22, stroke: 'var(--text)', 'stroke-width': 1.5, 'stroke-dasharray': '9 7' });
    // Runway numbers: landing on 25 you head 250, so "25" is painted at the end you touch down on
    var R = Math.PI / 180;
    function paint(h, d) {
      svgEl(svg, 'text', { x: cx + Math.sin(h * R) * d, y: cy - Math.cos(h * R) * d + 4, fill: 'var(--strong)', 'text-anchor': 'middle', 'font-weight': 600 }, rwyName(h + 180));
    }
    paint(rh + 180, L / 2 + 14);
    paint(rh, L / 2 + 14);
    if (ws > 0) {
      var r1 = 104, r2 = 30;
      var x1 = cx + Math.sin(wd * R) * r1, y1 = cy - Math.cos(wd * R) * r1;
      var x2 = cx + Math.sin(wd * R) * r2, y2 = cy - Math.cos(wd * R) * r2;
      svgEl(svg, 'line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: 'var(--warn)', 'stroke-width': 3, 'marker-end': 'url(#mk-x)' });
      var tx = cx + Math.sin(wd * R) * (r1 + 2), ty = cy - Math.cos(wd * R) * (r1 + 2);
      svgEl(svg, 'text', { x: Math.max(30, Math.min(270, tx)), y: Math.max(12, Math.min(214, ty + (ty > cy ? 12 : -4))), fill: 'var(--warn)', 'text-anchor': 'middle' }, deg3(wd) + '/' + Math.round(ws));
    }
  }

  /* ---------- Units ---------- */

  var UNIT_LABELS = {
    distance: { nm: 'nautical miles', sm: 'statute miles', km: 'kilometers', m: 'meters', ft: 'feet' },
    speed: { kt: 'knots', mph: 'miles per hour', 'km/h': 'km per hour', 'm/s': 'meters per second', 'ft/min': 'feet per minute' },
    volume: { 'US gal': 'US gallons', L: 'liters', 'Imp gal': 'imperial gallons', qt: 'US quarts' },
    weight: { lb: 'pounds', kg: 'kilograms' },
    pressure: { inHg: 'inches of mercury', hPa: 'hectopascals', mb: 'millibars', mmHg: 'mm of mercury', psi: 'pounds per sq inch' },
    temp: { C: 'degrees Celsius', F: 'degrees Fahrenheit', K: 'kelvin' },
    fuel: { 'US gal': 'US gallons', L: 'liters', lb: 'pounds', kg: 'kilograms' },
  };
  var lastCat = null;
  function units() {
    var cat = seg('un-cat');
    var from = $('un-from');
    if (cat !== lastCat) {
      from.innerHTML = '';
      Object.keys(UNIT_LABELS[cat]).forEach(function (u) { var o = document.createElement('option'); o.value = u; o.textContent = cat === 'temp' && u !== 'K' ? '°' + u : u; from.appendChild(o); });
      if (state.from[cat] && UNIT_LABELS[cat][state.from[cat]]) from.value = state.from[cat];
      lastCat = cat;
    }
    state.from[cat] = from.value;
    $('un-ft-box').classList.toggle('hidden', cat !== 'fuel');
    var v = numChecked('un-v'), out = $('un-out');
    out.innerHTML = '';
    Object.keys(UNIT_LABELS[cat]).forEach(function (u) {
      var r;
      if (isNaN(v)) r = NaN;
      else if (cat === 'temp') r = E.convertTemp(v, from.value, u);
      else if (cat === 'fuel') {
        var dens = E.FUEL_DENSITY[$('un-ft').value];
        var toLb = { 'US gal': dens, L: dens / 3.785411784, lb: 1, kg: 1 / 0.45359237 };
        r = v * toLb[from.value] / toLb[u];
      } else r = E.convert(cat, v, from.value, u);
      var box = document.createElement('div');
      box.className = 'r';
      box.innerHTML = '<span>' + UNIT_LABELS[cat][u] + '</span><b class="val">' + smart(r) + unit(cat === 'temp' && u !== 'K' ? '°' + u : u) + '</b>';
      if (u === from.value) box.style.borderColor = 'var(--line-hover)';
      out.appendChild(box);
    });
  }

  /* ---------- Coordinates ---------- */

  function copyBtn(text) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Copy';
    b.addEventListener('click', function () {
      function done() { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1200); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
      function fallback() {
        var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
        try { document.execCommand('copy'); done(); } catch (e) { /* nothing to do */ }
        t.remove();
      }
    });
    return b;
  }
  function coordRows(p) {
    var rows = [['Decimal degrees', 'lat, long', E.formatDD(p.lat, p.lon, 6)],
      ['Degrees, decimal minutes', 'GPS, ForeFlight', E.formatDDM(p.lat, true) + ' ' + E.formatDDM(p.lon, false)],
      ['Degrees, minutes, seconds', 'Chart Supplement', E.formatDMS(p.lat, true) + ' ' + E.formatDMS(p.lon, false)]];
    var m10 = E.toMGRS(p.lat, p.lon, 5), m8 = E.toMGRS(p.lat, p.lon, 4), u = E.toUTM(p.lat, p.lon);
    if (m10) {
      rows.push(['MGRS', '1 m, 10 digits', m10.text]);
      rows.push(['MGRS', '10 m, 8 digits', m8.text]);
      rows.push(['UTM', 'zone, easting, northing (m)', u.zone + u.band + ' ' + Math.floor(u.easting) + ' ' + Math.floor(u.northing)]);
    } else rows.push(['MGRS / UTM', '', 'Not used this close to the pole']);
    return rows;
  }
  function coords() {
    var s = $('co-in').value, out = $('co-out');
    out.innerHTML = '';
    var p = E.parseCoordinate(s);
    $('co-in-box').classList.toggle('bad', !p && s.trim() !== '');
    if (!p) {
      set('co-msg', s.trim() ? 'Could not read that position. Try one of the examples, latitude first.' : 'Type or paste a position.');
      return;
    }
    var how = 'Read as ' + p.from + ': ' + E.formatDDM(p.lat, true) + ' ' + E.formatDDM(p.lon, false) + '.';
    if (p.from === 'MGRS' && p.precisionM > 1) how += ' That grid names a ' + fmt(p.precisionM) + ' m square; the answers below are its centre.';
    set('co-msg', how);
    coordRows(p).forEach(function (r) {
      var row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = '<span>' + r[0] + (r[1] ? '<small>' + r[1] + '</small>' : '') + '</span><b class="val"></b>';
      row.querySelector('.val').textContent = r[2];
      if (r[1] !== '') row.appendChild(copyBtn(r[2])); else row.appendChild(document.createElement('span'));
      out.appendChild(row);
    });
    var a = document.createElement('a');
    a.href = 'https://www.openstreetmap.org/?mlat=' + p.lat.toFixed(6) + '&mlon=' + p.lon.toFixed(6) + '#map=13/' + p.lat.toFixed(5) + '/' + p.lon.toFixed(5);
    a.target = '_blank'; a.rel = 'noopener';
    a.textContent = 'Show on a map ↗';
    a.style.cssText = 'color:var(--accent);font-size:13px;justify-self:start;margin-top:2px';
    out.appendChild(a);
  }

  function greatCircle() {
    var a = E.parseCoordinate($('gc-a').value), b = E.parseCoordinate($('gc-b').value);
    $('gc-a-box').classList.toggle('bad', !a && $('gc-a').value.trim() !== '');
    $('gc-b-box').classList.toggle('bad', !b && $('gc-b').value.trim() !== '');
    var vr = variation('gc-var', 'gc-varh'), gs = num('gc-gs');
    bad('gc-var', isNaN(vr)); bad('gc-gs', isNaN(gs));
    $('gc-ete-box').classList.toggle('hidden', !(gs > 0));
    var ids = ['gc-nm', 'gc-tc', 'gc-mc', 'gc-rc', 'gc-ete'];
    set('gc-msg', ''); set('gc-other', '');
    if (!a || !b) {
      ids.forEach(function (id) { set(id, DASH); });
      if ($('gc-a').value.trim() && $('gc-b').value.trim()) set('gc-msg', 'One of the positions could not be read. The Coordinates tool shows which formats work.');
      return;
    }
    var r = E.greatCircle(a.lat, a.lon, b.lat, b.lon);
    set('gc-nm', fmt(r.nm, 1) + unit('nm'));
    set('gc-other', fmt(r.nm * 1.150779, 1) + ' sm · ' + fmt(r.km, 1) + ' km');
    var same = r.nm < 0.01;
    set('gc-tc', same ? DASH : deg3(r.course));
    set('gc-mc', same || isNaN(vr) ? DASH : deg3(r.course + vr));
    set('gc-rc', same ? DASH : deg3(r.course + 180));
    set('gc-ete', gs > 0 ? timeText(r.nm / gs) : DASH);
  }

  /* ---------- Page wiring ---------- */

  function all() {
    wind(); findWind(); tsd(); fuel(); climb(); tas(); densityAlt(); crosswind(); units(); coords(); greatCircle();
  }

  var TOOLS = ['wind', 'findwind', 'tsd', 'fuel', 'climb', 'tas', 'alt', 'xwind', 'units', 'coords', 'gc'];
  function route() {
    var id = location.hash.replace('#', '');
    if (TOOLS.indexOf(id) < 0) id = 'wind';
    TOOLS.forEach(function (t) { $('t-' + t).classList.toggle('on', t === id); });
    document.querySelectorAll('#nav a').forEach(function (a) {
      var on = a.getAttribute('href') === '#' + id;
      a.classList.toggle('on', on);
      if (on && window.innerWidth <= 760) a.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    var name = document.querySelector('#nav a.on');
    document.title = (name ? name.firstChild.textContent.trim() + ' — ' : '') + 'Flight Calculator';
  }

  load();
  document.addEventListener('input', function () { all(); save(); });
  document.addEventListener('change', function () { all(); save(); });
  document.querySelectorAll('.seg').forEach(function (segEl) {
    segEl.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      pick(segEl, b.getAttribute('data-v'));
      all(); save();
    });
  });
  document.querySelectorAll('[data-ex]').forEach(function (b) {
    b.addEventListener('click', function () { $('co-in').value = b.getAttribute('data-ex'); coords(); save(); });
  });
  // Select the whole entry on focus so a new number can be typed straight over it
  document.addEventListener('focusin', function (e) {
    if (e.target.matches && e.target.matches('.in input')) setTimeout(function () { try { e.target.select(); } catch (x) { /* ignore */ } }, 0);
  });
  Object.keys(E.FUEL_DENSITY).forEach(function (k) {
    var o = document.createElement('option'); o.value = k; o.textContent = k + ' (' + E.FUEL_DENSITY[k] + ' lb/gal)'; $('un-ft').appendChild(o);
  });
  if (state.v['un-ft'] != null) $('un-ft').value = state.v['un-ft'];
  window.addEventListener('hashchange', route);
  route();
  all();
})();
