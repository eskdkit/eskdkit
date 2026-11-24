/* Пустые листы ЕСКД: рамка, дополнительные графы и основные надписи форм 1, 2, 2а по ГОСТ Р 2.104-2023.
   Одна геометрия (мм, начало — левый нижний угол листа) рисуется в PDF и собирается в DOCX
   (рамка — фигурой в колонтитуле, основная надпись и графы — таблицами с точными размерами). Без сети. */
(function (root) {
  'use strict';
  var PT = 72 / 25.4, TW = 1440 / 25.4;
  var FORMATS = {
    A4: { name: 'А4', w: 210, h: 297, portraitOnly: true },
    A3: { name: 'А3', w: 297, h: 420 },
    A2: { name: 'А2', w: 420, h: 594 },
    A1: { name: 'А1', w: 594, h: 841 },
    A0: { name: 'А0', w: 841, h: 1189 }
  };
  var DOCX_OK = { A4: 1, A3: 1 }; // Word не открывает листы больше 558,8 мм
  var K = 'K', N = 'n'; // толщина линии: основная / тонкая

  function str(v) { return v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); }

  function sheet(fmt, orient) {
    var f = FORMATS[fmt] || FORMATS.A4, land = orient === 'L' && !f.portraitOnly;
    var W = land ? f.h : f.w, H = land ? f.w : f.h;
    return { fmt: fmt, name: f.name, orient: land ? 'L' : 'P', W: W, H: H, fx0: 20, fy0: 5, fx1: W - 5, fy1: H - 5 };
  }

  /* Основные надписи в собственных координатах: x 0…185 от левого края надписи, y от низа рамки вверх. */
  function leftBlock(G, top, rows, head, signs) {
    var xs = [0, 7, 17, 40, 55, 65];
    for (var i = 0; i <= rows; i++) {
      var y = top - i * 5;
      G.l(0, y, 65, y, (i === 0 || i === rows || i === head || i === head + 1) ? K : N);
    }
    xs.forEach(function (x, k) {
      if (k === 0) return;
      if (signs && k === 1) G.l(x, top, x, top - (head + 1) * 5, K); else G.l(x, top, x, top - rows * 5, K);
    });
    var hy = top - (head + 1) * 5;
    ['Изм.', 'Лист', '№ докум.', 'Подп.', 'Дата'].forEach(function (t, k) { G.t(t, xs[k], hy, xs[k + 1], hy + 5, 8); });
    (signs || []).forEach(function (s, k) {
      var y1 = hy - k * 5, y0 = y1 - 5;
      G.t(s[0] || '', 0, y0, 17, y1, 8, { al: 'l' });
      G.t(s[1] || '', 17, y0, 40, y1, 8.5, { al: 'l', field: 1 });
      G.t('', 40, y0, 55, y1, 8, { field: 1 }); G.t('', 55, y0, 65, y1, 8, { field: 1 });
    });
  }

  function signRows(m, five) {
    var r = [['Разраб.', m.razrab], ['Пров.', m.prov], [m.l3 != null ? m.l3 : (five ? '' : 'Т. контр.'), m.r3]];
    if (!five) r.push(['', '']);
    r.push(['Н. контр.', m.nkontr], ['Утв.', m.utv]);
    return r;
  }

  function form1(G, m, sh) {
    var TOP = 55;
    G.l(0, 0, 185, 0, K); G.l(185, 0, 185, TOP, K); G.l(0, TOP, 185, TOP, K); G.l(0, 0, 0, TOP, K);
    leftBlock(G, TOP, 11, 4, signRows(m, false));
    G.l(65, TOP - 15, 185, TOP - 15, K);
    G.l(175, TOP, 175, TOP - 15, K); G.l(175, TOP - 5, 185, TOP - 5, N);
    G.t('Вер.', 175, TOP - 5, 185, TOP, 6.5); G.t(m.ver || '', 175, TOP - 15, 185, TOP - 5, 9, { field: 1 });
    G.t(m.desig || '', 65, TOP - 15, 175, TOP, 17, { field: 1 });
    var RX = 135;
    G.l(RX, 0, RX, TOP - 15, K); G.l(65, 15, RX, 15, K);
    G.t(m.name || '', 65, 15, RX, TOP - 15, 13, { field: 1, wrap: true, sub: m.kind });
    G.t(m.material || '', 65, 0, RX, 15, 11, { field: 1, wrap: true });
    var r1 = TOP - 20, r2 = TOP - 35, r3 = TOP - 40;
    G.l(RX, r1, 185, r1, K); G.l(RX, r2, 185, r2, K); G.l(RX, r3, 185, r3, K);
    G.l(RX + 15, TOP - 15, RX + 15, r2, K); G.l(RX + 32, TOP - 15, RX + 32, r2, K);
    G.l(RX + 5, r1, RX + 5, r2, N); G.l(RX + 10, r1, RX + 10, r2, N);
    G.l(RX + 20, r2, RX + 20, r3, K);
    G.t('Лит.', RX, r1, RX + 15, TOP - 15, 8); G.t('Масса', RX + 15, r1, RX + 32, TOP - 15, 8); G.t('Масштаб', RX + 32, r1, 185, TOP - 15, 8);
    var lit = str(m.lit);
    [0, 1, 2].forEach(function (i) { G.t(i === 0 ? lit : '', RX + i * 5, r2, RX + 5 + i * 5, r1, 9, { field: 1 }); });
    G.t(m.mass || '', RX + 15, r2, RX + 32, r1, 12, { field: 1 }); G.t(m.scale || '', RX + 32, r2, 185, r1, 12, { field: 1 });
    G.t('Лист' + (sh.num ? ' ' + sh.n : ''), RX, r3, RX + 20, r2, 8, { al: 'l', field: 1 });
    G.t('Листов' + (sh.num && sh.total ? ' ' + sh.total : ''), RX + 20, r3, 185, r2, 8, { al: 'l', field: 1 });
    G.t(m.org || '', RX, 0, 185, r3, 11, { field: 1, wrap: true });
  }

  function form2(G, m, sh) {
    var top = 40;
    G.l(0, 0, 185, 0, K); G.l(185, 0, 185, top, K); G.l(0, top, 185, top, K); G.l(0, 0, 0, top, K);
    leftBlock(G, top, 8, 2, signRows(m, true));
    G.l(65, top - 15, 185, top - 15, K);
    G.l(175, top, 175, top - 15, K); G.l(175, top - 5, 185, top - 5, N);
    G.t('Вер.', 175, top - 5, 185, top, 7.5); G.t(m.ver || '', 175, top - 15, 185, top - 5, 9, { field: 1 });
    G.t(m.desig || '', 65, top - 15, 175, top, 17, { field: 1 });
    G.l(135, 0, 135, top - 15, K);
    G.t(m.name || '', 65, 0, 135, top - 15, 13, { field: 1, wrap: true, sub: m.docName });
    G.l(135, top - 20, 185, top - 20, K); G.l(135, top - 25, 185, top - 25, K);
    G.l(150, top - 25, 150, top - 15, K); G.l(165, top - 25, 165, top - 15, K);
    G.l(140, top - 25, 140, top - 20, N); G.l(145, top - 25, 145, top - 20, N);
    G.t('Лит.', 135, top - 20, 150, top - 15, 8); G.t('Лист', 150, top - 20, 165, top - 15, 8); G.t('Листов', 165, top - 20, 185, top - 15, 8);
    var lit = str(m.lit);
    [0, 1, 2].forEach(function (i) { G.t(i === 0 ? lit : '', 135 + i * 5, top - 25, 140 + i * 5, top - 20, 9, { field: 1 }); });
    G.t(sh.num && (sh.total > 1 || typeof sh.total === 'string') ? String(sh.n) : '', 150, top - 25, 165, top - 20, 9, { field: 1 });
    G.t(sh.num && sh.total ? String(sh.total) : '', 165, top - 25, 185, top - 20, 9, { field: 1 });
    G.t(m.org || '', 135, 0, 185, top - 25, 10, { field: 1, wrap: true });
  }

  function form2a(G, m, sh) {
    var top = 15;
    G.l(0, 0, 185, 0, K); G.l(185, 0, 185, top, K); G.l(0, top, 185, top, K); G.l(0, 0, 0, top, K);
    leftBlock(G, top, 3, 2, null);
    [0, 1].forEach(function (r) { [[0, 7], [7, 17], [17, 40], [40, 55], [55, 65]].forEach(function (c) { G.t('', c[0], top - (r + 1) * 5, c[1], top - r * 5, 8, { field: 1 }); }); });
    G.l(165, 0, 165, top, K); G.l(175, 0, 175, top, K); G.l(165, top - 5, 185, top - 5, N);
    G.t('Вер.', 165, top - 5, 175, top, 7.5); G.t('Лист', 175, top - 5, 185, top, 7.5);
    G.t(m.ver || '', 165, 0, 175, top - 5, 9, { field: 1 });
    G.t(sh.num ? String(sh.n) : '', 175, 0, 185, top - 5, 10, { field: 1 });
    G.t(m.desig || '', 65, 0, 165, top, 17, { field: 1 });
  }

  /* Лист целиком. opt: fmt, orient, form '1'|'2'|'2a', graphic (графа 26), side (доп. графы), sideTop (графы 24–25),
     n, total, num (нумеровать), meta */
  function build(opt) {
    var S = sheet(opt.fmt, opt.orient), m = opt.meta || {};
    var out = { S: S, lines: [], texts: [], regions: {} };
    function mk(dx, dy) {
      return {
        l: function (x1, y1, x2, y2, w) { out.lines.push([x1 + dx, y1 + dy, x2 + dx, y2 + dy, w]); },
        t: function (t, x0, y0, x1, y1, s, o) { o = o || {}; out.texts.push({ t: str(t), x0: x0 + dx, y0: y0 + dy, x1: x1 + dx, y1: y1 + dy, s: s, rot: o.rot || 0, al: o.al || 'c', field: !!o.field, wrap: !!o.wrap, sub: str(o.sub) }); }
      };
    }
    var P = mk(0, 0);
    // рамка
    P.l(S.fx0, S.fy0, S.fx1, S.fy0, K); P.l(S.fx1, S.fy0, S.fx1, S.fy1, K); P.l(S.fx1, S.fy1, S.fx0, S.fy1, K); P.l(S.fx0, S.fy1, S.fx0, S.fy0, K);
    out.regions.frame = [S.fx0, S.fy0, S.fx1, S.fy1];
    // основная надпись
    var form = opt.form || '1', X = S.fx1 - 185, G = mk(X, S.fy0), sh = { n: opt.fields ? '{PAGE}' : opt.n || 1, total: opt.fields ? '{NUMPAGES}' : opt.total || 1, num: opt.num !== false };
    if (form === '1') form1(G, m, sh); else if (form === '2') form2(G, m, sh); else form2a(G, m, sh);
    out.regions.tb = [X, S.fy0, S.fx1, S.fy0 + (form === '1' ? 55 : form === '2' ? 40 : 15)];
    // дополнительные графы 19–23
    if (opt.side !== false) {
      var x0 = 8, xm = 13, x1 = S.fx0, y = S.fy0;
      P.l(x0, y, x0, y + 145, K); P.l(xm, y, xm, y + 145, K); P.l(x0, y, x1, y, K);
      [['Инв. № подл.', 25, m.invPodl], ['Подп. и дата', 35, ''], ['Взам. инв. №', 25, m.vzamInv], ['Инв. № дубл.', 25, ''], ['Подп. и дата', 35, '']].forEach(function (g) {
        P.l(x0, y + g[1], x1, y + g[1], K);
        P.t(g[0], x0, y, xm, y + g[1], 7.5, { rot: 90 }); P.t(g[2] || '', xm, y, x1, y + g[1], 9, { rot: 90, field: 1 });
        y += g[1];
      });
      out.regions.side = [x0, S.fy0, x1, S.fy0 + 145];
      // графы 24–25 — только на первом листе
      if (opt.sideTop) {
        var t = S.fy1;
        P.l(x0, t - 120, x0, t, K); P.l(xm, t - 120, xm, t, K); P.l(x0, t, x1, t, K); P.l(x0, t - 60, x1, t - 60, K); P.l(x0, t - 120, x1, t - 120, K);
        P.t('Перв. примен.', x0, t - 60, xm, t, 7.5, { rot: 90 }); P.t(m.pervPrimen || '', xm, t - 60, x1, t, 9, { rot: 90, field: 1 });
        P.t('Справ. №', x0, t - 120, xm, t - 60, 7.5, { rot: 90 }); P.t(m.spravN || '', xm, t - 120, x1, t - 60, 9, { rot: 90, field: 1 });
        out.regions.sideTop = [x0, t - 120, x1, t];
      }
    }
    // графа 26 — для графических документов
    if (opt.graphic) {
      P.l(S.fx0, S.fy1 - 14, S.fx0 + 70, S.fy1 - 14, K); P.l(S.fx0 + 70, S.fy1 - 14, S.fx0 + 70, S.fy1, K);
      P.t(m.desig || '', S.fx0, S.fy1 - 14, S.fx0 + 70, S.fy1, 14, { rot: 180, field: 1 });
      out.regions.g26 = [S.fx0, S.fy1 - 14, S.fx0 + 70, S.fy1];
    }
    // «Копировал», «Формат»
    out.copy = [{ t: 'Копировал', x0: S.fx1 - 85, y0: 0, x1: S.fx1 - 55, y1: S.fy0 }, { t: 'Формат ' + S.name, x0: S.fx1 - 30, y0: 0, x1: S.fx1, y1: S.fy0 }];
    return out;
  }

  /* ---------- PDF ---------- */
  async function renderPdf(PDFLib, fontkit, fontBytes, sheets, info) {
    var doc = await PDFLib.PDFDocument.create();
    doc.registerFontkit(fontkit);
    var font = await doc.embedFont(fontBytes, { subset: true });
    var fk = font.embedder && font.embedder.font;
    function clean(t) { t = str(t); if (!fk || !fk.hasGlyphForCodePoint) return t; var o = ''; for (var ch of t) o += fk.hasGlyphForCodePoint(ch.codePointAt(0)) ? ch : '?'; return o; }
    function wid(t, s) { return font.widthOfTextAtSize(clean(t), s) / PT; }
    function wrap(text, w, s) {
      var words = clean(text).split(' '), lines = [], cur = '';
      words.forEach(function (x) { var c = cur ? cur + ' ' + x : x; if (!cur || wid(c, s) <= w) cur = c; else { lines.push(cur); cur = x; } });
      if (cur) lines.push(cur); return lines;
    }
    var rgb = PDFLib.rgb(0, 0, 0), deg = PDFLib.degrees;
    var W = { K: 0.6 * PT, n: 0.25 * PT };
    var form = doc.getForm ? doc.getForm() : null, fieldNo = 0;
    sheets.forEach(function (g) {
      var S = g.S, p = doc.addPage([S.W * PT, S.H * PT]);
      g.lines.forEach(function (l) {
        var h = l[1] === l[3], v = l[0] === l[2], e = l[4] === K ? 0.3 : 0.125;
        // продлеваем основные линии на половину толщины, чтобы углы смыкались
        var x1 = l[0], y1 = l[1], x2 = l[2], y2 = l[3];
        if (h) { var a = Math.min(x1, x2) - e, b = Math.max(x1, x2) + e; x1 = a; x2 = b; }
        if (v) { var c = Math.min(y1, y2) - e, d = Math.max(y1, y2) + e; y1 = c; y2 = d; }
        p.drawLine({ start: { x: x1 * PT, y: y1 * PT }, end: { x: x2 * PT, y: y2 * PT }, thickness: W[l[4]], color: rgb });
      });
      function T(text, x, y, s, rot) {
        if (rot === 90) p.drawText(text, { x: x * PT, y: y * PT, size: s, font: font, color: rgb, rotate: deg(90) });
        else if (rot === 180) p.drawText(text, { x: x * PT, y: y * PT, size: s, font: font, color: rgb, rotate: deg(180) });
        else p.drawText(text, { x: x * PT, y: y * PT, size: s, font: font, color: rgb });
      }
      g.texts.concat(g.copy.map(function (c) { return { t: c.t, x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1, s: 8, al: 'l', rot: 0 }; })).forEach(function (o) {
        var t = clean(o.t); if (!t && !o.sub) return;
        var bw = o.rot === 90 ? o.y1 - o.y0 : o.x1 - o.x0, bh = o.rot === 90 ? o.x1 - o.x0 : o.y1 - o.y0;
        var lines;
        if (o.wrap) {
          lines = (t ? wrap(t, bw - 2, o.s) : []).map(function (x) { return { t: x, s: o.s }; });
          if (o.sub) lines = lines.concat(wrap(o.sub, bw - 2, o.s - 2).map(function (x) { return { t: x, s: o.s - 2 }; }));
          while (lines.length > 1 && lines.reduce(function (a, l) { return a + l.s / PT * 1.25; }, 0) > bh - 1) lines.pop();
        } else lines = [{ t: t, s: o.s }];
        var lh = lines.map(function (l) { return l.s / PT * 1.25; }), tot = lh.reduce(function (a, b) { return a + b; }, 0);
        var off = tot / 2;
        lines.forEach(function (l, i) {
          var s = l.s, w = wid(l.t, s);
          if (w > bw - 1) { s = Math.max(s * 0.55, s * (bw - 1) / w); w = wid(l.t, s); }
          var cap = s / PT * 0.72, mid = off - lh[i] / 2; off -= lh[i];
          if (o.rot === 90) {
            var cx = (o.x0 + o.x1) / 2 - mid + cap / 2, sy = o.al === 'l' ? o.y0 + 0.7 : (o.y0 + o.y1) / 2 - w / 2;
            T(l.t, cx, sy, s, 90);
          } else if (o.rot === 180) {
            var cy = (o.y0 + o.y1) / 2 + mid + cap / 2, sx = (o.x0 + o.x1) / 2 + w / 2;
            T(l.t, sx, cy, s, 180);
          } else {
            var by = (o.y0 + o.y1) / 2 + mid - cap / 2, bx = o.al === 'l' ? o.x0 + 0.7 : (o.x0 + o.x1) / 2 - w / 2;
            T(l.t, bx, by, s, 0);
          }
        });
      });
    });
    info = info || {};
    doc.setTitle(str(info.title) || 'Бланк ЕСКД');
    doc.setCreator('eskdkit.ru — пустые рамки ЕСКД');
    doc.setProducer('pdf-lib');
    var fixed = new Date(Date.UTC(2026, 0, 1));
    doc.setCreationDate(fixed); doc.setModificationDate(fixed);
    return await doc.save();
  }

  /* ---------- DOCX ---------- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function tw(mm) { return Math.round(mm * TW); }
  var BSZ = { K: 12, n: 4 };

  // таблица из линий внутри прямоугольника: сетка по всем координатам линий, объединение по отсутствию линий
  function regionTable(g, rect, opt) {
    opt = opt || {};
    var rx0 = rect[0], ry0 = rect[1], rx1 = rect[2], ry1 = rect[3], eps = 0.01;
    var inR = function (l) { return Math.min(l[0], l[2]) >= rx0 - eps && Math.max(l[0], l[2]) <= rx1 + eps && Math.min(l[1], l[3]) >= ry0 - eps && Math.max(l[1], l[3]) <= ry1 + eps; };
    var L = g.lines.filter(inR);
    var V = L.filter(function (l) { return Math.abs(l[0] - l[2]) < eps; }), H = L.filter(function (l) { return Math.abs(l[1] - l[3]) < eps; });
    function uniq(a) { a = a.slice().sort(function (p, q) { return p - q; }); return a.filter(function (v, i) { return i === 0 || v - a[i - 1] > 0.05; }); }
    var xs = uniq([rx0, rx1].concat(V.map(function (l) { return l[0]; }))), ys = uniq([ry0, ry1].concat(H.map(function (l) { return l[1]; }))).reverse(); // сверху вниз
    function vAt(x, ya, yb) { var lo = Math.min(ya, yb), hi = Math.max(ya, yb), best = null; V.forEach(function (l) { if (Math.abs(l[0] - x) < 0.05 && Math.min(l[1], l[3]) <= lo + eps && Math.max(l[1], l[3]) >= hi - eps) best = best === K ? K : l[4]; }); return best; }
    function hAt(y, xa, xb) { var lo = Math.min(xa, xb), hi = Math.max(xa, xb), best = null; H.forEach(function (l) { if (Math.abs(l[1] - y) < 0.05 && Math.min(l[0], l[2]) <= lo + eps && Math.max(l[0], l[2]) >= hi - eps) best = best === K ? K : l[4]; }); return best; }
    var nR = ys.length - 1, nC = xs.length - 1, rows = [];
    for (var r = 0; r < nR; r++) {
      var yt = ys[r], yb = ys[r + 1], cells = [], c = 0;
      while (c < nC) {
        var e = c + 1;
        while (e < nC && !vAt(xs[e], yt, yb)) e++;
        cells.push({ c0: c, c1: e, x0: xs[c], x1: xs[e], yt: yt, yb: yb });
        c = e;
      }
      rows.push(cells);
    }
    // вертикальное объединение: одинаковые колонки и нет горизонтальной линии
    for (r = 1; r < nR; r++) rows[r].forEach(function (cell) {
      var up = rows[r - 1].filter(function (u) { return u.c0 === cell.c0 && u.c1 === cell.c1; })[0];
      if (up && !hAt(ys[r], cell.x0, cell.x1)) { cell.cont = true; cell.head = up.head || up; cell.head.merged = true; up.below = true; }
    });
    // тексты — в ячейку, содержащую центр (с учётом объединения)
    rows.forEach(function (cells) { cells.forEach(function (cell) { if (!cell.cont) { cell.texts = []; cell.mb = cell.yb; } else cell.head.mb = cell.yb; }); });
    g.texts.forEach(function (t) {
      var cx = (t.x0 + t.x1) / 2, cy = (t.y0 + t.y1) / 2;
      if (cx < rx0 || cx > rx1 || cy < ry0 || cy > ry1) return;
      rows.forEach(function (cells) { cells.forEach(function (cell) { if (!cell.cont && cx > cell.x0 && cx < cell.x1 && cy < cell.yt && cy > cell.mb) cell.texts.push(t); }); });
    });
    // границы
    rows.forEach(function (cells) {
      cells.forEach(function (cell) {
        cell.b = { top: cell.cont ? null : hAt(cell.yt, cell.x0, cell.x1), bottom: cell.below ? null : hAt(cell.yb, cell.x0, cell.x1), left: vAt(cell.x0, cell.yt, cell.yb), right: vAt(cell.x1, cell.yt, cell.yb) };
      });
    });
    return { xs: xs, ys: ys, rows: rows };
  }

  function runXml(text, s, font, o) {
    o = o || {};
    if (/\{(PAGE|NUMPAGES)\}/.test(text)) return text.split(/(\{(?:PAGE|NUMPAGES)\})/).filter(Boolean).map(function (part) {
      var m = /^\{(PAGE|NUMPAGES)\}$/.exec(part);
      return m ? '<w:fldSimple w:instr=" ' + m[1] + ' ">' + runXml('1', s, font, o) + '</w:fldSimple>' : runXml(part, s, font, o);
    }).join('');
    return '<w:r><w:rPr><w:rFonts w:ascii="' + esc(font) + '" w:hAnsi="' + esc(font) + '" w:cs="' + esc(font) + '"/>' + (o.i ? '<w:i/>' : '') +
      '<w:sz w:val="' + Math.round(s * 2) + '"/><w:szCs w:val="' + Math.round(s * 2) + '"/></w:rPr><w:t xml:space="preserve">' + esc(text) + '</w:t></w:r>';
  }
  function parXml(text, s, font, al, o) {
    o = o || {};
    return '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>' + '<w:ind w:left="' + (al === 'l' ? tw(0.7) : 0) + '" w:right="0" w:firstLine="0"/>' +
      '<w:jc w:val="' + (al === 'l' ? 'left' : 'center') + '"/><w:rPr><w:sz w:val="' + Math.round(s * 2) + '"/></w:rPr></w:pPr>' + (text ? runXml(text, s, font, o) : '') + '</w:p>';
  }

  function tableXml(T, o) {
    o = o || {};
    var font = o.font || 'Arial', ital = !!o.italic;
    var cols = [], acc = 0;
    for (var i = 0; i < T.xs.length - 1; i++) { var a = tw(T.xs[i + 1] - T.xs[0]); cols.push(a - acc); acc = a; }
    var tblPr = '<w:tblPr>' + (o.float ? '<w:tblpPr w:leftFromText="0" w:rightFromText="0" w:topFromText="0" w:bottomFromText="0" w:vertAnchor="page" w:horzAnchor="page" w:tblpX="' + tw(o.float.x) + '" w:tblpY="' + tw(o.float.y) + '"/><w:tblOverlap w:val="overlap"/>' : '') +
      '<w:tblW w:w="' + acc + '" w:type="dxa"/>' + (o.ind != null ? '<w:tblInd w:w="' + tw(o.ind) + '" w:type="dxa"/>' : '') +
      '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>' +
      '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>' +
      '<w:tblLook w:val="0000"/></w:tblPr>';
    var grid = '<w:tblGrid>' + cols.map(function (c) { return '<w:gridCol w:w="' + c + '"/>'; }).join('') + '</w:tblGrid>';
    var accY = 0, body = '';
    T.rows.forEach(function (cells, r) {
      var b = tw(T.ys[0] - T.ys[r + 1]), h = b - accY; accY = b;
      body += '<w:tr><w:trPr><w:trHeight w:val="' + h + '" w:hRule="exact"/><w:cantSplit/></w:trPr>';
      cells.forEach(function (cell) {
        var w = 0; for (var k = cell.c0; k < cell.c1; k++) w += cols[k];
        var bd = function (side, v) { return v ? '<w:' + side + ' w:val="single" w:sz="' + BSZ[v] + '" w:space="0" w:color="000000"/>' : '<w:' + side + ' w:val="nil"/>'; };
        var head = cell.cont ? cell.head : cell, rot = head.texts && head.texts[0] && head.texts[0].rot === 90;
        body += '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + (cell.c1 - cell.c0 > 1 ? '<w:gridSpan w:val="' + (cell.c1 - cell.c0) + '"/>' : '') +
          (cell.cont ? '<w:vMerge/>' : (cell.merged ? '<w:vMerge w:val="restart"/>' : '')) +
          '<w:tcBorders>' + bd('top', cell.b.top) + bd('left', cell.b.left) + bd('bottom', cell.b.bottom) + bd('right', cell.b.right) + '</w:tcBorders>' +
          (rot ? '<w:textDirection w:val="btLr"/>' : '') + '<w:vAlign w:val="center"/></w:tcPr>';
        var ps = '';
        if (!cell.cont) (cell.texts || []).forEach(function (t) {
          if (t.rot === 180) return; // повёрнутый на 180° текст в ячейке Word не поддерживает
          ps += parXml(t.t, t.s, font, t.al, { i: ital });
          if (t.sub) ps += parXml(t.sub, t.s - 2, font, t.al, { i: ital });
        });
        body += (ps || parXml('', 8, font, 'c')) + '</w:tc>';
      });
      body += '</w:tr>';
    });
    return '<w:tbl>' + tblPr + grid + body + '</w:tbl>';
  }

  var NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"';
  var TINY = '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>';

  function headerXml(g, o) {
    var S = g.S, pt = function (mm) { return (mm * PT).toFixed(2) + 'pt'; };
    var f = g.regions.frame;
    var rect = '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="2"/></w:rPr><w:pict>' +
      '<v:rect id="eskdFrame" o:spid="_x0000_s1025" style="position:absolute;margin-left:' + pt(f[0]) + ';margin-top:' + pt(S.H - f[3]) + ';width:' + pt(f[2] - f[0]) + ';height:' + pt(f[3] - f[1]) +
      ';z-index:-251658240;mso-position-horizontal-relative:page;mso-position-vertical-relative:page" filled="f" strokecolor="black" strokeweight="1.7pt"><w10:wrap anchorx="page" anchory="page"/></v:rect>' +
      '</w:pict></w:r></w:p>';
    var parts = [rect];
    ['side', 'sideTop', 'g26'].forEach(function (k) {
      var R = g.regions[k]; if (!R) return;
      // у графы 26 рамка совпадает с линиями рамки листа — рисуем только свои стороны
      var T = regionTable(g, R);
      parts.push(tableXml(T, { font: o.font, italic: o.italic, float: { x: R[0], y: S.H - R[3] } }));
      parts.push(TINY);
    });
    // «Копировал» и «Формат» — таблица без линий под рамкой
    var cp = g.copy, xs = [cp[0].x0, cp[0].x1, cp[1].x0, cp[1].x1];
    var CT = { xs: xs, ys: [S.fy0, 0], rows: [[
      { c0: 0, c1: 1, x0: xs[0], x1: xs[1], yt: S.fy0, yb: 0, b: {}, texts: [{ t: cp[0].t, s: 8, al: 'c' }] },
      { c0: 1, c1: 2, x0: xs[1], x1: xs[2], yt: S.fy0, yb: 0, b: {}, texts: [] },
      { c0: 2, c1: 3, x0: xs[2], x1: xs[3], yt: S.fy0, yb: 0, b: {}, texts: [{ t: cp[1].t, s: 8, al: 'c' }] }]] };
    parts.push(tableXml(CT, { font: o.font, italic: o.italic, float: { x: xs[0], y: S.H - S.fy0 } }));
    parts.push(TINY);
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ' + NS + ' xmlns:w10="urn:schemas-microsoft-com:office:word">' + parts.join('') + '</w:hdr>';
  }

  function footerXml(g, o, leftMargin) {
    var S = g.S, R = g.regions.tb, T = regionTable(g, R);
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ' + NS + '>' + tableXml(T, { font: o.font, italic: o.italic, ind: R[0] - leftMargin }) + TINY + '</w:ftr>';
  }

  // first — геометрия первого листа, next — последующих (или null, если все листы одинаковы)
  function buildDocx(first, next, o) {
    o = o || {};
    var S = first.S, lm = S.fx0 + 5, rm = S.W - S.fx1 + 5;
    var topM = S.fy0 + (first.regions.g26 ? 14 : 0) + 5, botM = S.fy0 + (next ? next.regions.tb[3] - next.regions.tb[1] : first.regions.tb[3] - first.regions.tb[1]) + 5;
    var tinyH = 20 / 1440 * 25.4;
    var files = {};
    files['[Content_Types].xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
      '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
      (next ? '<Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : '') +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';
    files['_rels/.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>';
    files['docProps/core.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + esc(o.title || 'Бланк ЕСКД') + '</dc:title><dc:creator>eskdkit.ru</dc:creator></cp:coreProperties>';
    var rels = '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' +
      (next ? '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/><Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer2.xml"/>' : '');
    files['word/_rels/document.xml.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + '</Relationships>';
    var font = o.font || 'Arial', bodySz = Math.round((o.bodyPt || 12) * 2);
    files['word/styles.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="' + esc(font) + '" w:hAnsi="' + esc(font) + '" w:cs="' + esc(font) + '" w:eastAsia="' + esc(font) + '"/>' + (o.italic ? '<w:i/>' : '') + '<w:sz w:val="' + bodySz + '"/><w:szCs w:val="' + bodySz + '"/><w:lang w:val="ru-RU"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="a"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:firstLine="' + tw(12.5) + '"/><w:jc w:val="both"/></w:pPr></w:style>' +
      '<w:style w:type="table" w:default="1" w:styleId="a1"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>';
    files['word/settings.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="709"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>';
    // заголовок 1 / колонтитул 1 — первый лист; 2 — последующие
    files['word/header1.xml'] = headerXml(first, o);
    files['word/footer1.xml'] = footerXml(first, o, lm);
    if (next) { files['word/header2.xml'] = headerXml(next, o); files['word/footer2.xml'] = footerXml(next, o, lm); }
    var refs = next ? '<w:headerReference w:type="default" r:id="rId5"/><w:headerReference w:type="first" r:id="rId3"/><w:footerReference w:type="default" r:id="rId6"/><w:footerReference w:type="first" r:id="rId4"/>'
      : '<w:headerReference w:type="default" r:id="rId3"/><w:footerReference w:type="default" r:id="rId4"/>';
    var sect = '<w:sectPr>' + refs + '<w:pgSz w:w="' + tw(S.W) + '" w:h="' + tw(S.H) + '"' + (S.orient === 'L' ? ' w:orient="landscape"' : '') + '/>' +
      '<w:pgMar w:top="' + tw(topM) + '" w:right="' + tw(rm) + '" w:bottom="' + tw(botM) + '" w:left="' + tw(lm) + '" w:header="' + tw(S.fy0) + '" w:footer="' + tw(S.fy0 - tinyH) + '" w:gutter="0"/>' +
      (next ? '<w:titlePg/>' : '') + '</w:sectPr>';
    var bodyText = (o.body || ['']).map(function (t) { return '<w:p>' + (t ? '<w:r><w:t xml:space="preserve">' + esc(t) + '</w:t></w:r>' : '') + '</w:p>'; }).join('');
    files['word/document.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + NS + '><w:body>' + bodyText + sect + '</w:body></w:document>';
    return zip(files);
  }

  /* ---------- ZIP (без сжатия) ---------- */
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function utf8(s) { return new TextEncoder().encode(s); }
  function zip(files) {
    var parts = [], central = [], off = 0, names = Object.keys(files);
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    names.forEach(function (name) {
      var data = typeof files[name] === 'string' ? utf8(files[name]) : files[name], nb = utf8(name), crc = crc32(data);
      var common = [].concat(u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(nb.length), u16(0));
      var lh = new Uint8Array([0x50, 0x4b, 3, 4].concat(common));
      parts.push(lh, nb, data);
      central.push(new Uint8Array([0x50, 0x4b, 1, 2].concat(u16(20), common, u16(0), u16(0), u16(0), u32(0), u32(off))), nb);
      off += lh.length + nb.length + data.length;
    });
    var cdSize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var end = new Uint8Array([0x50, 0x4b, 5, 6].concat(u16(0), u16(0), u16(names.length), u16(names.length), u32(cdSize), u32(off), u16(0)));
    var all = parts.concat(central, [end]), len = all.reduce(function (a, b) { return a + b.length; }, 0), out = new Uint8Array(len), p = 0;
    all.forEach(function (b) { out.set(b, p); p += b.length; });
    return out;
  }

  var api = { FORMATS: FORMATS, DOCX_OK: DOCX_OK, sheet: sheet, build: build, renderPdf: renderPdf, buildDocx: buildDocx, regionTable: regionTable, zip: zip, VERSION: '0.1' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BLANK = api;
})(typeof window !== 'undefined' ? window : globalThis);
