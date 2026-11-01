(function (DL) {
  'use strict';

  const $ = id => document.getElementById(id);
  const APP = 'briefing-lines';
  const VERSION = 1;
  const MAX_BYTES = 25 * 1024 * 1024;
  const TYPE_FIELDS = ['defSpeed', 'defAlt', 'vStall', 'vMax', 'maxG', 'accel', 'induced'];

  function stamp() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  }

  function hasContent() {
    const tl = DL.tl;
    return tl.frames.length > 1 || tl.frames.some(f => Object.keys(f).length) || tl.events.length > 0;
  }

  function snapshot() {
    const tl = DL.tl, cam = DL.scene && DL.scene.cam, rd = DL.adv.radar;
    const types = {};
    for (const k in DL.TYPES) { types[k] = {}; for (const f of TYPE_FIELDS) types[k][f] = DL.TYPES[k][f]; }
    return {
      app: APP, version: VERSION, saved: new Date().toISOString(),
      timeline: {
        aircraft: tl.aircraft, frames: tl.frames, current: tl.current, nextId: tl.nextId, counts: tl.counts,
        events: tl.events, nextEv: tl.nextEv, dur: Array.from(tl.dur, v => (v > 0 ? v : null)),
      },
      settings: Object.assign({}, DL.settings),
      types,
      radar: { on: rd.on, rangeNm: rd.rangeNm, fovDeg: rd.fovDeg, who: rd.who },
      markers: { shotTofSec: DL.adv.shotTofSec, gunLenFt: DL.adv.gunLenFt, flareCount: DL.adv.flareCount },
      view: cam ? { x: cam.scrollX, y: cam.scrollY, zoom: cam.zoom } : null,
    };
  }

  function check(d) {
    if (!d || typeof d !== 'object' || d.app !== APP) throw new Error('That file is not a Briefing Lines save.');
    if (typeof d.version !== 'number' || d.version > VERSION) throw new Error('That file was saved by a newer version of Briefing Lines.');
    const t = d.timeline;
    if (!t || !Array.isArray(t.frames) || !t.frames.length || !t.aircraft || typeof t.aircraft !== 'object') throw new Error('That save has no timeline in it.');
    for (const id in t.aircraft) {
      const a = t.aircraft[id];
      if (!a || !DL.TYPES[a.type]) throw new Error('That save uses an aircraft type this version does not have: ' + (a ? a.type : id) + '.');
    }
    t.frames.forEach((f, k) => {
      if (!f || typeof f !== 'object') throw new Error('Frame ' + k + ' is damaged.');
      for (const id in f) {
        const s = f[id];
        if (!t.aircraft[id]) throw new Error('Frame ' + k + ' has an aircraft that is not in the list.');
        for (const key of ['x', 'y', 'hdg', 'spd']) if (!Number.isFinite(s[key])) throw new Error('Frame ' + k + ' has a bad ' + key + '.');
        if (!s.ctl || typeof s.ctl !== 'object') throw new Error('Frame ' + k + ' is missing controls.');
      }
    });
  }

  function apply(d) {
    const t = d.timeline, frames = t.frames;
    const ids = Object.keys(t.aircraft).map(id => +id.replace(/\D/g, '')).filter(Number.isFinite);
    const events = (Array.isArray(t.events) ? t.events : []).filter(e => e && DL.EVENT_KINDS[e.kind] && t.aircraft[e.ac] && Number.isInteger(e.k) && e.k >= 0 && e.k < frames.length);
    const evNums = events.map(e => +String(e.id).replace(/\D/g, '')).filter(Number.isFinite);

    if (DL.bscope) DL.bscope.closeAll();
    DL.ui.closeVertical();
    DL.reset();
    Object.assign(DL.tl, {
      aircraft: t.aircraft, frames,
      current: Number.isInteger(t.current) ? DL.clamp(t.current, 0, frames.length - 1) : 0,
      nextId: Math.max(+t.nextId || 1, ...ids.map(n => n + 1), 1),
      counts: t.counts && typeof t.counts === 'object' ? t.counts : {},
      events,
      nextEv: Math.max(+t.nextEv || 1, ...evNums.map(n => n + 1), 1),
      dur: Array.isArray(t.dur) ? t.dur.map(v => (v > 0 ? v : undefined)) : [],
    });

    if (d.settings && typeof d.settings === 'object') {
      for (const k in DL.settings) {
        const v = d.settings[k];
        if (typeof v === typeof DL.settings[k] && (typeof v !== 'number' || Number.isFinite(v))) DL.settings[k] = v;
      }
    }
    if (d.types && typeof d.types === 'object') {
      for (const k in d.types) {
        if (!DL.TYPES[k]) continue;
        for (const f of TYPE_FIELDS) { const v = d.types[k][f]; if (Number.isFinite(v) && v > 0) DL.TYPES[k][f] = v; }
      }
    }
    const rd = DL.adv.radar, r = d.radar;
    if (r && typeof r === 'object') {
      if (typeof r.on === 'boolean') rd.on = r.on;
      if (Number.isFinite(r.rangeNm) && r.rangeNm > 0) rd.rangeNm = r.rangeNm;
      if (Number.isFinite(r.fovDeg)) rd.fovDeg = DL.clamp(r.fovDeg, 10, 360);
      if (r.who === 'selected' || r.who === 'all') rd.who = r.who;
    }
    const m = d.markers;
    if (m && typeof m === 'object') {
      if (Number.isFinite(m.shotTofSec) && m.shotTofSec > 0) DL.adv.shotTofSec = m.shotTofSec;
      if (Number.isFinite(m.gunLenFt) && m.gunLenFt > 0) DL.adv.gunLenFt = m.gunLenFt;
      if (Number.isFinite(m.flareCount) && m.flareCount > 0) DL.adv.flareCount = m.flareCount;
    }

    DL.ui.selected = null;
    DL.ui.selection = [];
    DL.ui.setScrub(0);
    const v = d.view, cam = DL.scene && DL.scene.cam;
    if (cam && v && [v.x, v.y, v.zoom].every(Number.isFinite) && v.zoom > 0) {
      cam.setZoom(v.zoom);
      cam.scrollX = v.x;
      cam.scrollY = v.y;
    } else if (DL.scene && DL.scene.fit) DL.scene.fit();
    DL.ui.buildSettings();
    DL.ui.refresh();
    if (DL.advWin) DL.advWin.refresh();
  }

  const save = {
    snapshot,

    download() {
      const blob = new Blob([JSON.stringify(snapshot())], { type: 'application/json' });
      const name = 'briefing-lines-' + stamp() + '.json';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      DL.ui.flash('Saved ' + name);
      return name;
    },

    load(text, name) {
      let d;
      try {
        d = JSON.parse(text);
        check(d);
      } catch (err) {
        DL.ui.flash(err instanceof SyntaxError ? 'That file could not be read: it is not valid JSON.' : err.message);
        return false;
      }
      if (hasContent() && !window.confirm('Replace the current debrief with ' + (name ? '"' + name + '"' : 'this file') + '? Anything not saved is lost.')) return false;
      apply(d);
      DL.ui.flash('Opened ' + (name || 'the file') + '.');
      return true;
    },

    openFile(file) {
      if (!file) return;
      if (file.size > MAX_BYTES) { DL.ui.flash('That file is too large to be a Briefing Lines save.'); return; }
      file.text().then(text => this.load(text, file.name), () => DL.ui.flash('That file could not be read.'));
    },

    init() {
      const input = $('file-open');
      $('btn-save').onclick = () => this.download();
      $('btn-open').onclick = () => input.click();
      input.onchange = () => { this.openFile(input.files[0]); input.value = ''; };
      window.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); this.download(); }
      });
      window.addEventListener('dragover', e => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault(); });
      window.addEventListener('drop', e => {
        const f = e.dataTransfer && e.dataTransfer.files[0];
        if (!f) return;
        e.preventDefault();
        this.openFile(f);
      });
    },
  };
  DL.save = save;
})(window.DL);
