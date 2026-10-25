// Advanced debrief overlays: a radar sector ahead of an aircraft and event
// markers (missile shots, gun bursts, flares) placed on the timeline.
// These are drawing and bookkeeping only: geometry from the frame data,
// nothing is flown or scored.
(function (DL) {
  'use strict';

  const $ = id => document.getElementById(id);
  const fmt = n => (Math.round(n) + 0).toLocaleString('en-US');
  const hex = c => '#' + c.toString(16).padStart(6, '0');
  const NM = 6076.12;           // feet per nautical mile
  const wrap180 = a => ((a + 540) % 360) - 180;

  DL.NM = NM;

  const adv = {
    radar: { on: false, rangeNm: 10, fovDeg: 120, who: 'selected' },   // who: 'selected' | 'all'
    shotTofSec: 10,       // default time of flight for a shot marker, seconds
    gunLenFt: 2000,       // length of the gun line drawn ahead of the nose
    flareCount: 3,
  };
  DL.adv = adv;

  const KINDS = {
    shot:  { name: 'Missile shot', short: 'SHOT',   color: 0xff6b6b },
    gun:   { name: 'Gun burst',    short: 'GUNS',   color: 0xffd166 },
    flare: { name: 'Flares',       short: 'FLARES', color: 0xffb547 },
  };
  DL.EVENT_KINDS = KINDS;

  // ---------- geometry ----------
  // Position of an aircraft at a fractional frame, following the flown path.
  // Past the last frame it follows the predicted flight of that frame
  // (`pred`, a step() result for frame k, saves flying it again).
  function posAt(id, kf, pred) {
    const tl = DL.tl;
    const k = Math.min(Math.floor(kf), tl.frames.length - 1);
    const s = tl.frames[k] && tl.frames[k][id];
    if (!s) return null;
    const frac = DL.clamp(kf - k, 0, 1);
    if (frac < 1e-6) return { x: s.x, y: s.y, alt: s.alt || 0 };
    const nx = tl.frames[k + 1] && tl.frames[k + 1][id];
    const alt = nx ? (s.alt || 0) + frac * ((nx.alt || 0) - (s.alt || 0)) : s.alt || 0;
    // a hand-set next frame has a straight dashed trail
    if (nx && nx.pinned) return { x: s.x + frac * (nx.x - s.x), y: s.y + frac * (nx.y - s.y), alt };
    let path = nx && nx.path;
    if (!path) path = (pred || DL.step(tl.aircraft[id].type, s, DL.frameDur(k))).path;
    const i = Math.min(path.length - 1, Math.round(frac * (path.length - 1)));
    return { x: path[i][0], y: path[i][1], alt };
  }
  DL.posAt = posAt;

  // Radar picture for aircraft `id` at frame k (or in the given set of
  // states): every other aircraft with bearing, range, aspect and closure,
  // flagged if inside the sector.
  function radarContacts(id, k, states) {
    const tl = DL.tl;
    if (k === undefined) k = tl.current;
    const f = states || tl.frames[k];
    const own = f && f[id];
    if (!own) return [];
    const rd = adv.radar;
    const R = rd.rangeNm * NM, half = rd.fovDeg / 2;
    const h = own.hdg * DL.D2R;
    const vo = [own.spd * Math.sin(h), -own.spd * Math.cos(h)];
    const out = [];
    for (const oid in f) {
      if (oid === id) continue;
      const o = f[oid];
      const dx = o.x - own.x, dy = o.y - own.y;
      const range = Math.hypot(dx, dy);
      const brg = DL.wrap360(Math.atan2(dx, -dy) / DL.D2R);
      const rel = wrap180(brg - own.hdg);
      const oh = o.hdg * DL.D2R;
      const vt = [o.spd * Math.sin(oh), -o.spd * Math.cos(oh)];
      // aspect: angle off the contact's tail as seen from it (0 = we are dead astern)
      const bearingFromContact = DL.wrap360(Math.atan2(-dx, dy) / DL.D2R);
      const aspect = Math.abs(wrap180(bearingFromContact - o.hdg - 180));
      const rangeRate = range > 1 ? ((vt[0] - vo[0]) * dx + (vt[1] - vo[1]) * dy) / range : 0;   // kt, + opening
      out.push({
        id: oid, callsign: tl.aircraft[oid].callsign, color: o.color || tl.aircraft[oid].color,
        range, rangeNm: range / NM, brg, rel, aspect, closure: -rangeRate,
        dAlt: (o.alt || 0) - (own.alt || 0), x: o.x, y: o.y,
        detected: range <= R && Math.abs(rel) <= half,
      });
    }
    out.sort((a, b) => a.range - b.range);
    return out;
  }
  DL.radarContacts = radarContacts;

  // ---------- events ----------
  function addEvent(kind, k, ac, opts) {
    const tl = DL.tl;
    if (!tl.frames[k] || !tl.frames[k][ac]) return null;
    const ev = Object.assign({ id: 'e' + (tl.nextEv++), kind, k, ac, target: null, result: '?' }, opts || {});
    if (kind === 'shot') ev.tof = Math.max(1, ev.tof || adv.shotTofSec);
    if (kind === 'gun') ev.len = Math.max(100, ev.len || adv.gunLenFt);
    if (kind === 'flare') ev.count = DL.clamp(Math.round(ev.count || adv.flareCount), 1, 12);
    tl.events.push(ev);
    tl.events.sort((a, b) => a.k - b.k);
    return ev;
  }

  function removeEvent(id) {
    DL.tl.events = DL.tl.events.filter(e => e.id !== id);
  }

  function eventsAt(k, ac) {
    return DL.tl.events.filter(e => e.k === k && (!ac || e.ac === ac));
  }

  // Where a shot marker is at frame kc (fractional while scrubbing): launch
  // point, the point it is drawn at, progress 0..1, and the target position
  // it is heading for.
  function shotState(ev, kc) {
    const tl = DL.tl;
    const sh = tl.frames[ev.k] && tl.frames[ev.k][ev.ac];
    if (!sh) return null;
    const launch = { x: sh.x, y: sh.y, hdg: sh.hdg };
    const t0 = DL.timeAt(ev.k);
    const p = DL.clamp((DL.timeAt(kc) - t0) / ev.tof, 0, 1);
    let tgt = null;
    if (ev.target) {
      const kEnd = DL.frameAt(t0 + ev.tof);
      tgt = posAt(ev.target, Math.min(kc, kEnd));
    }
    let at, hdg = sh.hdg;
    if (tgt) {
      at = { x: launch.x + p * (tgt.x - launch.x), y: launch.y + p * (tgt.y - launch.y) };
      hdg = DL.wrap360(Math.atan2(tgt.x - launch.x, -(tgt.y - launch.y)) / DL.D2R);
    } else {
      at = launch;
    }
    return { launch, at, p, tgt, hdg, done: p >= 1 - 1e-9 };
  }

  function describe(ev) {
    const tl = DL.tl, a = tl.aircraft[ev.ac];
    const who = a ? a.callsign : '?';
    if (ev.kind === 'shot') {
      const t = ev.target && tl.aircraft[ev.target];
      return who + ' shot' + (t ? ' → ' + t.callsign : '') + ', ' + ev.tof + ' s' + (ev.result !== '?' ? ', ' + ev.result : '');
    }
    if (ev.kind === 'gun') return who + ' guns';
    return who + ' flares ×' + ev.count;
  }

  Object.assign(DL, { addEvent, removeEvent, eventsAt, shotState, describeEvent: describe });

  // ---------- Advanced window ----------
  const win = {
    init() {
      $('btn-adv').onclick = () => (this.isOpen() ? this.close() : this.open());
      $('adv-close').onclick = () => this.close();
      $('adv-radar-on').onchange = e => { adv.radar.on = e.target.checked; this.refresh(); };
      $('adv-radar-who').onchange = e => { adv.radar.who = e.target.value; this.refresh(); };
      document.querySelectorAll('[data-range]').forEach(b => {
        b.onclick = () => { adv.radar.rangeNm = +b.dataset.range; adv.radar.on = true; this.refresh(); };
      });
      $('adv-fov').onchange = e => { adv.radar.fovDeg = DL.clamp(+e.target.value || 120, 10, 360); this.refresh(); };
      $('adv-add-shot').onclick = () => {
        const id = DL.ui.selected;
        if (!id) return;
        const target = $('adv-shot-target').value || null;
        const tof = Math.max(1, +$('adv-shot-tof').value || adv.shotTofSec);
        adv.shotTofSec = tof;
        DL.addEvent('shot', DL.tl.current, id, { target, tof });
        DL.ui.refresh();
      };
      $('adv-add-gun').onclick = () => {
        const id = DL.ui.selected;
        if (!id) return;
        adv.gunLenFt = Math.max(100, +$('adv-gun-len').value || adv.gunLenFt);
        DL.addEvent('gun', DL.tl.current, id, { len: adv.gunLenFt });
        DL.ui.refresh();
      };
      $('adv-add-flare').onclick = () => {
        const id = DL.ui.selected;
        if (!id) return;
        adv.flareCount = DL.clamp(Math.round(+$('adv-flare-n').value || adv.flareCount), 1, 12);
        DL.addEvent('flare', DL.tl.current, id, { count: adv.flareCount });
        DL.ui.refresh();
      };
      $('adv-events').addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.rm) { DL.removeEvent(b.dataset.rm); DL.ui.refresh(); }
        if (b.dataset.go) { DL.tl.current = +b.dataset.go; DL.ui.refresh(); }
      });
      $('adv-events').addEventListener('change', e => {
        const sel = e.target.closest('select[data-res]');
        if (!sel) return;
        const ev = DL.tl.events.find(x => x.id === sel.dataset.res);
        if (ev) { ev.result = sel.value; DL.ui.refresh(); }
      });
      DL.ui.dragWindow($('advwin'), document.querySelector('#advwin .vw-h'));
      $('adv-shot-tof').value = adv.shotTofSec;
      $('adv-gun-len').value = adv.gunLenFt;
      $('adv-flare-n').value = adv.flareCount;
      $('adv-fov').value = adv.radar.fovDeg;
    },

    isOpen() { return $('advwin').classList.contains('open'); },

    open() {
      DL.ui.soloWindow('adv');
      const el = $('advwin');
      el.classList.add('open');
      $('btn-adv').classList.add('on');
      if (!adv.radar.on) adv.radar.on = true;
      DL.ui.layout();
      this.refresh();
    },

    close() {
      $('advwin').classList.remove('open');
      $('btn-adv').classList.remove('on');
    },

    refresh() {
      if (!this.isOpen()) return;
      const tl = DL.tl, st = DL.settings;
      const id = DL.ui.selected, s = id && DL.cur()[id], a = s && tl.aircraft[id];
      $('adv-radar-on').checked = adv.radar.on;
      $('adv-radar-who').value = adv.radar.who;
      document.querySelectorAll('[data-range]').forEach(b => b.classList.toggle('on', +b.dataset.range === adv.radar.rangeNm));
      if (document.activeElement !== $('adv-fov')) $('adv-fov').value = adv.radar.fovDeg;

      // radar picture
      const pic = $('adv-contacts');
      if (!s) {
        $('adv-own').textContent = 'Select an aircraft to see its radar picture.';
        pic.innerHTML = '';
      } else {
        $('adv-own').innerHTML = `<span class="sw" style="background:${hex(s.color || a.color)}"></span>${a.callsign} · frame ${tl.current} · ` +
          `${String(Math.round(s.hdg)).padStart(3, '0')}° · ${fmt(s.spd)} kt · ${fmt(s.alt || 0)} ft`;
        const cs = radarContacts(id);
        if (!cs.length) pic.innerHTML = '<div class="dim">No other aircraft on the grid.</div>';
        else {
          pic.innerHTML = '<table><thead><tr><th></th><th>Brg</th><th>Rng nm</th><th>Aspect</th><th>Closure</th><th>Δalt</th></tr></thead><tbody>' +
            cs.map(c => `<tr class="${c.detected ? 'hit' : 'miss'}"><td><span class="sw" style="background:${hex(c.color)}"></span>${c.callsign}</td>` +
              `<td>${String(Math.round(c.brg)).padStart(3, '0')}° <small>${c.rel >= 0 ? 'R' : 'L'}${Math.abs(Math.round(c.rel))}</small></td>` +
              `<td>${c.rangeNm < 10 ? c.rangeNm.toFixed(1) : Math.round(c.rangeNm)}</td>` +
              `<td>${Math.round(c.aspect)}°</td><td>${(c.closure >= 0 ? '+' : '') + fmt(c.closure)} kt</td>` +
              `<td>${(c.dAlt >= 0 ? '+' : '') + fmt(c.dAlt)}</td></tr>`).join('') +
            '</tbody></table><div class="dim">Bright rows are inside the ' + adv.radar.fovDeg + '° sector within ' + adv.radar.rangeNm + ' nm. Aspect 0° = looking at its tail.</div>';
        }
      }

      // add-event controls
      const tgt = $('adv-shot-target');
      const others = s ? Object.keys(DL.cur()).filter(o => o !== id) : [];
      const keep = tgt.value;
      tgt.innerHTML = '<option value="">no target</option>' + others.map(o => `<option value="${o}">${tl.aircraft[o].callsign}</option>`).join('');
      if (others.includes(keep)) tgt.value = keep; else if (others.length) tgt.value = others[0];
      ['adv-add-shot', 'adv-add-gun', 'adv-add-flare'].forEach(b => { $(b).disabled = !s; });
      $('adv-at').textContent = s ? 'Add for ' + a.callsign + ' at frame ' + tl.current + ' (T+' + DL.fmtSec(DL.timeAt(tl.current)) + 's)' : 'Select an aircraft to add events.';

      // timeline list
      const list = $('adv-events');
      if (!tl.events.length) { list.innerHTML = '<div class="dim">No events yet.</div>'; return; }
      list.innerHTML = tl.events.map(ev => {
        const k = KINDS[ev.kind], ac = tl.aircraft[ev.ac];
        const res = ev.kind === 'shot' ? `<select data-res="${ev.id}"><option value="?" ${ev.result === '?' ? 'selected' : ''}>?</option><option value="hit" ${ev.result === 'hit' ? 'selected' : ''}>hit</option><option value="miss" ${ev.result === 'miss' ? 'selected' : ''}>miss</option></select>` : '';
        return `<div class="ev ${ev.k === tl.current ? 'now' : ''}"><span class="sw" style="background:${hex(k.color)}"></span>` +
          `<b>F${ev.k}</b> <span>${describe(ev).replace(ac ? ac.callsign : '', `<i style="color:${hex(ac ? DL.colorAt(ev.k, ev.ac) : 0xffffff)}">${ac ? ac.callsign : '?'}</i>`)}</span>` +
          `${res}<button data-go="${ev.k}" title="Go to this frame">go</button><button data-rm="${ev.id}" title="Remove">×</button></div>`;
      }).join('');
    },
  };
  DL.advWin = win;
})(window.DL);
