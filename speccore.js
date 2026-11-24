/* Спецификация по ГОСТ Р 2.106-2019 (формы 1, 1а) с основной надписью по ГОСТ Р 2.104-2023 (формы 2, 2а).
   Разбор таблицы, вёрстка по листам и вывод в PDF. Работает в браузере и в Node; без сети. */
(function (root) {
  'use strict';

  var SECTIONS = ['Документация', 'Комплексы', 'Сборочные единицы', 'Детали', 'Программные изделия и базы данных',
    'Стандартные изделия', 'Прочие изделия', 'Материалы', 'Комплекты'];
  var SORTABLE = { 'Комплексы': 1, 'Сборочные единицы': 1, 'Детали': 1, 'Комплекты': 1 };
  var DOC_CODES = /^(СБ|ВО|ТЧ|ГЧ|МЧ|УЧ|МЭ|ЭСБ|ЭМД|ЭМ|ВС|ВД|ВП|ВИ|ДП|ПТ|ЭП|ТП|ПЗ|ПМ|ТУ|ТБ|РР|И\d?|Д\d*|ВЭ|ПС|РЭ|ЭТ|ФО|ИМ|КИ|ЗИ|ВЭД|ДЗ|НРМ|Э\d|С\d|П\d|ПЭ\d|ПО(-УЛ)?|[А-ЯЁ]{2,3}-УЛ)$/;
  var DESIG = /^([А-ЯЁA-Z]{4})\.(\d{6})\.(\d{3})(-\d{2,3})?(?:\s+(\S+))?$/;

  var COLS = [
    ['section', /^(раздел|группа)/],
    ['format', /^(форм(ат)?\.?)$|^ф-?т$/],
    ['zone', /^зона/],
    ['pos', /^(поз|№\s*поз|позиц|№\s*п\/?п|№)/],
    ['desig', /^(обозн|децимал|шифр|код\b)/],
    ['name', /^(наимен|назван)/],
    ['qty', /^(кол|кол-?во|количеств|шт)/],
    ['note', /^(прим|коммент)/]
  ];
  var TEMPLATE_HEAD = ['Раздел', 'Формат', 'Поз.', 'Обозначение', 'Наименование', 'Кол.', 'Примечание'];

  function str(v) { return v == null ? '' : String(v).replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }
  function norm(t) { return str(t).toLowerCase().replace(/ё/g, 'е').replace(/["«»“”.]/g, '').trim(); }

  function matchSection(t) {
    var n = norm(t);
    if (!n) return '';
    for (var i = 0; i < SECTIONS.length; i++) {
      var s = norm(SECTIONS[i]);
      if (n === s || (n.length >= 4 && s.indexOf(n) === 0) || (n.length >= 6 && n.indexOf(s) === 0)) return SECTIONS[i];
    }
    if (/^сб(орочн)?\s*ед/.test(n)) return 'Сборочные единицы';
    if (/^станд/.test(n)) return 'Стандартные изделия';
    if (/^проч/.test(n)) return 'Прочие изделия';
    if (/^(док|кд$)/.test(n)) return 'Документация';
    if (/^(по|программ)/.test(n)) return 'Программные изделия и базы данных';
    return '';
  }

  /* ---------- 1. Разбор таблицы ---------- */
  function parseRows(rows) {
    var warn = [], map = null, start = 0;
    for (var r = 0; r < Math.min(rows.length, 12) && !map; r++) {
      var m = {}, hits = 0;
      (rows[r] || []).forEach(function (c, i) {
        var t = norm(c);
        if (!t) return;
        for (var k = 0; k < COLS.length; k++) {
          if (m[COLS[k][0]] == null && COLS[k][1].test(t)) { m[COLS[k][0]] = i; hits++; return; }
        }
      });
      if (hits >= 2 && (m.desig != null || m.name != null)) { map = m; start = r + 1; }
    }
    if (!map) {
      map = { section: 0, format: 1, pos: 2, desig: 3, name: 4, qty: 5, note: 6 };
      warn.push({ sev: 'note', msg: 'Строка с заголовками колонок не найдена. Колонки прочитаны в порядке шаблона: ' + TEMPLATE_HEAD.join(', ') + '.' });
    }
    var items = [], section = '', custom = [];
    for (var i = start; i < rows.length; i++) {
      var row = rows[i] || [], g = function (k) { return map[k] == null ? '' : str(row[map[k]]); };
      var it = { row: i + 1, section: g('section'), format: g('format'), zone: g('zone'), pos: g('pos'), desig: g('desig'), name: g('name'), qty: g('qty'), note: g('note') };
      if (!it.section && !it.format && !it.pos && !it.desig && !it.name && !it.qty && !it.note) continue;
      // строка-заголовок раздела: «Детали» в любой одной колонке
      var only = [it.section, it.desig, it.name].filter(Boolean);
      if (only.length === 1 && !it.qty && !it.pos && !it.format && !it.note) {
        var sh = matchSection(only[0]);
        if (sh || it.section) { section = sh || it.section; if (!sh && custom.indexOf(section) < 0) custom.push(section); continue; }
      }
      if (it.section) {
        var s = matchSection(it.section);
        if (!s) { s = it.section; if (custom.indexOf(s) < 0) { custom.push(s); warn.push({ sev: 'warn', row: it.row, msg: 'Раздел «' + s + '» не входит в перечень ГОСТ Р 2.106, п. 4.2.3. Он будет выведен после стандартных разделов.' }); } }
        section = s;
      }
      it.section = section;
      var d = DESIG.exec(it.desig);
      it.base = d ? d[1] + '.' + d[2] + '.' + d[3] + (d[4] || '') : '';
      it.code = d && d[5] ? d[5] : '';
      if (!it.section) {
        if (it.code && DOC_CODES.test(it.code)) it.section = 'Документация';
        else { it.section = ''; warn.push({ sev: 'err', row: it.row, msg: 'Не указан раздел для «' + (it.desig || it.name) + '». Укажите раздел в колонке «Раздел» или строкой-заголовком над группой.' }); }
      }
      if (it.desig && !d && SORTABLE[it.section]) warn.push({ sev: 'note', row: it.row, msg: 'Обозначение «' + it.desig + '» не похоже на обозначение по ГОСТ Р 2.201 (ХХХХ.ХХХХХХ.ХХХ).' });
      if (!it.desig && !it.name) warn.push({ sev: 'err', row: it.row, msg: 'Нет ни обозначения, ни наименования.' });
      if (it.section !== 'Документация' && !it.qty) warn.push({ sev: 'warn', row: it.row, msg: 'Не указано количество для «' + (it.desig || it.name) + '».' });
      if (it.section === 'Документация' && it.qty) warn.push({ sev: 'note', row: it.row, msg: 'В разделе «Документация» графу «Кол.» не заполняют (ГОСТ Р 2.106, таблица 4.1).' });
      if (it.section === 'Детали' && /^бч$/i.test(it.format) && !/кг|\bг\b/i.test(it.note)) warn.push({ sev: 'note', row: it.row, msg: 'Для детали без чертежа (БЧ) в примечании указывают массу (ГОСТ Р 2.106, п. 4.2.17.7).' });
      if (/^бч$/i.test(it.format)) it.format = 'БЧ';
      if (/^а\d$/i.test(it.format)) it.format = 'А' + it.format.slice(1);
      items.push(it);
    }
    var seen = {};
    items.forEach(function (it) {
      if (!it.desig || it.section === 'Стандартные изделия' || it.section === 'Прочие изделия' || it.section === 'Материалы') return;
      if (seen[it.desig]) warn.push({ sev: 'warn', row: it.row, msg: 'Обозначение ' + it.desig + ' уже встречалось в строке ' + seen[it.desig] + '.' });
      else seen[it.desig] = it.row;
    });
    return { items: items, warnings: warn, custom: custom, mapped: map };
  }

  /* ---------- 2. Порядок и позиции ---------- */
  function natCmp(a, b) {
    var ax = a.match(/\d+|\D+/g) || [], bx = b.match(/\d+|\D+/g) || [];
    for (var i = 0; i < Math.min(ax.length, bx.length); i++) {
      var x = ax[i], y = bx[i];
      if (/^\d/.test(x) && /^\d/.test(y)) { if (+x !== +y) return +x - +y; }
      else if (x !== y) return x < y ? -1 : 1;
    }
    return ax.length - bx.length;
  }

  function arrange(parsed, opt) {
    opt = opt || {};
    var order = SECTIONS.concat(parsed.custom);
    if (parsed.items.some(function (it) { return !it.section; })) order.push('');
    var groups = [], warn = [];
    order.forEach(function (sec) {
      var list = parsed.items.filter(function (it) { return it.section === sec; });
      if (!list.length) return;
      if (opt.sort !== false && SORTABLE[sec]) list = list.slice().sort(function (a, b) { return natCmp(a.desig || '~' + a.name, b.desig || '~' + b.name); });
      groups.push({ section: sec || 'Раздел не указан', items: list });
    });
    // позиции
    var given = parsed.items.some(function (it) { return it.pos; }), next = 1, used = {};
    groups.forEach(function (g) {
      if (g.section === 'Документация') { g.items.forEach(function (it) { if (it.pos) warn.push({ sev: 'note', row: it.row, msg: 'В разделе «Документация» позицию не указывают; номер ' + it.pos + ' не выведен.' }); it.outPos = ''; }); return; }
      g.items.forEach(function (it) {
        if (given && it.pos) {
          it.outPos = it.pos;
          if (used[it.pos]) warn.push({ sev: 'err', row: it.row, msg: 'Позиция ' + it.pos + ' повторяется.' });
          used[it.pos] = 1;
          if (/^\d+$/.test(it.pos)) next = Math.max(next, +it.pos + 1);
        } else {
          while (used[next]) next++;
          it.outPos = String(next); used[next] = 1; next++;
        }
      });
      next += Math.max(0, opt.posReserve | 0);
    });
    if (given && opt.sort !== false) {
      var prev = 0;
      groups.forEach(function (g) { g.items.forEach(function (it) { if (/^\d+$/.test(it.outPos)) { if (+it.outPos < prev) warn.push({ sev: 'note', row: it.row, msg: 'После сортировки позиция ' + it.outPos + ' оказалась после позиции ' + prev + '. Очистите колонку «Поз.», чтобы пронумеровать заново, или отключите сортировку.' }); prev = Math.max(prev, +it.outPos); } }); });
    }
    return { groups: groups, warnings: warn };
  }

  /* ---------- 3. Геометрия (мм, начало координат — левый нижний угол листа А4) ---------- */
  var G = {
    W: 210, H: 297, fx0: 20, fx1: 205, fy0: 5, fy1: 292,
    cols: [20, 26, 32, 40, 110, 173, 183, 205], // Формат 6, Зона 6, Поз. 8, Обозначение 70, Наименование 63, Кол. 10, Примечание 22
    headH: 15, rowH: 8, tb1: 40, tb2: 15
  };
  G.rowsFirst = Math.floor((G.fy1 - G.headH - (G.fy0 + G.tb1)) / G.rowH); // 29
  G.rowsNext = Math.floor((G.fy1 - G.headH - (G.fy0 + G.tb2)) / G.rowH);  // 32

  /* ---------- 4. Перенос текста ---------- */
  var NB = /((?:ГОСТ|ОСТ|СТО|ТУ|ГОСТ Р|ГОСТ IEC|ГОСТ ISO|ГОСТ Р ИСО|ГОСТ Р МЭК|ISO|DIN|IEC|№|Поз\.?|поз\.) )(?=\S)|(\d) (?=(?:кг|г|мм|см|м|мл|л|шт|м2|м3|А|В|Вт|Ом|%)(?![А-Яа-яЁё]))/g;
  function wrap(text, width, measure) {
    text = str(text).replace(/ГОСТ Р /g, 'ГОСТ\u00a0Р ').replace(NB, function (m, a, d) { return a ? a.slice(0, -1) + '\u00a0' : d + '\u00a0'; });
    if (!text) return [''];
    var meas = function (t) { return measure(t.replace(/\u00a0/g, ' ')); };
    var words = text.split(' '), lines = [], cur = '';
    function push(w) {
      while (meas(w) > width) { // длинное слово: сначала по дефису, иначе режем
        var hy = -1;
        for (var q = w.length - 1; q > 0; q--) if (w[q - 1] === '-' && meas(w.slice(0, q)) <= width) { hy = q; break; }
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
    lines = lines.map(function (l) { return l.replace(/\u00a0/g, ' '); });
    return lines.length ? lines : [''];
  }

  /* ---------- 5. Разбивка на строки и листы ---------- */
  function paginate(groups, measure, opt) {
    opt = opt || {};
    var cw = function (i) { return G.cols[i + 1] - G.cols[i] - 2; };
    var blocks = [];
    groups.forEach(function (g, gi) {
      var head = { type: 'header', text: g.section, lines: 1 };
      var its = g.items.map(function (it) {
        var nm = wrap(it.name, cw(4), measure.body), nt = wrap(it.note, cw(6), measure.body), ds = wrap(it.desig, cw(3), measure.body);
        var n = Math.max(nm.length, nt.length, ds.length, 1);
        return { type: 'item', it: it, name: nm, note: nt, desig: ds, lines: n };
      });
      blocks.push({ group: g, head: head, items: its, spare: Math.max(0, opt.spareRows | 0) });
    });
    var pages = [[]], cap = G.rowsFirst;
    function free() { return cap - pages[pages.length - 1].length; }
    function newPage() { pages.push([]); cap = G.rowsNext; }
    function emit(row) { pages[pages.length - 1].push(row); }
    blocks.forEach(function (b, bi) {
      // ГОСТ Р 2.105-2019, п. 7.2: выше заголовка не менее одной свободной строки, ниже — одна
      var first = b.items[0] ? b.items[0].lines : 0;
      if (free() < 3 + first) newPage();
      emit({ type: 'blank' });
      emit({ type: 'header', text: b.head.text });
      emit({ type: 'blank' });
      b.items.forEach(function (x) {
        if (free() < x.lines) newPage();
        // ГОСТ Р 2.105-2019, п. 7.5: записи в последующих графах начинают на уровне первой строки;
        // однострочную запись допускается помещать на уровне последней строки
        var low = opt.lastLine && x.lines > 1 && x.note.length === 1, last = x.lines - 1;
        for (var l = 0; l < x.lines; l++) emit({ type: 'item', first: l === 0, qtyHere: low ? l === last : l === 0, it: x.it, desig: x.desig[l] || '', name: x.name[l] || '',
          note: low ? (l === last ? x.note[0] : '') : (x.note[l] || '') });
      });
      for (var s = 0; s < b.spare && free() > 0; s++) emit({ type: 'blank' });
    });
    return pages;
  }

  /* ---------- 6. Вывод в PDF (pdf-lib) ---------- */
  var PT = 72 / 25.4;

  async function render(PDFLib, fontkit, fontBytes, groups, meta, opt) {
    opt = opt || {};
    var doc = await PDFLib.PDFDocument.create();
    doc.registerFontkit(fontkit);
    var font = await doc.embedFont(fontBytes, { subset: true });
    var fk = font.embedder && font.embedder.font;
    var clean = function (t) {
      t = str(t);
      if (!fk || !fk.hasGlyphForCodePoint) return t;
      var o = '';
      for (var ch of t) o += fk.hasGlyphForCodePoint(ch.codePointAt(0)) ? ch : '?';
      return o;
    };
    var SZ = { body: opt.fontPt || 12, head: 11, small: 7.5, tbLabel: 8, tbDesig: 17, tbName: 13, side: 7.5 };
    var measure = { body: function (t) { return font.widthOfTextAtSize(clean(t), SZ.body) / PT; } };
    var pages = paginate(groups, measure, opt);
    var total = pages.length;
    var rgb = PDFLib.rgb(0, 0, 0), deg = PDFLib.degrees;
    var thick = 0.6 * PT, thin = 0.25 * PT;

    function L(p, x1, y1, x2, y2, w) { p.drawLine({ start: { x: x1 * PT, y: y1 * PT }, end: { x: x2 * PT, y: y2 * PT }, thickness: w || thin, color: rgb }); }
    function R(p, x0, y0, x1, y1, w) { L(p, x0, y0, x1, y0, w); L(p, x1, y0, x1, y1, w); L(p, x1, y1, x0, y1, w); L(p, x0, y1, x0, y0, w); }
    function T(p, text, x, y, size, o) {
      o = o || {}; text = clean(text); if (!text) return;
      var w = font.widthOfTextAtSize(text, size) / PT, s = size;
      if (o.max && w > o.max) { s = Math.max(size * 0.6, size * o.max / w); w = font.widthOfTextAtSize(text, s) / PT; }
      var dx = o.align === 'center' ? -w / 2 : o.align === 'right' ? -w : 0;
      if (o.rot) p.drawText(text, { x: x * PT, y: (y + dx) * PT, size: s, font: font, color: rgb, rotate: deg(90) });
      else p.drawText(text, { x: (x + dx) * PT, y: y * PT, size: s, font: font, color: rgb });
      return w;
    }
    // текст по центру ячейки
    function C(p, text, x0, y0, x1, y1, size, o) { o = o || {}; var cap = size / PT * 0.72; if (o.rot) T(p, text, (x0 + x1) / 2 + cap / 2, (y0 + y1) / 2, size, { align: 'center', rot: true, max: (y1 - y0) - 1 }); else T(p, text, (x0 + x1) / 2, (y0 + y1) / 2 - cap / 2, size, { align: 'center', max: (x1 - x0) - 1 }); }

    function sideGraphs(p, firstSheet) {
      var x0 = 8, xm = 13, x1 = G.fx0;
      var g = [['Инв. № подл.', 25, meta.invPodl], ['Подп. и дата', 35, ''], ['Взам. инв. №', 25, meta.vzamInv], ['Инв. № дубл.', 25, ''], ['Подп. и дата', 35, '']];
      var y = G.fy0;
      R(p, x0, y, x1, y + 145, thick); L(p, xm, y, xm, y + 145, thick);
      g.forEach(function (gr) { L(p, x0, y + gr[1], x1, y + gr[1], thick); C(p, gr[0], x0, y, xm, y + gr[1], SZ.side, { rot: true }); if (gr[2]) C(p, gr[2], xm, y, x1, y + gr[1], SZ.side + 1.5, { rot: true }); y += gr[1]; });
      if (firstSheet) {
        var top = G.fy1;
        R(p, x0, top - 120, x1, top, thick); L(p, xm, top - 120, xm, top, thick); L(p, x0, top - 60, x1, top - 60, thick);
        C(p, 'Перв. примен.', x0, top - 60, xm, top, SZ.side, { rot: true });
        C(p, 'Справ. №', x0, top - 120, xm, top - 60, SZ.side, { rot: true });
        if (meta.pervPrimen) C(p, meta.pervPrimen, xm, top - 60, x1, top, SZ.side + 2, { rot: true });
        if (meta.spravN) C(p, meta.spravN, xm, top - 120, x1, top - 60, SZ.side + 2, { rot: true });
      }
    }

    function leftBlock(p, yTop, rows, headerRowIndex, signRows) {
      var xs = [20, 27, 37, 60, 75, 85];
      for (var i = 0; i <= rows; i++) {
        var y = yTop - i * 5, isHead = i === headerRowIndex || i === headerRowIndex + 1;
        L(p, 20, y, 85, y, (i === 0 || i === rows || isHead) ? thick : thin);
      }
      xs.forEach(function (x, k) {
        var yb = yTop - rows * 5;
        if (signRows && (k === 1)) { L(p, x, yTop, x, yTop - (headerRowIndex + 1) * 5, thick); return; } // Изм./Лист разделены только над подписями
        L(p, x, yTop, x, yb, thick);
      });
      var hy = yTop - (headerRowIndex + 1) * 5;
      ['Изм.', 'Лист', '№ докум.', 'Подп.', 'Дата'].forEach(function (t, k) { C(p, t, xs[k], hy, xs[k + 1], hy + 5, SZ.tbLabel); });
      if (signRows) signRows.forEach(function (sr, k) {
        var y1 = hy - k * 5, y0 = y1 - 5;
        if (sr[0]) T(p, sr[0], 20.7, y0 + 1.4, SZ.tbLabel, { max: 16 });
        if (sr[1]) T(p, sr[1], 37.7, y0 + 1.4, SZ.tbLabel + 0.5, { max: 22 });
      });
    }

    function form2(p) {
      var y0 = G.fy0, top = y0 + G.tb1;
      R(p, 20, y0, 205, top, thick);
      leftBlock(p, top, 8, 2, [[meta.l1 || 'Разраб.', meta.razrab], [meta.l2 || 'Пров.', meta.prov], [meta.l3, meta.r3], [meta.l4 || 'Н. контр.', meta.nkontr], [meta.l5 || 'Утв.', meta.utv]]);
      L(p, 85, top - 15, 205, top - 15, thick);              // низ графы 2
      L(p, 195, top, 195, top - 15, thick); L(p, 195, top - 5, 205, top - 5, thin);
      C(p, 'Вер.', 195, top - 5, 205, top, SZ.small);
      if (meta.ver) C(p, meta.ver, 195, top - 15, 205, top - 5, SZ.tbLabel + 1);
      C(p, meta.desig, 85, top - 15, 195, top, SZ.tbDesig);
      L(p, 155, y0, 155, top - 15, thick);                   // граница графы 1
      // графа 1: наименование
      var nl = wrap(meta.name, 66, function (t) { return font.widthOfTextAtSize(clean(t), SZ.tbName) / PT; }).slice(0, 4);
      var lh = 6.2, cy = (y0 + top - 15) / 2 + (nl.length - 1) * lh / 2;
      nl.forEach(function (l, i) { C(p, l, 85, cy - i * lh - 2.5, 155, cy - i * lh + 2.5, SZ.tbName); });
      // Лит. / Лист / Листов
      L(p, 155, top - 20, 205, top - 20, thick); L(p, 155, top - 25, 205, top - 25, thick);
      [170, 185].forEach(function (x) { L(p, x, top - 25, x, top - 15, thick); });
      [160, 165].forEach(function (x) { L(p, x, top - 25, x, top - 20, thin); });
      C(p, 'Лит.', 155, top - 20, 170, top - 15, SZ.tbLabel); C(p, 'Лист', 170, top - 20, 185, top - 15, SZ.tbLabel); C(p, 'Листов', 185, top - 20, 205, top - 15, SZ.tbLabel);
      (meta.lit || []).slice(0, 3).forEach(function (l, i) { if (l) C(p, l, 155 + i * 5, top - 25, 160 + i * 5, top - 20, SZ.tbLabel + 1); });
      if (total > 1) C(p, '1', 170, top - 25, 185, top - 20, SZ.tbLabel + 1);
      C(p, String(total), 185, top - 25, 205, top - 20, SZ.tbLabel + 1);
      var ol = wrap(meta.org, 47, function (t) { return font.widthOfTextAtSize(clean(t), SZ.tbLabel + 2) / PT; }).slice(0, 3);
      ol.forEach(function (l, i) { C(p, l, 155, y0 + 7.5 + (ol.length - 1) * 2.4 - i * 4.8 - 2, 205, y0 + 7.5 + (ol.length - 1) * 2.4 - i * 4.8 + 2, SZ.tbLabel + 2); });
    }

    function form2a(p, n) {
      var y0 = G.fy0, top = y0 + G.tb2;
      R(p, 20, y0, 205, top, thick);
      leftBlock(p, top, 3, 2, null);
      L(p, 185, y0, 185, top, thick); L(p, 195, y0, 195, top, thick);
      L(p, 185, top - 5, 205, top - 5, thin);
      C(p, 'Вер.', 185, top - 5, 195, top, SZ.small); C(p, 'Лист', 195, top - 5, 205, top, SZ.small);
      if (meta.ver) C(p, meta.ver, 185, y0, 195, top - 5, SZ.tbLabel + 1);
      C(p, String(n), 195, y0, 205, top - 5, SZ.tbLabel + 2);
      C(p, meta.desig, 85, y0, 185, top, SZ.tbDesig);
    }

    function table(p, nRows, bottom, rows) {
      var X = G.cols, ht = G.fy1 - G.headH, RH = (ht - bottom) / nRows;
      L(p, X[0], ht, X[7], ht, thick);
      X.slice(1, 7).forEach(function (x) { L(p, x, G.fy1, x, bottom, thick); });
      C(p, 'Формат', X[0], ht, X[1], G.fy1, SZ.head - 2, { rot: true });
      C(p, 'Зона', X[1], ht, X[2], G.fy1, SZ.head - 2, { rot: true });
      C(p, 'Поз.', X[2], ht, X[3], G.fy1, SZ.head - 2, { rot: true });
      C(p, 'Обозначение', X[3], ht, X[4], G.fy1, SZ.head);
      C(p, 'Наименование', X[4], ht, X[5], G.fy1, SZ.head);
      C(p, 'Кол.', X[5], ht, X[6], G.fy1, SZ.head - 1, { rot: true });
      C(p, 'Приме-', X[6], ht + 7.5, X[7], G.fy1 - 1, SZ.head - 1); C(p, 'чание', X[6], ht + 1, X[7], ht + 7.5, SZ.head - 1);
      for (var i = 1; i < nRows; i++) L(p, X[0], ht - i * RH, X[7], ht - i * RH, thin);
      rows.forEach(function (r, i) {
        var y1 = ht - i * RH, y0 = y1 - RH, base = y0 + 2.4;
        if (r.type === 'header') {
          var w = T(p, r.text, (X[4] + X[5]) / 2, base, SZ.body, { align: 'center', max: X[5] - X[4] - 2 });
          if (w) L(p, (X[4] + X[5]) / 2 - w / 2, base - 0.9, (X[4] + X[5]) / 2 + w / 2, base - 0.9, thin);
          return;
        }
        if (r.type !== 'item') return;
        if (r.first) {
          C(p, r.it.format, X[0], y0, X[1], y1, SZ.body - (r.it.format.length > 2 ? 3 : 1));
          C(p, r.it.zone, X[1], y0, X[2], y1, SZ.body - 2);
          C(p, r.it.outPos, X[2], y0, X[3], y1, SZ.body - (r.it.outPos.length > 2 ? 2 : 0));
        }
        if (r.qtyHere) C(p, r.it.qty, X[5], y0, X[6], y1, SZ.body - (r.it.qty.length > 3 ? 2 : 0));
        T(p, r.desig, X[3] + 1, base, SZ.body, { max: X[4] - X[3] - 2 });
        T(p, r.name, X[4] + 1, base, SZ.body, { max: X[5] - X[4] - 2 });
        T(p, r.note, X[6] + 1, base, SZ.body - 1, { max: X[7] - X[6] - 2 });
      });
    }

    pages.forEach(function (rows, i) {
      var p = doc.addPage([G.W * PT, G.H * PT]);
      R(p, G.fx0, G.fy0, G.fx1, G.fy1, thick);
      sideGraphs(p, i === 0);
      if (i === 0) { table(p, G.rowsFirst, G.fy0 + G.tb1, rows); form2(p); }
      else { table(p, G.rowsNext, G.fy0 + G.tb2, rows); form2a(p, i + 1); }
      T(p, 'Копировал', 120, 1.6, SZ.tbLabel);
      T(p, 'Формат А4', 175, 1.6, SZ.tbLabel);
    });
    doc.setTitle(str(meta.desig) + ' ' + str(meta.name));
    doc.setCreator('Инструменты ЕСКД: спецификация');
    doc.setProducer('pdf-lib');
    var bytes = await doc.save();
    return { bytes: bytes, pages: total, rows: pages };
  }

  function templateRows() {
    return [TEMPLATE_HEAD,
      ['Документация', 'А3', '', 'АБВГ.123456.001 СБ', 'Сборочный чертеж', '', ''],
      ['', 'А4', '', 'АБВГ.123456.001 ПС', 'Паспорт', '', ''],
      ['Сборочные единицы', 'А4', '', 'АБВГ.301411.010', 'Плата в сборе', '1', ''],
      ['Детали', 'А3', '', 'АБВГ.735211.002', 'Корпус', '1', ''],
      ['', 'А4', '', 'АБВГ.741571.001', 'Крышка', '1', ''],
      ['', 'БЧ', '', 'АБВГ.754463.003', 'Прокладка', '2', '0,01 кг'],
      ['Стандартные изделия', '', '', '', 'Винт М3-6gx8.48.016 ГОСТ 17473-80', '4', ''],
      ['Прочие изделия', '', '', '', 'Светодиод L-934GD', '1', ''],
      ['Материалы', '', '', '', 'Припой ПОС 61 ГОСТ 21931-76', '0,01', 'кг']
    ];
  }

  var api = { SECTIONS: SECTIONS, parseRows: parseRows, arrange: arrange, paginate: paginate, render: render, templateRows: templateRows, TEMPLATE_HEAD: TEMPLATE_HEAD, G: G, VERSION: '0.2' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SPEC = api;
})(typeof window !== 'undefined' ? window : globalThis);
