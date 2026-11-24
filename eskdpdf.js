/* Общие элементы листов ЕСКД для текстовых документов: рамка, дополнительные графы, основные надписи форм 2 и 2а
   по ГОСТ Р 2.104-2023, перенос текста. Основная надпись — у правого нижнего угла рамки при любом формате. */
(function (root) {
  'use strict';
  var PT = 72 / 25.4;

  function str(v) { return v == null ? '' : String(v).replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }

  // Форматы (мм): W×H листа, рамка 20 слева и 5 с остальных сторон
  var FORMATS = {
    'A4': { W: 210, H: 297, name: 'А4' },
    'A3L': { W: 420, H: 297, name: 'А3' },
    'A4L': { W: 297, H: 210, name: 'А4' }
  };
  function fmt(key) { var f = FORMATS[key]; return { W: f.W, H: f.H, name: f.name, fx0: 20, fx1: f.W - 5, fy0: 5, fy1: f.H - 5 }; }

  /* ---------- Перенос текста (неразрывные «ГОСТ 1234», «10 кОм», перенос по дефису) ---------- */
  var NB = /((?:ГОСТ|ОСТ|СТО|ТУ|ГОСТ Р|ГОСТ IEC|ГОСТ ISO|ГОСТ Р ИСО|ГОСТ Р МЭК|ISO|DIN|IEC|№|Поз\.?|поз\.) )(?=\S)|(\d) (?=(?:кг|г|мм|см|м|мл|л|шт|м2|м3|А|мА|мкА|В|мВ|кВ|Вт|мВт|Ом|кОм|МОм|Гц|кГц|МГц|Ф|мкФ|нФ|пФ|Гн|мГн|мкГн|%)(?![А-Яа-яЁё]))/g;
  function wrap(text, width, measure) {
    text = str(text).replace(/ГОСТ Р /g, 'ГОСТ Р ').replace(NB, function (m, a, d) { return a ? a.slice(0, -1) + ' ' : d + ' '; });
    if (!text) return [''];
    var meas = function (t) { return measure(t.replace(/ /g, ' ')); };
    var words = text.split(' '), lines = [], cur = '';
    function push(w) {
      while (meas(w) > width) {
        var hy = -1;
        for (var q = w.length - 1; q > 0; q--) if ((w[q - 1] === '-' || w[q - 1] === ',') && meas(w.slice(0, q)) <= width) { hy = q; break; }
        if (hy > 0) { lines.push(w.slice(0, hy)); w = w.slice(hy); continue; }
        var k = w.length;
        while (k > 1 && meas(w.slice(0, k) + '-') > width) k--;
        lines.push(w.slice(0, k) + (k < w.length && /[A-Za-zА-Яа-яЁё]/.test(w[k]) ? '-' : ''));
        w = w.slice(k);
      }
      return w;
    }
    words.forEach(function (w) {
      var cand = cur ? cur + ' ' + w : w;
      if (meas(cand) <= width) { cur = cand; return; }
      if (cur) lines.push(cur);
      cur = push(w);
    });
    if (cur) lines.push(cur);
    lines = lines.map(function (l) { return l.replace(/ /g, ' '); });
    return lines.length ? lines : [''];
  }

  /* ---------- Рисование ---------- */
  async function create(PDFLib, fontkit, fontBytes, opt) {
    opt = opt || {};
    var doc = await PDFLib.PDFDocument.create();
    doc.registerFontkit(fontkit);
    var font = await doc.embedFont(fontBytes, { subset: true });
    var fk = font.embedder && font.embedder.font;
    function clean(t) {
      t = str(t);
      if (!fk || !fk.hasGlyphForCodePoint) return t;
      var o = '';
      for (var ch of t) o += fk.hasGlyphForCodePoint(ch.codePointAt(0)) ? ch : '?';
      return o;
    }
    var rgb = PDFLib.rgb(0, 0, 0), deg = PDFLib.degrees;
    var thick = 0.6 * PT, thin = 0.25 * PT;
    var SZ = { body: opt.fontPt || 12, head: 11, small: 7.5, tbLabel: 8, tbDesig: 17, tbName: 13, side: 7.5 };
    function width(t, size) { return font.widthOfTextAtSize(clean(t), size) / PT; }
    function L(p, x1, y1, x2, y2, w) { p.drawLine({ start: { x: x1 * PT, y: y1 * PT }, end: { x: x2 * PT, y: y2 * PT }, thickness: w || thin, color: rgb }); }
    function R(p, x0, y0, x1, y1, w) { L(p, x0, y0, x1, y0, w); L(p, x1, y0, x1, y1, w); L(p, x1, y1, x0, y1, w); L(p, x0, y1, x0, y0, w); }
    function T(p, text, x, y, size, o) {
      o = o || {}; text = clean(text); if (!text) return 0;
      var w = font.widthOfTextAtSize(text, size) / PT, s = size;
      if (o.max && w > o.max) { s = Math.max(size * 0.6, size * o.max / w); w = font.widthOfTextAtSize(text, s) / PT; }
      var dx = o.align === 'center' ? -w / 2 : o.align === 'right' ? -w : 0;
      if (o.rot) p.drawText(text, { x: x * PT, y: (y + dx) * PT, size: s, font: font, color: rgb, rotate: deg(90) });
      else p.drawText(text, { x: (x + dx) * PT, y: y * PT, size: s, font: font, color: rgb });
      return w;
    }
    function C(p, text, x0, y0, x1, y1, size, o) {
      o = o || {}; var cap = size / PT * 0.72;
      if (o.rot) return T(p, text, (x0 + x1) / 2 + cap / 2, (y0 + y1) / 2, size, { align: 'center', rot: true, max: (y1 - y0) - 1 });
      return T(p, text, (x0 + x1) / 2, (y0 + y1) / 2 - cap / 2, size, { align: 'center', max: (x1 - x0) - 1 });
    }
    function addPage(F) { var p = doc.addPage([F.W * PT, F.H * PT]); R(p, F.fx0, F.fy0, F.fx1, F.fy1, thick); return p; }

    // Дополнительные графы слева от рамки (ГОСТ Р 2.104-2023)
    function sideGraphs(p, F, firstSheet, meta) {
      var x0 = 8, xm = 13, x1 = F.fx0;
      var g = [['Инв. № подл.', 25, meta.invPodl], ['Подп. и дата', 35, ''], ['Взам. инв. №', 25, meta.vzamInv], ['Инв. № дубл.', 25, ''], ['Подп. и дата', 35, '']];
      var y = F.fy0;
      R(p, x0, y, x1, y + 145, thick); L(p, xm, y, xm, y + 145, thick);
      g.forEach(function (gr) { L(p, x0, y + gr[1], x1, y + gr[1], thick); C(p, gr[0], x0, y, xm, y + gr[1], SZ.side, { rot: true }); if (gr[2]) C(p, gr[2], xm, y, x1, y + gr[1], SZ.side + 1.5, { rot: true }); y += gr[1]; });
      if (firstSheet) {
        var top = F.fy1;
        R(p, x0, top - 120, x1, top, thick); L(p, xm, top - 120, xm, top, thick); L(p, x0, top - 60, x1, top - 60, thick);
        C(p, 'Перв. примен.', x0, top - 60, xm, top, SZ.side, { rot: true });
        C(p, 'Справ. №', x0, top - 120, xm, top - 60, SZ.side, { rot: true });
        if (meta.pervPrimen) C(p, meta.pervPrimen, xm, top - 60, x1, top, SZ.side + 2, { rot: true });
        if (meta.spravN) C(p, meta.spravN, xm, top - 120, x1, top - 60, SZ.side + 2, { rot: true });
      }
    }

    function leftBlock(p, d, yTop, rows, headerRowIndex, signRows) {
      var xs = [20, 27, 37, 60, 75, 85].map(function (x) { return x + d; });
      for (var i = 0; i <= rows; i++) {
        var y = yTop - i * 5, isHead = i === headerRowIndex || i === headerRowIndex + 1;
        L(p, xs[0], y, xs[5], y, (i === 0 || i === rows || isHead) ? thick : thin);
      }
      xs.forEach(function (x, k) {
        var yb = yTop - rows * 5;
        if (signRows && k === 1) { L(p, x, yTop, x, yTop - (headerRowIndex + 1) * 5, thick); return; }
        L(p, x, yTop, x, yb, thick);
      });
      var hy = yTop - (headerRowIndex + 1) * 5;
      ['Изм.', 'Лист', '№ докум.', 'Подп.', 'Дата'].forEach(function (t, k) { C(p, t, xs[k], hy, xs[k + 1], hy + 5, SZ.tbLabel); });
      if (signRows) signRows.forEach(function (sr, k) {
        var y1 = hy - k * 5, y0 = y1 - 5;
        if (sr[0]) T(p, sr[0], xs[0] + 0.7, y0 + 1.4, SZ.tbLabel, { max: 16 });
        if (sr[1]) T(p, sr[1], xs[2] + 0.7, y0 + 1.4, SZ.tbLabel + 0.5, { max: 22 });
        if (sr[2]) C(p, sr[2], xs[3], y0, xs[4], y0 + 5, SZ.tbLabel);
        if (sr[3]) C(p, sr[3], xs[4], y0, xs[5], y0 + 5, SZ.tbLabel);
      });
    }

    // Форма 2 (заглавный лист текстового документа), 185×40, у правого нижнего угла рамки
    function form2(p, F, meta, total) {
      var d = F.fx1 - 205, y0 = F.fy0, top = y0 + 40, X = function (x) { return x + d; };
      R(p, X(20), y0, X(205), top, thick);
      var sp = meta.signPodp || '', sd = meta.signDate || '';
      leftBlock(p, d, top, 8, 2, [[meta.l1 || 'Разраб.', meta.razrab], [meta.l2 || 'Пров.', meta.prov], [meta.l3, meta.r3], [meta.l4 || 'Н. контр.', meta.nkontr], [meta.l5 || 'Утв.', meta.utv]].map(function (r) { return r[1] ? r.concat([sp, sd]) : r; }));
      L(p, X(85), top - 15, X(205), top - 15, thick);
      L(p, X(195), top, X(195), top - 15, thick); L(p, X(195), top - 5, X(205), top - 5, thin);
      C(p, 'Вер.', X(195), top - 5, X(205), top, SZ.small);
      if (meta.ver) C(p, meta.ver, X(195), top - 15, X(205), top - 5, SZ.tbLabel + 1);
      C(p, meta.desig, X(85), top - 15, X(195), top, SZ.tbDesig);
      L(p, X(155), y0, X(155), top - 15, thick);
      // графа 1: наименование изделия и наименование документа (вторая строка, меньшим шрифтом)
      var nl = wrap(meta.name, 66, function (t) { return width(t, SZ.tbName); }).slice(0, meta.docName ? 3 : 4);
      var lines = nl.map(function (t) { return { t: t, s: SZ.tbName, h: 6.2 }; });
      if (meta.docName) lines.push({ t: meta.docName, s: SZ.tbName - 2, h: 5.4 });
      var tot = lines.reduce(function (a, l) { return a + l.h; }, 0), y = (y0 + top - 15) / 2 + tot / 2;
      lines.forEach(function (l) { C(p, l.t, X(85), y - l.h / 2 - 2.5, X(155), y - l.h / 2 + 2.5, l.s); y -= l.h; });
      L(p, X(155), top - 20, X(205), top - 20, thick); L(p, X(155), top - 25, X(205), top - 25, thick);
      [170, 185].forEach(function (x) { L(p, X(x), top - 25, X(x), top - 15, thick); });
      [160, 165].forEach(function (x) { L(p, X(x), top - 25, X(x), top - 20, thin); });
      C(p, 'Лит.', X(155), top - 20, X(170), top - 15, SZ.tbLabel); C(p, 'Лист', X(170), top - 20, X(185), top - 15, SZ.tbLabel); C(p, 'Листов', X(185), top - 20, X(205), top - 15, SZ.tbLabel);
      (meta.lit || []).slice(0, 3).forEach(function (l, i) { if (l) C(p, l, X(155 + i * 5), top - 25, X(160 + i * 5), top - 20, SZ.tbLabel + 1); });
      if (total > 1) C(p, '1', X(170), top - 25, X(185), top - 20, SZ.tbLabel + 1);
      C(p, String(total), X(185), top - 25, X(205), top - 20, SZ.tbLabel + 1);
      var ol = wrap(meta.org, 47, function (t) { return width(t, SZ.tbLabel + 2); }).slice(0, 3);
      ol.forEach(function (l, i) { C(p, l, X(155), y0 + 7.5 + (ol.length - 1) * 2.4 - i * 4.8 - 2, X(205), y0 + 7.5 + (ol.length - 1) * 2.4 - i * 4.8 + 2, SZ.tbLabel + 2); });
    }

    // Форма 2а (последующие листы), 185×15
    function form2a(p, F, meta, n) {
      var d = F.fx1 - 205, y0 = F.fy0, top = y0 + 15, X = function (x) { return x + d; };
      R(p, X(20), y0, X(205), top, thick);
      leftBlock(p, d, top, 3, 2, null);
      L(p, X(185), y0, X(185), top, thick); L(p, X(195), y0, X(195), top, thick);
      L(p, X(185), top - 5, X(205), top - 5, thin);
      C(p, 'Вер.', X(185), top - 5, X(195), top, SZ.small); C(p, 'Лист', X(195), top - 5, X(205), top, SZ.small);
      if (meta.ver) C(p, meta.ver, X(185), y0, X(195), top - 5, SZ.tbLabel + 1);
      C(p, String(n), X(195), y0, X(205), top - 5, SZ.tbLabel + 2);
      C(p, meta.desig, X(85), y0, X(185), top, SZ.tbDesig);
    }

    function footer(p, F) {
      T(p, 'Копировал', F.fx1 - 85, 1.6, SZ.tbLabel);
      T(p, 'Формат ' + F.name, F.fx1 - 30, 1.6, SZ.tbLabel);
    }

    async function save(meta, creator) {
      doc.setTitle(str(meta.desig) + ' ' + str(meta.name));
      doc.setCreator(creator || 'Инструменты ЕСКД');
      doc.setProducer('pdf-lib');
      return await doc.save();
    }

    return { doc: doc, font: font, SZ: SZ, thick: thick, thin: thin, width: width, clean: clean, L: L, R: R, T: T, C: C,
      addPage: addPage, sideGraphs: sideGraphs, form2: form2, form2a: form2a, footer: footer, save: save,
      wrapW: function (text, w, size) { return wrap(text, w, function (t) { return width(t, size); }); } };
  }

  var api = { PT: PT, fmt: fmt, wrap: wrap, str: str, create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ESKDPDF = api;
})(typeof window !== 'undefined' ? window : globalThis);
