(function (FI) {
  'use strict';

  const RAD = Math.PI / 180;
  const CAP = 14;

  function sp(cx, cy, rx, ry, deg, p) {
    const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD), e = 2 / p;
    return [cx + rx * Math.sign(c) * Math.pow(Math.abs(c), e), cy + ry * Math.sign(s) * Math.pow(Math.abs(s), e)];
  }
  function arc(cx, cy, rx, ry, a0, a1, p) {
    const n = Math.max(3, Math.ceil(Math.abs(a1 - a0) / 18)), pts = [];
    for (let i = 0; i <= n; i++) pts.push(sp(cx, cy, rx, ry, a0 + (a1 - a0) * i / n, p || 2.4));
    return pts;
  }
  function loop(cx, cy, rx, ry) {
    const pts = arc(cx, cy, rx, ry, 0, 360);
    pts.pop();
    pts.closed = true;
    return pts;
  }
  const L = (...pts) => pts;
  const glyph = (w, strokes, dots, a) => ({ w, a: a || w + 3, s: strokes, d: dots });

  const G = {
    ' ': glyph(0, [], null, 8),
    '0': glyph(10, [loop(5, 7, 4.7, 6.9)], null, 13),
    '1': glyph(10, [L([1.6, 3.4], [5.8, 0.3], [5.8, 14])], null, 13),
    '2': glyph(10, [arc(5, 4.4, 4.5, 4.2, 190, 385).concat([[0.8, 14], [9.8, 14]])], null, 13),
    '3': glyph(10, [arc(4.8, 3.7, 3.9, 3.5, 205, 450).concat(arc(4.8, 10.5, 4.5, 3.5, 270, 515))], null, 13),
    '4': glyph(10, [L([7.4, 14], [7.4, 0], [0.2, 10.2], [9.9, 10.2])], null, 13),
    '5': glyph(10, [L([9, 0], [1.8, 0], [1.2, 6.6]).concat(arc(5, 9.7, 4.5, 4.3, 238, 520))], null, 13),
    '6': glyph(10, [loop(5, 9.4, 4.6, 4.5), L([0.4, 9.4], [0.6, 5.4], [2, 2.2], [4.8, 0.4], [8.3, 1])], null, 13),
    '7': glyph(10, [L([0.3, 0], [9.8, 0], [3.8, 14])], null, 13),
    '8': glyph(10, [loop(5, 3.7, 3.7, 3.7), loop(5, 10.4, 4.4, 3.7)], null, 13),
    '9': glyph(10, [loop(5, 4.6, 4.6, 4.5), L([9.6, 4.6], [9.4, 8.6], [8, 11.9], [5.2, 13.6], [1.8, 13])], null, 13),

    'A': glyph(10, [L([0, 14], [5, 0], [10, 14]), L([1.9, 9.6], [8.1, 9.6])]),
    'B': glyph(10, [L([0.7, 0], [0.7, 14]),
      L([0.7, 0], [6, 0]).concat(arc(6, 3.5, 3.5, 3.5, 270, 450), [[0.7, 7]]),
      L([0.7, 7], [6.6, 7]).concat(arc(6.6, 10.5, 3.5, 3.5, 270, 450), [[0.7, 14]])]),
    'C': glyph(10, [arc(5.2, 7, 4.9, 7, 325, 35)]),
    'D': glyph(10, [L([0.7, 0], [0.7, 14]), L([0.7, 0], [4.5, 0]).concat(arc(4.5, 7, 5, 7, 270, 450), [[0.7, 14]])]),
    'E': glyph(9, [L([9.2, 0], [0.7, 0], [0.7, 14], [9.2, 14]), L([0.7, 7], [7.6, 7])], null, 12),
    'F': glyph(9, [L([9.2, 0], [0.7, 0], [0.7, 14]), L([0.7, 7], [7.6, 7])], null, 12),
    'G': glyph(10, [arc(5.2, 7, 4.9, 7, 325, 35).concat([[9.25, 11], [9.25, 7.8], [5.6, 7.8]])]),
    'H': glyph(10, [L([0.7, 0], [0.7, 14]), L([9.3, 0], [9.3, 14]), L([0.7, 7], [9.3, 7])]),
    'I': glyph(3, [L([1.5, 0], [1.5, 14])], null, 6),
    'J': glyph(9, [L([8.5, 0], [8.5, 9.5]).concat(arc(4.9, 9.5, 3.6, 4.5, 0, 160))], null, 12),
    'K': glyph(10, [L([0.7, 0], [0.7, 14]), L([9.5, 0], [0.9, 8.4]), L([3.6, 6], [9.8, 14])]),
    'L': glyph(9, [L([0.7, 0], [0.7, 14], [9, 14])], null, 12),
    'M': glyph(12, [L([0.7, 14], [0.7, 0], [6, 9.2], [11.3, 0], [11.3, 14])], null, 15),
    'N': glyph(10, [L([0.7, 14], [0.7, 0], [9.3, 14], [9.3, 0])]),
    'O': glyph(10, [loop(5.2, 7, 4.9, 7)]),
    'P': glyph(10, [L([0.7, 14], [0.7, 0], [5.8, 0]).concat(arc(5.8, 3.8, 3.8, 3.8, 270, 450), [[0.7, 7.6]])]),
    'Q': glyph(10, [loop(5.2, 7, 4.9, 7), L([6.2, 10], [10, 14.5])]),
    'R': glyph(10, [L([0.7, 14], [0.7, 0], [5.8, 0]).concat(arc(5.8, 3.8, 3.8, 3.8, 270, 450), [[0.7, 7.6]]), L([4.8, 7.6], [9.6, 14])]),
    'S': glyph(10, [arc(5, 3.7, 4.2, 3.7, 335, 90).concat(arc(5, 10.4, 4.6, 3.6, 270, 515))]),
    'T': glyph(10, [L([0, 0], [10, 0]), L([5, 0], [5, 14])]),
    'U': glyph(10, [L([0.7, 0], [0.7, 9.6]).concat(arc(5, 9.6, 4.3, 4.4, 180, 0), [[9.3, 0]])]),
    'V': glyph(10, [L([0, 0], [5, 14], [10, 0])]),
    'W': glyph(14, [L([0, 0], [3.4, 14], [7, 2.4], [10.6, 14], [14, 0])], null, 17),
    'X': glyph(10, [L([0.3, 0], [9.7, 14]), L([9.7, 0], [0.3, 14])]),
    'Y': glyph(10, [L([0, 0], [5, 7.4]), L([10, 0], [5, 7.4]), L([5, 7.4], [5, 14])]),
    'Z': glyph(10, [L([0.3, 0], [9.7, 0], [0.3, 14], [9.7, 14])]),

    '.': glyph(2, [], [[1.2, 13]], 5),
    ',': glyph(2, [L([1.4, 13], [0.4, 16.2])], [[1.4, 13]], 5),
    ':': glyph(2, [], [[1.2, 4.2], [1.2, 12.4]], 5),
    '-': glyph(7, [L([0.5, 7.2], [6.5, 7.2])], null, 10),
    '+': glyph(8, [L([4, 3.5], [4, 10.5]), L([0.5, 7], [7.5, 7])], null, 11),
    '/': glyph(8, [L([0, 14], [8, 0])], null, 10),
    '°': glyph(5, [loop(2.5, 2.6, 2.3, 2.3)], null, 8),
  };

  function measure(text) {
    let w = 0, trail = 0;
    for (const ch of text) {
      const gl = G[ch];
      if (!gl) continue;
      w += gl.a;
      trail = gl.a - gl.w;
    }
    return w - trail;
  }

  FI.VF = {
    CAP,
    width(str, size) { return measure(String(str).toUpperCase()) * size / CAP; },
    draw(g, str, x, y, size, color, o) {
      o = o || {};
      const text = String(str).toUpperCase(), k = size / CAP;
      const wu = measure(text);
      const ax = o.align === 'right' ? -wu : o.align === 'left' ? 0 : -wu / 2;
      const ay = o.base === 'top' ? 0 : o.base === 'bottom' ? -CAP : -CAP / 2;
      const rot = o.rot || 0, cr = Math.cos(rot), sr = Math.sin(rot);
      const alpha = o.alpha == null ? 1 : o.alpha;
      const lw = o.lw || Math.max(1.4, size * (o.weight || 0.14));
      const T = (u, v) => { const lx = (ax + u) * k, ly = (ay + v) * k; return { x: x + lx * cr - ly * sr, y: y + lx * sr + ly * cr }; };
      g.lineStyle(lw, color, alpha);
      let cx = 0;
      for (const ch of text) {
        const gl = G[ch];
        if (!gl) continue;
        for (const st of gl.s) g.strokePoints(st.map(p => T(cx + p[0], p[1])), !!st.closed);
        if (gl.d) {
          g.fillStyle(color, alpha);
          for (const p of gl.d) { const q = T(cx + p[0], p[1]); g.fillCircle(q.x, q.y, lw * 0.62); }
        }
        cx += gl.a;
      }
    },
  };
})(window.FI);
