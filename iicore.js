/* Извещение об изменении по ГОСТ Р 2.503-2023: текст содержания изменения и бланк (формы 2 и 2а, приложение А).
   Исходные данные — результаты сравнения версий (чертежи PDF, спецификации, BOM). */
(function (root) {
  'use strict';
  var VERSION = '0.1';
  function str(v) { return v == null ? '' : String(v).replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }
  function q(s) { return '«' + str(s) + '»'; }
  function plural(n, a, b, c) { var m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; }
  function list(nums) {
    // 1, 2, 3, 5 → «1–3, 5»
    var a = nums.slice().sort(function (x, y) { return x - y; }), out = [], i = 0;
    while (i < a.length) { var j = i; while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++; out.push(j - i >= 2 ? a[i] + '–' + a[j] : j > i ? a[i] + ', ' + a[j] : String(a[i])); i = j + 1; }
    return out.join(', ');
  }

  /* ---------- Чертежи и текстовые документы PDF ---------- */
  // Зоны по ГОСТ 2.104: цифры у верхней/нижней стороны рамки, буквы — у левой/правой.
  function zones(items, fr, mm) {
    if (!fr) return null;
    var band = 7 * mm, cols = {}, rows = {};
    items.forEach(function (t) {
      var s = str(t.s), cx = t.cx, cy = t.cy;
      if (/^\d{1,2}$/.test(s) && cx > fr.x0 && cx < fr.x1 && (Math.abs(cy - fr.y0) < band || Math.abs(cy - fr.y1) < band)) (cols[s] = cols[s] || []).push(cx);
      if (/^[A-ZА-ЯЁ]$/.test(s) && cy > fr.y0 && cy < fr.y1 && (Math.abs(cx - fr.x0) < band || Math.abs(cx - fr.x1) < band)) (rows[s] = rows[s] || []).push(cy);
    });
    var avg = function (a) { return a.reduce(function (p, c) { return p + c; }, 0) / a.length; };
    var C = Object.keys(cols).map(function (k) { return { label: k, x: avg(cols[k]) }; }), R = Object.keys(rows).map(function (k) { return { label: k, y: avg(rows[k]) }; });
    if (C.length < 3 || R.length < 2) return null;
    return { cols: C, rows: R };
  }
  function zoneOf(z, x, y) {
    if (!z) return '';
    var c = null, r = null, dc = 1e9, dr = 1e9;
    z.cols.forEach(function (k) { var d = Math.abs(k.x - x); if (d < dc) { dc = d; c = k; } });
    z.rows.forEach(function (k) { var d = Math.abs(k.y - y); if (d < dr) { dr = d; r = k; } });
    return r && c ? r.label + c.label : '';
  }
  function isDim(s) { return /^[ØRМM⌀∅]?\s?\d+(?:[.,]\d+)?(?:\s?[±+\-]\s?\d+(?:[.,]\d+)?)?(?:\s?[A-Za-z]{1,2}\d{1,2})?\*?$/.test(str(s)); }

  // Изменения на одном листе. p: { n, text, regions, frame, zones, mm, first, tbTop }
  // Рамка, основная надпись и таблица изменений в ней не учитываются: их меняют при внесении изменения.
  function pageChanges(p) {
    var fr = p.frame, mm = p.mm, out = [];
    function inside(x, y) {
      if (!fr) return true;
      if (x < fr.x0 + 1 || x > fr.x1 - 1 || y < fr.y0 + 1 || y > fr.y1 - 1) return false;
      var tbH = (p.first ? (p.tbH || 55) : 15) * mm;
      if (x > fr.x1 - 185 * mm && y > fr.y1 - tbH) return false;
      return true;
    }
    var t = p.text || { changed: [], removed: [], added: [] }, boxes = [];
    t.changed.forEach(function (c) { if (inside(c.b.cx, c.b.cy)) { out.push({ k: 'changed', from: c.from, to: c.to, x: c.b.cx, y: c.b.cy }); boxes.push(c.a, c.b); } });
    t.removed.forEach(function (c) { if (inside(c.cx, c.cy)) { out.push({ k: 'removed', s: c.s, x: c.cx, y: c.cy }); boxes.push(c); } });
    t.added.forEach(function (c) { if (inside(c.cx, c.cy)) { out.push({ k: 'added', s: c.s, x: c.cx, y: c.cy }); boxes.push(c); } });
    // графика: области, не объяснённые изменениями текста
    (p.regions || []).forEach(function (r) {
      var cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
      if (!inside(cx, cy)) return;
      var byText = boxes.some(function (b) { var hw = (b.w || 0) / 2 + 2 * mm, hh = (b.h || 0) / 2 + 2 * mm; return cx > b.cx - hw && cx < b.cx + hw && cy > b.cy - hh && cy < b.cy + hh; });
      if (!byText) out.push({ k: 'graphic', x: cx, y: cy, w: (r.x1 - r.x0) / mm, h: (r.y1 - r.y0) / mm });
    });
    out.forEach(function (c) { c.zone = zoneOf(p.zones, c.x, c.y); });
    out.sort(function (a, b) { return (a.zone || '').localeCompare(b.zone || '') || a.y - b.y || a.x - b.x; });
    return out;
  }
  // ГОСТ Р 2.503, табл. А.1, графа 18, и) 4): при изменении части текста неизменные начало и конец заменяют многоточием
  function shorten(from, to) {
    var A = str(from).split(' '), B = str(to).split(' ');
    if (str(from).length < 40 && str(to).length < 40) return [str(from), str(to)];
    var p = 0; while (p < A.length - 1 && p < B.length - 1 && A[p] === B[p]) p++;
    var e = 0; while (e < A.length - p - 1 && e < B.length - p - 1 && A[A.length - 1 - e] === B[B.length - 1 - e]) e++;
    var ps = Math.max(0, p - 1), es = Math.max(0, e - 1);
    var cut = function (W) { return (ps ? '…' : '') + W.slice(ps, W.length - es).join(' ') + (es ? '…' : ''); };
    return [cut(A), cut(B)];
  }
  function lineOf(c) {
    var z = c.zone ? 'Зона ' + c.zone + '. ' : '';
    if (c.k === 'changed') { var sh = shorten(c.from, c.to); return z + (isDim(c.from) && isDim(c.to) ? 'Размер ' + str(c.from) + ' заменить на ' + str(c.to) : q(sh[0]) + ' заменить на ' + q(sh[1])) + '.'; }
    if (c.k === 'added') return z + 'Ввести: ' + q(c.s) + '.';
    if (c.k === 'removed') return z + (isDim(c.s) ? 'Размер ' + str(c.s) + ' исключить' : 'Исключить: ' + q(c.s)) + '.';
    return '';
  }

  /* ---------- Спецификации: построчное сравнение ---------- */
  function specKey(it) { return (it.base || '') + (it.code ? ' ' + it.code : ''); }
  function specName(it) { return [specKey(it), str(it.name)].filter(Boolean).join(' '); }
  function specDiff(A, B) {
    var usedA = [], usedB = [], out = [];
    function same(a, b) { return a.section === b.section; }
    function pair(i, j) {
      usedA[i] = usedB[j] = 1;
      var a = A[i], b = B[j], d = [];
      if (a.pos != null && b.pos != null && a.pos !== b.pos) d.push({ f: 'поз.', from: a.pos, to: b.pos });
      if (specKey(a) !== specKey(b)) d.push({ f: 'обозначение', from: specKey(a), to: specKey(b) });
      if (str(a.name).toLowerCase() !== str(b.name).toLowerCase()) d.push({ f: 'наименование', from: a.name, to: b.name });
      if (str(a.qty) !== str(b.qty)) d.push({ f: 'кол.', from: a.qty, to: b.qty });
      if (str(a.note) !== str(b.note)) d.push({ f: 'примечание', from: a.note, to: b.note });
      if (str(a.format) !== str(b.format)) d.push({ f: 'формат', from: a.format, to: b.format });
      if (d.length) out.push({ k: 'changed', a: a, b: b, d: d, page: b.page });
    }
    // 1) по обозначению, 2) по позиции, 3) по наименованию (изделия без обозначения)
    A.forEach(function (a, i) { if (!specKey(a)) return; var j = B.findIndex(function (b, k) { return !usedB[k] && specKey(b) === specKey(a) && same(a, b) && (specKey(a).length > 3); }); if (j >= 0) pair(i, j); });
    A.forEach(function (a, i) { if (usedA[i] || a.pos == null) return; var j = B.findIndex(function (b, k) { return !usedB[k] && b.pos === a.pos && same(a, b); }); if (j >= 0) pair(i, j); });
    A.forEach(function (a, i) { if (usedA[i]) return; var j = B.findIndex(function (b, k) { return !usedB[k] && str(b.name).toLowerCase() === str(a.name).toLowerCase() && same(a, b); }); if (j >= 0) pair(i, j); });
    A.forEach(function (a, i) { if (!usedA[i]) out.push({ k: 'removed', a: a, page: a.page }); });
    B.forEach(function (b, j) { if (!usedB[j]) out.push({ k: 'added', b: b, page: b.page }); });
    out.sort(function (x, y) { return (x.page || 0) - (y.page || 0); });
    return out;
  }
  function specLine(c) {
    var it = c.b || c.a, who = it.pos != null ? 'Поз. ' + it.pos : 'Строку ' + q(specName(it));
    if (c.k === 'removed') return (c.a.pos != null ? 'Поз. ' + c.a.pos + ' (' + specName(c.a) + ')' : 'Строку ' + q(specName(c.a))) + ' исключить.';
    if (c.k === 'added') {
      var b = c.b;
      return 'Ввести' + (b.pos != null ? ' поз. ' + b.pos : '') + ' в раздел ' + q(b.section) + ': ' + specName(b) + (str(b.qty) ? ', кол. ' + str(b.qty) : '') + (str(b.note) ? ', примечание ' + q(b.note) : '') + '.';
    }
    var head = c.a.pos != null ? 'Поз. ' + c.a.pos + (c.d.length === 1 && c.d[0].f === 'кол.' ? ' (' + specName(c.b) + ')' : '') : 'Строка ' + q(specName(c.a));
    return head + ': ' + c.d.map(function (d) { return d.f + ' ' + (str(d.from) ? q(d.from) : '«—»') + ' заменить на ' + (str(d.to) ? q(d.to) : '«—»'); }).join('; ') + '.';
  }

  /* ---------- BOM / перечень элементов ---------- */
  function bomLines(r) {
    var out = [];
    r.changed.forEach(function (c) { out.push(c.des + ': ' + c.diffs.map(function (d) { return d.col + ' ' + (d.from ? q(d.from) : '«—»') + ' заменить на ' + (d.to ? q(d.to) : '«—»'); }).join('; ') + '.'); });
    r.added.forEach(function (c) { out.push('Ввести ' + c.des + ': ' + c.key + '.'); });
    r.removed.forEach(function (c) { out.push(c.des + ' (' + c.key + ') исключить.'); });
    return out;
  }

  /* ---------- Текст содержания изменения ---------- */
  // doc: { desig, izm, kind: 'pdf'|'spec'|'bom', sheetsA, sheetsB, pages: [{n, changes}], spec: [..], bom: res }
  // opt.mode: 'sheets' — по листам; 'detail' — подробно. opt.header — строка «Изм. N  обозначение».
  function compose(doc, opt) {
    opt = opt || {};
    var L = [], mode = opt.mode || 'sheets';
    if (opt.header !== false && (doc.desig || doc.izm)) L.push((doc.izm ? 'Изм. ' + doc.izm + '  ' : '') + (doc.desig || ''));
    if (doc.kind === 'bom') {
      var bl = bomLines(doc.bom);
      if (!bl.length) L.push('Изменений нет.'); else L.push.apply(L, bl);
      return L.join('\n');
    }
    var changed = {}, byPage = {};
    if (doc.kind === 'spec') (doc.spec || []).forEach(function (c) { var p = c.page || 1; changed[p] = 1; (byPage[p] = byPage[p] || []).push(specLine(c)); });
    (doc.pages || []).forEach(function (pg) {
      if (doc.kind === 'spec' || !pg.changes.length) return;
      changed[pg.n] = 1;
      var lines = [], gz = [], gn = 0;
      pg.changes.forEach(function (c) { if (c.k === 'graphic') { gn++; if (c.zone && gz.indexOf(c.zone) < 0) gz.push(c.zone); } else lines.push(lineOf(c)); });
      if (gn) lines.push(gz.length ? (gz.length > 1 ? 'Зоны ' : 'Зона ') + gz.join(', ') + '. Изображение изменить согласно новой редакции листа.' : 'Изображение изменить согласно новой редакции листа (изменений: ' + gn + ').');
      byPage[pg.n] = lines;
    });
    var nA = doc.sheetsA || 0, nB = doc.sheetsB || 0, common = Math.min(nA, nB);
    var ch = Object.keys(changed).map(Number).filter(function (n) { return n <= common; }).sort(function (a, b) { return a - b; });
    var added = [], removed = [];
    for (var i = common + 1; i <= nB; i++) added.push(i);
    for (var j = common + 1; j <= nA; j++) removed.push(j);
    if (!ch.length && !added.length && !removed.length) { L.push('Изменений не найдено.'); return L.join('\n'); }
    if (mode === 'sheets') {
      if (ch.length && ch.length === common && !added.length && !removed.length && common > 1 && doc.desig) L.push(doc.desig + ' заменить.');
      else {
        if (ch.length) L.push((ch.length > 1 ? 'Листы ' : 'Лист ') + list(ch) + ' заменить.');
        if (added.length) L.push((added.length > 1 ? 'Листы ' : 'Лист ') + list(added) + ' ввести.');
        if (removed.length) L.push((removed.length > 1 ? 'Листы ' : 'Лист ') + list(removed) + ' исключить.');
      }
      return L.join('\n');
    }
    ch.forEach(function (n) {
      L.push('Лист ' + n + '.');
      (byPage[n] || []).forEach(function (l) { L.push(l); });
    });
    if (added.length) L.push((added.length > 1 ? 'Листы ' : 'Лист ') + list(added) + ' ввести.');
    if (removed.length) L.push((removed.length > 1 ? 'Листы ' : 'Лист ') + list(removed) + ' исключить.');
    if (doc.kind === 'spec' && nA !== nB && !added.length && !removed.length) L.push('Число листов: ' + nA + ' заменить на ' + nB + '.');
    return L.join('\n');
  }

  /* ---------- Бланк: формы 2 и 2а (А4, горизонтально) ---------- */
  async function renderPdf(PDFLib, fontkit, fontBytes, E, text, meta) {
    meta = meta || {};
    var K = await E.create(PDFLib, fontkit, fontBytes, {}), F = E.fmt('A4L'), SZ = K.SZ;
    var H = F.H, Y = function (yTop) { return H - yTop; }; // размеры сняты с формы сверху вниз
    var L = function (p, x1, y1, x2, y2, w) { K.L(p, x1, Y(y1), x2, Y(y2), w); };
    var C = function (p, s, x0, y0, x1, y1, sz, o) { if (str(s)) K.C(p, str(s), x0, Y(y1), x1, Y(y0), sz, o); };
    var LB = SZ.tbLabel, VAL = SZ.tbLabel + 1, BODY = SZ.body;
    // содержание (18): строки по ширине поля
    var W1 = 224 - 20 - 4, W2 = 292 - 20 - 4, LH = 5.6;
    var paras = String(text || '').split('\n');
    var n1 = Math.floor((185.9 - 61.4 - 2) / LH), n2 = Math.floor((205 - 26.4 - 2) / LH);
    var pagesLines = [[]], cap = n1, w = W1;
    paras.forEach(function (para) {
      var ls = K.wrapW(para, w, BODY); if (!ls.length) ls = [''];
      ls.forEach(function (l, li) {
        if (pagesLines[pagesLines.length - 1].length >= cap) {
          pagesLines.push([]); cap = n2;
          if (w !== W2) { w = W2; var restPara = ls.slice(li).join(' '); ls = K.wrapW(restPara, w, BODY); return pushRest(ls); }
        }
        pagesLines[pagesLines.length - 1].push(l);
      });
    });
    function pushRest(ls) { ls.forEach(function (l) { if (pagesLines[pagesLines.length - 1].length >= cap) pagesLines.push([]); pagesLines[pagesLines.length - 1].push(l); }); }
    var total = pagesLines.length;
    pagesLines.forEach(function (lines, pi) {
      var p = K.addPage(F);
      if (pi === 0) {
        // шапка
        L(p, 45, 5, 45, 31, K.thick); L(p, 20, 21, 292, 21, K.thick); L(p, 45, 11, 292, 11, K.thin); L(p, 20, 31, 292, 31, K.thick);
        [125, 247, 262, 277].forEach(function (x) { L(p, x, 5, x, 21, K.thick); });
        [65, 125, 145, 224, 262].forEach(function (x) { L(p, x, 21, x, 31, K.thick); });
        C(p, 'Извещение', 45, 5, 125, 11, LB); C(p, 'Причина', 125, 5, 247, 11, LB); C(p, 'Код', 247, 5, 262, 11, LB); C(p, 'Лист', 262, 5, 277, 11, LB); C(p, 'Листов', 277, 5, 292, 11, LB);
        C(p, meta.org, 20, 5, 45, 21, VAL); C(p, meta.iiDesig, 45, 11, 125, 21, VAL); C(p, meta.reason, 125, 11, 247, 21, VAL); C(p, meta.code, 247, 11, 262, 21, VAL);
        C(p, total > 1 ? '1' : '', 262, 11, 277, 21, VAL); C(p, String(total), 277, 11, 292, 21, VAL);
        C(p, meta.dept, 20, 21, 45, 31, VAL); C(p, 'Дата', 45, 21, 65, 26, LB); C(p, 'выпуска', 45, 26, 65, 31, LB); C(p, meta.date, 65, 21, 125, 31, VAL);
        C(p, 'Срок изм.', 125, 21, 145, 31, LB); C(p, meta.srok, 145, 21, 224, 31, VAL); C(p, 'Срок действия ПИ', 224, 21, 262, 31, LB); C(p, meta.srokPI || '—', 262, 21, 292, 31, VAL);
        // задел, внедрение, применяемость, разослать
        L(p, 224, 31, 224, 205, K.thick); L(p, 45, 31, 45, 51.4, K.thick); L(p, 20, 51.4, 224, 51.4, K.thick);
        C(p, 'Указание', 20, 34, 45, 41, LB); C(p, 'о заделе', 20, 41, 45, 48, LB);
        boxText(p, meta.zadel, 46, 31, 223, 51.4, VAL);
        L(p, 224, 36.3, 292, 36.3, K.thin); C(p, 'Указание о внедрении', 224, 31, 292, 36.3, LB); boxText(p, meta.vnedr, 225, 36.3, 291, 62.3, VAL);
        L(p, 224, 62.3, 292, 62.3, K.thick); L(p, 224, 67.4, 292, 67.4, K.thin); C(p, 'Применяемость', 224, 62.3, 292, 67.4, LB); boxText(p, meta.primen, 225, 67.4, 291, 120.6, VAL);
        L(p, 224, 120.6, 292, 120.6, K.thick); L(p, 224, 125.4, 292, 125.4, K.thin); C(p, 'Разослать', 224, 120.6, 292, 125.4, LB); boxText(p, meta.razoslat, 225, 125.4, 291, 205, VAL);
        // Изм. / Содержание изменения / (17) (3)
        L(p, 35, 51.4, 35, 61.4, K.thick); L(p, 20, 56.2, 224, 56.2, K.thin); L(p, 20, 61.4, 105, 61.4, K.thick); L(p, 105, 56.2, 105, 61.4, K.thick);
        C(p, 'Изм.', 20, 51.4, 35, 56.2, LB); C(p, 'Содержание изменения', 35, 51.4, 224, 56.2, LB);
        C(p, meta.izm, 20, 56.2, 35, 61.4, VAL); C(p, meta.docDesig, 35, 56.2, 105, 61.4, VAL);
        body(p, lines, 22, 61.4 + 1);
        // подписи
        L(p, 20, 185.9, 224, 185.9, K.thick); L(p, 20, 190.7, 224, 190.7, K.thin); L(p, 20, 200.6, 224, 200.6, K.thick);
        var S = [['Составил', meta.sost], ['Проверил', meta.prov], ['Т. контроль', meta.tk], ['Н. контроль', meta.nk], ['Утвердил', meta.utv], ['Предст. заказ.', meta.pz]];
        S.forEach(function (s, k) {
          var x0 = 20 + k * 34;
          if (k) L(p, x0, 185.9, x0, 200.6, K.thick);
          L(p, x0 + 24, 190.7, x0 + 24, 200.6, K.thin); L(p, x0, 195.6, x0 + 24, 195.6, K.thin);
          C(p, s[0], x0, 185.9, x0 + 34, 190.7, LB); C(p, s[1], x0, 190.7, x0 + 24, 195.6, VAL);
        });
        C(p, 'Изменения внес', 20, 200.6, 66, 205, LB); C(p, 'Контрольную копию исправил', 112, 200.6, 170, 205, LB);
        [66, 88, 112, 170, 192].forEach(function (x) { L(p, x, 200.6, x, 205, K.thin); });
        // поле для подписей согласующих (19–22) слева от рамки
        L(p, 5, 125.4, 20, 125.4, K.thick); L(p, 5, 125.4, 5, 205, K.thick); L(p, 5, 205, 20, 205, K.thick);
        [10, 15].forEach(function (x) { L(p, x, 125.4, x, 205, K.thin); }); [145.7, 166, 185.9].forEach(function (y) { L(p, 5, y, 20, y, K.thin); });
      } else {
        L(p, 20, 11.2, 292, 11.2, K.thick); L(p, 60, 5, 60, 11.2, K.thin); L(p, 277, 5, 277, 21.2, K.thick); L(p, 20, 21.2, 292, 21.2, K.thin); L(p, 35, 11.2, 35, 26.4, K.thick);
        L(p, 20, 26.4, 105, 26.4, K.thick); L(p, 105, 21.2, 105, 26.4, K.thick);
        C(p, 'Извещение', 20, 5, 60, 11.2, LB); C(p, meta.iiDesig, 60, 5, 277, 11.2, VAL); C(p, 'Лист', 277, 5, 292, 11.2, LB);
        C(p, 'Изм.', 20, 11.2, 35, 21.2, LB); C(p, 'Содержание изменения', 35, 11.2, 277, 21.2, LB); C(p, String(pi + 1), 277, 11.2, 292, 21.2, VAL);
        C(p, meta.izm, 20, 21.2, 35, 26.4, VAL); C(p, meta.docDesig, 35, 21.2, 105, 26.4, VAL);
        body(p, lines, 22, 26.4 + 1);
      }
      K.footer(p, F);
    });
    function body(p, lines, x, yTop) { lines.forEach(function (l, i) { if (l) K.T(p, l, x, Y(yTop + (i + 1) * LH - 1.2), BODY); }); }
    function boxText(p, s, x0, y0, x1, y1, sz) {
      s = str(s); if (!s) return;
      var ls = K.wrapW(s, x1 - x0 - 2, sz), lh = 4.2, n = Math.max(1, Math.floor((y1 - y0 - 1) / lh));
      ls.slice(0, n).forEach(function (l, i) { K.T(p, l, x0 + 1, Y(y0 + (i + 1) * lh - 0.6), sz); });
    }
    var fixed = meta.fixedDate || new Date();
    K.doc.setCreationDate(fixed); K.doc.setModificationDate(fixed);
    return await K.save({ desig: meta.iiDesig, name: 'Извещение об изменении ' + str(meta.docDesig) }, 'Инструменты ЕСКД: извещение об изменении');
  }

  var api = { VERSION: VERSION, zones: zones, zoneOf: zoneOf, pageChanges: pageChanges, specDiff: specDiff, specLine: specLine, bomLines: bomLines, compose: compose, renderPdf: renderPdf, isDim: isDim, list: list };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.II = api;
})(typeof window !== 'undefined' ? window : globalThis);
