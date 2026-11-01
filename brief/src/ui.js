(function (DL) {
  'use strict';

  const $ = id => document.getElementById(id);
  const fmt = n => (Math.round(n) + 0).toLocaleString('en-US');
  const hex = c => '#' + c.toString(16).padStart(6, '0');

  const MANEUVERS = {
    splitS:    { name: 'Split-S',   bank: 180 },
    immelmann: { name: 'Immelmann', bank: 0 },
    pitchback: { name: 'Pitchback', bank: 45 },
    sliceback: { name: 'Sliceback', bank: 135 },
  };

  const ui = {
    tool: 'select',
    placeType: 'fighter',
    selected: null,
    touch: false,
    dragMode: 'path',

    init() {
      $('btn-add').onclick = () => this.setTool(this.tool === 'place' ? 'select' : 'place');
      $('add-type').innerHTML = Object.keys(DL.TYPES).map(k => '<option value="' + k + '">' + DL.TYPES[k].name + '</option>').join('');
      $('add-type').value = this.placeType;
      $('add-type').onchange = e => { this.placeType = e.target.value; this.setTool('place'); };
      $('btn-remove').onclick = () => this.removeSelected();
      $('btn-reset').onclick = () => this.resetAll();
      $('btn-prev').onclick = () => this.prev();
      $('btn-next').onclick = () => this.next();
      $('scrub').oninput = e => this.setScrub(+e.target.value);
      $('btn-play').onclick = () => this.togglePlay();
      $('frame-dur').onchange = e => {
        DL.setFrameDur(DL.tl.current, +e.target.value);
        e.target.value = DL.frameDur(DL.tl.current);
        this.refresh();
      };
      document.querySelectorAll('[data-tool]').forEach(b => { b.onclick = () => this.setTool(b.dataset.tool); });
      $('btn-zin').onclick = () => DL.scene.zoomCenter(1.5);
      $('btn-zout').onclick = () => DL.scene.zoomCenter(1 / 1.5);
      $('btn-fit').onclick = () => DL.scene.fit();
      $('btn-settings').onclick = () => this.openSettings();
      $('btn-help').onclick = () => $('help').classList.toggle('open');
      $('help-close').onclick = () => $('help').classList.remove('open');

      $('p-close').onclick = () => this.select(null);
      $('p-callsign').oninput = e => { const a = this.ac(); if (a) a.callsign = e.target.value; };
      $('p-color').oninput = e => { if (this.selected && this.state()) { DL.setColorAt(DL.tl.current, this.selected, parseInt(e.target.value.slice(1), 16)); this.refresh(); } };
      $('p-hdg').onchange = e => this.pose({ hdg: +e.target.value || 0 });
      $('p-spd').onchange = e => {
        if (!this.state()) return;
        DL.quickSpeed(DL.tl.current, this.selected, +e.target.value || DL.TYPES[this.ac().type].defSpeed);
        this.refresh();
      };
      $('p-alt').onchange = e => {
        if (!this.state()) return;
        DL.quickAlt(DL.tl.current, this.selected, +e.target.value || 0);
        this.refresh();
      };
      for (const [id, step, fn] of [['p-spd', 10, 'quickSpeed'], ['p-alt', 500, 'quickAlt']]) {
        $(id).addEventListener('wheel', e => {
          const s = this.state();
          if (!s) return;
          e.preventDefault();
          const k = (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 5 : 1);
          DL[fn](DL.tl.current, this.selected, (id === 'p-spd' ? s.spd : s.alt) + k * step);
          this.refresh();
        }, { passive: false });
      }
      $('p-thr').oninput = e => this.setControl('thr', +e.target.value);
      $('p-g').oninput = e => this.setControl('g', +e.target.value);
      $('p-bank').oninput = e => this.setControl('bank', +e.target.value);
      $('p-sb').onchange = e => this.setControl('sb', e.target.checked);
      $('p-trim').onclick = () => {
        const s = this.state(), a = this.ac();
        this.setControl('thr', DL.trimThrottle(a.type, s.spd, DL.turnInfo(a.type, s.spd, s.ctl, s.gam).n));
      };
      $('p-level').onclick = () => { DL.editControls(this.selected, { g: 1, bank: 0 }); this.refresh(); };
      $('p-unlock').onclick = () => { DL.setUnlocked(this.selected, true); this.refresh(); };
      $('p-lock').onclick = () => { DL.setUnlocked(this.selected, false); this.refresh(); };
      $('p-restore').onclick = () => { DL.restoreFlown(this.selected); this.refresh(); };
      $('p-vert').onclick = () => { if (this.state()) this.openVertical(DL.tl.current, this.selected); };
      $('preset').onchange = e => {
        const [key, side] = e.target.value.split(':');
        e.target.value = '';
        if (!key) return;
        if (!this.state()) { this.flash('Select an aircraft first, then pick a preset.'); return; }
        this.applyPreset(DL.tl.current, this.selected, key, side === 'L');
      };

      $('vw-close').onclick = () => this.closeVertical();
      $('vw-alt').onchange = e => { const v = this.vw; if (v) { DL.setAltAt(v.k, v.id, +e.target.value || 0); this.refresh(); } };
      $('vw-gam').onchange = e => { const v = this.vw; if (v) { DL.setClimb(v.k, v.id, +e.target.value || 0); this.refresh(); } };
      $('vw-gam-r').oninput = e => { const v = this.vw; if (v) { DL.setClimb(v.k, v.id, +e.target.value); this.refresh(); } };
      $('vw-g').oninput = e => this.vwControl({ g: +e.target.value });
      $('vw-bank').oninput = e => this.vwControl({ bank: +e.target.value, maneuver: undefined });
      $('vw-hold').onclick = () => {
        const v = this.vw, s = v && this.vwState();
        if (!s) return;
        const dir = Math.sign(s.ctl.bank) || 1;
        const b = Math.round(DL.bankForG(s.ctl.g, s.gam));
        this.vwControl({ bank: b ? dir * b : 0, maneuver: undefined });
      };
      $('vw-levelfl').onclick = () => {
        const v = this.vw;
        if (!v) return;
        DL.setClimb(v.k, v.id, 0);
        this.vwControl({ g: 1, bank: 0, maneuver: undefined });
      };
      document.querySelectorAll('[data-vmnv]').forEach(b => {
        b.onclick = () => { const v = this.vw; if (v) this.applyPreset(v.k, v.id, b.dataset.vmnv, $('vw-left').checked); };
      });
      this.dragWindow($('vwin'), document.querySelector('#vwin .vw-h'));
      $('p-truncate').onclick = () => { DL.truncate(); this.refresh(); };

      $('set-cancel').onclick = () => $('settings').classList.remove('open');
      document.querySelectorAll('#settings [data-tab]').forEach(b => { b.onclick = () => this.setSettingsTab(b.dataset.tab); });
      $('set-apply').onclick = () => this.applySettings();

      window.addEventListener('keydown', e => {
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
        if (e.code === 'Space') { DL.scene.spaceDown = true; e.preventDefault(); return; }
        const s = this.state();
        switch (e.key) {
          case 'ArrowRight': case '.': this.next(); break;
          case 'ArrowLeft': case ',': this.prev(); break;
          case 'Delete': case 'Backspace': this.removeSelected(); break;
          case 'Escape': this.closeWheel(); this.closeVertical(); if (DL.advWin) DL.advWin.close(); if (DL.bscope) DL.bscope.close(); this.setTool('select'); this.select(null); $('help').classList.remove('open'); $('settings').classList.remove('open'); break;
          case 'v': case 'V': this.setTool('select'); break;
          case 'a': case 'A': this.setTool('place'); break;
          case 'f': case 'F': this.setTool('path'); break;
          case 'm': case 'M': this.setTool('move'); break;
          case 'h': case 'H': this.setTool('pan'); break;
          case 'z': case 'Z': this.setTool('zoom'); break;
          case '0': DL.scene.fit(); break;
          case '=': case '+': DL.scene.zoomCenter(1.5); break;
          case '-': DL.scene.zoomCenter(1 / 1.5); break;
          case 'b': case 'B': if (s) this.setControl('sb', !s.ctl.sb); break;
          case 'w': case 'W': if (s) this.setControl('thr', DL.clamp(s.ctl.thr + 5, 0, 100)); break;
          case 's': case 'S': if (s) this.setControl('thr', DL.clamp(s.ctl.thr - 5, 0, 100)); break;
          case 'q': case 'Q': if (s) this.setControl('bank', DL.clamp(s.ctl.bank - 5, -this.bankMax(), this.bankMax())); break;
          case 'e': case 'E': if (s) this.setControl('bank', DL.clamp(s.ctl.bank + 5, -this.bankMax(), this.bankMax())); break;
          case 'p': case 'P': this.togglePlay(); break;
          case '?': $('help').classList.toggle('open'); break;
          default: return;
        }
        e.preventDefault();
      });
      window.addEventListener('keyup', e => { if (e.code === 'Space' && DL.scene) DL.scene.spaceDown = false; });
      const endGesture = e => {
        if (e.touches && e.touches.length) return;
        if (DL.scene) DL.scene.pressing = false;
        document.body.classList.remove('map-gesture');
      };
      for (const t of ['mouseup', 'touchend', 'touchcancel']) window.addEventListener(t, endGesture);
      $('game').addEventListener('wheel', e => { e.preventDefault(); }, { passive: false });

      $('btn-touch').onclick = () => this.setTouch(!this.touch, true);
      document.querySelectorAll('[data-drag]').forEach(b => { b.onclick = () => this.setDragMode(b.dataset.drag); });
      $('p-min').onclick = () => { $('panel').classList.toggle('min'); this.refresh(); };
      let saved = null;
      try { saved = localStorage.getItem('combatLines.touch'); } catch (e) { saved = null; }
      const detected = (navigator.maxTouchPoints || 0) > 0 || !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      this.setTouch(saved === '1' || saved === '0' ? saved === '1' : detected, false);

      this.buildSettings();
      this.buildWheel();
      $('set-ac').onchange = () => this.showAircraftForm();
      $('set-ac-reset').onclick = () => { this.acDraft[$('set-ac').value] = Object.assign({}, this.acDefaults[$('set-ac').value]); this.showAircraftForm(); };
      this.watchBar();
      window.addEventListener('resize', () => this.layout());
      this.refresh();
    },

    ac() { return this.selected ? DL.tl.aircraft[this.selected] : null; },
    state() { return this.selected ? DL.cur()[this.selected] : null; },

    select(id) {
      const fresh = !!id && id !== this.selected;
      this.selected = id;
      this.refresh();
      if (fresh && DL.scene && DL.scene.keepClear) {
        if (DL.scene.pressing) this.pendingClear = id; else DL.scene.keepClear(id);
      }
    },

    setTool(t) {
      this.tool = t;
      document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
      $('btn-add').classList.toggle('on', t === 'place');
      const cursors = { select: 'default', place: 'crosshair', path: 'crosshair', move: 'move', pan: 'grab', zoom: 'zoom-in' };
      this.toolCursor = cursors[t] || 'default';
      $('game').style.cursor = this.toolCursor;
      const hints = {
        select: 'Drag from an aircraft to shape its flight path. Drag the next frame\'s climb ticks up or down to set climb angle. Hover a past frame for its data.',
        place: 'Click to place ' + DL.TYPES[this.placeType].name + ' here, drag to point its nose. Shift snaps heading to 15°.',
        path: 'Drag from the selected aircraft: its next turn bends through the cursor.',
        move: 'Drag an aircraft to move its whole flight: its history and flight path go with it.',
        pan: 'Drag to pan. Space+drag or the middle button pans from any tool.',
        zoom: 'Click to zoom in, Shift+click to zoom out. Wheel or pinch zooms anywhere.',
      };
      const touchHints = {
        select: 'Drag from an aircraft to shape its path. One finger pans, two fingers pinch to zoom. Tap a past frame for its data.',
        place: 'Tap to place ' + DL.TYPES[this.placeType].name + ' here and drag to point its nose.',
        path: 'Drag anywhere: the selected aircraft\'s next turn bends through your finger.',
        move: 'Drag an aircraft to move its whole flight, history and path included.',
        pan: 'Drag to pan, pinch to zoom.',
        zoom: 'Tap to zoom in. Pinch zooms anywhere.',
      };
      $('hint').textContent = (this.touch ? touchHints : hints)[t] || '';
    },

    bankMax() { return DL.settings.coordinated ? 85 : 160; },

    setTouch(on, remember) {
      this.touch = !!on;
      document.body.classList.toggle('touch', this.touch);
      $('btn-touch').classList.toggle('on', this.touch);
      if (remember) { try { localStorage.setItem('combatLines.touch', this.touch ? '1' : '0'); } catch (e) { } }
      this.setTool(this.tool);
      if (this.measure) this.measure();
    },

    setDragMode(m) {
      this.dragMode = m;
      document.querySelectorAll('[data-drag]').forEach(b => b.classList.toggle('on', b.dataset.drag === m));
    },

    narrow() { return window.innerWidth <= 720; },
    small() { return this.narrow() || window.innerHeight < 560; },

    soloWindow(which) {
      const one = this.small();
      const panelW = $('panel').offsetWidth || (this.touch ? 330 : 290);
      if (!one && window.innerWidth >= 384 + 300 + panelW + 48) return;
      if (which !== 'vwin' && this.vw) this.closeVertical();
      if (which !== 'bscope' && one && DL.bscope && DL.bscope.isOpen()) DL.bscope.close();
      if (which === 'vwin' || one) {
        if (which !== 'adv' && DL.advWin && DL.advWin.isOpen()) DL.advWin.close();
        if (which === 'bscope' && DL.advWin && DL.advWin.isOpen()) DL.advWin.close();
        if (which !== 'v3d' && DL.view3d && DL.view3d.visible) DL.view3d.setVisible(false);
      }
    },

    pose(patch) {
      if (!this.state()) return;
      DL.editPose(this.selected, patch);
      this.refresh();
    },

    setControl(key, val) {
      const s = this.state();
      if (!s) return;
      const patch = { [key]: val };
      if (key === 'bank') patch.maneuver = undefined;
      if (DL.settings.coordinated) {
        if (key === 'g') {
          const dir = Math.sign(s.ctl.bank) || 1;
          patch.bank = val > 1.0001 ? dir * Math.round(DL.bankForG(val, s.gam)) : 0;
        } else if (key === 'bank') {
          const maxG = DL.TYPES[this.ac().type].maxG;
          patch.g = Math.min(maxG, Math.round(10 / Math.cos(Math.abs(val) * DL.D2R)) / 10);
          if (1 / Math.cos(Math.abs(val) * DL.D2R) > maxG) patch.bank = Math.sign(val) * Math.round(DL.bankForG(maxG, s.gam));
        }
      }
      DL.editControls(this.selected, patch);
      this.refresh();
    },

    wheelOpen: false,

    buildWheel() {
      const box = $('wheel');
      box.addEventListener('contextmenu', e => e.preventDefault());
      document.addEventListener('pointerdown', e => { if (this.wheelOpen && !box.contains(e.target)) this.closeWheel(); }, true);
    },

    wheelItems(hit, w) {
      const cur = DL.tl.current;
      if (hit) {
        const t = DL.TYPES[DL.tl.aircraft[hit].type], sb = DL.cur()[hit].ctl.sb;
        return {
          title: $('p-callsign').value || 'Aircraft',
          items: [
            { a: 0, t: 'Vertical…', go: () => this.openVertical(cur, hit) },
            { a: 45, t: 'Wings level', v: '1 g', go: () => $('p-level').click() },
            { a: 90, t: 'Hold speed', go: () => $('p-trim').click() },
            { a: 135, t: 'Speedbrake', v: sb ? 'in' : 'out', off: !t.brake, go: () => this.setControl('sb', !sb) },
            { a: 180, t: 'Remove', go: () => this.removeSelected() },
            { a: 225, t: '3D view', go: () => $('btn-3d').click() },
            { a: 270, t: 'Immelmann', go: () => this.applyPreset(cur, hit, 'immelmann', false) },
            { a: 315, t: 'Split-S', go: () => this.applyPreset(cur, hit, 'splitS', false) },
          ],
          pills: [
            { t: 'Pitchback R', go: () => this.applyPreset(cur, hit, 'pitchback', false) },
            { t: 'Pitchback L', go: () => this.applyPreset(cur, hit, 'pitchback', true) },
            { t: 'Sliceback R', go: () => this.applyPreset(cur, hit, 'sliceback', false) },
            { t: 'Sliceback L', go: () => this.applyPreset(cur, hit, 'sliceback', true) },
            { t: 'Alt +1000', go: () => DL.quickAlt(cur, hit, DL.cur()[hit].alt + 1000) },
            { t: 'Alt −1000', go: () => DL.quickAlt(cur, hit, DL.cur()[hit].alt - 1000) },
            { t: 'Speed +50', go: () => DL.quickSpeed(cur, hit, DL.cur()[hit].spd + 50) },
            { t: 'Speed −50', go: () => DL.quickSpeed(cur, hit, DL.cur()[hit].spd - 50) },
          ],
        };
      }
      const frames = DL.tl.frames.length, playing = DL.view3d && DL.view3d.playing;
      return {
        title: 'Frame ' + cur,
        items: [
          { a: 0, t: 'Add here', v: DL.TYPES[this.placeType].name, go: () => { const id = DL.addAircraft(this.placeType, DL.scene.snap(w.x), DL.scene.snap(w.y), 0); this.select(id); this.setScrub(0); } },
          { a: 45, t: 'Next frame', go: () => this.next() },
          { a: 90, t: 'Zoom in', go: () => DL.scene.zoomAt(this.wheelAt, 1.5) },
          { a: 135, t: 'Fit', go: () => DL.scene.fit() },
          { a: 180, t: 'Zoom out', go: () => DL.scene.zoomAt(this.wheelAt, 1 / 1.5) },
          { a: 225, t: playing ? 'Pause' : 'Play', go: () => this.togglePlay() },
          { a: 270, t: 'Previous', v: 'frame', off: cur <= 0 && frames <= 1, go: () => this.prev() },
          { a: 315, t: '3D view', go: () => $('btn-3d').click() },
        ],
        pills: [],
      };
    },

    openWheel(p, w, hit) {
      if (!this.tool || this.tool === 'place' || this.tool === 'zoom') return;
      if (hit) this.select(hit); else this.select(null);
      const NS = 'http://www.w3.org/2000/svg', box = $('wheel'), m = this.wheelItems(hit, w);
      this.wheelAt = { x: p.x, y: p.y };
      const C = 130, r0 = 50, r1 = 122, half = 22.5 - 1.2, d2r = Math.PI / 180;
      const pt = (a, r) => [C + Math.sin(a * d2r) * r, C - Math.cos(a * d2r) * r];
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 260 260'); svg.setAttribute('width', '260'); svg.setAttribute('height', '260');
      for (const it of m.items) {
        const [x0, y0] = pt(it.a - half, r1), [x1, y1] = pt(it.a + half, r1), [x2, y2] = pt(it.a + half, r0), [x3, y3] = pt(it.a - half, r0);
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'wedge' + (it.off ? ' off' : '')); g.setAttribute('role', 'menuitem'); g.setAttribute('tabindex', it.off ? '-1' : '0');
        g.setAttribute('aria-label', it.t + (it.v ? ' ' + it.v : '')); if (it.off) g.setAttribute('aria-disabled', 'true');
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', `M${x0},${y0} A${r1},${r1} 0 0 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 0 0 ${x3},${y3} Z`);
        g.appendChild(path);
        const [tx, ty] = pt(it.a, (r0 + r1) / 2);
        const t1 = document.createElementNS(NS, 'text'); t1.setAttribute('x', tx); t1.setAttribute('y', it.v ? ty - 3 : ty + 4); t1.textContent = it.t; g.appendChild(t1);
        if (it.v) { const t2 = document.createElementNS(NS, 'text'); t2.setAttribute('x', tx); t2.setAttribute('y', ty + 11); t2.setAttribute('class', 'v'); t2.textContent = it.v; g.appendChild(t2); }
        const fire = e => { e.preventDefault(); e.stopPropagation(); if (it.off) return; this.closeWheel(); it.go(); this.refresh(); };
        g.addEventListener('click', fire);
        g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fire(e); });
        svg.appendChild(g);
      }
      const hub = document.createElementNS(NS, 'circle');
      hub.setAttribute('cx', C); hub.setAttribute('cy', C); hub.setAttribute('r', r0 - 4); hub.setAttribute('class', 'hub'); svg.appendChild(hub);
      const ro = document.createElementNS(NS, 'text'); ro.setAttribute('x', C); ro.setAttribute('y', C + 4); ro.setAttribute('class', 'ro'); ro.textContent = m.title; svg.appendChild(ro);
      const ring = box.querySelector('.ring'); ring.innerHTML = ''; ring.appendChild(svg);
      const pills = box.querySelector('.pills'); pills.innerHTML = '';
      for (const pl of m.pills) {
        const b = document.createElement('button'); b.textContent = pl.t;
        b.onclick = e => { e.stopPropagation(); this.closeWheel(); pl.go(); this.refresh(); };
        pills.appendChild(b);
      }
      this.hideTip();
      box.classList.add('open'); this.wheelOpen = true;
      const cr = document.querySelector('canvas').getBoundingClientRect(), bw = box.offsetWidth, bh = box.offsetHeight;
      box.style.left = DL.clamp(cr.left + p.x - bw / 2, 4, window.innerWidth - bw - 4) + 'px';
      box.style.top = DL.clamp(cr.top + p.y - 130, 4, window.innerHeight - bh - 4) + 'px';
    },

    closeWheel() { if (!this.wheelOpen) return; this.wheelOpen = false; $('wheel').classList.remove('open'); },

    removeSelected() {
      if (!this.selected) return;
      DL.removeAircraft(this.selected);
      this.selected = null;
      this.refresh();
    },

    next() { DL.nextFrame(); this.refresh(); },
    prev() { DL.prevFrame(); this.refresh(); },

    resetAll() {
      const tl = DL.tl;
      const any = tl.frames.length > 1 || tl.frames.some(f => Object.keys(f).length) || tl.events.length;
      if (any && !window.confirm('Clear every aircraft, frame and marker and start over?')) return;
      DL.reset();
      this.selected = null;
      this.closeVertical();
      this.setScrub(0);
      this.setTool('select');
      this.refresh();
      if (DL.scene && DL.scene.cam) DL.scene.fit();
      this.flash('Cleared. Add an aircraft to start a new debrief.');
    },

    setScrub(t) {
      const v3 = DL.view3d;
      if (!v3) return;
      v3.t = DL.clamp(t, 0, DL.frameDur(DL.tl.current));
      v3.playing = false;
      this.syncScrub();
    },

    togglePlay() {
      const v3 = DL.view3d;
      if (!v3 || !Object.keys(DL.cur()).length) return;
      v3.playing = !v3.playing;
      if (v3.playing && v3.t >= DL.frameDur(DL.tl.current) - 1e-6) v3.t = 0;
      v3.lastTs = null;
      this.syncScrub(true);
    },

    syncScrub(force) {
      const v3 = DL.view3d, tl = DL.tl, fs = DL.frameDur(tl.current);
      if (!v3) return;
      if (this._scrubK !== tl.current) { this._scrubK = tl.current; v3.t = 0; v3.playing = false; force = true; }
      if (v3.t > fs) v3.t = fs;
      const t = v3.t, playing = !!v3.playing;
      if (this._playing !== playing) {
        this._playing = playing;
        $('btn-play').textContent = playing ? 'Pause' : 'Play';
        $('btn-play').classList.toggle('on', playing);
      }
      if (!force && this._scrubT === t && this._scrubFs === fs) return;
      this._scrubT = t; this._scrubFs = fs;
      const sc = $('scrub'), fd = $('frame-dur');
      sc.max = fs;
      if (document.activeElement !== sc) sc.value = t;
      if (document.activeElement !== fd) fd.value = fs;
      $('timeline').classList.toggle('scrubbing', t > 0);
      $('frame-time').textContent = 'T+' + (t > 0 ? (DL.timeAt(tl.current) + t).toFixed(1) : DL.fmtSec(DL.timeAt(tl.current))) + 's';
    },

    tip(html, p) {
      const el = $('tip');
      el.innerHTML = html;
      el.style.display = 'block';
      const W = window.innerWidth, H = window.innerHeight;
      const bh = this.barH();
      let x = p.x + 16, y = p.y + bh + 14;
      const r = el.getBoundingClientRect();
      if (x + r.width > W - 8) x = p.x - r.width - 12;
      const floor = H - ($('timeline').offsetHeight || 44) - $('status').offsetHeight - 8;
      if (y + r.height > floor) y = Math.max(bh + 4, p.y + bh - r.height - 10);
      el.style.left = x + 'px'; el.style.top = y + 'px';
    },

    hideTip() {
      $('tip').style.display = 'none';
      this.setCursor(this.toolCursor);
    },

    setCursor(c) { $('game').style.cursor = c || 'default'; },

    barH() { return $('bar').offsetHeight || 48; },

    watchBar() {
      const apply = () => {
        document.documentElement.style.setProperty('--bar-h', this.barH() + 'px');
        document.documentElement.style.setProperty('--bottom-h', (($('timeline').offsetHeight || 44) + $('status').offsetHeight) + 'px');
        if (DL.game && DL.game.isBooted && DL.game.scale && DL.game.scale.canvas) DL.game.scale.refresh();
        this.layout();
      };
      const bar = $('bar');
      const edge = () => bar.classList.toggle('more', bar.scrollWidth - bar.clientWidth - bar.scrollLeft > 4);
      bar.addEventListener('scroll', edge, { passive: true });
      this.measure = () => { apply(); edge(); };
      if (window.ResizeObserver) { const ro = new ResizeObserver(() => this.measure()); ro.observe($('bar')); ro.observe($('timeline')); }
      window.addEventListener('resize', this.measure);
      this.measure();
    },

    frameTip(k, id, p) {
      const s = DL.tl.frames[k][id], a = DL.tl.aircraft[id];
      if (!s || !a) return this.hideTip();
      const nx = DL.tl.frames[k + 1] && DL.tl.frames[k + 1][id];
      const ti = DL.turnInfo(a.type, s.spd, s.ctl, s.gam);
      const b = s.ctl.bank;
      const sign = v => (v >= 0 ? '+' : '') + v;
      const rows = [
        ['Altitude', fmt(s.alt || 0) + ' ft'],
        ['Airspeed', fmt(s.spd) + ' kt'],
        ['Heading', String(Math.round(s.hdg)).padStart(3, '0') + '°'],
        ['Climb angle', sign(Math.round(s.gam || 0)) + '°  (' + sign(fmt(ti.vsFpm)) + ' ft/min)'],
        ['G / bank', s.ctl.g.toFixed(1) + ' g, ' + (b ? Math.abs(b) + '° ' + (b < 0 ? 'L' : 'R') : 'level')],
        ['Throttle', s.ctl.thr + '%' + (s.ctl.sb ? ', speedbrake out' : '')],
      ];
      if (ti.dir) rows.push(['Turn', fmt(ti.radius) + ' ft, ' + Math.abs(ti.rateDps).toFixed(1) + '°/s']);
      if (s.ctl.maneuver) rows.push(['Maneuver', MANEUVERS[s.ctl.maneuver].name]);
      if (nx) rows.push(['Next frame', sign(fmt(nx.dAlt || 0)) + ' ft, ' + sign(Math.round(nx.dHdg || 0)) + '° hdg, ' + sign(Math.round(nx.spd - s.spd)) + ' kt']);
      const evs = DL.eventsAt ? DL.eventsAt(k, id) : [];
      if (evs.length) rows.push(['Events', evs.map(e => DL.describeEvent(e).replace(a.callsign + ' ', '')).join('; ')]);
      this.tip('<div class="tip-h"><span style="background:' + hex(DL.colorAt(k, id)) + '"></span>' + a.callsign + ' · frame ' + k +
        ' · T+' + DL.fmtSec(DL.timeAt(k)) + 's</div>' +
        rows.map(([l, v]) => '<div class="tip-r"><span>' + l + '</span><b>' + v + '</b></div>').join(''), p);
      this.setCursor('help');
    },

    eventTip(ev, p) {
      const a = DL.tl.aircraft[ev.ac], kind = DL.EVENT_KINDS[ev.kind];
      if (!a) return this.hideTip();
      const rows = [['Frame', ev.k + ' (T+' + DL.fmtSec(DL.timeAt(ev.k)) + 's)']];
      if (ev.kind === 'shot') {
        const t = ev.target && DL.tl.aircraft[ev.target];
        rows.push(['Target', t ? t.callsign : 'none set']);
        rows.push(['Time of flight', ev.tof + ' s']);
        rows.push(['Result', ev.result === '?' ? 'not set' : ev.result]);
      } else if (ev.kind === 'gun') rows.push(['Line', fmt(ev.len) + ' ft ahead']);
      else rows.push(['Count', ev.count]);
      this.tip('<div class="tip-h"><span style="background:' + hex(DL.colorAt(ev.k, ev.ac)) + '"></span>' + a.callsign + ' · ' + kind.name + '</div>' +
        rows.map(([l, v]) => '<div class="tip-r"><span>' + l + '</span><b>' + v + '</b></div>').join('') +
        '<div class="dim" style="margin-top:4px">Edit or remove it in the Advanced window.</div>', p);
      this.setCursor('help');
    },

    applyPreset(k, id, key, left) {
      const s = DL.tl.frames[k] && DL.tl.frames[k][id], a = DL.tl.aircraft[id];
      if (!s) return;
      const m = MANEUVERS[key], t = DL.TYPES[a.type];
      const dir = left ? -1 : 1;
      const g = Math.max(2, Math.min(t.maxG, DL.availG(a.type, s.spd), 6));
      DL.startManeuverAt(k, id, { bank: m.bank === 0 || m.bank === 180 ? m.bank : dir * m.bank, g: Math.round(g * 10) / 10, maneuver: key });
      this.refresh();
    },

    openVertical(k, id) {
      this.soloWindow('vwin');
      this.vw = { k, id };
      this.selected = id;
      $('vwin').classList.add('open');
      this.refresh();
    },

    closeVertical() {
      this.vw = null;
      $('vwin').classList.remove('open');
      this.layout();
    },

    vwState() {
      const v = this.vw;
      return v && DL.tl.frames[v.k] && DL.tl.frames[v.k][v.id];
    },

    vwControl(patch) {
      const v = this.vw;
      if (!v || !this.vwState()) return;
      DL.editControlsAt(v.k, v.id, patch);
      this.refresh();
    },

    refreshVertical() {
      const v = this.vw;
      if (!v) return;
      v.k = DL.tl.current;
      const s = this.vwState();
      if (!s || !DL.tl.aircraft[v.id]) { this.closeVertical(); return; }
      const a = DL.tl.aircraft[v.id], t = DL.TYPES[a.type], st = DL.settings;
      const r = DL.step(a.type, s, DL.frameDur(DL.tl.current));
      const ti = DL.turnInfo(a.type, s.spd, s.ctl, s.gam);
      $('vw-swatch').style.background = hex(DL.colorAt(DL.tl.current, v.id));
      $('vw-title').textContent = a.callsign + ' · vertical';
      $('vw-sub').textContent = 'Frame ' + v.k + ' → ' + (v.k + 1) + '  (T+' + DL.fmtSec(DL.timeAt(v.k)) + 's to T+' + DL.fmtSec(DL.timeAt(v.k + 1)) + 's)';
      const ae = document.activeElement;
      if (ae !== $('vw-alt')) $('vw-alt').value = Math.round(s.alt || 0);
      if (ae !== $('vw-gam')) $('vw-gam').value = Math.round(s.gam || 0);
      $('vw-gam-r').value = Math.round(s.gam || 0);
      $('vw-gam-v').textContent = (s.gam > 0 ? '+' : '') + Math.round(s.gam || 0) + '°';
      $('vw-g').max = t.maxG; $('vw-g').value = s.ctl.g; $('vw-g-v').textContent = s.ctl.g.toFixed(1) + ' g';
      $('vw-bank').min = -this.bankMax(); $('vw-bank').max = this.bankMax(); $('vw-bank').value = s.ctl.bank;
      const b = s.ctl.bank;
      $('vw-bank-v').textContent = b === 0 ? 'level' : Math.abs(b) + '° ' + (b < 0 ? 'L' : 'R');

      const sign = n => (n >= 0 ? '+' : '') + fmt(n);
      const ad = Math.abs(r.dAlt);
      const ticks = ad < st.vertLevelFt ? '1 tick: level' :
        (ad < st.vertSteepFt ? '2 ticks: gentle ' : '3 ticks: steep ') + (r.dAlt > 0 ? 'climb' : 'descent');
      const rows = [
        ['Altitude', fmt(s.alt || 0) + ' → ' + fmt(r.alt) + ' ft'],
        ['Altitude change', sign(r.dAlt) + ' ft'],
        ['Climb angle', sign(Math.round(s.gam || 0)) + '° → ' + sign(Math.round(r.gam)) + '°'],
        ['Vertical speed', sign(ti.vsFpm) + ' ft/min'],
        ['Nose moving', Math.abs(ti.pitchRateDps) < 0.05 ? 'steady' : Math.abs(ti.pitchRateDps).toFixed(1) + ' °/s ' + (ti.pitchRateDps > 0 ? 'up' : 'down')],
        ['Ticks', ticks],
      ];
      let warn = '';
      if (s.ctl.maneuver || s.rev || r.rev) {
        const ahead = DL.predictAhead(v.k, v.id, 10);
        const last = ahead[ahead.length - 1];
        const name = s.ctl.maneuver ? MANEUVERS[s.ctl.maneuver].name : 'Reversal';
        rows.push(['Maneuver', name + (s.rev ? ' (reversing)' : '')]);
        rows.push(['Rolls out', last.rolledOut
          ? 'frame ' + (v.k + ahead.length) + ', ' + String(Math.round(last.hdg)).padStart(3, '0') + '° at ' + fmt(last.alt) + ' ft'
          : 'not within 10 frames']);
        warn = 'Maneuver';
      }
      $('vw-readout').innerHTML = rows.map(([k, val]) =>
        `<div><span>${k}</span><b class="${k === warn ? 'warn' : ''}">${val}</b></div>`).join('');
    },

    layout() {
      const W = window.innerWidth, H = window.innerHeight;
      const top = this.barH() + 12;
      const bottom = H - ($('timeline').offsetHeight || 44) - $('status').offsetHeight - 12;
      const v3 = $('v3d'), adv = $('advwin'), vw = $('vwin'), panel = $('panel'), bsw = $('bscope');
      if (this.narrow()) {
        const pr = panel.classList.contains('open') ? panel.getBoundingClientRect() : null;
        const y0 = this.barH() + 6, floor = (pr ? pr.top : bottom + 12) - 6;
        for (const el of [v3, adv, vw, bsw]) {
          if (!el.offsetWidth || el.dataset.moved) continue;
          el.style.left = '6px'; el.style.width = (W - 12) + 'px'; el.style.top = y0 + 'px'; el.style.bottom = 'auto';
          el.style.maxHeight = Math.max(150, floor - y0) + 'px';
        }
        return;
      }
      for (const el of [v3, adv, vw, bsw]) if (!el.dataset.moved && el !== bsw) el.style.width = '';
      const place = (el, x, y) => { el.style.left = Math.max(8, x) + 'px'; el.style.top = Math.max(top, y) + 'px'; el.style.bottom = 'auto'; };
      const v3h = v3.offsetHeight;
      if (v3h && !v3.dataset.moved) place(v3, 12, bottom - v3h);
      if (!adv.dataset.moved) place(adv, 12, top);
      const advEnd = v3h && !v3.dataset.moved && !adv.dataset.moved ? bottom - v3h - 10 : bottom;
      adv.style.maxHeight = Math.max(180, advEnd - parseFloat(adv.style.top || top)) + 'px';
      if (!bsw.dataset.moved) place(bsw, 12 + (adv.classList.contains('open') ? adv.offsetWidth + 10 : 0), top);
      const pw = panel.classList.contains('open') ? panel.offsetWidth + 10 : 0;
      if (!vw.dataset.moved) place(vw, W - 12 - pw - (vw.offsetWidth || 300), top);
      vw.style.maxHeight = Math.max(180, bottom - parseFloat(vw.style.top || top)) + 'px';
    },

    dragWindow(el, handle) {
      handle.addEventListener('dblclick', e => {
        if (e.target.tagName === 'BUTTON') return;
        delete el.dataset.moved;
        this.layout();
      });
      let lastTap = 0;
      handle.addEventListener('pointerdown', e => {
        if (e.target.tagName === 'BUTTON') return;
        const r = el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
        let moved = false;
        const move = ev => {
          if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 4) return;
          moved = true;
          el.dataset.moved = '1';
          el.style.bottom = 'auto';
          el.style.left = (ev.clientX - ox) + 'px'; el.style.top = Math.max(this.barH(), ev.clientY - oy) + 'px';
        };
        const up = () => {
          window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
          if (moved || e.pointerType === 'mouse') return;
          const now = Date.now();
          if (now - lastTap < 400) { lastTap = 0; delete el.dataset.moved; this.layout(); } else lastTap = now;
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });
    },

    flash(msg) {
      const h = $('hint');
      h.textContent = msg;
      h.classList.add('flash');
      clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(() => { h.classList.remove('flash'); this.setTool(this.tool); }, 3500);
    },

    cursor(w) {
      $('st-cursor').textContent = 'E ' + fmt(w.x) + " ft  N " + fmt(-w.y) + ' ft';
    },

    refresh() {
      const tl = DL.tl, st = DL.settings;
      $('frame-num').textContent = tl.current;
      $('frame-count').textContent = tl.frames.length - 1;
      $('btn-prev').disabled = tl.current === 0;
      const flying = Object.keys(tl.frames[tl.current]).length > 0;
      if (!flying) this.setScrub(0);
      $('scrub').disabled = $('btn-play').disabled = !flying;
      $('p-truncate').disabled = tl.current >= tl.frames.length - 1;
      this.syncScrub(true);
      $('btn-remove').disabled = !this.state();
      if (this.selected && !this.state()) this.selected = this.selected && tl.aircraft[this.selected] ? this.selected : null;

      if (DL.scene && DL.scene.cam) {
        const z = DL.scene.cam.zoom;
        $('st-zoom').textContent = 'Zoom ' + (z >= 0.1 ? z.toFixed(2) : z.toFixed(3)) + '×';
        $('st-grid').textContent = '1 cell = ' + fmt(st.gridFt) + ' ft';
        const target = 120 / z;
        const p = Math.pow(10, Math.floor(Math.log10(target)));
        const nice = [1, 2, 5, 10].map(m => m * p).reduce((a, b) => Math.abs(b - target) < Math.abs(a - target) ? b : a);
        $('scale-bar').style.width = (nice * z) + 'px';
        $('scale-label').textContent = fmt(nice) + ' ft';
      }

      this.refreshVertical();
      if (DL.advWin) DL.advWin.refresh();
      const panel = $('panel');
      const s = this.state(), a = this.ac();
      panel.classList.toggle('open', !!s);
      const folded = panel.classList.contains('min');
      $('p-min').textContent = folded ? '▴' : '▾';
      $('p-min').title = folded ? 'Unfold the panel' : 'Fold the panel to its title';
      const canPose = !!(s && DL.canEditPose(this.selected));
      document.querySelectorAll('[data-drag]').forEach(b => { if (b.dataset.drag !== 'path') b.disabled = !canPose; });
      if (!canPose && this.dragMode !== 'path') this.setDragMode('path');
      this.layout();
      if (!s) return;
      const t = DL.TYPES[a.type];
      const ti = DL.turnInfo(a.type, s.spd, s.ctl, s.gam);
      const r = DL.step(a.type, s, DL.frameDur(DL.tl.current));
      $('p-swatch').style.background = hex(s.color || a.color);
      $('p-type').textContent = t.name;
      if (document.activeElement !== $('p-callsign')) $('p-callsign').value = a.callsign;
      $('p-color').value = hex(s.color || a.color);
      const editable = DL.canEditPose(this.selected);
      $('p-hdg').disabled = !editable;
      const first = DL.isFirstFrame(this.selected);
      $('p-locked').style.display = editable ? 'none' : '';
      $('p-unlocked').style.display = editable && !first ? '' : 'none';
      $('p-restore').style.display = s.pinned ? '' : 'none';
      if (document.activeElement !== $('p-hdg')) $('p-hdg').value = Math.round(s.hdg);
      if (document.activeElement !== $('p-spd')) $('p-spd').value = Math.round(s.spd);
      if (document.activeElement !== $('p-alt')) $('p-alt').value = Math.round(s.alt || 0);
      $('p-bank').min = -this.bankMax(); $('p-bank').max = this.bankMax();
      $('p-thr').value = s.ctl.thr; $('p-thr-v').textContent = s.ctl.thr + '%';
      $('p-g').max = t.maxG;
      $('p-g').value = s.ctl.g; $('p-g-v').textContent = s.ctl.g.toFixed(1) + ' g';
      $('p-bank').value = s.ctl.bank;
      $('p-bank-v').textContent = s.ctl.bank === 0 ? 'level' : Math.abs(s.ctl.bank) + '° ' + (s.ctl.bank < 0 ? 'L' : 'R');
      $('p-sb').checked = s.ctl.sb;
      $('p-sb').disabled = !t.brake;

      const avail = DL.availG(a.type, s.spd);
      const limited = s.ctl.g > avail + 0.05;
      const dv = r.spd - s.spd;
      const rows = [
        ['Turn radius', ti.dir ? fmt(ti.radius) + ' ft' : 'straight'],
        ['Turn rate', ti.dir ? Math.abs(ti.rateDps).toFixed(1) + ' °/s ' + (ti.dir < 0 ? 'left' : 'right') : '0 °/s'],
        ['Load factor', ti.n.toFixed(1) + ' g' + (limited ? ' (lift limited)' : '')],
        ['Available g', avail.toFixed(1) + ' g at ' + fmt(s.spd) + ' kt'],
        ['Corner speed', fmt(DL.cornerSpeed(a.type)) + ' kt'],
        ['Next ' + DL.fmtSec(DL.frameDur(DL.tl.current)) + ' s', ''],
        ['  Distance', fmt(r.dist) + ' ft'],
        ['  Heading change', (r.dHdg >= 0 ? '+' : '') + r.dHdg.toFixed(0) + '°  →  ' + String(Math.round(r.hdg)).padStart(3, '0') + '°'],
        ['  Speed change', (dv >= 0 ? '+' : '') + dv.toFixed(0) + ' kt  →  ' + fmt(r.spd) + ' kt'],
      ];
      $('p-readout').innerHTML = rows.map(([k, v]) =>
        v === '' ? `<div class="sub">${k}</div>` : `<div><span>${k.trim()}</span><b class="${(limited && k === 'Load factor') || k === 'Maneuver' ? 'warn' : ''}">${v}</b></div>`
      ).join('');
      const last = DL.tl.current < DL.tl.frames.length - 1;
      $('p-future').style.display = last ? '' : 'none';
    },

    acFields: [
      ['defSpeed', 'Start speed', 'kt', 5, 'Speed new aircraft of this type start with'],
      ['defAlt', 'Start altitude', 'ft', 500, 'Altitude new aircraft of this type start at'],
      ['vStall', 'Stall speed', 'kt', 5, 'Below this the aircraft cannot pull many g'],
      ['vMax', 'Max speed', 'kt', 5, 'Top speed'],
      ['maxG', 'Max g', 'g', 0.5, 'Structural limit'],
      ['accel', 'Acceleration', 'kt/s', 0.5, 'How fast it speeds up at full power'],
      ['induced', 'Induced drag', '', 0.01, 'Higher means less sustained g in a turn'],
    ],

    buildSettings() {
      const fields = this.acFields.map(f => f[0]);
      if (!this.acDefaults) {
        this.acDefaults = {};
        for (const k in DL.TYPES) { this.acDefaults[k] = {}; for (const f of fields) this.acDefaults[k][f] = DL.TYPES[k][f]; }
      }
      this.acDraft = {};
      for (const k in DL.TYPES) { this.acDraft[k] = {}; for (const f of fields) this.acDraft[k][f] = DL.TYPES[k][f]; }
      const sel = $('set-ac');
      sel.innerHTML = Object.keys(DL.TYPES).map(k => `<option value="${k}">${DL.TYPES[k].name}</option>`).join('');
      sel.value = this.acEdit && DL.TYPES[this.acEdit] ? this.acEdit : DL.TYPES[this.placeType] ? this.placeType : Object.keys(DL.TYPES)[0];
      this.showAircraftForm();
    },

    showAircraftForm() {
      const k = $('set-ac').value, d = this.acDraft[k];
      this.acEdit = k;
      $('set-ac-form').innerHTML = this.acFields.map(([f, label, unit, step, hint]) =>
        `<div><label for="ac-${f}">${label}${unit ? ' (' + unit + ')' : ''}</label>` +
        `<input type="number" id="ac-${f}" step="${step}" data-f="${f}" value="${d[f]}"><span class="hint">${hint}</span></div>`).join('');
      $('set-ac-form').querySelectorAll('input').forEach(inp => {
        inp.oninput = () => { const v = +inp.value; if (v > 0) this.acDraft[$('set-ac').value][inp.dataset.f] = v; };
      });
    },

    setSettingsTab(name) {
      this.settingsTab = name;
      document.querySelectorAll('#settings [data-tab]').forEach(b => { b.classList.toggle('on', b.dataset.tab === name); b.setAttribute('aria-selected', b.dataset.tab === name); });
      document.querySelectorAll('#settings [data-page]').forEach(pg => pg.classList.toggle('on', pg.dataset.page === name));
      document.querySelector('#settings .tab-body').scrollTop = 0;
    },

    openSettings() {
      const st = DL.settings;
      $('set-grid').value = st.gridFt;
      $('set-frame').value = st.frameSec;
      $('set-snap').checked = st.snap;
      $('set-coord').checked = st.coordinated;
      $('set-circles').value = st.showCircles;
      $('set-pred').checked = st.showPrediction;
      $('set-labels').checked = st.showLabels;
      $('set-ghosts').checked = st.showGhosts;
      $('set-vert').checked = st.showVertical;
      $('set-vlevel').value = st.vertLevelFt;
      $('set-vsteep').value = st.vertSteepFt;
      $('set-touch').checked = this.touch;
      if (window.facoTheme) $('set-theme').value = facoTheme.get();
      this.buildSettings();
      this.setSettingsTab(this.settingsTab || 'general');
      $('settings').classList.add('open');
    },

    applySettings() {
      const st = DL.settings;
      st.gridFt = Math.max(1, +$('set-grid').value || 100);
      st.frameSec = DL.clamp(+$('set-frame').value || 5, 0.5, 60);
      st.snap = $('set-snap').checked;
      st.coordinated = $('set-coord').checked;
      st.showCircles = $('set-circles').value;
      st.showPrediction = $('set-pred').checked;
      st.showLabels = $('set-labels').checked;
      st.showGhosts = $('set-ghosts').checked;
      st.showVertical = $('set-vert').checked;
      st.vertLevelFt = Math.max(0, +$('set-vlevel').value || 0);
      st.vertSteepFt = Math.max(st.vertLevelFt + 1, +$('set-vsteep').value || 1000);
      for (const k in DL.TYPES) {
        const t = DL.TYPES[k];
        Object.assign(t, this.acDraft[k]);
        t.vMax = Math.max(t.vMax, t.vStall + 10);
        t.maxG = Math.max(1, t.maxG);
      }
      if ($('set-touch').checked !== this.touch) this.setTouch($('set-touch').checked, true);
      if (window.facoTheme) facoTheme.set($('set-theme').value);
      DL.resimAll();
      $('settings').classList.remove('open');
      this.refresh();
    },
  };

  DL.ui = ui;
})(window.DL);
