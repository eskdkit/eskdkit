/* Сравнение чертежей: ядро без зависимостей от браузера (маски, выравнивание, разница, текст). */
(function (root) {
  'use strict';
  var VERSION = '0.1';

  // ---------- Маска «чернил» ----------
  // Пиксель считается линией, если хотя бы один канал темнее порога (цветные линии тоже ловятся).
  function inkMask(rgba, w, h, thr) {
    thr = thr || 200;
    var m = new Uint8Array(w * h);
    for (var i = 0, j = 0; i < m.length; i++, j += 4) {
      if (rgba[j + 3] < 128) continue;
      var r = rgba[j], g = rgba[j + 1], b = rgba[j + 2];
      var mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
      if (mn < thr) m[i] = 1;
    }
    return m;
  }

  function count(m) { var s = 0; for (var i = 0; i < m.length; i++) s += m[i]; return s; }

  // ---------- Поиск внутренней рамки ----------
  // Линии рамки — самые длинные горизонтали и вертикали листа (≥ 60 % стороны).
  function findFrame(m, w, h) {
    var rows = new Uint32Array(h), cols = new Uint32Array(w);
    for (var y = 0; y < h; y++) {
      var o = y * w, s = 0;
      for (var x = 0; x < w; x++) { var v = m[o + x]; s += v; cols[x] += v; }
      rows[y] = s;
    }
    function edges(arr, n, lim) {
      var a = -1, b = -1;
      for (var i = 0; i < n; i++) if (arr[i] >= lim) { if (a < 0) a = i; b = i; }
      return a < 0 ? null : [a, b];
    }
    var ry = edges(rows, h, 0.6 * w), cx = edges(cols, w, 0.6 * h);
    if (!ry || !cx) return null;
    if (ry[1] - ry[0] < 0.3 * h || cx[1] - cx[0] < 0.3 * w) return null;
    return { x0: cx[0], y0: ry[0], x1: cx[1], y1: ry[1] };
  }

  // ---------- Уменьшение маски (OR по блоку f×f) ----------
  function pool(m, w, h, f) {
    var W = Math.ceil(w / f), H = Math.ceil(h / f), o = new Uint8Array(W * H);
    for (var y = 0; y < h; y++) {
      var oy = ((y / f) | 0) * W, iy = y * w;
      for (var x = 0; x < w; x++) if (m[iy + x]) o[oy + ((x / f) | 0)] = 1;
    }
    return { m: o, w: W, h: H };
  }

  function inkPoints(m, w, h, maxN) {
    var n = count(m), step = Math.max(1, Math.floor(n / (maxN || 80000)));
    var pts = [], k = 0;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (m[y * w + x]) { if (k++ % step === 0) pts.push(x, y); }
    return pts;
  }

  // Доля точек B, попавших на линии A при сдвиге (dx, dy): B(x,y) → A(x+dx, y+dy)
  function score(mA, wA, hA, pts, dx, dy) {
    var hit = 0, tot = 0;
    for (var i = 0; i < pts.length; i += 2) {
      var x = pts[i] + dx, y = pts[i + 1] + dy;
      if (x < 0 || y < 0 || x >= wA || y >= hA) continue;
      tot++; if (mA[y * wA + x]) hit++;
    }
    return tot ? hit / (pts.length / 2) : 0;
  }

  function searchShift(mA, wA, hA, mB, wB, hB, dx0, dy0, R) {
    var f = 4;
    var a = pool(mA, wA, hA, f), b = pool(mB, wB, hB, f);
    var pts = inkPoints(b.m, b.w, b.h, 40000);
    var cx = Math.round(dx0 / f), cy = Math.round(dy0 / f), r = Math.ceil(R / f);
    var best = { s: -1, x: cx, y: cy };
    for (var sy = -r; sy <= r; sy++) for (var sx = -r; sx <= r; sx++) {
      var s = score(a.m, a.w, a.h, pts, cx + sx, cy + sy);
      // при равенстве предпочитаем меньший сдвиг относительно начального
      if (s > best.s + 1e-9 || (Math.abs(s - best.s) <= 1e-9 && Math.abs(sx) + Math.abs(sy) < Math.abs(best.x - cx) + Math.abs(best.y - cy))) best = { s: s, x: cx + sx, y: cy + sy };
    }
    // уточнение в полном разрешении
    var ptsF = inkPoints(mB, wB, hB, 120000);
    var fx = best.x * f, fy = best.y * f, bestF = { s: -1, x: fx, y: fy };
    for (var ty = -f; ty <= f; ty++) for (var tx = -f; tx <= f; tx++) {
      var s2 = score(mA, wA, hA, ptsF, fx + tx, fy + ty);
      if (s2 > bestF.s) bestF = { s: s2, x: fx + tx, y: fy + ty };
    }
    var s0 = score(mA, wA, hA, ptsF, Math.round(dx0), Math.round(dy0));
    return { dx: bestF.x, dy: bestF.y, score: bestF.s, score0: s0 };
  }

  // Выравнивание B относительно A. Сдвиг: точка B (x, y) соответствует точке A (x+dx, y+dy).
  function align(mA, wA, hA, mB, wB, hB, opt) {
    opt = opt || {};
    var fA = findFrame(mA, wA, hA), fB = findFrame(mB, wB, hB);
    // кандидаты начального сдвига: по рамке (правый нижний угол — основная надпись, левый верхний), по листу
    var cand = [];
    if (fA && fB) { cand.push({ dx: fA.x1 - fB.x1, dy: fA.y1 - fB.y1, method: 'frame' }); cand.push({ dx: fA.x0 - fB.x0, dy: fA.y0 - fB.y0, method: 'frame-tl' }); }
    cand.push({ dx: 0, dy: 0, method: 'page' });
    if (wA !== wB || hA !== hB) cand.push({ dx: wA - wB, dy: hA - hB, method: 'corner' });
    var seen = {}, best = null;
    cand.forEach(function (c) {
      var key = c.dx + ',' + c.dy; if (seen[key]) return; seen[key] = 1;
      var r = { dx: c.dx, dy: c.dy, method: c.method, score: null };
      if (opt.fine !== false) {
        var R = opt.search || Math.round(Math.max(wA, hA) * 0.012);
        var s = searchShift(mA, wA, hA, mB, wB, hB, c.dx, c.dy, R);
        if (s.score > s.score0 + 0.01) { r.dx = s.dx; r.dy = s.dy; r.fine = true; }
        r.score = Math.max(s.score, s.score0);
      }
      // первый кандидат (рамка по основной надписи) выигрывает при близких оценках
      if (!best || (r.score != null && r.score > best.score + 0.02)) best = r;
    });
    best.frameA = fA; best.frameB = fB;
    return best;
  }

  // ---------- Расширение маски на r пикселей (квадрат) ----------
  function dilate(m, w, h, r) {
    if (r <= 0) return m;
    var t = new Uint8Array(w * h), o = new Uint8Array(w * h), x, y, c;
    for (y = 0; y < h; y++) {
      var row = y * w; c = 0;
      for (x = 0; x < Math.min(r, w); x++) c += m[row + x];
      for (x = 0; x < w; x++) {
        if (x + r < w) c += m[row + x + r];
        if (x - r - 1 >= 0) c -= m[row + x - r - 1];
        t[row + x] = c > 0 ? 1 : 0;
      }
    }
    for (x = 0; x < w; x++) {
      c = 0;
      for (y = 0; y < Math.min(r, h); y++) c += t[y * w + x];
      for (y = 0; y < h; y++) {
        if (y + r < h) c += t[(y + r) * w + x];
        if (y - r - 1 >= 0) c -= t[(y - r - 1) * w + x];
        o[y * w + x] = c > 0 ? 1 : 0;
      }
    }
    return o;
  }

  // ---------- Разница ----------
  // Общее полотно: A в (ax, ay), B в (bx, by). Код пикселя: 0 пусто, 1 совпадает, 2 только «было», 3 только «стало».
  function diff(mA, wA, hA, mB, wB, hB, dx, dy, tol) {
    var ox = Math.min(0, dx), oy = Math.min(0, dy);
    var W = Math.max(wA, wB + dx) - ox, H = Math.max(hA, hB + dy) - oy;
    var ax = -ox, ay = -oy, bx = dx - ox, by = dy - oy;
    var a = new Uint8Array(W * H), b = new Uint8Array(W * H), x, y;
    for (y = 0; y < hA; y++) a.set(mA.subarray(y * wA, y * wA + wA), (y + ay) * W + ax);
    for (y = 0; y < hB; y++) b.set(mB.subarray(y * wB, y * wB + wB), (y + by) * W + bx);
    var da = dilate(a, W, H, tol), db = dilate(b, W, H, tol);
    var code = new Uint8Array(W * H), nRem = 0, nAdd = 0, nCom = 0;
    for (var i = 0; i < code.length; i++) {
      if (a[i]) { if (db[i]) { code[i] = 1; nCom++; } else { code[i] = 2; nRem++; } }
      else if (b[i]) { if (da[i]) { code[i] = 1; nCom++; } else { code[i] = 3; nAdd++; } }
    }
    return { W: W, H: H, ax: ax, ay: ay, bx: bx, by: by, code: code, removed: nRem, added: nAdd, common: nCom };
  }

  // ---------- Области изменений ----------
  function regions(d, opt) {
    opt = opt || {};
    var cell = opt.cell || 8, minPix = opt.minPix || 4, gap = opt.gap == null ? 2 : opt.gap;
    var W = d.W, H = d.H, gw = Math.ceil(W / cell), gh = Math.ceil(H / cell);
    var rem = new Uint32Array(gw * gh), add = new Uint32Array(gw * gh), x, y, i;
    for (y = 0; y < H; y++) {
      var gy = ((y / cell) | 0) * gw, row = y * W;
      for (x = 0; x < W; x++) {
        var c = d.code[row + x];
        if (c === 2) rem[gy + ((x / cell) | 0)]++;
        else if (c === 3) add[gy + ((x / cell) | 0)]++;
      }
    }
    var mark = new Uint8Array(gw * gh);
    for (i = 0; i < mark.length; i++) if (rem[i] + add[i] >= minPix) mark[i] = 1;
    var grow = dilate(mark, gw, gh, gap), lab = new Int32Array(gw * gh), out = [], stack = [];
    for (i = 0; i < grow.length; i++) {
      if (!grow[i] || lab[i]) continue;
      var id = out.length + 1, r = { x0: 1e9, y0: 1e9, x1: -1, y1: -1, rem: 0, add: 0 };
      lab[i] = id; stack.push(i);
      while (stack.length) {
        var k = stack.pop(), kx = k % gw, ky = (k / gw) | 0;
        if (mark[k]) {
          r.rem += rem[k]; r.add += add[k];
          if (kx < r.x0) r.x0 = kx; if (ky < r.y0) r.y0 = ky; if (kx > r.x1) r.x1 = kx; if (ky > r.y1) r.y1 = ky;
        }
        var nb = [k - 1, k + 1, k - gw, k + gw];
        for (var q = 0; q < 4; q++) {
          var n = nb[q];
          if (n < 0 || n >= grow.length) continue;
          if ((q === 0 && kx === 0) || (q === 1 && kx === gw - 1)) continue;
          if (grow[n] && !lab[n]) { lab[n] = id; stack.push(n); }
        }
      }
      if (r.x1 < 0 || r.rem + r.add < (opt.minRegion || 12)) continue;
      out.push({ x0: r.x0 * cell, y0: r.y0 * cell, x1: Math.min(W, (r.x1 + 1) * cell), y1: Math.min(H, (r.y1 + 1) * cell), removed: r.rem, added: r.add });
    }
    // порядок чтения: сверху вниз полосами, внутри полосы слева направо
    var band = Math.max(cell * 4, Math.round(H / 20));
    out.sort(function (p, q) { var a = Math.floor(p.y0 / band), b = Math.floor(q.y0 / band); return a - b || p.x0 - q.x0; });
    out.forEach(function (r, i) { r.n = i + 1; r.kind = r.added && !r.removed ? 'added' : r.removed && !r.added ? 'removed' : 'changed'; });
    return out;
  }

  // ---------- Текст ----------
  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  // Склейка соседних фрагментов одной строки в слова/фразы (часть САПР выводит текст по символам).
  // items: {s, x, y, w, h, dir} в координатах полотна (px); dir: угол поворота в градусах, округлённый
  function mergeItems(items) {
    var horiz = items.filter(function (t) { return t.dir === 0; }), other = items.filter(function (t) { return t.dir !== 0; });
    horiz.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    var lines = [];
    horiz.forEach(function (t) {
      var L = null;
      for (var i = lines.length - 1; i >= 0 && i >= lines.length - 30; i--) {
        if (Math.abs(lines[i].y - t.y) <= 0.35 * Math.max(t.h, lines[i].h)) { L = lines[i]; break; }
      }
      if (!L) { L = { y: t.y, h: t.h, items: [] }; lines.push(L); }
      L.items.push(t);
    });
    var out = [];
    lines.forEach(function (L) {
      L.items.sort(function (a, b) { return a.x - b.x; });
      var cur = null;
      L.items.forEach(function (t) {
        if (cur && t.x - (cur.x + cur.w) < 0.3 * Math.max(t.h, cur.h) && t.x - (cur.x + cur.w) > -0.5 * t.h) {
          var gap = t.x - (cur.x + cur.w);
          cur.s += (gap > 0.12 * t.h ? ' ' : '') + t.s;
          cur.w = t.x + t.w - cur.x; cur.h = Math.max(cur.h, t.h);
        } else { if (cur) out.push(cur); cur = { s: t.s, x: t.x, y: t.y, w: t.w, h: t.h, dir: 0 }; }
      });
      if (cur) out.push(cur);
    });
    return out.concat(other).map(function (t) { t.s = norm(t.s); t.cx = t.x + t.w / 2; t.cy = t.y; return t; }).filter(function (t) { return t.s; });
  }

  // tol — допуск совпадения положения (px), near — радиус, в котором удалённое и добавленное считаются заменой
  function textDiff(A, B, tol, near) {
    var byS = new Map();
    B.forEach(function (t, j) { var l = byS.get(t.s); if (!l) byS.set(t.s, l = []); l.push(j); });
    var usedB = new Uint8Array(B.length), usedA = new Uint8Array(A.length), moved = [];
    function d(a, b) { return Math.hypot(a.cx - b.cx, a.cy - b.cy); }
    // 1) тот же текст на том же месте
    A.forEach(function (a, i) {
      var l = byS.get(a.s); if (!l) return;
      var best = -1, bd = 1e18;
      l.forEach(function (j) { if (!usedB[j]) { var dd = d(a, B[j]); if (dd < bd) { bd = dd; best = j; } } });
      if (best >= 0 && bd <= tol) { usedA[i] = 1; usedB[best] = 1; }
    });
    // 2) тот же текст в другом месте — перемещён
    A.forEach(function (a, i) {
      if (usedA[i]) return;
      var l = byS.get(a.s); if (!l) return;
      var best = -1, bd = 1e18;
      l.forEach(function (j) { if (!usedB[j]) { var dd = d(a, B[j]); if (dd < bd) { bd = dd; best = j; } } });
      if (best >= 0) { usedA[i] = 1; usedB[best] = 1; moved.push({ s: a.s, from: a, to: B[best] }); }
    });
    var rem = [], add = [];
    A.forEach(function (a, i) { if (!usedA[i]) rem.push(a); });
    B.forEach(function (b, j) { if (!usedB[j]) add.push(b); });
    // 3) удалённое и добавленное рядом — изменение
    var changed = [], addUsed = new Uint8Array(add.length);
    rem = rem.filter(function (a) {
      var best = -1, bd = 1e18;
      add.forEach(function (b, j) { if (!addUsed[j]) { var dd = d(a, b); if (dd < bd) { bd = dd; best = j; } } });
      if (best >= 0 && bd <= near) { addUsed[best] = 1; changed.push({ from: a.s, to: add[best].s, a: a, b: add[best] }); return false; }
      return true;
    });
    add = add.filter(function (b, j) { return !addUsed[j]; });
    return { changed: changed, removed: rem, added: add, moved: moved };
  }

  var CMP = { VERSION: VERSION, inkMask: inkMask, findFrame: findFrame, align: align, dilate: dilate, diff: diff, regions: regions, mergeItems: mergeItems, textDiff: textDiff, count: count, pool: pool };
  if (typeof module !== 'undefined' && module.exports) module.exports = CMP; else root.CMP = CMP;
})(this);
