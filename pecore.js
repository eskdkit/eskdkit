/* Перечень элементов (ПЭ3) из BOM по ГОСТ 2.701-2008 (п. 5.7), лист — ГОСТ Р 2.104-2023 (формы 2 и 2а) */
(function (root) {
  'use strict';
  var VERSION = '0.1';
  function str(v) { return v == null ? '' : String(v).replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }
  function low(v) { return str(v).toLowerCase().replace(/ё/g, 'е'); }

  /* ---------- 1. Колонки BOM ---------- */
  var FIELDS = {
    desig: ['поз. обозначение', 'поз обозначение', 'позиционное обозначение', 'поз.обозначение', 'позиция', 'обозначение элемента', 'designator', 'designators', 'reference', 'references', 'ref des', 'refdes', 'ref', 'part reference', 'reference designator'],
    name: ['наименование', 'наименование элемента', 'название', 'name', 'part name'],
    pn: ['part number', 'partnumber', 'mpn', 'manufacturer part number', 'manufacturer part', 'mfr part number', 'mfr. part number', 'mfr part', 'артикул', 'тип'],
    comment: ['comment', 'value', 'значение', 'номинал', 'val'],
    descr: ['description', 'описание'],
    footprint: ['footprint', 'корпус', 'package', 'pattern', 'посадочное место'],
    qty: ['кол.', 'кол', 'кол-во', 'количество', 'quantity', 'qty', 'qnty', 'count'],
    note: ['примечание', 'примечания', 'note', 'notes', 'remark', 'remarks'],
    dnp: ['dnp', 'fitted', 'populate', 'не устанавливать', 'установка', 'mount', 'no fit', 'nofit', 'dns']
  };
  function matchField(h) {
    var t = low(h).replace(/[_]/g, ' ');
    for (var k in FIELDS) if (FIELDS[k].indexOf(t) >= 0) return k;
    if (/^поз\.?\s*обозн/.test(t)) return 'desig';
    if (/designator|reference/.test(t)) return 'desig';
    if (/наименов/.test(t)) return 'name';
    if (/part\s*(number|no)|mpn/.test(t)) return 'pn';
    if (/^(кол|qty|quantity)/.test(t)) return 'qty';
    if (/примеч|^note/.test(t)) return 'note';
    return null;
  }

  // Поиск строки заголовка и автоматическое сопоставление колонок
  function detect(rows) {
    var best = null;
    for (var r = 0; r < Math.min(rows.length, 40); r++) {
      var map = {}, n = 0;
      (rows[r] || []).forEach(function (c, i) { var f = matchField(c); if (f && map[f] == null) { map[f] = i; n++; } });
      if (map.desig != null && (!best || n > best.n)) best = { row: r, map: map, n: n };
    }
    if (!best) return null;
    var head = (rows[best.row] || []).map(str);
    var m = best.map, sel = { desig: m.desig, name: null, name2: null, note: m.note == null ? null : m.note, qty: m.qty == null ? null : m.qty, dnp: m.dnp == null ? null : m.dnp };
    // Наименование: готовая колонка, иначе тип/артикул, иначе значение
    if (m.name != null) sel.name = m.name;
    else if (m.pn != null) { sel.name = m.pn; if (m.comment != null) sel.name2 = null; }
    else if (m.comment != null) { sel.name = m.comment; if (m.footprint != null) sel.name2 = m.footprint; }
    else if (m.descr != null) sel.name = m.descr;
    return { headerRow: best.row, headers: head, sel: sel };
  }

  /* ---------- 2. Позиционные обозначения ---------- */
  var CYR2LAT = { 'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X', 'У': 'Y' };
  var DES = /^([A-Za-z]+)(\d+)((?:[.:][\d]+)?)$/;
  function normDes(d) {
    var s = str(d).replace(/\s+/g, ''), fixed = false;
    var o = s.replace(/[АВЕКМНОРСТХУ]/g, function (c) { fixed = true; return CYR2LAT[c]; });
    return { s: o, fixed: fixed };
  }
  function splitDes(cell) {
    var s = str(cell);
    if (!s) return [];
    s = s.replace(/\s*(-|–|—|\.\.\.?|…)\s*/g, '$1');
    var parts = s.split(/[,;\s]+/).map(function (x) { return x.trim(); }).filter(Boolean);
    var out = [];
    parts.forEach(function (p) {
      var m = /^([A-Za-zА-Яа-я]+)(\d+)\s*(?:-|–|—|\.\.\.?|…)\s*([A-Za-zА-Яа-я]*)(\d+)$/.exec(p);
      if (m && (!m[3] || m[3] === m[1]) && +m[4] >= +m[2] && +m[4] - +m[2] < 1000) {
        for (var i = +m[2]; i <= +m[4]; i++) out.push(m[1] + i);
      } else out.push(p);
    });
    return out;
  }
  function parseDes(s) { var m = DES.exec(s); return m ? { prefix: m[1].toUpperCase(), num: +m[2], sub: m[3] || '', s: s } : { prefix: s.replace(/[\d.:]+$/, '').toUpperCase() || s, num: NaN, sub: '', s: s }; }

  /* ---------- 3. Типы элементов (ГОСТ 2.710-81, табл. 1 и распространённая практика) ---------- */
  var TYPES = {
    A: ['Устройство', 'Устройства'], B: ['Преобразователь', 'Преобразователи'], BA: ['Громкоговоритель', 'Громкоговорители'],
    BM: ['Микрофон', 'Микрофоны'], BQ: ['Пьезоэлемент', 'Пьезоэлементы'], BK: ['Термодатчик', 'Термодатчики'], BL: ['Фотоэлемент', 'Фотоэлементы'],
    C: ['Конденсатор', 'Конденсаторы'], D: ['Микросхема', 'Микросхемы'], DA: ['Микросхема', 'Микросхемы'], DD: ['Микросхема', 'Микросхемы'],
    E: ['Элемент', 'Элементы'], EL: ['Лампа', 'Лампы'], F: ['Предохранитель', 'Предохранители'], FU: ['Предохранитель', 'Предохранители'], FV: ['Разрядник', 'Разрядники'],
    G: ['Генератор', 'Генераторы'], GB: ['Батарея', 'Батареи'], H: ['Индикатор', 'Индикаторы'], HA: ['Излучатель звуковой', 'Излучатели звуковые'],
    HG: ['Индикатор', 'Индикаторы'], HL: ['Индикатор световой', 'Индикаторы световые'], K: ['Реле', 'Реле'], KV: ['Реле', 'Реле'], KK: ['Реле', 'Реле'],
    L: ['Дроссель', 'Дроссели'], M: ['Двигатель', 'Двигатели'], P: ['Прибор', 'Приборы'], PA: ['Амперметр', 'Амперметры'], PV: ['Вольтметр', 'Вольтметры'],
    Q: ['Выключатель', 'Выключатели'], R: ['Резистор', 'Резисторы'], RK: ['Терморезистор', 'Терморезисторы'], RP: ['Резистор переменный', 'Резисторы переменные'],
    RU: ['Варистор', 'Варисторы'], S: ['Переключатель', 'Переключатели'], SA: ['Переключатель', 'Переключатели'], SB: ['Кнопка', 'Кнопки'], SF: ['Выключатель автоматический', 'Выключатели автоматические'],
    SK: ['Выключатель', 'Выключатели'], T: ['Трансформатор', 'Трансформаторы'], TV: ['Трансформатор', 'Трансформаторы'], U: ['Преобразователь', 'Преобразователи'],
    V: ['Прибор полупроводниковый', 'Приборы полупроводниковые'], VD: ['Диод', 'Диоды'], VT: ['Транзистор', 'Транзисторы'], VS: ['Тиристор', 'Тиристоры'], VU: ['Оптрон', 'Оптроны'],
    W: ['Линия', 'Линии'], WA: ['Антенна', 'Антенны'], X: ['Соединитель', 'Соединители'], XP: ['Вилка', 'Вилки'], XS: ['Розетка', 'Розетки'],
    XT: ['Соединение разборное', 'Соединения разборные'], XW: ['Соединитель высокочастотный', 'Соединители высокочастотные'], XA: ['Токосъёмник', 'Токосъёмники'],
    Y: ['Электромагнит', 'Электромагниты'], Z: ['Фильтр', 'Фильтры'], ZQ: ['Резонатор кварцевый', 'Резонаторы кварцевые']
  };
  function typeOf(prefix) { return TYPES[prefix] || TYPES[prefix.charAt(0)] || null; }
  // Названия, которыми в BOM обычно начинаются записи (чтобы не дублировать тип)
  var LEADS = /^(резистор|конденсатор|микросхема|диод|стабилитрон|транзистор|светодиод|индикатор|дроссель|катушка|реле|кнопка|переключатель|выключатель|вилка|розетка|соединитель|разъем|разъём|клеммник|колодка|резонатор|кварц|предохранитель|варистор|терморезистор|трансформатор|батарея|излучатель|зуммер|оптрон|тиристор|симистор|фильтр|антенна|генератор|модуль|датчик|двигатель|лампа|супрессор)/i;

  /* ---------- 4. Разбор строк BOM ---------- */
  function parse(rows, info, opt) {
    opt = opt || {};
    var sel = info.sel, warn = [], elems = [], fixed = 0, dnp = 0, noDes = 0;
    function cell(row, i) { return i == null ? '' : str(row[i]); }
    for (var r = info.headerRow + 1; r < rows.length; r++) {
      var row = rows[r] || [];
      var desCell = cell(row, sel.desig), name = cell(row, sel.name), name2 = cell(row, sel.name2), note = cell(row, sel.note);
      if (!desCell && !name) continue;
      if (!desCell) { noDes++; continue; }
      if (sel.dnp != null) {
        var dv = low(row[sel.dnp]);
        var head = low(info.headers[sel.dnp]);
        var isNot = /^(fitted|populate|mount|установка)$/.test(head) ? /^(no|false|0|нет|not fitted|не устанавливать|dnp|-)$/.test(dv) : /^(yes|true|1|да|x|dnp|не устанавливать|not fitted|\+)$/.test(dv);
        if (isNot) { dnp++; if (!opt.keepDnp) continue; note = note ? note + '; не устанавливать' : 'Не устанавливать'; }
      }
      var full = name2 && name2 !== name ? (name ? name + ' ' + name2 : name2) : name;
      var list = splitDes(desCell);
      if (sel.qty != null) {
        var q = parseFloat(String(row[sel.qty]).replace(',', '.'));
        if (isFinite(q) && q > 0 && list.length && q !== list.length) warn.push({ sev: 'warn', row: r + 1, msg: 'Строка ' + (r + 1) + ': количество ' + q + ', а позиционных обозначений ' + list.length + ' (' + desCell + ').' });
      }
      list.forEach(function (d) {
        var n = normDes(d); if (n.fixed) fixed++;
        var p = parseDes(n.s);
        elems.push({ des: n.s, prefix: p.prefix, num: p.num, sub: p.sub, name: full, note: note, row: r + 1 });
      });
    }
    if (noDes) warn.push({ sev: 'note', msg: 'Строк без позиционного обозначения: ' + noDes + ' (например, плата или крепёж) — в перечень не включены.' });
    if (dnp) warn.push({ sev: 'note', msg: (opt.keepDnp ? 'Элементы с отметкой «не устанавливать» включены с примечанием: ' : 'Элементы с отметкой «не устанавливать» не включены: ') + dnp + '.' });
    if (fixed) warn.push({ sev: 'warn', msg: 'В ' + fixed + ' позиционных обозначениях русские буквы заменены латинскими (ГОСТ 2.710-81).' });
    // повторы
    var seen = {};
    elems.forEach(function (e) { if (seen[e.des]) warn.push({ sev: 'error', row: e.row, msg: 'Позиционное обозначение ' + e.des + ' встречается дважды (строки ' + seen[e.des] + ' и ' + e.row + ').' }); else seen[e.des] = e.row; });
    elems.forEach(function (e) { if (!e.name) warn.push({ sev: 'warn', row: e.row, msg: e.des + ': нет наименования.' }); });
    return { elems: elems, warnings: warn };
  }

  /* ---------- 5. Группировка ---------- */
  function cmpEl(a, b) {
    if (a.prefix !== b.prefix) return a.prefix < b.prefix ? -1 : 1;
    if (isNaN(a.num) !== isNaN(b.num)) return isNaN(a.num) ? 1 : -1;
    if (a.num !== b.num) return a.num - b.num;
    return a.sub < b.sub ? -1 : a.sub > b.sub ? 1 : 0;
  }
  function desText(run, sep) {
    var a = run[0].des, b = run[run.length - 1].des;
    if (run.length === 1) return a;
    if (run.length === 2) return a + ', ' + b;
    return a + sep + b;
  }
  function wordsCommon(names) {
    var ws = names.map(function (n) { return n.split(' '); }), k = 0;
    while (ws.every(function (w) { return w.length > k + 1 && w[k] === ws[0][k]; })) k++;
    return ws[0].slice(0, k).join(' ');
  }

  function arrange(elems, opt) {
    opt = opt || {};
    var sep = opt.sep == null ? ' - ' : opt.sep;
    var list = elems.slice().sort(cmpEl), groups = [], cur = null;
    list.forEach(function (e) {
      if (!cur || cur.prefix !== e.prefix) { cur = { prefix: e.prefix, runs: [] }; groups.push(cur); }
      var r = cur.runs[cur.runs.length - 1], last = r && r[r.length - 1];
      if (last && last.name === e.name && last.note === e.note && !e.sub && !last.sub && !isNaN(e.num) && e.num === last.num + 1) r.push(e);
      else cur.runs.push([e]);
    });
    var out = [];
    groups.forEach(function (g) {
      var t = typeOf(g.prefix);
      var lines = g.runs.map(function (run) { return { des: desText(run, sep), name: run[0].name, note: run[0].note, qty: run.length }; });
      var block = { prefix: g.prefix, heading: '', lines: lines };
      if (opt.headings !== false && lines.length >= 2) {
        var names = lines.map(function (l) { return l.name; });
        // убираем совпадающее с типом первое слово («Резистор …» под заголовком «Резисторы»)
        if (t && names.every(function (n) { return low(n).indexOf(low(t[0]) + ' ') === 0; })) names = names.map(function (n) { return n.slice(t[0].length + 1); });
        var common = opt.commonPrefix !== false ? wordsCommon(names) : '';
        if (common && common.length >= 2) names = names.map(function (n) { return n.slice(common.length + 1); });
        else common = '';
        if (t || common) {
          block.heading = t ? t[1] + (common ? ' ' + common : '') : common;
          lines.forEach(function (l, i) { l.name = names[i]; });
        }
      } else if (opt.addType !== false && t) {
        lines.forEach(function (l) { if (l.name && !LEADS.test(l.name) && low(l.name).indexOf(low(t[0])) !== 0) l.name = t[0] + ' ' + l.name; else if (!l.name) l.name = t[0]; });
      }
      out.push(block);
    });
    return out;
  }

  /* ---------- 6. Геометрия ПЭ (ГОСТ 2.701-2008, рисунок 4): 20 / 110 / 10 / 45, заголовок 15, строки 8 ---------- */
  var G = { cols: [20, 40, 150, 160, 205], headH: 15, rowH: 8, tb1: 40, tb2: 15 };

  function paginate(blocks, F, measure, opt) {
    opt = opt || {};
    var rowsFirst = Math.floor((F.fy1 - G.headH - (F.fy0 + G.tb1)) / G.rowH), rowsNext = Math.floor((F.fy1 - G.headH - (F.fy0 + G.tb2)) / G.rowH);
    var cw = function (i) { return G.cols[i + 1] - G.cols[i] - 2; };
    var pages = [[]], cap = rowsFirst;
    function free() { return cap - pages[pages.length - 1].length; }
    function newPage() { pages.push([]); cap = rowsNext; }
    function emit(r) { pages[pages.length - 1].push(r); }
    blocks.forEach(function (b, bi) {
      var items = b.lines.map(function (l) {
        var ds = measure.width(l.des) <= cw(0) * 1.45 ? [l.des] : measure.wrap(l.des.replace(/ - /g, '\u00a0-\u00a0'), cw(0)), nm = measure.wrap(l.name, cw(1)), nt = measure.wrap(l.note, cw(3));
        return { l: l, ds: ds, nm: nm, nt: nt, n: Math.max(ds.length, nm.length, nt.length, 1) };
      });
      var need = (bi > 0 && opt.blank !== false ? 1 : 0) + (b.heading ? 1 : 0) + (items[0] ? items[0].n : 0);
      if (free() < need) newPage();
      if (bi > 0 && opt.blank !== false && pages[pages.length - 1].length) emit({ type: 'blank' });
      if (b.heading) {
        var hl = measure.wrap(b.heading, cw(1));
        if (free() < hl.length + (items[0] ? items[0].n : 0)) newPage();
        hl.forEach(function (t) { emit({ type: 'head', text: t }); });
      }
      items.forEach(function (x) {
        if (free() < x.n) newPage();
        var lowQ = opt.lastLine && x.n > 1 && x.nt.length === 1, last = x.n - 1;
        for (var k = 0; k < x.n; k++) emit({ type: 'item', des: x.ds[k] || '', name: x.nm[k] || '', note: lowQ ? (k === last ? x.nt[0] : '') : (x.nt[k] || ''), qty: (lowQ ? k === last : k === 0) ? String(x.l.qty) : '' });
      });
    });
    return { pages: pages, rowsFirst: rowsFirst, rowsNext: rowsNext };
  }

  async function render(PDFLib, fontkit, fontBytes, blocks, meta, opt) {
    opt = opt || {};
    var E = root.ESKDPDF || (typeof require !== 'undefined' ? require('./eskdpdf.js') : null);
    var F = E.fmt('A4');
    var K = await E.create(PDFLib, fontkit, fontBytes, opt);
    var SZ = K.SZ;
    var measure = { wrap: function (t, w) { return K.wrapW(t, w, SZ.body); }, width: function (t) { return K.width(t, SZ.body); } };
    var pg = paginate(blocks, F, measure, opt), total = pg.pages.length;
    var X = G.cols;
    pg.pages.forEach(function (rows, i) {
      var p = K.addPage(F), first = i === 0, n = first ? pg.rowsFirst : pg.rowsNext;
      K.sideGraphs(p, F, first, meta);
      var top = F.fy1, ht = top - G.headH, bottom = F.fy0 + (first ? G.tb1 : G.tb2), RH = (ht - bottom) / n;
      K.L(p, X[0], ht, X[4], ht, K.thick);
      X.slice(1, 4).forEach(function (x) { K.L(p, x, top, x, bottom, K.thick); });
      K.C(p, 'Поз.', X[0], ht + 7.5, X[1], top - 1, SZ.head - 1); K.C(p, 'обозна-', X[0], ht + 4, X[1], ht + 9, SZ.head - 1); K.C(p, 'чение', X[0], ht + 0.5, X[1], ht + 5.5, SZ.head - 1);
      K.C(p, 'Наименование', X[1], ht, X[2], top, SZ.head);
      K.C(p, 'Кол.', X[2], ht, X[3], top, SZ.head - 1, { rot: true });
      K.C(p, 'Примечание', X[3], ht, X[4], top, SZ.head);
      for (var r = 1; r < n; r++) K.L(p, X[0], ht - r * RH, X[4], ht - r * RH, K.thin);
      rows.forEach(function (row, k) {
        var y1 = ht - k * RH, y0 = y1 - RH, base = y0 + 2.4;
        if (row.type === 'head') { K.T(p, row.text, X[1] + 1, base, SZ.body, { max: X[2] - X[1] - 2 }); return; }
        if (row.type !== 'item') return;
        K.T(p, row.des, X[0] + 1, base, SZ.body, { max: X[1] - X[0] - 2 });
        K.T(p, row.name, X[1] + 1, base, SZ.body, { max: X[2] - X[1] - 2 });
        if (row.qty) K.C(p, row.qty, X[2], y0, X[3], y1, SZ.body - (row.qty.length > 2 ? 2 : 0));
        K.T(p, row.note, X[3] + 1, base, SZ.body - 1, { max: X[4] - X[3] - 2 });
      });
      if (first) K.form2(p, F, meta, total); else K.form2a(p, F, meta, i + 1);
      K.footer(p, F);
    });
    var bytes = await K.save(meta, 'Инструменты ЕСКД: перечень элементов');
    return { bytes: bytes, pages: total };
  }

  // Таблица для выгрузки в Excel — строки как в документе
  function tableRows(blocks) {
    var out = [['Поз. обозначение', 'Наименование', 'Кол.', 'Примечание']];
    blocks.forEach(function (b, i) {
      if (i > 0) out.push(['', '', '', '']);
      if (b.heading) out.push(['', b.heading, '', '']);
      b.lines.forEach(function (l) { out.push([l.des, l.name, l.qty, l.note]); });
    });
    return out;
  }

  function templateRows() {
    return [['Поз. обозначение', 'Наименование', 'Кол.', 'Примечание'],
      ['C1, C2', 'Конденсатор GRM188R71H104KA93D 0,1 мкФ', '2', ''],
      ['C3', 'Конденсатор GRM21BR61A106KE19L 10 мкФ', '1', ''],
      ['DD1', 'Микросхема STM32F030F4P6', '1', ''],
      ['HL1', 'Светодиод KP-2012SGC', '1', ''],
      ['R1-R4', 'Резистор RC0603FR-0710KL 10 кОм', '4', ''],
      ['R5', 'Резистор RC0603FR-07330RL 330 Ом', '1', ''],
      ['VD1', 'Диод BAT54C', '1', ''],
      ['XP1', 'Вилка PLS-6', '1', '']];
  }

  var api = { VERSION: VERSION, detect: detect, parse: parse, arrange: arrange, paginate: paginate, render: render, tableRows: tableRows, templateRows: templateRows, splitDes: splitDes, TYPES: TYPES, G: G };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PE = api;
})(typeof window !== 'undefined' ? window : globalThis);
