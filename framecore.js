/* Лист с рамкой и основной надписью по ГОСТ Р 2.104-2023 (форма 1, графические документы) вокруг изображения.
   Форматы по ГОСТ 2.301. Без сети. */
(function (root) {
  'use strict';
  var PT = 72 / 25.4;
  var FORMATS = {
    'A4': { name: 'А4', w: 210, h: 297, portraitOnly: true },
    'A3': { name: 'А3', w: 297, h: 420 },
    'A2': { name: 'А2', w: 420, h: 594 },
    'A1': { name: 'А1', w: 594, h: 841 }
  };
  var ORDER = ['A4', 'A3', 'A2', 'A1'];

  function sheet(fmt, orient) {
    var f = FORMATS[fmt], land = orient === 'L' && !f.portraitOnly;
    var W = land ? f.h : f.w, H = land ? f.w : f.h;
    return { fmt: fmt, name: f.name, orient: land ? 'L' : 'P', W: W, H: H, fx0: 20, fy0: 5, fx1: W - 5, fy1: H - 5 };
  }

  // Поле для изображения: всё внутри рамки, кроме основной надписи (185×55) и графы 26 (70×14)
  function placeImage(S, iw, ih, margin) {
    margin = margin == null ? 5 : margin;
    var x0 = S.fx0 + margin, x1 = S.fx1 - margin, y0 = S.fy0 + margin, y1 = S.fy1 - margin;
    var tbTop = S.fy0 + 55 + margin, tbLeft = S.fx1 - 185 - margin, g26 = S.fy1 - 14 - margin;
    var cand = [
      { x0: x0, x1: x1, y0: tbTop, y1: g26 },          // над основной надписью, под графой 26
      { x0: x0, x1: tbLeft, y0: y0, y1: g26 }          // левее основной надписи
    ].filter(function (r) { return r.x1 - r.x0 > 20 && r.y1 - r.y0 > 20; });
    var best = null;
    cand.forEach(function (r) {
      var k = Math.min((r.x1 - r.x0) / iw, (r.y1 - r.y0) / ih);
      if (!best || k > best.k) best = { k: k, r: r };
    });
    var w = iw * best.k, h = ih * best.k;
    return { x: best.r.x0 + (best.r.x1 - best.r.x0 - w) / 2, y: best.r.y0 + (best.r.y1 - best.r.y0 - h) / 2, w: w, h: h, k: best.k };
  }

  // Автоподбор: наименьший формат, на котором изображение не уменьшается больше чем до minScale от «естественного» размера
  function autoFormat(iwMm, ihMm, minScale) {
    minScale = minScale || 0.85;
    var tries = [];
    ORDER.forEach(function (fmt) {
      (FORMATS[fmt].portraitOnly ? ['P'] : (iwMm >= ihMm ? ['L', 'P'] : ['P', 'L'])).forEach(function (o) {
        var S = sheet(fmt, o), pl = placeImage(S, iwMm, ihMm);
        tries.push({ fmt: fmt, orient: o, k: pl.k });
      });
    });
    var ok = tries.filter(function (t) { return t.k >= minScale; });
    if (ok.length) { var f0 = ok[0].fmt; ok = ok.filter(function (t) { return t.fmt === f0; }); ok.sort(function (a, b) { return b.k - a.k; }); return ok[0]; }
    tries.sort(function (a, b) { return b.k - a.k; });
    return tries.filter(function (t) { return t.fmt === 'A1'; })[0];
  }

  function str(v) { return v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); }

  function wrap(text, width, measure) {
    text = str(text); if (!text) return [];
    var words = text.split(' '), lines = [], cur = '';
    words.forEach(function (w) { var c = cur ? cur + ' ' + w : w; if (measure(c) <= width || !cur) cur = c; else { lines.push(cur); cur = w; } });
    if (cur) lines.push(cur);
    return lines;
  }

  async function render(PDFLib, fontkit, fontBytes, src, meta, opt) {
    opt = opt || {};
    var doc = await PDFLib.PDFDocument.create();
    doc.registerFontkit(fontkit);
    var font = await doc.embedFont(fontBytes, { subset: true });
    var fk = font.embedder && font.embedder.font;
    var clean = function (t) { t = str(t); if (!fk || !fk.hasGlyphForCodePoint) return t; var o = ''; for (var ch of t) o += fk.hasGlyphForCodePoint(ch.codePointAt(0)) ? ch : '?'; return o; };
    var rgb = PDFLib.rgb(0, 0, 0), deg = PDFLib.degrees, thick = 0.6 * PT, thin = 0.25 * PT;

    // источник: картинка (PNG/JPEG) или страница PDF (вектором)
    var obj, iwMm, ihMm;
    if (src.kind === 'pdf') {
      var pages = await doc.embedPdf(src.bytes, [src.page || 0]);
      obj = pages[0]; iwMm = obj.width / PT; ihMm = obj.height / PT;
    } else {
      obj = src.kind === 'jpg' ? await doc.embedJpg(src.bytes) : await doc.embedPng(src.bytes);
      var dpi = src.dpi || 150; iwMm = obj.width / dpi * 25.4; ihMm = obj.height / dpi * 25.4;
    }
    var choice = opt.format && opt.format !== 'auto' ? { fmt: opt.format.split('-')[0], orient: opt.format.split('-')[1] || 'P' } : autoFormat(iwMm, ihMm, opt.minScale);
    var S = sheet(choice.fmt, choice.orient);
    var p = doc.addPage([S.W * PT, S.H * PT]);
    function L(x1, y1, x2, y2, w) { p.drawLine({ start: { x: x1 * PT, y: y1 * PT }, end: { x: x2 * PT, y: y2 * PT }, thickness: w || thin, color: rgb }); }
    function R(x0, y0, x1, y1, w) { L(x0, y0, x1, y0, w); L(x1, y0, x1, y1, w); L(x1, y1, x0, y1, w); L(x0, y1, x0, y0, w); }
    function T(text, x, y, size, o) {
      o = o || {}; text = clean(text); if (!text) return 0;
      var w = font.widthOfTextAtSize(text, size) / PT, s = size;
      if (o.max && w > o.max) { s = Math.max(size * 0.55, size * o.max / w); w = font.widthOfTextAtSize(text, s) / PT; }
      var dx = o.align === 'center' ? -w / 2 : o.align === 'right' ? -w : 0;
      if (o.rot === 90) p.drawText(text, { x: x * PT, y: (y + dx) * PT, size: s, font: font, color: rgb, rotate: deg(90) });
      else if (o.rot === 180) p.drawText(text, { x: (x - dx) * PT, y: y * PT, size: s, font: font, color: rgb, rotate: deg(180) });
      else p.drawText(text, { x: (x + dx) * PT, y: y * PT, size: s, font: font, color: rgb });
      return w;
    }
    function C(text, x0, y0, x1, y1, size, o) {
      o = o || {}; var cap = size / PT * 0.72;
      if (o.rot === 90) T(text, (x0 + x1) / 2 + cap / 2, (y0 + y1) / 2, size, { align: 'center', rot: 90, max: (y1 - y0) - 1 });
      else if (o.rot === 180) T(text, (x0 + x1) / 2, (y0 + y1) / 2 + cap / 2, size, { align: 'center', rot: 180, max: (x1 - x0) - 1 });
      else T(text, (x0 + x1) / 2, (y0 + y1) / 2 - cap / 2, size, { align: 'center', max: (x1 - x0) - 1 });
    }

    // изображение
    var pl = placeImage(S, iwMm, ihMm, opt.margin);
    p.drawImage ? null : null;
    if (src.kind === 'pdf') p.drawPage(obj, { x: pl.x * PT, y: pl.y * PT, width: pl.w * PT, height: pl.h * PT });
    else p.drawImage(obj, { x: pl.x * PT, y: pl.y * PT, width: pl.w * PT, height: pl.h * PT });

    // рамка
    R(S.fx0, S.fy0, S.fx1, S.fy1, thick);

    // дополнительные графы 19–23 (слева внизу) и 24–25 (слева вверху)
    var gx0 = 8, gxm = 13, gx1 = S.fx0, y = S.fy0, SM = 7.5;
    R(gx0, y, gx1, y + 145, thick); L(gxm, y, gxm, y + 145, thick);
    [['Инв. № подл.', 25, meta.invPodl], ['Подп. и дата', 35, ''], ['Взам. инв. №', 25, meta.vzamInv], ['Инв. № дубл.', 25, ''], ['Подп. и дата', 35, '']].forEach(function (g) {
      L(gx0, y + g[1], gx1, y + g[1], thick); C(g[0], gx0, y, gxm, y + g[1], SM, { rot: 90 }); if (g[2]) C(g[2], gxm, y, gx1, y + g[1], SM + 1.5, { rot: 90 }); y += g[1];
    });
    var top = S.fy1;
    R(gx0, top - 120, gx1, top, thick); L(gxm, top - 120, gxm, top, thick); L(gx0, top - 60, gx1, top - 60, thick);
    C('Перв. примен.', gx0, top - 60, gxm, top, SM, { rot: 90 }); C('Справ. №', gx0, top - 120, gxm, top - 60, SM, { rot: 90 });
    if (meta.pervPrimen) C(meta.pervPrimen, gxm, top - 60, gx1, top, SM + 2, { rot: 90 });
    if (meta.spravN) C(meta.spravN, gxm, top - 120, gx1, top - 60, SM + 2, { rot: 90 });

    // графа 26: обозначение, повёрнутое на 180°, в левом верхнем углу
    if (opt.graph26 !== false) {
      R(S.fx0, S.fy1 - 14, S.fx0 + 70, S.fy1, thick);
      if (meta.desig) C(meta.desig, S.fx0, S.fy1 - 14, S.fx0 + 70, S.fy1, 14, { rot: 180 });
    }

    // основная надпись, форма 1 (185×55): 4 строки изменений, заголовок, 6 строк подписей
    var X = S.fx1 - 185, Y = S.fy0, H = 55, TOP = Y + H, LB = 9;
    R(X, Y, S.fx1, TOP, thick);
    var xs = [X, X + 7, X + 17, X + 40, X + 55, X + 65];
    for (var i = 1; i < 11; i++) { var yy = TOP - i * 5; L(X, yy, X + 65, yy, (i === 4 || i === 5) ? thick : thin); }
    xs.forEach(function (x, k) { if (k === 1) L(x, TOP, x, TOP - 25, thick); else L(x, TOP, x, Y, thick); });
    ['Изм.', 'Лист', '№ докум.', 'Подп.', 'Дата'].forEach(function (t, k) { C(t, xs[k], TOP - 25, xs[k + 1], TOP - 20, LB); });
    var mode = meta.signMode || 'paper', sdate = str(meta.signDate);
    [[meta.l1 || 'Разраб.', meta.razrab], [meta.l2 || 'Пров.', meta.prov], [meta.l3 || 'Т.контр.', meta.r3], ['', ''], [meta.l4 || 'Н. контр.', meta.nkontr], [meta.l5 || 'Утв.', meta.utv]].forEach(function (r, k) {
      var y0 = TOP - 30 - k * 5;
      if (r[0]) T(r[0], X + 0.7, y0 + 1.4, LB, { max: 16 });
      if (r[1]) T(r[1], X + 17.7, y0 + 1.4, LB + 0.5, { max: 22 });
      if (r[1] && mode === 'ep') C('ЭП', X + 40, y0, X + 55, y0 + 5, LB);
      if (r[1] && sdate) C(sdate, X + 55, y0, X + 65, y0 + 5, LB);
    });
    // графа 2 и «Вер.»
    L(X + 65, TOP - 15, S.fx1, TOP - 15, thick);
    L(S.fx1 - 10, TOP, S.fx1 - 10, TOP - 15, thick); L(S.fx1 - 10, TOP - 5, S.fx1, TOP - 5, thin);
    C('Вер.', S.fx1 - 10, TOP - 5, S.fx1, TOP, 6.5);
    if (meta.ver) C(meta.ver, S.fx1 - 10, TOP - 15, S.fx1, TOP - 5, LB + 1);
    C(meta.desig, X + 65, TOP - 15, S.fx1 - 10, TOP, 17);
    // графы 1 и 3
    var RX = X + 135;
    L(RX, Y, RX, TOP - 15, thick); L(X + 65, Y + 15, RX, Y + 15, thick);
    var nl = wrap(meta.name, 66, function (t) { return font.widthOfTextAtSize(clean(t), 13) / PT; }).slice(0, 3);
    var kind = str(meta.kind);
    var lines = nl.concat(kind ? [kind] : []), lh = 5.6, cy = (Y + 15 + TOP - 15) / 2 + (lines.length - 1) * lh / 2;
    lines.forEach(function (l, i) { C(l, X + 65, cy - i * lh - 2.5, RX, cy - i * lh + 2.5, i === nl.length ? 11 : 13); });
    var ml = wrap(meta.material, 66, function (t) { return font.widthOfTextAtSize(clean(t), 11) / PT; }).slice(0, 2);
    ml.forEach(function (l, i) { C(l, X + 65, Y + 7.5 + (ml.length - 1) * 2.6 - i * 5.2 - 2.5, RX, Y + 7.5 + (ml.length - 1) * 2.6 - i * 5.2 + 2.5, 11); });
    // правый блок: Лит. | Масса | Масштаб; Лист | Листов; организация
    var r1 = TOP - 20, r2 = TOP - 35, r3 = TOP - 40;
    L(RX, r1, S.fx1, r1, thick); L(RX, r2, S.fx1, r2, thick); L(RX, r3, S.fx1, r3, thick);
    L(RX + 15, TOP - 15, RX + 15, r2, thick); L(RX + 32, TOP - 15, RX + 32, r2, thick);
    [5, 10].forEach(function (d) { L(RX + d, r1, RX + d, r2, thin); });
    L(RX + 20, r2, RX + 20, r3, thick);
    C('Лит.', RX, r1, RX + 15, TOP - 15, LB); C('Масса', RX + 15, r1, RX + 32, TOP - 15, LB); C('Масштаб', RX + 32, r1, S.fx1, TOP - 15, LB);
    (meta.lit || []).slice(0, 3).forEach(function (l, i) { if (l) C(l, RX + i * 5, r2, RX + 5 + i * 5, r1, LB + 1); });
    if (meta.mass) C(meta.mass, RX + 15, r2, RX + 32, r1, 12);
    if (meta.scale) C(meta.scale, RX + 32, r2, S.fx1, r1, 12);
    var nSheets = +meta.sheets || 1;
    T('Лист' + (nSheets > 1 ? ' 1' : ''), RX + 1, r3 + 1.4, LB);
    T('Листов ' + nSheets, RX + 21, r3 + 1.4, LB);
    var ol = wrap(meta.org, 47, function (t) { return font.widthOfTextAtSize(clean(t), 11) / PT; }).slice(0, 3);
    ol.forEach(function (l, i) { C(l, RX, Y + 7.5 + (ol.length - 1) * 2.4 - i * 4.8 - 2, S.fx1, Y + 7.5 + (ol.length - 1) * 2.4 - i * 4.8 + 2, 11); });
    // под рамкой
    T('Копировал', X + 70, 1.6, LB);
    var note = mode === 'ul' ? 'Подписано с использованием УЛ' + (str(meta.ulDesig) ? ' ' + str(meta.ulDesig) : '') : mode === 'ep' ? str(meta.epNote) : '';
    if (note) T(note, S.fx0, 1.6, LB, { max: X + 68 - S.fx0 });
    T('Формат ' + S.name, X + 140, 1.6, LB);

    doc.setTitle(str(meta.desig) + ' ' + str(meta.name));
    doc.setCreator('Инструменты ЕСКД: рамка');
    doc.setProducer('pdf-lib');
    // фиксированные даты: одинаковые реквизиты дают побайтно одинаковый файл (важно для хэш-кода в УЛ)
    var fixed = opt.fixedDate || new Date(Date.UTC(2000, 0, 1));
    doc.setCreationDate(fixed); doc.setModificationDate(fixed);
    var bytes = await doc.save();
    return { bytes: bytes, sheet: S, place: pl, natural: { w: iwMm, h: ihMm } };
  }

  var api = { FORMATS: FORMATS, sheet: sheet, placeImage: placeImage, autoFormat: autoFormat, render: render, VERSION: '0.2' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FRAME = api;
})(typeof window !== 'undefined' ? window : globalThis);
