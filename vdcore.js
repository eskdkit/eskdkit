/* Ведомость ссылочных документов (ВД) по ГОСТ Р 2.106-2019, п. 4.4: поиск ссылок в документах комплекта,
   наименования стандартов из перечней Росстандарта, разделы и порядок записи, PDF (А4, формы 2 и 2а). Без сети. */
(function (root) {
  'use strict';
  var VERSION = '0.1';
  var STD = root.STD || (typeof require !== 'undefined' ? require('./stdcore.js') : null);

  function sp(s) { return String(s || '').replace(/ /g, ' ').replace(/[–—−]/g, '-').replace(/\s+/g, ' ').trim(); }

  // Прочие документы: ОСТ, СТО/СТП, РД, ТУ (в т. ч. оформленные как КД: АБВГ.123456.001ТУ)
  var OTHER = [
    { kind: 'ost', re: /(?<![А-ЯЁA-Za-zа-яё])ОСТ\s?\d{1,3}(?:[\s.\-]?[А-ЯЁ]{1,3})?(?:[\s.\-]?\d[\d.]*)+(?:-\d{2,4})?(?![\d.]*\d)/g },
    { kind: 'sto', re: /(?<![А-ЯЁA-Za-zа-яё])СТ[ОП]\s?[\dА-ЯЁ][\dА-ЯЁ.\-]*\d(?:-\d{2,4})?/g },
    { kind: 'rd', re: /(?<![А-ЯЁA-Za-zа-яё])РД\s?\d[\d.\-]*\d/g },
    { kind: 'tu', re: /(?<![А-ЯЁA-Za-zа-яё])ТУ\s?\d[\d.\-]*\d(?:-\d{2,4})?/g },
    { kind: 'tu', re: /(?<![А-ЯЁA-Za-zа-яё.])[А-ЯЁ]{4}\.\d{6}\.\d{3,4}(?:-\d{1,3})?\s?ТУ\d?(?![А-ЯЁ])/g }
  ];

  function norm(d) {
    return sp(d).replace(/\s*-\s*/g, '-').replace(/^(ГОСТ|ОСТ|СТО|СТП|РД|ТУ|ПНСТ)(?=\d)/, '$1 ').replace(/^ГОСТ Р(?=\d)/, 'ГОСТ Р ').replace(/(\.\d{3,4}(?:-\d{1,3})?)\s+ТУ/, '$1ТУ');
  }

  /* Найти ссылки в тексте. Возвращает [{d, key, kind, at}] */
  function extract(text) {
    var t = sp(text), out = [], taken = [];
    function overlap(a, b) { return taken.some(function (r) { return a < r[1] && b > r[0]; }); }
    if (STD) STD.extract(t).forEach(function (r) {
      var raw = r.raw; out.push({ d: norm(raw), key: r.key, kind: 'gost', ref: r, at: r.at }); taken.push([r.at, r.at + raw.length]);
    });
    OTHER.forEach(function (o) {
      o.re.lastIndex = 0; var m;
      while ((m = o.re.exec(t))) {
        if (overlap(m.index, m.index + m[0].length)) continue;
        var d = norm(m[0]).replace(/[.\-]+$/, '');
        out.push({ d: d, key: d.toUpperCase().replace(/\s+/g, ' '), kind: o.kind, at: m.index });
        taken.push([m.index, m.index + m[0].length]);
      }
    });
    return out;
  }

  /* Раздел по п. 4.4.3 и вид документа для порядка внутри раздела */
  function section(item, opt) {
    if (item.kind !== 'gost') return 0; // документы организаций и отраслевые: ОСТ, СТО, РД, ТУ
    var p = item.ref;
    if (!opt.split) return 1;
    if (p && (p.idx === 'ГОСТ Р' || p.idx === 'ПНСТ')) return 1;
    return 2;
  }
  var SECTIONS = ['Документы организаций и отраслевые нормативные документы', 'Государственные (национальные) документы', 'Межгосударственные (международные) документы'];
  var KIND_ORDER = { gost: 0, ost: 0, sto: 0, rd: 2, tu: 1 }; // стандарты, ТУ, инструкции и прочие

  // сравнение обозначений «по возрастанию»: индекс, затем номер по числам
  var IDX_RANK = { 'ГОСТ': 0, 'ГОСТ Р': 1, 'ПНСТ': 2, 'ОСТ': 3, 'СТО': 4, 'СТП': 5, 'РД': 6, 'ТУ': 7 };
  function idxOf(d) { var m = /^(ГОСТ Р|ГОСТ|ПНСТ|ОСТ|СТО|СТП|РД|ТУ)(?=\s|\d)/.exec(d); return m ? m[1] : 'ТУ'; }
  function cmp(a, b) {
    var ia = IDX_RANK[idxOf(a.d)], ib = IDX_RANK[idxOf(b.d)];
    if (ia !== ib) return ia - ib;
    var ka = a.d.replace(/^(ГОСТ Р|ГОСТ|ПНСТ|ОСТ|СТО|СТП|РД|ТУ)\s*/, ''), kb = b.d.replace(/^(ГОСТ Р|ГОСТ|ПНСТ|ОСТ|СТО|СТП|РД|ТУ)\s*/, '');
    return ka.localeCompare(kb, 'ru', { numeric: true });
  }

  /* Собрать ВД: docs = [{name, text|pages:[{num,text}]}], db — STD.Db или null.
     opt: split (разделять национальные и межгосударственные), skipOwn (не включать обозначения самого комплекта) */
  function build(docs, db, opt) {
    opt = opt || {};
    var map = {}, own = {};
    docs.forEach(function (doc) {
      var pages = doc.pages || [{ num: 0, text: doc.text || '' }];
      pages.forEach(function (pg) {
        // обозначения документов самого комплекта (из основных надписей) не являются ссылочными (примечание к п. 4.4.1)
        extract(pg.text).forEach(function (r) {
          var m = map[r.key] || (map[r.key] = { d: r.d, key: r.key, kind: r.kind, ref: r.ref, where: {}, n: 0, variants: {} });
          m.n++; m.variants[r.d] = 1;
          var w = m.where[doc.name] || (m.where[doc.name] = []); if (pg.num && w.indexOf(pg.num) < 0) w.push(pg.num);
        });
      });
      if (doc.desig) own[String(doc.desig).replace(/\s+/g, '').toUpperCase()] = 1;
    });
    var items = Object.keys(map).map(function (k) { return map[k]; });
    if (opt.skipOwn !== false) items = items.filter(function (it) { return !(it.kind === 'tu' && own[it.d.replace(/\s+/g, '').replace(/ТУ\d?$/, '').toUpperCase()]); });
    items.forEach(function (it) {
      it.name = ''; it.status = null; it.current = null;
      if (it.kind === 'gost' && db && it.ref) {
        var r = db.check(it.ref);
        it.status = r.status; it.current = r.current; it.next = r.next;
        it.name = (r.entry && r.entry.t) || '';
        if (!it.name && r.current && (r.status === 'undated' || r.status === 'replaced' || r.status === 'wrongyear')) it.name = r.current.t || '';
      }
      it.section = section(it, opt);
    });
    var sections = [[], [], []];
    items.forEach(function (it) { sections[it.section].push(it); });
    sections.forEach(function (s) { s.sort(function (a, b) { return (KIND_ORDER[a.kind] - KIND_ORDER[b.kind]) || cmp(a, b); }); });
    return { sections: sections.map(function (list, i) { return { title: SECTIONS[i], items: list }; }).filter(function (s) { return s.items.length; }), count: items.length };
  }

  /* ---------- PDF: форма 4 (графы «№ строки», «Обозначение», «Наименование»), А4 ---------- */
  var G = { cols: [20, 28, 98, 205], headH: 15, rowH: 8, tb1: 40, tb2: 15 };

  function paginate(vd, F, measure, opt) {
    var rowsFirst = Math.floor((F.fy1 - G.headH - (F.fy0 + G.tb1)) / G.rowH), rowsNext = Math.floor((F.fy1 - G.headH - (F.fy0 + G.tb2)) / G.rowH);
    var cw = function (i) { return G.cols[i + 1] - G.cols[i] - 2; };
    var pages = [[]], cap = rowsFirst, no = 0;
    function free() { return cap - pages[pages.length - 1].length; }
    function newPage() { pages.push([]); cap = rowsNext; }
    function emit(r) { pages[pages.length - 1].push(r); }
    vd.sections.forEach(function (s, si) {
      var rows = s.items.filter(function (it) { return it.on !== false; }).map(function (it) {
        var ds = measure.wrap(it.d, cw(1)), nm = measure.wrap(it.name || '', cw(2));
        return { it: it, ds: ds, nm: nm, n: Math.max(ds.length, nm.length, 1) };
      });
      if (!rows.length) return;
      var hl = opt.headings === false ? [] : measure.wrap(s.title, cw(2));
      var need = (si > 0 && pages[pages.length - 1].length ? 1 : 0) + hl.length + rows[0].n;
      if (free() < need) newPage();
      if (pages[pages.length - 1].length) emit({ type: 'blank' });
      hl.forEach(function (t) { emit({ type: 'head', text: t }); });
      rows.forEach(function (x) {
        if (free() < x.n) newPage();
        no++;
        for (var k = 0; k < x.n; k++) emit({ type: 'item', no: k === 0 ? String(no) : '', des: x.ds[k] || '', name: x.nm[k] || '' });
      });
    });
    return { pages: pages, rowsFirst: rowsFirst, rowsNext: rowsNext, count: no };
  }

  async function render(PDFLib, fontkit, fontBytes, vd, meta, opt) {
    opt = opt || {};
    var E = root.ESKDPDF || (typeof require !== 'undefined' ? require('./eskdpdf.js') : null);
    var F = E.fmt('A4');
    var K = await E.create(PDFLib, fontkit, fontBytes, opt);
    var SZ = K.SZ;
    var measure = { wrap: function (t, w) { return t ? K.wrapW(t, w, SZ.body) : ['']; } };
    var pg = paginate(vd, F, measure, opt), total = pg.pages.length, X = G.cols;
    pg.pages.forEach(function (rows, i) {
      var p = K.addPage(F), first = i === 0, n = first ? pg.rowsFirst : pg.rowsNext;
      K.sideGraphs(p, F, first, meta);
      var top = F.fy1, ht = top - G.headH, bottom = F.fy0 + (first ? G.tb1 : G.tb2), RH = (ht - bottom) / n;
      K.L(p, X[0], ht, X[3], ht, K.thick);
      X.slice(1, 3).forEach(function (x) { K.L(p, x, top, x, bottom, K.thick); });
      K.C(p, '№', X[0], ht + 7, X[1], top - 2, SZ.head - 1); K.C(p, 'строки', X[0], ht + 2, X[1], ht + 7, SZ.head - 3);
      K.C(p, 'Обозначение', X[1], ht, X[2], top, SZ.head);
      K.C(p, 'Наименование', X[2], ht, X[3], top, SZ.head);
      for (var r = 1; r < n; r++) K.L(p, X[0], ht - r * RH, X[3], ht - r * RH, K.thin);
      rows.forEach(function (row, k) {
        var y1 = ht - k * RH, y0 = y1 - RH, base = y0 + 2.4;
        if (row.type === 'head') {
          var w = K.width(row.text, SZ.body), x0 = X[2] + (X[3] - X[2] - w) / 2;
          K.T(p, row.text, x0, base, SZ.body, { max: X[3] - X[2] - 2 });
          K.L(p, x0, base - 0.9, x0 + Math.min(w, X[3] - X[2] - 2), base - 0.9, 0.25 * E.PT);
          return;
        }
        if (row.type !== 'item') return;
        if (row.no) K.C(p, row.no, X[0], y0, X[1], y1, SZ.body - 1);
        K.T(p, row.des, X[1] + 1, base, SZ.body, { max: X[2] - X[1] - 2 });
        K.T(p, row.name, X[2] + 1, base, SZ.body, { max: X[3] - X[2] - 2 });
      });
      if (first) K.form2(p, F, meta, total); else K.form2a(p, F, meta, i + 1);
      K.footer(p, F);
    });
    var bytes = await K.save(meta, 'Инструменты ЕСКД: ведомость ссылочных документов');
    return { bytes: bytes, pages: total, count: pg.count };
  }

  function tableRows(vd) {
    var out = [['№ строки', 'Обозначение', 'Наименование', 'Где есть ссылки', 'Статус']], no = 0;
    vd.sections.forEach(function (s) {
      out.push(['', '', s.title, '', '']);
      s.items.forEach(function (it) {
        if (it.on === false) return;
        no++;
        out.push([String(no), it.d, it.name || '', whereText(it), it.status || '']);
      });
    });
    return out;
  }
  function pagesText(list) {
    var out = [], i = 0; list = list.slice().sort(function (a, b) { return a - b; });
    while (i < list.length) { var j = i; while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++; out.push(j > i + 1 ? list[i] + '–' + list[j] : j === i + 1 ? list[i] + ', ' + list[j] : String(list[i])); i = j + 1; }
    return out.join(', ');
  }
  function whereText(it) { return Object.keys(it.where).map(function (f) { var p = it.where[f]; return f + (p.length ? ' (л. ' + pagesText(p) + ')' : ''); }).join('; '); }

  var api = { VERSION: VERSION, extract: extract, build: build, paginate: paginate, render: render, tableRows: tableRows, whereText: whereText, SECTIONS: SECTIONS, G: G };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VD = api;
})(typeof window !== 'undefined' ? window : globalThis);
