/* Удостоверяющий лист (УЛ) электронных конструкторских документов по ГОСТ Р 2.051-2023, приложение А, форма 1.
   Лист А4 книжный; основная надпись по форме 2 ГОСТ Р 2.104 на каждом листе (подписи повторяются на всех листах).
   Графы: а — № п/п, б — обозначение, в — версия (номер изменения), г — наименование, д — хэш-код, е — алгоритм,
   ж — резервные (имя файла, размер, дата изменения), и — свободное поле. */
(function (root) {
  'use strict';
  var COLS = [ // мм, сумма 185
    { k: 'n', t: ['№', 'п/п'], w: 10 },
    { k: 'desig', t: 'Обозначение документа', w: 47 },
    { k: 'ver', t: 'Версия (изм.)', w: 13 },
    { k: 'name', t: 'Наименование документа', w: 52 },
    { k: 'hash', t: 'Хэш-код', w: 63 }
  ];
  function ulDesig(desig) {
    desig = String(desig || '').trim();
    return desig ? desig + '-УЛ' : '';
  }
  function fmtSize(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' байт'; }

  async function render(PDFLib, fontkit, fontBytes, E, items, meta) {
    var D = await E.create(PDFLib, fontkit, fontBytes, {});
    var F = E.fmt('A4'), x0 = F.fx0, x1 = F.fx1, LH = 4.6, FS = 9, FSs = 7.5, HS = 8.5;
    var bottomLimit = F.fy0 + 40 + 4; // над основной надписью формы 2
    var title = { desig: meta.ulDesig, name: meta.name || '', docName: 'Удостоверяющий лист', org: meta.org, razrab: meta.razrab, prov: meta.prov,
      l3: meta.l3, r3: meta.r3, nkontr: meta.nkontr, utv: meta.utv, l1: meta.l1, l2: meta.l2, l4: meta.l4, l5: meta.l5, lit: meta.lit, ver: meta.ver,
      signDate: meta.signDate };
    var xs = [x0]; COLS.forEach(function (c) { xs.push(xs[xs.length - 1] + c.w); });
    var hashW = COLS[4].w - 2;

    // разметка строк: каждая запись — основная строка (а–д) и строка граф е, ж
    var blocks = items.map(function (it, i) {
      var cells = [
        [items.length > 1 ? String(i + 1) : '–'],
        D.wrapW(it.desig || '', COLS[1].w - 2, FS),
        D.wrapW(it.ver || '', COLS[2].w - 2, FS),
        D.wrapW(it.name || '', COLS[3].w - 2, FS),
        [String(it.hash || '').slice(0, 32), String(it.hash || '').slice(32)]
      ];
      var rows = Math.max.apply(null, cells.map(function (c) { return c.length; }));
      var extra = ['Алгоритм: ' + (it.alg || 'ГОСТ Р 34.11-2012 (256 бит)')];
      if (it.file) extra.push('Файл: ' + it.file);
      if (it.size != null) extra.push('Размер: ' + fmtSize(it.size));
      if (it.mtime) extra.push('Изменён: ' + it.mtime);
      var ex = D.wrapW(extra.join('; '), x1 - xs[1] - 2, FSs);
      return { cells: cells, h: rows * LH + 1.4, eh: ex.length * 3.6 + 1.4, ex: ex };
    });

    var pages = [], cur = null, y;
    function newPage() {
      var p = D.addPage(F); cur = { p: p }; pages.push(cur);
      y = F.fy1;
      // шапка таблицы
      var hh = 10;
      D.R(p, x0, y - hh, x1, y, D.thick);
      xs.forEach(function (x, k) { if (k > 0 && k < xs.length - 1) D.L(p, x, y, x, y - hh, D.thick); });
      COLS.forEach(function (c, k) {
        var lines = Array.isArray(c.t) ? c.t : D.wrapW(c.t, c.w - 2, HS);
        lines.forEach(function (l, i) { D.C(p, l, xs[k], y - hh / 2 + (lines.length - 1) * 1.8 - i * 3.6 - 1.8, xs[k + 1], y - hh / 2 + (lines.length - 1) * 1.8 - i * 3.6 + 1.8, HS); });
      });
      y -= hh;
      return p;
    }
    newPage();
    blocks.forEach(function (b) {
      if (y - b.h - b.eh < bottomLimit + 12) newPage();
      var p = cur.p, top = y, mid = y - b.h, bot = mid - b.eh;
      xs.forEach(function (x, k) { if (k > 0 && k < xs.length - 1) D.L(p, x, top, x, mid, D.thin); });
      D.L(p, xs[1], mid, x1, mid, D.thin);
      D.L(p, xs[1], mid, xs[1], bot, D.thin);
      D.L(p, x0, bot, x1, bot, D.thin);
      b.cells.forEach(function (lines, k) {
        lines.forEach(function (l, i) {
          var ty = top - 1.2 - (i + 1) * LH + 1.3;
          if (k === 0) D.T(p, l, (xs[0] + xs[1]) / 2, ty, FS, { align: 'center' });
          else if (k === 4) D.T(p, l, xs[k] + 1, ty, FS, { max: hashW });
          else D.T(p, l, xs[k] + 1, ty, FS, { max: COLS[k].w - 2 });
        });
      });
      b.ex.forEach(function (l, i) { D.T(p, l, xs[1] + 1, mid - 0.8 - (i + 1) * 3.6 + 1, FSs); });
      y = bot;
    });
    // наружный контур таблицы
    pages.forEach(function (pg, i) {
      var yb = i === pages.length - 1 ? y : bottomLimit + 12;
      pg.yb = yb;
    });
    pages.forEach(function (pg) { D.L(pg.p, x0, F.fy1, x0, pg.yb, D.thick); D.L(pg.p, x1, F.fy1, x1, pg.yb, D.thick); });
    // и — свободное поле (справочные данные ко всем документам)
    var last = pages[pages.length - 1];
    var free = String(meta.free || '').trim();
    if (free) {
      var fl = D.wrapW(free, x1 - x0 - 4, FS), fy = y - 6;
      if (fy - fl.length * LH < bottomLimit) { newPage(); last = pages[pages.length - 1]; fy = F.fy1 - 8; }
      fl.forEach(function (l, i) { D.T(last.p, l, x0 + 2, fy - i * LH, FS); });
    }
    pages.forEach(function (pg) { D.form2(pg.p, F, Object.assign({}, title), pages.length); D.footer(pg.p, F); });
    // номер листа на последующих листах: форма 1 одна на всех листах, ставим номер в графу «Лист»
    if (pages.length > 1) pages.forEach(function (pg, i) {
      if (i === 0) return;
      var d = F.fx1 - 205, top = F.fy0 + 40;
      pg.p.drawRectangle({ x: (d + 170.3) * E.PT, y: (top - 24.7) * E.PT, width: 14.4 * E.PT, height: 4.4 * E.PT, color: PDFLib.rgb(1, 1, 1) });
      D.C(pg.p, String(i + 1), d + 170, top - 25, d + 185, top - 20, D.SZ.tbLabel + 1);
    });
    var fixed = meta.fixedDate || new Date(Date.UTC(2000, 0, 1));
    D.doc.setCreationDate(fixed); D.doc.setModificationDate(fixed);
    return await D.save(title, 'Инструменты ЕСКД: удостоверяющий лист');
  }

  // обозначение и наименование из имени файла: «АБВГ.123456.001 СБ Корпус.pdf»
  var DES = /([А-ЯЁA-Z]{2,4}\.\d{6}\.\d{3}(?:-\d{2,3})?(?:\s?[А-ЯЁ]{1,3}\d{0,2}(?![А-Яа-яЁё]))?)/;
  function fromFileName(fn) {
    var base = String(fn || '').replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
    var m = base.match(DES);
    if (!m) return { desig: base, name: '' };
    var rest = (base.slice(0, m.index) + ' ' + base.slice(m.index + m[0].length)).replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
    return { desig: m[1].trim(), name: rest };
  }

  var api = { render: render, ulDesig: ulDesig, fromFileName: fromFileName, COLS: COLS, VERSION: '0.1' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.UL = api;
})(typeof window !== 'undefined' ? window : globalThis);
