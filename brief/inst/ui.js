// DOM: top bar, control strip, status bar, dialogs, keyboard and touch mode.
// Also decides how the canvas is split between the map and the panel.
(function (FI) {
  'use strict';

  const $ = id => document.getElementById(id);
  const clamp = FI.clamp;

  // The panel is square. Wide screens: panel on the right, as tall as the
  // canvas, map on the left. Narrow screens: panel across the bottom, map
  // above it.
  FI.layout = function (W, H) {
    if (W >= 720 && W >= H * 0.8) {
      const pw = Math.round(clamp(Math.min(W * 0.58, H), 300, W - 240));
      return { map: { x: 0, y: 0, w: W - pw, h: H }, panel: { x: W - pw, y: 0, w: pw, h: H } };
    }
    const ph = Math.round(Math.min(W, H * 0.55));
    return { map: { x: 0, y: 0, w: W, h: H - ph }, panel: { x: 0, y: H - ph, w: W, h: ph } };
  };

  const ui = FI.ui = {
    touch: false,
    dragging: null,         // slider being dragged, so the sim does not move it back

    init() {
      // scenarios, rebuilt when the home airport changes
      const sel = $('scn');
      ui.fillScenarios();
      sel.addEventListener('change', () => { ui.start(sel.value); sel.blur(); });
      // home airport and approach
      const dl = $('apt-list');
      for (const a of FI.airportCodes()) { const o = document.createElement('option'); o.value = a.code; o.label = a.name; dl.appendChild(o); }
      $('apt').addEventListener('change', () => {
        const code = $('apt').value.trim().toUpperCase();
        if (FI.findAirport(code)) ui.setHome(code); else { $('apt').value = FI.home.apt.code; }
        $('apt').blur();
      });
      $('apt').addEventListener('focus', () => $('apt').select());
      $('app').addEventListener('change', () => { ui.setHome(FI.home.apt.code, $('app').value); $('app').blur(); });
      ui.fillApproaches();
      // radios: type a frequency or channel, or pick a nearby station
      $('r-nav').addEventListener('change', () => ui.tune('nav', $('r-nav').value));
      $('r-tcn').addEventListener('change', () => ui.tune('tcn', $('r-tcn').value));
      $('r-adf').addEventListener('change', () => ui.tune('adf', $('r-adf').value));
      for (const id of ['r-nav', 'r-tcn', 'r-adf']) {
        $(id).addEventListener('keydown', e => { if (e.key === 'Enter') $(id).blur(); if (e.key === 'Escape') { ui.refresh(true); $(id).blur(); } });
        $(id).addEventListener('focus', () => $(id).select());
      }
      const tl = $('r-tune');
      tl.addEventListener('focus', () => ui.fillTune());
      tl.addEventListener('pointerdown', () => ui.fillTune());
      tl.addEventListener('change', () => { ui.pickStation(tl.value); tl.value = ''; tl.blur(); });
      $('btn-play').addEventListener('click', () => { FI.paused = !FI.paused; ui.refresh(); });
      $('btn-restart').addEventListener('click', () => ui.start($('scn').value));
      document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => { FI.speed = +b.dataset.speed; ui.refresh(); }));
      $('btn-follow').addEventListener('click', () => FI.map.setFollow(!FI.map.follow));
      $('btn-fit').addEventListener('click', () => FI.map.fit());
      $('btn-zin').addEventListener('click', () => FI.map.zoomCenter(1.4));
      $('btn-zout').addEventListener('click', () => FI.map.zoomCenter(1 / 1.4));
      document.querySelectorAll('[data-panel]').forEach(b => b.addEventListener('click', () => ui.setPanel(b.dataset.panel)));
      $('btn-touch').addEventListener('click', () => ui.setTouch(!ui.touch));
      $('btn-help').addEventListener('click', () => $('help').classList.add('open'));
      $('help-close').addEventListener('click', () => $('help').classList.remove('open'));
      $('btn-settings').addEventListener('click', () => ui.openSettings());
      $('set-cancel').addEventListener('click', () => $('settings').classList.remove('open'));
      $('set-apply').addEventListener('click', () => ui.applySettings());
      document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); }));

      // stick and power
      for (const [id, axis] of [['c-bank', 'bank'], ['c-pitch', 'pitch'], ['c-power', 'power']]) {
        const el = $(id);
        el.addEventListener('input', () => { FI.setControl(axis, +el.value); ui.refresh(); });
        el.addEventListener('pointerdown', () => { ui.dragging = id; });
        el.addEventListener('pointerup', () => { ui.dragging = null; });
        el.addEventListener('pointercancel', () => { ui.dragging = null; });
      }
      $('c-level').addEventListener('click', () => { FI.setControl('bank', 0); ui.refresh(); });
      // bugs and autopilot
      ui.repeat($('bug-dec'), () => ui.bump('bug', -1)); ui.repeat($('bug-inc'), () => ui.bump('bug', 1));
      ui.repeat($('obs-dec'), () => ui.bump('obs', -1)); ui.repeat($('obs-inc'), () => ui.bump('obs', 1));
      $('ap-hdg').addEventListener('click', () => { FI.setAp('hdg', !FI.ap.hdg); ui.refresh(); });
      $('ap-alt').addEventListener('click', () => { FI.setAp('alt', !FI.ap.alt); ui.refresh(); });
      $('ap-nav').addEventListener('click', () => { FI.setAp('nav', !FI.ap.nav); ui.refresh(); });
      document.querySelectorAll('[data-src]').forEach(b => b.addEventListener('click', () => ui.setSource(b.dataset.src)));

      ui.buildQuick();
      window.addEventListener('keydown', e => ui.key(e));
      window.addEventListener('resize', () => ui.layoutDom());
      const coarse = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window && navigator.maxTouchPoints > 0;
      ui.setTouch(coarse);
      ui.layoutDom();
    },

    // Press and hold a − or + button to keep stepping.
    repeat(btn, fn) {
      let t = null, iv = null;
      const stop = () => { clearTimeout(t); clearInterval(iv); t = iv = null; };
      btn.addEventListener('pointerdown', e => { e.preventDefault(); fn(); t = setTimeout(() => { iv = setInterval(fn, 60); }, 400); });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stop);
    },
    bump(what, d) {
      FI.nav[what] = FI.norm360(FI.nav[what] + d);
      ui.refresh();
    },
    // Six-pack or glass cockpit. Remembered per browser; ?p=glass opens glass.
    setPanel(mode) {
      FI.panelMode = mode === 'glass' ? 'glass' : 'analog';
      try { localStorage.setItem('fi-panel', FI.panelMode); } catch (e) { /* private mode */ }
      if (FI.panel && FI.panel.glass) FI.panel.setMode(FI.panelMode);
      ui.refresh();
    },
    setSource(src) { FI.nav.src = src === 'TCN' ? 'TCN' : 'NAV'; FI.ap.gsCap = false; FI.computeNav(); ui.refresh(); },

    fillScenarios() {
      const sel = $('scn');
      while (sel.options.length > 1) sel.remove(1);
      FI.SCENARIOS.forEach((s, i) => { const o = document.createElement('option'); o.value = i; o.textContent = s.name; sel.appendChild(o); });
    },
    fillApproaches() {
      const sel = $('app'); sel.innerHTML = '';
      for (const L of FI.home.apt.ils) {
        const o = document.createElement('option'); o.value = L.rwy; o.textContent = `${L.name} ${L.id}`; sel.appendChild(o);
      }
      sel.value = FI.home.ils ? FI.home.ils.rwy : '';
      $('apt').value = FI.home.apt.code;
      $('apt').title = `${FI.home.apt.code} ${FI.home.apt.name}: type an airport code (any US airport with an ILS or localizer)`;
    },
    // Move to another airport: reload the area and the scenarios, and fly
    // the same scenario there if it exists, otherwise free flight.
    setHome(code, rwy) {
      const sc = FI.scn ? FI.scn.def.id : null;
      FI.setHome(code, rwy);
      try { localStorage.setItem('fi-home', JSON.stringify({ apt: FI.home.apt.code, rwy: FI.home.ils && FI.home.ils.rwy })); } catch (e) { /* private mode */ }
      ui.fillScenarios(); ui.fillApproaches();
      const i = FI.SCENARIOS.findIndex(s => s.id === sc);
      ui.start(i >= 0 ? String(i) : 'free');
      if (FI.map) FI.map.fit();
    },

    // Tune a radio from typed text. Bad input puts the old value back.
    tune(which, text) {
      const nv = FI.nav, t = String(text).trim().toUpperCase();
      if (which === 'nav') {
        const f = Math.round(parseFloat(t) * 20) / 20;
        if (f >= 108 && f <= 117.95) { nv.mhz = f; nv.src = 'NAV'; }
      } else if (which === 'tcn') {
        const m = /^(\d{1,3})\s*([XY])?$/.exec(t);
        if (m && +m[1] >= 1 && +m[1] <= 126) { nv.chan = +m[1] + (m[2] || 'X'); nv.src = 'TCN'; }
      } else if (which === 'adf') {
        const k = Math.round(parseFloat(t));
        if (k >= 190 && k <= 1750) nv.khz = k;
        else if (t === '' || t === '0' || t === 'OFF') nv.khz = 0;
      }
      FI.ap.gsCap = false;
      FI.computeNav();
      ui.refresh(true);
    },
    // The nearby list: stations within 80 nm of the aircraft, nearest first.
    fillTune() {
      const sel = $('r-tune'), s = FI.state;
      ui.tuneList = FI.nearby(s.x, s.y, 80).slice(0, 40);
      sel.innerHTML = '<option value="">Tune nearby…</option>';
      ui.tuneList.forEach(({ s: st, d }, i) => {
        let t;
        if (st.kind === 'LOC') t = `${st.id}  ${st.apt.code} ${st.name}  ${FI.fmtMhz(st.mhz)}`;
        else if (st.ndb) t = `${st.id}  ${st.type}  ${st.khz} kHz`;
        else if (st.vor) t = `${st.id}  ${st.type}  ${FI.fmtMhz(st.mhz)}${st.tacan ? ' / ' + st.chan : ''}`;
        else t = `${st.id}  ${st.type}  ${st.chan}${st.mhz ? ' (' + FI.fmtMhz(st.mhz) + ')' : ''}`;
        const o = document.createElement('option'); o.value = i; o.textContent = `${t}  ·  ${Math.round(d)} nm`; sel.appendChild(o);
      });
    },
    pickStation(i) {
      const e = ui.tuneList && ui.tuneList[+i];
      if (!e) return;
      const st = e.s, nv = FI.nav;
      if (st.kind === 'LOC') { nv.mhz = st.mhz; nv.src = 'NAV'; nv.obs = Math.round(st.crsM); }
      else if (st.ndb) nv.khz = st.khz;
      else if (st.vor) { nv.mhz = st.mhz; nv.src = 'NAV'; if (st.chan) nv.chan = st.chan; }
      else if (st.tacan) { nv.chan = st.chan; nv.src = 'TCN'; }
      else if (st.chan) { nv.chan = st.chan; if (st.mhz) nv.mhz = st.mhz; }
      FI.ap.gsCap = false;
      FI.computeNav();
      ui.refresh(true);
    },

    start(idx) {
      if (idx === 'free' || idx === '') FI.freeFlight();
      else FI.loadScenario(FI.SCENARIOS[+idx]);
      $('scn').value = idx === '' ? 'free' : idx;
      if (FI.map) { FI.map.setFollow(true); FI.map.centerOnAircraft(); }
      ui.refresh();
    },

    // keyboard: arrows bank and pitch, W/S power, L level, [ ] OBS, , . bug,
    // H/A/N autopilot, V nav source, G six-pack or glass, Space pause, F follow, 0 fit, ? help
    key(e) {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const s = FI.state, k = e.key;
      let used = true;
      if (k === 'ArrowLeft') FI.setControl('bank', s.cmdBank - (e.shiftKey ? 1 : 5));
      else if (k === 'ArrowRight') FI.setControl('bank', s.cmdBank + (e.shiftKey ? 1 : 5));
      else if (k === 'ArrowUp') FI.setControl('pitch', s.cmdPitch + (e.shiftKey ? 0.5 : 1));
      else if (k === 'ArrowDown') FI.setControl('pitch', s.cmdPitch - (e.shiftKey ? 0.5 : 1));
      else if (k === 'w' || k === 'W') FI.setControl('power', s.power + 5);
      else if (k === 's' || k === 'S') FI.setControl('power', s.power - 5);
      else if (k === 'l' || k === 'L') FI.setControl('bank', 0);
      else if (k === '[') ui.bump('obs', e.shiftKey ? -10 : -1);
      else if (k === ']') ui.bump('obs', e.shiftKey ? 10 : 1);
      else if (k === ',') ui.bump('bug', e.shiftKey ? -10 : -1);
      else if (k === '.') ui.bump('bug', e.shiftKey ? 10 : 1);
      else if (k === 'h' || k === 'H') FI.setAp('hdg', !FI.ap.hdg);
      else if (k === 'a' || k === 'A') FI.setAp('alt', !FI.ap.alt);
      else if (k === 'n' || k === 'N') FI.setAp('nav', !FI.ap.nav);
      else if (k === 'g' || k === 'G') ui.setPanel(FI.panelMode === 'glass' ? 'analog' : 'glass');
      else if (k === 'v' || k === 'V') ui.setSource(FI.nav.src === 'NAV' ? 'TCN' : 'NAV');
      else if (k === ' ') FI.paused = !FI.paused;
      else if (k === 'f' || k === 'F') FI.map.setFollow(!FI.map.follow);
      else if (k === '0') FI.map.fit();
      else if (k === '?') $('help').classList.toggle('open');
      else if (k === 'Escape') { ui.closeQuick(); document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open')); }
      else used = false;
      if (used) { e.preventDefault(); ui.refresh(); }
    },

    setTouch(on) {
      ui.touch = on;
      document.body.classList.toggle('touch', on);
      $('btn-touch').classList.toggle('on', on);
      $('set-touch').checked = on;
      ui.layoutDom();
    },

    // The canvas fills the space between the bars; their heights change
    // when they wrap, so measure them.
    layoutDom() {
      const g = $('game');
      g.style.top = $('bar').offsetHeight + 'px';
      g.style.bottom = ($('ctl').offsetHeight + $('status').offsetHeight) + 'px';
      if (FI.game) FI.game.scale.refresh();
    },

    openSettings() {
      $('set-wdir').value = FI.wind.dir; $('set-wkt').value = FI.wind.kt;
      $('set-touch').checked = ui.touch;
      $('settings').classList.add('open');
    },
    applySettings() {
      FI.wind.dir = FI.norm360(+$('set-wdir').value || 0);
      FI.wind.kt = clamp(+$('set-wkt').value || 0, 0, 60);
      ui.setTouch($('set-touch').checked);
      $('settings').classList.remove('open');
      ui.refresh();
    },

    // Buttons and sliders reflect the state. Called after any input.
    refresh(radios) {
      const s = FI.state, ap = FI.ap, nv = FI.nav;
      $('btn-play').textContent = FI.paused ? '▶ Play' : '❚❚ Pause';
      document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed === FI.speed));
      document.querySelectorAll('[data-panel]').forEach(b => b.classList.toggle('on', b.dataset.panel === FI.panelMode));
      $('btn-follow').classList.toggle('on', !!(FI.map && FI.map.follow));
      $('ap-hdg').classList.toggle('on', ap.hdg); $('ap-alt').classList.toggle('on', ap.alt); $('ap-nav').classList.toggle('on', ap.nav);
      document.querySelectorAll('[data-src]').forEach(b => b.classList.toggle('on', b.dataset.src === nv.src));
      // radio boxes, unless the student is typing in one
      const act = document.activeElement;
      if (radios || act !== $('r-nav')) $('r-nav').value = FI.fmtMhz(nv.mhz);
      if (radios || act !== $('r-tcn')) $('r-tcn').value = nv.chan || '';
      if (radios || act !== $('r-adf')) $('r-adf').value = nv.khz ? String(nv.khz) : '';
      $('bug-v').textContent = FI.pad3(nv.bug) + '°';
      $('obs-v').textContent = FI.pad3(nv.obs) + '°';
      $('ap-alt').title = ap.alt ? `Holding ${Math.round(ap.altTgt).toLocaleString('en-US')} ft (A)` : 'Hold the current altitude (A)';
      ui.sliders();
    },
    sliders() {
      const s = FI.state;
      if (ui.dragging !== 'c-bank') $('c-bank').value = Math.round(s.cmdBank);
      if (ui.dragging !== 'c-pitch') $('c-pitch').value = Math.round(s.cmdPitch * 2) / 2;
      if (ui.dragging !== 'c-power') $('c-power').value = Math.round(s.power);
      $('c-bank-v').textContent = `${Math.abs(Math.round(s.cmdBank))}° ${s.cmdBank < -0.5 ? 'L' : s.cmdBank > 0.5 ? 'R' : ''}`;
      $('c-pitch-v').textContent = `${s.cmdPitch >= 0 ? '+' : ''}${(Math.round(s.cmdPitch * 2) / 2).toFixed(1)}°`;
      $('c-power-v').textContent = `${Math.round(s.power)}%`;
    },

    // Every frame from the map scene: status bar text, about 10 times a second.
    lastTick: 0,
    tick() {
      const now = performance.now();
      if (now - ui.lastTick < 100) return;
      ui.lastTick = now;
      const s = FI.state, n = FI.navOut;
      $('st-mode').textContent = (FI.paused ? 'Paused · ' : '') + FI.statusText();
      $('st-data').textContent = `HDG ${FI.pad3(FI.toMag(s.hdg))}  TRK ${FI.pad3(FI.toMag(s.trk))}  ${Math.round(s.ias)} kt  ${Math.round(s.alt).toLocaleString('en-US')} ft  ${s.vs >= 0 ? '+' : ''}${Math.round(s.vs / 10) * 10} fpm  ${n.ident || '---'} ${n.radial != null ? 'R-' + FI.pad3(n.radial) : ''}  DME ${n.dmeValid ? n.dme.toFixed(1) : '---'}`;
      const sc = FI.scn;
      $('st-brief').textContent = sc ? sc.def.brief : 'Free flight: fly with the sliders or the keyboard, or pick a scenario.';
      $('st-brief').title = $('st-brief').textContent;
      const z = FI.map.cam.zoom, nm = FI.NM * z;
      const stepNm = nm > 120 ? 1 : nm > 60 ? 2 : nm > 24 ? 5 : 10;
      $('scale-bar').style.width = `${Math.round(stepNm * nm)}px`;
      $('scale-label').textContent = `${stepNm} nm`;
      if (FI.ap.hdg || FI.ap.alt || FI.ap.nav || FI.ap.spd || (sc && !sc.off)) ui.sliders();
      if (ui.quickOpen) ui.quickReadout();
    },

    // ---------- tooltip while steering with the mouse ----------
    tip(html, p) {
      const t = $('tip'), r = FI.game.canvas.getBoundingClientRect();
      t.innerHTML = html; t.style.display = 'block';
      const x = r.left + p.x + 18, y = r.top + p.y + 18;
      t.style.left = Math.min(x, innerWidth - t.offsetWidth - 8) + 'px';
      t.style.top = Math.min(y, innerHeight - t.offsetHeight - 8) + 'px';
    },
    hideTip() { $('tip').style.display = 'none'; },
    steerTip(p, d) {
      const t = d.turn, a = d.dAlt;
      const turn = Math.abs(t) < 1 ? `<b>Hold ${FI.pad3(d.hdgTgt)}°</b>` : `<b>${t > 0 ? 'Right' : 'Left'} ${Math.abs(Math.round(t))}° to ${FI.pad3(d.hdgTgt)}°</b> at standard rate`;
      const alt = a === 0 ? `<b>Hold ${d.altTgt.toLocaleString('en-US')} ft</b>` : `<b>${a > 0 ? 'Climb' : 'Descend'} ${a > 0 ? '+' : '−'}${Math.abs(a).toLocaleString('en-US')} ft to ${d.altTgt.toLocaleString('en-US')} ft</b> at 500 fpm`;
      ui.tip(`${turn}<br>${alt}<br><span class="dim">Drag left or right to turn, up to climb, down to descend.${ui.touch ? '' : ' Shift for 1° steps.'}</span>`, p);
    },

    // ---------- quick menu: right-click (or press and hold) the aircraft ----------
    // Eight wedges laid out like the drag: up climbs, down descends, right
    // and left turn, and the lower corners change speed. Clicks add up, so
    // two clicks on Climb +500 ft climb 1,000 ft. Shift doubles a step.
    quickOpen: false,
    buildQuick() {
      const box = $('quick'), NS = 'http://www.w3.org/2000/svg';
      const items = ui.quickItems = [
        { a: 0, t: 'Climb', v: '+500 ft', go: m => ui.qAlt(500 * m) },
        { a: 45, t: 'Right', v: '30°', go: m => ui.qTurn(30 * m) },
        { a: 90, t: 'Right', v: '90°', go: m => ui.qTurn(90 * m) },
        { a: 135, t: 'Faster', v: '+10 kt', go: m => ui.qSpd(10 * m) },
        { a: 180, t: 'Descend', v: '−500 ft', go: m => ui.qAlt(-500 * m) },
        { a: 225, t: 'Slower', v: '−10 kt', go: m => ui.qSpd(-10 * m) },
        { a: 270, t: 'Left', v: '90°', go: m => ui.qTurn(-90 * m) },
        { a: 315, t: 'Left', v: '30°', go: m => ui.qTurn(-30 * m) },
      ];
      const C = 130, r0 = 50, r1 = 122, half = 22.5 - 1.2;
      const pt = (a, r) => [C + Math.sin(a * Math.PI / 180) * r, C - Math.cos(a * Math.PI / 180) * r];
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 260 260'); svg.setAttribute('width', '260'); svg.setAttribute('height', '260');
      for (const it of items) {
        const [x0, y0] = pt(it.a - half, r1), [x1, y1] = pt(it.a + half, r1), [x2, y2] = pt(it.a + half, r0), [x3, y3] = pt(it.a - half, r0);
        const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'wedge'); g.setAttribute('role', 'button');
        g.setAttribute('tabindex', '0'); g.setAttribute('aria-label', `${it.t} ${it.v}`);
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', `M${x0},${y0} A${r1},${r1} 0 0 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 0 0 ${x3},${y3} Z`);
        g.appendChild(path);
        const [tx, ty] = pt(it.a, (r0 + r1) / 2);
        const t1 = document.createElementNS(NS, 'text'); t1.setAttribute('x', tx); t1.setAttribute('y', ty - 3); t1.textContent = it.t;
        const t2 = document.createElementNS(NS, 'text'); t2.setAttribute('x', tx); t2.setAttribute('y', ty + 11); t2.setAttribute('class', 'v'); t2.textContent = it.v;
        g.appendChild(t1); g.appendChild(t2);
        const fire = e => { e.preventDefault(); e.stopPropagation(); it.go(e.shiftKey ? 2 : 1); ui.flash(g); ui.refresh(); ui.quickReadout(); };
        g.addEventListener('click', fire);
        g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fire(e); });
        svg.appendChild(g);
      }
      const hub = document.createElementNS(NS, 'circle');
      hub.setAttribute('cx', C); hub.setAttribute('cy', C); hub.setAttribute('r', r0 - 4); hub.setAttribute('class', 'hub');
      svg.appendChild(hub);
      ui.qText = [-14, 2, 18].map(dy => {
        const t = document.createElementNS(NS, 'text'); t.setAttribute('x', C); t.setAttribute('y', C + dy); t.setAttribute('class', 'ro');
        svg.appendChild(t); return t;
      });
      box.querySelector('.ring').appendChild(svg);
      box.addEventListener('contextmenu', e => e.preventDefault());
      box.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); ui.quickPill(b.dataset.q); }));
      document.addEventListener('pointerdown', e => {
        if (ui.quickOpen && !box.contains(e.target) && e.target !== FI.game.canvas) ui.closeQuick();
      }, true);
    },
    flash(g) { g.classList.remove('hit'); void g.getBBox(); g.classList.add('hit'); setTimeout(() => g.classList.remove('hit'), 220); },
    openQuick(p) {
      const box = $('quick'), r = FI.game.canvas.getBoundingClientRect();
      ui.hideTip();
      box.classList.add('open'); ui.quickOpen = true;
      const w = box.offsetWidth, h = box.offsetHeight;
      const x = clamp(r.left + p.x - w / 2, 4, innerWidth - w - 4), y = clamp(r.top + p.y - 130, 4, innerHeight - h - 4);
      box.style.left = x + 'px'; box.style.top = y + 'px';
      ui.quickReadout();
    },
    closeQuick() { if (!ui.quickOpen) return; ui.quickOpen = false; $('quick').classList.remove('open'); },
    quickReadout() {
      const s = FI.state, ap = FI.ap, run = FI.scn && !FI.scn.off, [a, b, c] = ui.qText;
      const hHold = !run && ap.hdg && !ap.nav, aHold = !run && ap.alt, sHold = !run && ap.spd;
      a.textContent = `HDG ${FI.pad3(hHold ? FI.nav.bug : FI.toMag(s.hdg))}°`;
      b.textContent = `${Math.round(aHold ? ap.altTgt : s.alt).toLocaleString('en-US')} ft`;
      c.textContent = `${Math.round(sHold ? ap.spdTgt : s.ias)} kt`;
      a.classList.toggle('held', hHold); b.classList.toggle('held', aHold); c.classList.toggle('held', sHold);
      $('q-spd').classList.toggle('on', sHold);
    },
    qTurn(d) {
      const tot = clamp(FI.turnLeft() + d, -355, 355);
      FI.steer({ hdg: FI.toMag(FI.state.hdg) + tot, dir: Math.abs(tot) > 170 ? Math.sign(tot) : 0 });
    },
    qAlt(d) {
      const ap = FI.ap, run = FI.scn && !FI.scn.off;
      FI.steer({ alt: (!run && ap.alt ? ap.altTgt : Math.round(FI.state.alt / 100) * 100) + d });
    },
    qSpd(d) {
      const ap = FI.ap, run = FI.scn && !FI.scn.off;
      FI.steer({ ias: (!run && ap.spd ? ap.spdTgt : Math.round(FI.state.ias / 5) * 5) + d });
    },
    quickPill(q) {
      const s = FI.state;
      if (q === 'level') FI.steer({ hdg: FI.toMag(s.hdg), dir: 0, alt: s.alt });
      else if (q === 'rev') ui.qTurn(FI.turnLeft() >= 0 ? 180 : -180);
      else if (q === 'spd') { if (FI.ap.spd) FI.ap.spd = false; else FI.steer({ ias: s.ias }); }
      else if (q === 'hand') { FI.takeover(); FI.setControl('bank', 0); }
      else if (q === 'move') { FI.map.moveNext = true; ui.closeQuick(); }
      ui.refresh(); ui.quickReadout();
    },
  };
})(window.FI);
