/* Ведомость покупных изделий (ВП) из спецификаций по ГОСТ Р 2.106-2019 (п. 4.5, формы 5 и 5а)
   и сводная потребность в материалах на изделие (не форма ЕСКД — справочная таблица). */
(function (root) {
  'use strict';
  var VERSION = '0.2';
  function str(v) { return v == null ? '' : String(v).replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }
  function low(v) { return str(v).toLowerCase().replace(/ё/g, 'е'); }
  var DESIG = /([А-ЯЁA-Z]{4}\.\d{6}\.\d{3}(?:-\d{2,3})?)/;

  // «0,01 кг» → { n: 0.01, unit: 'кг' }; «1/16» → 0.0625
  function num(q) {
    var s = str(q).replace(',', '.'), m = /^(\d+(?:\.\d+)?)(?:\/(\d+))?\s*([А-Яа-яA-Za-z.²³0-9]*)$/.exec(s);
    if (!m) return null;
    var n = +m[1]; if (m[2]) n = n / +m[2];
    return { n: n, unit: (m[3] || '').replace(/\.$/, ''), frac: !!m[2] };
  }
  // дробное количество из спецификации («1/16» — одна упаковка на 16 изделий) выводим дробью
  function fmtQ(n, frac) {
    if (n == null || !isFinite(n) || !n) return '';
    if (frac && Math.abs(n - Math.round(n)) > 1e-9) {
      for (var d = 2; d <= 1000; d++) { var p = n * d; if (Math.abs(p - Math.round(p)) < 1e-7) { p = Math.round(p); var w = Math.floor(p / d); return w ? fmtNum(n) : p + '/' + d; } }
    }
    return fmtNum(n);
  }
  function fmtNum(n) {
    if (n == null || !isFinite(n)) return '';
    var r = Math.abs(n) >= 0.01 || n === 0 ? Math.round(n * 10000) / 10000 : Number(n.toPrecision(3)); // малые нормы — три значащие цифры
    return String(r).replace('.', ',');
  }

  /* ---------- Наименование и документ на поставку ---------- */
  var DOCRE = /\s+((?:ГОСТ\s?Р?\s?(?:ИСО|МЭК|IEC|ISO)?\s?[\d.]+[-–]\d{2,4})|(?:ОСТ\s?[\d.]+[-–]\d{2,4})|(?:[А-ЯЁA-Z]{2,4}\d?\.\d{3,6}\.\d{3}(?:-\d{2,3})?\s?ТУ)|(?:ТУ\s?[\d.\-–]+(?:-\d{2,4})?)|(?:[\d.]+[-–][\d\-–]+\s?ТУ))$/;
  function splitDoc(name) {
    var s = str(name), m = DOCRE.exec(s);
    return m ? { name: s.slice(0, m.index).trim(), doc: m[1].replace(/\s+/g, ' ') } : { name: s, doc: '' };
  }

  /* ---------- Разделы ВП по функциональному назначению (п. 4.5.2) ---------- */
  var SECT = [
    [/^резистор|^терморезистор|^варистор|^потенциометр/, 'Резисторы'], [/^конденсатор/, 'Конденсаторы'], [/^микросхем/, 'Микросхемы'],
    [/^диод|^стабилитрон|^супрессор|^диодн/, 'Диоды'], [/^светодиод|^индикатор/, 'Индикаторы'], [/^транзистор|^тиристор|^симистор|^оптопара|^оптрон/, 'Транзисторы и тиристоры'],
    [/^вилк|^розетк|^соединител|^разъем|^разъём|^клеммник|^колодк|^гнезд|^штыр/, 'Соединители'], [/^кнопк|^переключател|^выключател|^микропереключ/, 'Переключатели'],
    [/^реле/, 'Реле'], [/^резонатор|^кварц|^генератор/, 'Резонаторы и генераторы'], [/^дроссел|^индуктивн|^катушк|^трансформатор/, 'Моточные изделия'],
    [/^предохранител/, 'Предохранители'], [/^батаре|^аккумулятор|^элемент питания/, 'Элементы питания'], [/^провод|^кабел|^шнур|^жгут/, 'Провода и кабели'],
    [/^подшипник/, 'Подшипники'], [/^датчик|^сенсор/, 'Датчики'], [/^модуль/, 'Модули'], [/^излучател|^зуммер|^динамик|^пьезо/, 'Звуковые излучатели'],
    [/^двигател|^вентилятор/, 'Двигатели и вентиляторы'], [/^плата|^печатн/, 'Печатные платы']
  ];
  // порядок разделов ВП — как в спецификации: (в сквозной ВП) «Детали», затем покупные по назначению и «Прочие», затем «Материалы»
  function secRank(t) { return { 'Детали': -1, 'Прочие': 1, 'Материалы': 3 }[t] || 0; }
  function sectionOf(name) { var n = low(name); for (var i = 0; i < SECT.length; i++) if (SECT[i][0].test(n)) return SECT[i][1]; return 'Прочие'; }

  /* ---------- Состав изделия ---------- */
  // specs: [{ base, name, items:[{section, base, name, qty, note, multi}], group, file }]
  function build(specs, rootBase, opt) {
    opt = opt || {};
    var warn = [], by = {};
    specs.forEach(function (s) { if (s.base) { if (by[s.base]) warn.push({ sev: 'warn', msg: 'Спецификация ' + s.base + ' загружена дважды (' + by[s.base].file + ', ' + s.file + '). Учтена первая.' }); else by[s.base] = s; } });
    var rootSpec = by[rootBase];
    if (!rootSpec) return { error: 'Не найдена спецификация изделия ' + rootBase + '.', warnings: warn };
    // кратность каждой спецификации на одно изделие: отдельно «на изделие» и «в комплекты»
    var mult = {}, kit = {}, order = [], missing = {};
    function visit(s, m, inKit, path) {
      if (path.indexOf(s.base) >= 0) { warn.push({ sev: 'error', msg: 'Циклическая ссылка в составе: ' + path.concat(s.base).join(' → ') + '.' }); return; }
      if (!mult[s.base]) { mult[s.base] = 0; kit[s.base] = 0; order.push(s.base); }
      if (inKit) kit[s.base] += m; else mult[s.base] += m;
      s.items.forEach(function (it) {
        if (['Комплексы', 'Сборочные единицы', 'Комплекты'].indexOf(it.section) < 0 || !it.base) return;
        var child = by[it.base];
        var q = num(it.qty);
        if (!child) { if (!missing[it.base]) { missing[it.base] = s.base; } return; }
        if (it.multi || !q) { warn.push({ sev: 'error', msg: 'В спецификации ' + s.base + ' не удалось прочитать количество для ' + it.base + ' — её покупные изделия не учтены.' }); return; }
        visit(child, m * q.n, inKit || it.section === 'Комплекты', path.concat(s.base));
      });
    }
    visit(rootSpec, 1, false, []);
    Object.keys(missing).forEach(function (b) {
      warn.push({ sev: 'note', msg: 'Нет спецификации на ' + b + ' (входит в ' + missing[b] + '). Если это сборочная единица с покупными изделиями, загрузите и её спецификацию.' });
    });
    specs.forEach(function (s) { if (s.base && mult[s.base] == null) warn.push({ sev: 'note', msg: 'Спецификация ' + s.base + ' не входит в состав ' + rootBase + ' и не учтена.' }); });

    var entries = {}, mats = {};
    order.forEach(function (b) {
      var s = by[b];
      if (s.group) { warn.push({ sev: 'error', msg: 'Спецификация ' + b + ' — групповая (количество по исполнениям). Такие спецификации пока не поддерживаются: выгрузите нужное исполнение в Excel.' }); return; }
      // заготовка детали (строка «… (Заготовка)» сразу под деталью) — не отдельная деталь, а то, из чего деталь делают
      var blankOf = new Map(), prevDet = null;
      s.items.forEach(function (it) {
        if (it.section !== 'Детали') { prevDet = null; return; }
        if (/заготовк/i.test(it.name) && prevDet) { blankOf.set(prevDet, it); it._blank = true; return; }
        prevDet = it;
      });
      s.items.forEach(function (it) {
        if (opt.through && it._blank) return;
        // сквозная ВП: детали — покупные, если на них нет норм материалов; с нормами — разбираются на материалы
        if (opt.through && it.section === 'Детали') {
          var qd = num(it.qty) || num(it.note);
          if (!qd) { warn.push({ sev: 'warn', msg: 'В спецификации ' + b + ' не указано количество для детали «' + (it.base || it.name) + '» — строка пропущена.' }); return; }
          var nr = it.base && opt.norms ? opt.norms[it.base] : null, bl = blankOf.get(it), k2 = 1;
          // нет норм на саму деталь — берём нормы её заготовки (количество заготовок на одну деталь)
          if (!nr && bl && bl.base && opt.norms && opt.norms[bl.base]) { nr = opt.norms[bl.base]; var qb = num(bl.qty); k2 = qb ? qb.n / qd.n : 1; }
          if (!nr || opt.keepParts) addEntry(it.name, it.base || '', 'Детали', bl ? 'из заготовки ' + (bl.base || bl.name) : '', b, qd.n, qd.frac);
          if (nr) nr.forEach(function (m) {
            addEntry(m.name, m.doc, 'Материалы', m.unit, it.base, m.n * qd.n * k2, false, b);
            addMat(m.name, m.doc, m.unit, it.base, m.n * qd.n * k2, b);
          });
          return;
        }
        // в «Стандартные изделия» по ГОСТ Р 2.106 пишут только изделия по ГОСТ, ОСТ, стандартам организаций;
        // остальное (DIN, ISO, изделия без стандарта) — покупное, и в ВП оно попадает в любом случае
        var notStd = it.section === 'Стандартные изделия' && !/(^|[\s(])(ГОСТ|ОСТ|РСТ|СТО|СТП)(?=[\s\d]|$)/.test(it.name + ' ' + (it.note || ''));
        if (notStd) warn.push({ sev: 'warn', msg: 'В спецификации ' + b + ' строка «' + it.name + '» стоит в разделе «Стандартные изделия», но изделие не по ГОСТ, ОСТ или стандарту организации. По ГОСТ Р 2.106 место ему в «Прочих изделиях»; в ВП оно включено как покупное.' });
        var isBuy = it.section === 'Прочие изделия' || notStd || (opt.withStandard && it.section === 'Стандартные изделия');
        var isMat = it.section === 'Материалы';
        if (!isBuy && !isMat) return;
        var q = num(it.qty) || num(it.note);
        if (!q) { warn.push({ sev: 'warn', msg: 'В спецификации ' + b + ' не указано количество для «' + it.name + '» — строка пропущена.' }); return; }
        var sd = splitDoc(it.name);
        if (isMat) {
          var unit = q.unit || (num('1 ' + str(it.note)) || {}).unit || '';
          addMat(sd.name, sd.doc, unit, b, q.n, b);
          if (opt.through) addEntry(sd.name, sd.doc, 'Материалы', unit, b, q.n, q.frac);
          return;
        }
        addEntry(sd.name, sd.doc, sectionOf(sd.name), it.note && !num(it.note) ? it.note : '', b, q.n, q.frac);
      });
    });
    // kuda — куда входит; qn — количество в одну единицу «куда входит»; mb — спецификация, кратность которой берётся (по умолчанию kuda)
    function addEntry(name, doc, section, note, kuda, qn, frac, mb) {
      mb = mb || kuda;
      var k = section + '|' + low(name) + '|' + doc + (section === 'Материалы' ? '|' + note : '');
      if (!entries[k]) entries[k] = { name: name, doc: doc, section: section, rows: [], note: note };
      var e = entries[k], row = e.rows.filter(function (r) { return r.kuda === kuda; })[0];
      if (!row) { row = { kuda: kuda, perItem: 0, inKits: 0, frac: false }; e.rows.push(row); }
      row.perItem += qn * mult[mb]; row.inKits += qn * kit[mb];
      if (section !== 'Материалы' && (frac || !Number.isInteger(mult[mb] + kit[mb]))) row.frac = true; // материалы — всегда десятичной дробью
    }
    function addMat(name, doc, unit, kuda, qn, mb) {
      var km = low(name) + '|' + doc + '|' + unit;
      if (!mats[km]) mats[km] = { name: name, doc: doc, unit: unit, total: 0, parts: [] };
      mats[km].total += qn * (mult[mb] + kit[mb]); mats[km].parts.push({ kuda: kuda, qty: qn, mult: mult[mb] + kit[mb] });
    }
    // разделы и порядок: по алфавиту разделов («Прочие» — в конце), внутри — по наименованию
    var groups = {};
    Object.keys(entries).forEach(function (k) { var e = entries[k]; (groups[e.section] = groups[e.section] || []).push(e); });
    var natural = function (a, b) { return a.localeCompare(b, 'ru', { numeric: true, sensitivity: 'base' }); };
    var names = Object.keys(groups).sort(function (a, b) { return secRank(a) - secRank(b) || natural(a, b); });
    var sections = names.map(function (n) {
      var list = groups[n].sort(function (a, b) { return natural(a.name, b.name) || natural(a.doc, b.doc); });
      list.forEach(function (e) { e.rows.sort(function (a, b) { return (a.kuda === rootBase ? -1 : 0) - (b.kuda === rootBase ? -1 : 0) || natural(a.kuda, b.kuda); }); });
      return { title: n, entries: list };
    });
    var materials = Object.keys(mats).map(function (k) { return mats[k]; }).sort(function (a, b) { return natural(a.name, b.name); });
    return { sections: sections, materials: materials, warnings: warn, used: order, mult: mult, kit: kit };
  }

  /* ---------- Геометрия: А3 горизонтально, формы 5 и 5а ---------- */
  // № строки 7, Наименование 60, Код продукции 45, Обозначение документа на поставку 70, Поставщик 55,
  // Куда входит 70, Количество: на изделие 16, в комплекты 16, на регулир. 16, всего 16, Примечание 24 (итого 395)
  var W = [7, 60, 45, 70, 55, 70, 16, 16, 16, 16, 24];
  var X = [20]; W.forEach(function (w, i) { X.push(X[i] + w); });
  var G = { X: X, headH: 27, rowsFirst: 24, rowsNext: 29, tb1: 40, tb2: 15 };

  function lines(res, measure, opt) {
    opt = opt || {};
    var cw = function (i) { return X[i + 1] - X[i] - 2; }, out = [];
    res.sections.forEach(function (s, si) {
      if (si > 0) out.push({ type: 'blank' });
      out.push({ type: 'head', text: s.title, keep: 1 });
      s.entries.forEach(function (e) {
        var nm = measure.wrap(e.name, cw(1)), dc = measure.wrap(e.doc, cw(3)), nt = measure.wrap(e.note, cw(10));
        var total = 0, block = [];
        e.rows.forEach(function (r, ri) {
          var t = r.perItem + r.inKits; total += t;
          var kd = measure.wrap(r.kuda, cw(5));
          var n = ri === 0 ? Math.max(nm.length, dc.length, nt.length, kd.length, 1) : kd.length;
          for (var l = 0; l < n; l++) block.push({ type: 'item', name: ri === 0 ? nm[l] || '' : '', doc: ri === 0 ? dc[l] || '' : '', note: ri === 0 ? nt[l] || '' : '',
            kuda: kd[l] || '', perItem: l === 0 ? fmtQ(r.perItem || null, r.frac) : '', inKits: l === 0 ? fmtQ(r.inKits || null, r.frac) : '', total: l === 0 ? fmtQ(t, r.frac) : '' });
          if (r.frac) e.frac = true;
        });
        if (e.rows.length > 1) block.push({ type: 'item', name: '', doc: '', note: '', kuda: '', perItem: '', inKits: '', total: fmtQ(total, e.frac), sum: true });
        block[0].start = block.length;
        out.push.apply(out, block);
      });
    });
    return out;
  }

  function paginate(rows) {
    var pages = [[]], cap = G.rowsFirst;
    function free() { return cap - pages[pages.length - 1].length; }
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var need = r.start || (r.type === 'head' ? 1 + (rows[i + 1] && rows[i + 1].start || 1) : 1);
      if (r.type === 'blank' && free() <= 1) { pages.push([]); cap = G.rowsNext; continue; }
      if (free() < Math.min(need, cap)) { pages.push([]); cap = G.rowsNext; if (r.type === 'blank') continue; }
      pages[pages.length - 1].push(r);
    }
    return pages;
  }

  async function render(PDFLib, fontkit, fontBytes, res, meta, opt) {
    opt = opt || {};
    var E = root.ESKDPDF || (typeof require !== 'undefined' ? require('./eskdpdf.js') : null);
    var F = E.fmt('A3L');
    var K = await E.create(PDFLib, fontkit, fontBytes, opt), SZ = K.SZ;
    var measure = { wrap: function (t, w) { return K.wrapW(t, w, SZ.body); } };
    var pages = paginate(lines(res, measure, opt)), total = pages.length;
    pages.forEach(function (rows, i) {
      var p = K.addPage(F), first = i === 0, n = first ? G.rowsFirst : G.rowsNext;
      K.sideGraphs(p, F, first, meta);
      var top = F.fy1, ht = top - G.headH, bottom = F.fy0 + (first ? G.tb1 : G.tb2), RH = (ht - bottom) / n;
      // шапка
      K.L(p, X[0], ht, X[11], ht, K.thick);
      for (var c = 1; c < 11; c++) K.L(p, X[c], c >= 7 && c <= 9 ? ht + 18 : top, X[c], ht - n * RH, K.thick);
      K.L(p, X[6], ht + 18, X[10], ht + 18, K.thin);
      K.C(p, '№ строки', X[0], ht, X[1], top, SZ.head - 3, { rot: true });
      K.C(p, 'Наименование', X[1], ht, X[2], top, SZ.head);
      K.C(p, 'Код', X[2], ht + 13, X[3], ht + 19, SZ.head); K.C(p, 'продукции', X[2], ht + 7, X[3], ht + 13, SZ.head);
      K.C(p, 'Обозначение документа', X[3], ht + 13, X[4], ht + 19, SZ.head); K.C(p, 'на поставку', X[3], ht + 7, X[4], ht + 13, SZ.head);
      K.C(p, 'Поставщик', X[4], ht, X[5], top, SZ.head);
      K.C(p, 'Куда входит', X[5], ht + 13, X[6], ht + 19, SZ.head); K.C(p, '(обозначение)', X[5], ht + 7, X[6], ht + 13, SZ.head);
      K.C(p, 'Количество', X[6], ht + 18, X[10], top, SZ.head);
      [['на из-', 'делие'], ['в ком-', 'плекты'], ['на ре-', 'гулир.'], ['всего', '']].forEach(function (t, k) {
        if (t[1]) { K.C(p, t[0], X[6 + k], ht + 9, X[7 + k], ht + 14, SZ.head - 2); K.C(p, t[1], X[6 + k], ht + 4, X[7 + k], ht + 9, SZ.head - 2); }
        else K.C(p, t[0], X[6 + k], ht, X[7 + k], ht + 18, SZ.head - 2);
      });
      K.C(p, 'Приме-', X[10], ht + 13, X[11], ht + 19, SZ.head - 1); K.C(p, 'чание', X[10], ht + 7, X[11], ht + 13, SZ.head - 1);
      // строки
      for (var r = 0; r < n; r++) {
        var y1 = ht - r * RH, y0 = y1 - RH;
        if (r > 0) K.L(p, X[0], y1, X[11], y1, K.thin);
        K.C(p, String(r + 1), X[0], y0, X[1], y1, SZ.small + 1);
      }
      K.L(p, X[0], ht - n * RH, X[11], ht - n * RH, K.thick);
      rows.forEach(function (row, k) {
        var y1 = ht - k * RH, y0 = y1 - RH, base = y0 + (RH - 3.2) / 2 + 0.6;
        if (row.type === 'head') {
          var w = K.T(p, row.text, (X[1] + X[2]) / 2, base, SZ.body, { align: 'center', max: X[2] - X[1] - 2 });
          if (w) K.L(p, (X[1] + X[2]) / 2 - w / 2, base - 0.9, (X[1] + X[2]) / 2 + w / 2, base - 0.9, K.thin);
          return;
        }
        if (row.type !== 'item') return;
        K.T(p, row.name, X[1] + 1, base, SZ.body, { max: X[2] - X[1] - 2 });
        K.T(p, row.doc, X[3] + 1, base, SZ.body, { max: X[4] - X[3] - 2 });
        K.T(p, row.kuda, X[5] + 1, base, SZ.body, { max: X[6] - X[5] - 2 });
        if (row.perItem) K.C(p, row.perItem, X[6], y0, X[7], y1, SZ.body - (row.perItem.length > 4 ? 2 : 0));
        if (row.inKits) K.C(p, row.inKits, X[7], y0, X[8], y1, SZ.body - (row.inKits.length > 4 ? 2 : 0));
        if (row.total) K.C(p, row.total, X[9], y0, X[10], y1, SZ.body - (row.total.length > 4 ? 2 : 0));
        if (row.sum) K.L(p, X[9] + 2, y1 - 0.8, X[10] - 2, y1 - 0.8, K.thick); // итоговая черта
        K.T(p, row.note, X[10] + 1, base, SZ.body - 2, { max: X[11] - X[10] - 2 });
      });
      if (first) K.form2(p, F, meta, total); else K.form2a(p, F, meta, i + 1);
      K.footer(p, F);
    });
    var bytes = await K.save(meta, 'Инструменты ЕСКД: ведомость покупных изделий');
    return { bytes: bytes, pages: total };
  }

  function tableRows(res) {
    var out = [['Наименование', 'Код продукции', 'Обозначение документа на поставку', 'Поставщик', 'Куда входит (обозначение)', 'Кол. на изделие', 'Кол. в комплекты', 'Кол. на регулир.', 'Кол. всего', 'Примечание']];
    res.sections.forEach(function (s) {
      out.push([s.title, '', '', '', '', '', '', '', '', '']);
      s.entries.forEach(function (e) {
        var tot = 0;
        e.rows.forEach(function (r, i) { var t = r.perItem + r.inKits; tot += t; out.push([i ? '' : e.name, '', i ? '' : e.doc, '', r.kuda, r.perItem || '', r.inKits || '', '', t, i ? '' : e.note]); });
        if (e.rows.length > 1) out.push(['', '', '', '', 'Итого', '', '', '', tot, '']);
      });
    });
    return out;
  }
  function materialRows(res) {
    var out = [['Наименование', 'Обозначение документа', 'Ед. изм.', 'Количество на изделие', 'Из чего складывается']];
    res.materials.forEach(function (m) {
      out.push([m.name, m.doc, m.unit, Math.round(m.total * 1e6) / 1e6, m.parts.map(function (p) { return p.kuda + ': ' + fmtNum(p.qty) + (p.mult !== 1 ? ' × ' + fmtNum(p.mult) : ''); }).join('; ')]);
    });
    return out;
  }

  /* ---------- Групповая ВП: количество на каждое исполнение изделия ---------- */
  // roots: [{ base, label }] — исполнения группового изделия
  function buildGroup(specs, roots, opt) {
    var entries = {}, mats = {}, warn = [], seen = {}, used = {};
    roots.forEach(function (rt, i) {
      var res = build(specs, rt.base, opt);
      (res.warnings || []).concat(res.error ? [{ sev: 'error', msg: res.error }] : []).forEach(function (w) {
        if (/не входит в состав/.test(w.msg)) return;
        var mm = /^Нет спецификации на (\S+)/.exec(w.msg), key = mm ? 'nospec|' + mm[1] : w.msg;
        if (!seen[key]) { seen[key] = 1; warn.push(w); }
      });
      if (res.error) return;
      (res.used || []).forEach(function (b) { used[b] = 1; });
      res.sections.forEach(function (sec) {
        sec.entries.forEach(function (e) {
          var k = sec.title + '|' + low(e.name) + '|' + e.doc + '|' + (sec.title === 'Материалы' ? e.note : '');
          if (!entries[k]) entries[k] = { name: e.name, doc: e.doc, section: sec.title, note: e.note, rows: {} };
          e.rows.forEach(function (r) {
            var row = entries[k].rows[r.kuda] || (entries[k].rows[r.kuda] = { kuda: r.kuda, q: roots.map(function () { return 0; }), frac: false });
            row.q[i] += r.perItem + r.inKits; if (r.frac) row.frac = true;
          });
        });
      });
      res.materials.forEach(function (m) {
        var km = low(m.name) + '|' + m.doc + '|' + m.unit;
        if (!mats[km]) mats[km] = { name: m.name, doc: m.doc, unit: m.unit, q: roots.map(function () { return 0; }) };
        mats[km].q[i] += m.total;
      });
    });
    var natural = function (a, b) { return a.localeCompare(b, 'ru', { numeric: true, sensitivity: 'base' }); };
    var unused = {};
    specs.forEach(function (sp) { if (sp.base && !used[sp.base]) { var k = sp.execOf || sp.base; (unused[k] = unused[k] || []).push(sp.execOf ? (sp.execLabel === '-' ? 'базовое' : '-' + sp.execLabel) : ''); } });
    Object.keys(unused).forEach(function (k) {
      var all = specs.filter(function (sp) { return (sp.execOf || sp.base) === k; }).length, u = unused[k];
      warn.push({ sev: 'note', msg: 'Спецификация ' + k + (u[0] && u.length < all ? ' (исполнения ' + u.join(', ') + ')' : '') + ' не входит в состав выбранного изделия и не учтена.' });
    });
    var groups = {};
    Object.keys(entries).forEach(function (k) {
      var e = entries[k];
      e.rows = Object.keys(e.rows).map(function (kd) { return e.rows[kd]; }).sort(function (a, b) { return natural(a.kuda, b.kuda); });
      (groups[e.section] = groups[e.section] || []).push(e);
    });
    var names = Object.keys(groups).sort(function (a, b) { return secRank(a) - secRank(b) || natural(a, b); });
    return {
      group: true, roots: roots, labels: roots.map(function (r) { return r.label; }), warnings: warn, used: Object.keys(used),
      sections: names.map(function (n) { return { title: n, entries: groups[n].sort(function (a, b) { return natural(a.name, b.name) || natural(a.doc, b.doc); }) }; }),
      materials: Object.keys(mats).map(function (k) { return mats[k]; }).sort(function (a, b) { return natural(a.name, b.name); })
    };
  }

  // геометрия групповой ВП: № 7, Наименование 60, Код 35, Документ на поставку 55, Поставщик 40, Куда входит 50, исполнения 124, Примечание 24
  function groupGeom(n) {
    var W0 = [7, 60, 35, 55, 40, 50], Xg = [20]; W0.forEach(function (w, i) { Xg.push(Xg[i] + w); });
    var q0 = Xg[6], qw = 124 / n, Q = []; for (var i = 0; i <= n; i++) Q.push(q0 + i * qw);
    return { X: Xg, Q: Q, note: [q0 + 124, q0 + 148] };
  }
  function linesGroup(res, measure) {
    var g = groupGeom(res.labels.length), cw = function (a, b) { return b - a - 2; }, out = [];
    res.sections.forEach(function (s, si) {
      if (si > 0) out.push({ type: 'blank' });
      out.push({ type: 'head', text: s.title });
      s.entries.forEach(function (e) {
        var nm = measure.wrap(e.name, cw(g.X[1], g.X[2])), dc = measure.wrap(e.doc, cw(g.X[3], g.X[4])), nt = measure.wrap(e.note, cw(g.note[0], g.note[1]));
        var block = [];
        e.rows.forEach(function (r, ri) {
          var kd = measure.wrap(r.kuda, cw(g.X[5], g.X[6]));
          var n = ri === 0 ? Math.max(nm.length, dc.length, nt.length, kd.length, 1) : kd.length;
          for (var l = 0; l < n; l++) block.push({ type: 'item', name: ri === 0 ? nm[l] || '' : '', doc: ri === 0 ? dc[l] || '' : '', note: ri === 0 ? nt[l] || '' : '', kuda: kd[l] || '',
            q: l === 0 ? r.q.map(function (v) { return v ? fmtQ(v, r.frac) : '-'; }) : null });
        });
        block[0].start = block.length;
        out.push.apply(out, block);
      });
    });
    return out;
  }
  async function renderGroup(PDFLib, fontkit, fontBytes, res, meta, opt) {
    opt = opt || {};
    var E = root.ESKDPDF || (typeof require !== 'undefined' ? require('./eskdpdf.js') : null);
    var F = E.fmt('A3L');
    var K = await E.create(PDFLib, fontkit, fontBytes, opt), SZ = K.SZ, g = groupGeom(res.labels.length), X = g.X, Q = g.Q, N = g.note;
    var measure = { wrap: function (t, w) { return K.wrapW(t, w, SZ.body); } };
    var pages = paginate(linesGroup(res, measure)), total = pages.length, base = res.roots.length ? res.roots[0].base : '';
    pages.forEach(function (rows, i) {
      var p = K.addPage(F), first = i === 0, n = first ? G.rowsFirst : G.rowsNext;
      K.sideGraphs(p, F, first, meta);
      var top = F.fy1, ht = top - G.headH, bottom = F.fy0 + (first ? G.tb1 : G.tb2), RH = (ht - bottom) / n, yb = ht - n * RH;
      K.L(p, X[0], ht, N[1], ht, K.thick);
      for (var c = 1; c < X.length; c++) K.L(p, X[c], top, X[c], yb, K.thick);
      for (var q = 1; q < Q.length - 1; q++) K.L(p, Q[q], ht + 9, Q[q], yb, K.thin);
      K.L(p, N[0], top, N[0], yb, K.thick);
      K.L(p, Q[0], ht + 9, N[0], ht + 9, K.thin);
      K.C(p, '№ строки', X[0], ht, X[1], top, SZ.head - 3, { rot: true });
      K.C(p, 'Наименование', X[1], ht, X[2], top, SZ.head);
      K.C(p, 'Код', X[2], ht + 13, X[3], ht + 19, SZ.head); K.C(p, 'продукции', X[2], ht + 7, X[3], ht + 13, SZ.head);
      K.C(p, 'Обозначение документа', X[3], ht + 13, X[4], ht + 19, SZ.head); K.C(p, 'на поставку', X[3], ht + 7, X[4], ht + 13, SZ.head);
      K.C(p, 'Поставщик', X[4], ht, X[5], top, SZ.head);
      K.C(p, 'Куда входит', X[5], ht + 13, X[6], ht + 19, SZ.head); K.C(p, '(обозначение)', X[5], ht + 7, X[6], ht + 13, SZ.head);
      K.C(p, 'Кол. на исполнение', Q[0], ht + 16, N[0], ht + 22, SZ.head); K.C(p, base, Q[0], ht + 10, N[0], ht + 16, SZ.head);
      res.labels.forEach(function (l, k) { K.C(p, l, Q[k], ht, Q[k + 1], ht + 9, SZ.head - 1); });
      K.C(p, 'Приме-', N[0], ht + 13, N[1], ht + 19, SZ.head - 1); K.C(p, 'чание', N[0], ht + 7, N[1], ht + 13, SZ.head - 1);
      for (var r = 0; r < n; r++) {
        var y1 = ht - r * RH, y0 = y1 - RH;
        if (r > 0) K.L(p, X[0], y1, N[1], y1, K.thin);
        K.C(p, String(r + 1), X[0], y0, X[1], y1, SZ.small + 1);
      }
      K.L(p, X[0], yb, N[1], yb, K.thick);
      var qs = Q[1] - Q[0] < 10 ? SZ.body - 2 : SZ.body;
      rows.forEach(function (row, k) {
        var y1 = ht - k * RH, y0 = y1 - RH, bl = y0 + (RH - 3.2) / 2 + 0.6;
        if (row.type === 'head') {
          var w = K.T(p, row.text, (X[1] + X[2]) / 2, bl, SZ.body, { align: 'center', max: X[2] - X[1] - 2 });
          if (w) K.L(p, (X[1] + X[2]) / 2 - w / 2, bl - 0.9, (X[1] + X[2]) / 2 + w / 2, bl - 0.9, K.thin);
          return;
        }
        if (row.type !== 'item') return;
        K.T(p, row.name, X[1] + 1, bl, SZ.body, { max: X[2] - X[1] - 2 });
        K.T(p, row.doc, X[3] + 1, bl, SZ.body, { max: X[4] - X[3] - 2 });
        K.T(p, row.kuda, X[5] + 1, bl, SZ.body, { max: X[6] - X[5] - 2 });
        if (row.q) row.q.forEach(function (v, j) { K.C(p, v, Q[j], y0, Q[j + 1], y1, qs); });
        K.T(p, row.note, N[0] + 1, bl, SZ.body - 2, { max: N[1] - N[0] - 2 });
      });
      if (first) K.form2(p, F, meta, total); else K.form2a(p, F, meta, i + 1);
      K.footer(p, F);
    });
    var bytes = await K.save(meta, 'Инструменты ЕСКД: ведомость покупных изделий (групповая)');
    return { bytes: bytes, pages: total };
  }
  function tableRowsGroup(res) {
    var base = res.roots.length ? res.roots[0].base : '';
    var out = [['Наименование', 'Код продукции', 'Обозначение документа на поставку', 'Поставщик', 'Куда входит (обозначение)'].concat(res.labels.map(function (l) { return 'Кол. ' + (l === '-' ? base : base + '-' + l); }), ['Примечание'])];
    res.sections.forEach(function (s) {
      out.push([s.title, '', '', '', ''].concat(res.labels.map(function () { return ''; }), ['']));
      s.entries.forEach(function (e) {
        e.rows.forEach(function (r, i) { out.push([i ? '' : e.name, '', i ? '' : e.doc, '', r.kuda].concat(r.q.map(function (v) { return !v ? '' : r.frac && Math.abs(v - Math.round(v)) > 1e-9 ? fmtQ(v, true) : Math.round(v * 1e6) / 1e6; }), [i ? '' : e.note])); });
      });
    });
    return out;
  }
  function materialRowsGroup(res) {
    var base = res.roots.length ? res.roots[0].base : '';
    var out = [['Наименование', 'Обозначение документа', 'Ед. изм.'].concat(res.labels.map(function (l) { return 'На ' + (l === '-' ? base : base + '-' + l); }))];
    res.materials.forEach(function (m) { out.push([m.name, m.doc, m.unit].concat(m.q.map(function (v) { return v ? Math.round(v * 1e6) / 1e6 : ''; }))); });
    return out;
  }

  /* ---------- Нормы материалов на детали (Excel по шаблону) ---------- */
  var NORM_HEAD = ['Обозначение детали', 'Наименование детали', 'Материал (наименование, марка, документ)', 'Норма на 1 деталь', 'Ед. изм.', 'Примечание'];
  function normsTemplate() {
    return [NORM_HEAD,
      ['АБВГ.711141.001', 'Корпус', 'Пластик ABS 2020-30 ТУ 2214-019-00203521-96', 0.012, 'кг', ''],
      ['', '', 'Краска МЛ-12 ГОСТ 9754-76', 0.0004, 'кг', 'покрытие; строка без обозначения — тот же материал детали выше'],
      ['АБВГ.741124.002', 'Пластина', 'Лист Б-ПН-1,5 ГОСТ 19903-2015', 0.045, 'кг', ''],
      ['АБВГ.741124.002-01', 'Пластина', 'Лист Б-ПН-1,5 ГОСТ 19903-2015', 0.06, 'кг', 'исполнения — отдельными строками']];
  }
  function parseNorms(rows) {
    var hr = -1, col = {};
    for (var r = 0; r < Math.min(rows.length, 15) && hr < 0; r++) {
      var row = (rows[r] || []).map(low);
      var di = row.findIndex(function (c) { return /обозначени/.test(c); }), mi = row.findIndex(function (c) { return /материал/.test(c); });
      if (di >= 0 && mi >= 0) {
        hr = r; col.des = di; col.mat = mi;
        col.n = row.findIndex(function (c) { return /норм|расход|количеств|кол\./.test(c); });
        col.u = row.findIndex(function (c) { return /^ед|единиц/.test(c); });
      }
    }
    if (hr < 0 || col.n < 0) return { error: 'Не найдена строка заголовков: нужны графы «Обозначение детали», «Материал» и «Норма на 1 деталь». Скачайте шаблон.' };
    var norms = {}, cur = '', nRows = 0, warn = [];
    for (var i = hr + 1; i < rows.length; i++) {
      var rw = rows[i] || [], d = str(rw[col.des]).replace(/\s+/g, ''), m = str(rw[col.mat]), nv = str(rw[col.n]);
      if (d) cur = d;
      if (!m && !nv) continue;
      if (!cur) { warn.push('Строка ' + (i + 1) + ': нет обозначения детали — пропущена.'); continue; }
      var q = num(nv);
      if (!m || !q) { warn.push('Строка ' + (i + 1) + ' (' + cur + '): ' + (!m ? 'нет материала' : 'не число в норме «' + nv + '»') + ' — пропущена.'); continue; }
      var sd = splitDoc(m), unit = col.u >= 0 ? str(rw[col.u]).replace(/\.$/, '') : '';
      (norms[cur] = norms[cur] || []).push({ name: sd.name, doc: sd.doc, n: q.n, unit: unit || q.unit || '' });
      nRows++;
    }
    return { norms: norms, parts: Object.keys(norms).length, rows: nRows, warnings: warn };
  }

  var api = { VERSION: VERSION, build: build, parseNorms: parseNorms, normsTemplate: normsTemplate, buildGroup: buildGroup, renderGroup: renderGroup, tableRowsGroup: tableRowsGroup, materialRowsGroup: materialRowsGroup, linesGroup: linesGroup, fmtQ: fmtQ, render: render, tableRows: tableRows, materialRows: materialRows, splitDoc: splitDoc, sectionOf: sectionOf, num: num, DESIG: DESIG, G: G, lines: lines, paginate: paginate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VP = api;
})(typeof window !== 'undefined' ? window : globalThis);
