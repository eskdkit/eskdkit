/* Преднормоконтроль: извлечение текста и набор правил. Без сети, без ИИ. */
(function (root) {
  'use strict';

  var L = 'A-Za-zА-Яа-яЁё';

  /* ---------- 1. Извлечение: элементы pdf.js -> строки, фрагменты, блоки ---------- */

  function buildPage(num, items) {
    var hor = [];
    items.forEach(function (it) {
      if (!it.str) return;
      var t = it.transform, a = t[0], b = t[1];
      var fs = Math.hypot(a, b) || 1;
      if (Math.abs(b) > 0.05 * fs || a <= 0) return; // вертикальный и повёрнутый текст пропускаем
      hor.push({ s: it.str.trim() ? it.str : ' ', x: t[4], y: t[5], w: it.width || 0, fs: fs, sp: !it.str.trim() });
    });
    hor.sort(function (p, q) { return q.y - p.y || p.x - q.x; });

    var rows = [];
    hor.forEach(function (it) {
      var r = rows.length ? rows[rows.length - 1] : null;
      if (it.sp && !r) return;
      if (r && Math.abs(r.y - it.y) < 0.45 * Math.max(r.fs, it.fs)) r.items.push(it);
      else if (!it.sp) rows.push({ y: it.y, fs: it.fs, items: [it] });
    });

    var segs = [], lines = [], rowsOut = [];
    rows.forEach(function (r) {
      r.items.sort(function (p, q) { return p.x - q.x; });
      var cur = null, rowSegs = [];
      r.items.forEach(function (it) {
        if (it.sp) { if (cur && !/\s$/.test(cur.text)) cur.text += ' '; return; }
        if (cur && cur.li && it.s.length <= 2 && it.x < cur.x1 - 0.5 * it.fs && it.x >= cur.li.x) {
          // знак, наложенный поверх уже прочитанного текста (например, дефис отдельным объектом)
          var rel = Math.round((it.x - cur.li.x) / (cur.li.w || 1) * cur.li.len), pos = cur.li.off + rel, done = false;
          for (var d = 0; d <= 3 && !done; d++) {
            [pos - d, pos + d].forEach(function (q) { if (!done && cur.text[q] === ' ') { cur.text = cur.text.slice(0, q) + it.s + cur.text.slice(q + 1); done = true; } });
          }
          if (!done) cur.text = cur.text.slice(0, pos) + it.s + cur.text.slice(pos);
          return;
        }
        if (cur) {
          var gap = it.x - cur.x1;
          if (gap > 2.2 * Math.max(cur.fs, it.fs)) { rowSegs.push(cur); cur = null; }
          else {
            if (gap > 0.18 * it.fs && !/\s$/.test(cur.text) && !/^\s/.test(it.s)) cur.text += ' ';
            cur.li = { off: cur.text.length, x: it.x, w: it.w, len: it.s.length };
            cur.parts.push({ x: it.x, w: it.w, s: it.s, fs: it.fs });
            cur.text += it.s; cur.x1 = Math.max(cur.x1, it.x + it.w); return;
          }
        }
        cur = { text: it.s, x0: it.x, x1: it.x + it.w, y: it.y, fs: it.fs, page: num, li: { off: 0, x: it.x, w: it.w, len: it.s.length }, parts: [{ x: it.x, w: it.w, s: it.s, fs: it.fs }] };
      });
      if (cur) rowSegs.push(cur);
      rowSegs.forEach(function (s) { s.text = s.text.replace(/\s+/g, ' ').trim(); });
      rowSegs = rowSegs.filter(function (s) { return s.text; });
      segs = segs.concat(rowSegs);
      if (rowSegs.length) { lines.push(rowSegs.map(function (s) { return s.text; }).join('   ')); rowsOut.push(rowSegs); }
    });

    // Блоки: фрагменты одной колонки, идущие подряд по вертикали
    var blocks = [];
    segs.forEach(function (s) {
      var best = null, bestGap = 1e9;
      blocks.forEach(function (b) {
        var last = b.last, gap = last.y - s.y;
        if (gap <= 0 || gap > 2.1 * Math.max(last.fs, s.fs)) return;
        var ov = Math.min(b.x1, s.x1) - Math.max(b.x0, s.x0);
        var minw = Math.min(b.x1 - b.x0, s.x1 - s.x0) || 1;
        if (ov / minw < 0.5) return;
        if (gap < bestGap) { best = b; bestGap = gap; }
      });
      if (best) {
        best.text = /[а-яё]-$/.test(best.text) && /^[а-яё]/.test(s.text)
          ? best.text.slice(0, -1) + s.text : best.text + ' ' + s.text;
        best.last = s; best.x0 = Math.min(best.x0, s.x0); best.x1 = Math.max(best.x1, s.x1);
      } else blocks.push({ text: s.text, last: s, x0: s.x0, x1: s.x1, page: num });
    });
    return { num: num, segs: segs, lines: lines, blocks: blocks, rows: rowsOut };
  }

  /* ---------- 2. Справочные данные (шаблон правил) ---------- */

  // Единицы: каноническая запись. Проверяется регистр букв после числа.
  var UNITS_CASE = ['Гц', 'кГц', 'МГц', 'ГГц', 'Ом', 'кОм', 'МОм', 'Вт', 'кВт', 'мА', 'мкА', 'Па', 'кПа', 'МПа', 'дБ', 'Дж', 'кДж', 'лк', 'мкФ', 'пФ', 'нФ', 'мГн', 'Гн'];
  // Единицы, перед которыми нужен пробел
  var UNITS_SPACE = ['мкА', 'мА', 'кВт', 'Вт', 'кГц', 'МГц', 'ГГц', 'Гц', 'кОм', 'МОм', 'Ом', 'дБ', 'мм', 'см', 'кг', 'мс', '°С', '°C', 'В', 'А', '%'];
  var UNITS_DOT = ['мкА', 'мА', 'кВт', 'Вт', 'кГц', 'МГц', 'Гц', 'кОм', 'МОм', 'Ом', 'дБ', 'мм', 'см', 'кг', 'мс'];
  var UNITS_PRODUCT = { 'Нм': 'Н·м', 'кВтч': 'кВт·ч', 'Втч': 'Вт·ч', 'мАч': 'мА·ч', 'Ач': 'А·ч', 'кВА': 'кВ·А', 'МВА': 'МВ·А', 'ВА': 'В·А' };
  var SPEC_SECTIONS = ['Документация', 'Комплексы', 'Сборочные единицы', 'Детали', 'Программные изделия и базы данных', 'Стандартные изделия', 'Прочие изделия', 'Материалы', 'Комплекты'];
  var TEXT_TYPES = { 'ПС': 1, 'РЭ': 1, 'ЭТ': 1, 'ФО': 1, 'ТУ': 1 };
  var UNITS_RANGE = UNITS_SPACE.concat(['%', 'с', 'мин', 'ч', 'м', 'г', 'лет', 'сут']);

  // Заменённые стандарты: [действующий, true если замена подтверждена по тексту действующего стандарта]
  var REPLACED = {
    'ГОСТ 2.102-2013': ['ГОСТ Р 2.102-2023', true],
    'ГОСТ 2.104-2006': ['ГОСТ Р 2.104-2023', true],
    'ГОСТ 2.106-96': ['ГОСТ Р 2.106-2019', true],
    'ГОСТ 2.114-95': ['ГОСТ 2.114-2016', true],
    'ГОСТ 2.201-80': ['ГОСТ Р 2.201-2023', true],
    'ГОСТ 2.316-2008': ['ГОСТ Р 2.316-2023', true],
    'ГОСТ 2.503-2013': ['ГОСТ Р 2.503-2023', true],
    'ГОСТ 8.417-2002': ['ГОСТ 8.417-2024', true],
    'ГОСТ 2.105-95': ['ГОСТ Р 2.105-2019', false],
    'ГОСТ 2.601-2006': ['ГОСТ Р 2.601-2019', false],
    'ГОСТ 2.601-2013': ['ГОСТ Р 2.601-2019', false],
    'ГОСТ 2.610-2006': ['ГОСТ Р 2.610-2019', false],
    'ГОСТ 2.102-68': ['ГОСТ Р 2.102-2023', false],
    'ГОСТ 2.103-68': ['ГОСТ 2.103-2013', false],
    'ГОСТ 2.701-84': ['ГОСТ 2.701-2008', false],
    'ГОСТ 2.051-2006': ['ГОСТ 2.051-2013', false],
    'ГОСТ 14254-96': ['ГОСТ 14254-2015', false],
    'ГОСТ Р 53325-2009': ['ГОСТ Р 53325-2012', false]
  };

  // Состав документов: [название раздела, признак в тексте, true если раздел основной]
  var DOC_SECTIONS = {
    'ПС': { name: 'Паспорт', basis: 'ГОСТ Р 2.610-2019, п. 8.1', parts: [
      ['Основные сведения об изделии и технические данные', /основные\s+сведения|технические\s+данные/i, true],
      ['Комплектность', /комплектност/i, true],
      ['Ресурсы, сроки службы и хранения и гарантии изготовителя (поставщика)', /гаранти|срок[аи]?\s+служб|ресурс/i, true],
      ['Консервация', /консерваци/i, false],
      ['Свидетельство об упаковывании', /упаковыв/i, true],
      ['Свидетельство о приемке', /при[её]мк/i, true],
      ['Сведения об утилизации', /утилизаци/i, true],
      ['Особые отметки', /особые\s+отметки/i, false]
    ] },
    'РЭ': { name: 'Руководство по эксплуатации', basis: 'ГОСТ Р 2.610-2019, п. 5.1', parts: [
      ['Описание и работа', /описание\s+и\s+работа/i, true],
      ['Использование по назначению', /использование\s+по\s+назначению/i, true],
      ['Техническое обслуживание', /техническое\s+обслуживание/i, true],
      ['Текущий ремонт', /текущий\s+ремонт/i, false],
      ['Хранение', /хранени/i, true],
      ['Транспортирование', /транспортировани/i, true],
      ['Утилизация', /утилизаци/i, true]
    ] },
    'ЭТ': { name: 'Этикетка', basis: 'ГОСТ Р 2.610-2019, п. 9.1', parts: [
      ['Основные сведения об изделии и технические данные', /основные\s+сведения|технические\s+данные/i, true],
      ['Свидетельство о приемке', /при[её]мк/i, true],
      ['Ресурсы, сроки службы и хранения, гарантии изготовителя (поставщика)', /гаранти|срок[аи]?\s+служб|ресурс/i, true]
    ] },
    'ФО': { name: 'Формуляр', basis: 'ГОСТ Р 2.610-2019, п. 7.3', parts: [
      ['Общие указания', /общие\s+указания/i, true],
      ['Основные сведения об изделии', /основные\s+сведения/i, true],
      ['Основные технические данные', /технические\s+данные/i, true],
      ['Комплектность', /комплектност/i, true],
      ['Ресурсы, сроки службы и хранения, гарантии изготовителя (поставщика)', /гаранти|срок[аи]?\s+служб|ресурс/i, true],
      ['Консервация', /консерваци/i, false],
      ['Свидетельство об упаковывании', /упаковыв/i, true],
      ['Свидетельство о приемке', /при[её]мк/i, true],
      ['Движение изделия при эксплуатации', /движение\s+изделия/i, true],
      ['Учет работы изделия', /уч[её]т\s+работы/i, true],
      ['Учет технического обслуживания', /уч[её]т\s+технического\s+обслуживания/i, true],
      ['Хранение', /хранени/i, true],
      ['Ремонт', /ремонт/i, true],
      ['Особые отметки', /особые\s+отметки/i, false],
      ['Сведения об утилизации', /утилизаци/i, true]
    ] },
    'ТУ': { name: 'Технические условия', basis: 'ГОСТ 2.114-2016, п. 5.1.1', parts: [
      ['Технические требования', /технические\s+требования/i, true],
      ['Требования безопасности', /требования\s+безопасности/i, true],
      ['Требования охраны окружающей среды', /охран[аы]\s+окружающей\s+среды/i, true],
      ['Правила приемки', /правила\s+при[её]мки/i, true],
      ['Методы контроля', /методы\s+контроля|методы\s+испытаний/i, true],
      ['Указания по эксплуатации', /указания\s+по\s+эксплуатации/i, true],
      ['Гарантии изготовителя', /гаранти/i, true]
    ] }
  };

  var DESIG = '[A-ZА-ЯЁ]{4}\\.\\d{6}\\.\\d{3}(?:-\\d{2,3})?';
  var DOC_CODES = ['СБ', 'ПС', 'РЭ', 'ТУ', 'ЭТ', 'ФО', 'ВП', 'ВО', 'МЧ', 'ГЧ', 'ИМ', 'ПМ', 'РР', 'ВЭ', 'ИС', 'ДЗ', 'НРМ'];


  /* ---------- 2а. Реквизиты документа и разбор спецификации ---------- */

  // Коды и наименования видов документов: ГОСТ Р 2.102-2023 (таблица 1), ГОСТ Р 2.601-2019
  var DOC_KIND = {
    'СБ': 'Сборочный чертеж', 'ВО': 'Чертеж общего вида', 'ТЧ': 'Теоретический чертеж', 'ГЧ': 'Габаритный чертеж',
    'МЧ': 'Монтажный чертеж', 'УЧ': 'Упаковочный чертеж', 'МЭ': 'Электромонтажный чертеж', 'ВС': 'Ведомость спецификаций',
    'ВД': 'Ведомость ссылочных документов', 'ВП': 'Ведомость покупных изделий', 'ПЗ': 'Пояснительная записка',
    'ПМ': 'Программа и методика испытаний', 'ТУ': 'Технические условия', 'РР': 'Расчет',
    'ПС': 'Паспорт', 'РЭ': 'Руководство по эксплуатации', 'ЭТ': 'Этикетка', 'ФО': 'Формуляр'
  };
  function norm(t) { return (t || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"'“”]/g, '').replace(/\s+/g, ' ').trim(); }
  var KIND_BY_NAME = {};
  Object.keys(DOC_KIND).forEach(function (c) { KIND_BY_NAME[norm(DOC_KIND[c])] = c; });

  function parseDesig(text) {
    var m = new RegExp('(?<![' + L + '\\d.])(' + DESIG + ')(?:\\s([А-ЯЁ]{1,3}\\d{0,2}(?:-УЛ)?))?(?![' + L + '\\d])').exec(text || '');
    return m ? { base: m[1], code: m[2] || '', full: m[1] + (m[2] ? ' ' + m[2] : ''), index: m.index, len: m[0].length } : null;
  }

  // Строки спецификации с учётом граф формы 1 ГОСТ Р 2.106: текст, попавший в графы «Кол.» и «Примечание»,
  // отделяется от наименования даже если в PDF он слит с ним в один фрагмент.
  function specLines(p) {
    var plain = p.lines.map(function (l) { return { t: l }; });
    if (!p.rows) return plain;
    var cx = function (sg) { return (sg.x0 + sg.x1) / 2; };
    var prim = p.segs.filter(function (sg) { return /^Приме/.test(sg.text); })[0];
    var nmh = prim && p.segs.filter(function (sg) { return /^Наименование$/.test(sg.text) && Math.abs(sg.y - prim.y) < 40; })[0];
    if (!prim || !nmh) return plain;
    var k = (cx(prim) - cx(nmh)) / 52.5;
    if (!(k > 1.5 && k < 6)) return plain;
    var kolS = cx(prim) - 21 * k, noteS = cx(prim) - 11 * k, nameS = cx(nmh) - 31.5 * k;
    function join(parts) {
      var t = '', last = null;
      parts.forEach(function (pt) { if (last && pt.x - (last.x + last.w) > 0.18 * pt.fs && !/\s$/.test(t)) t += ' '; t += pt.s; last = pt; });
      return t.replace(/\s+/g, ' ').trim();
    }
    return p.rows.map(function (rs) {
      var left = [], q = [], n = [];
      rs.forEach(function (sg) {
        var cols = [[], [], []];
        (sg.parts || []).forEach(function (pt) { var c = pt.x + pt.w / 2; cols[c >= noteS ? 2 : c >= kolS ? 1 : 0].push(pt); });
        if (!sg.parts || (!cols[1].length && !cols[2].length)) { left.push(sg.text); return; }
        var a = join(cols[0]); if (a) left.push(a);
        if (cols[1].length) q.push(join(cols[1]));
        if (cols[2].length) n.push(join(cols[2]));
      });
      var cells = left.slice();
      if (q.length) cells.push(q.join(' '));
      if (n.length) cells.push(n.join(' '));
      return { t: cells.join('   '), x0: rs[0].x0, nameS: nameS, k: k, hasQ: q.length > 0, geo: true };
    });
  }

  function parseSpec(doc, own) {
    var items = [], section = '', secNorm = SPEC_SECTIONS.map(norm);
    doc.pages.forEach(function (p) { var stop = false; specLines(p).forEach(function (L) {
      var line = L.t;
      if (stop) return;
      if (/^\*{1,3}\s?[А-ЯЁа-яёA-Za-z]/.test(line)) { stop = true; return; } // сноски под таблицей
      if (/^Изм\.|Разраб|Лит\.\s+(Масса|Лист)/.test(line)) { stop = true; return; }
      var cells = line.split(/\s{3,}/);
      if (cells.length === 1) { var si = secNorm.indexOf(norm(cells[0])); if (si >= 0) { section = SPEC_SECTIONS[si]; return; } }
      if (!section || /Изм\.|Разраб|Утв\.|Копировал/.test(line)) return;
      if (/(^|\s)\d{1,2}\s+(ЗАМ|НОВ|ИЗМ|АНН|Зам\.|Нов\.)\s/.test(line)) return; // строка изменений в основной надписи
      var k = -1, d = null;
      for (var i = 0; i < cells.length && k < 0; i++) { d = parseDesig(cells[i]); if (d) k = i; }
      var prevIt = items.length ? items[items.length - 1] : null;
      var inName = L.geo && L.x0 >= L.nameS - 2 * L.k;
      if (L.geo && k < 0 && !inName && prevIt && !/^((А\d|A\d|БЧ)\s+)?\d{1,3}\s/.test(line)) return; // текст вне граф (сноски)
      // многострочная запись без позиции: количество стоит на последней строке
      if (k < 0 && inName && prevIt && prevIt.page === p.num && !prevIt.qty && !prevIt.multi && prevIt.section === section &&
          ['Стандартные изделия', 'Прочие изделия', 'Материалы', 'Комплекты'].indexOf(section) >= 0 && !/^\d{1,3}\s/.test(cells[0])) {
        prevIt.name = /-$/.test(prevIt.name) ? prevIt.name + cells[0] : prevIt.name + ' ' + cells[0];
        var rr = cells.slice(1);
        if (L.hasQ && rr.length && /^(\d+([.,]\d+)?(\s?(кг|г|т|м|мм|см|м2|м3|л|мл|шт|компл)\.?)?|[\d\/]+)$/.test(rr[0])) { prevIt.qty = rr[0]; rr = rr.slice(1); }
        if (rr.length) prevIt.note = (prevIt.note ? prevIt.note + ' ' : '') + rr.join(' ');
        return;
      }
      if (k < 0 && items.length && (/^[а-яё]/.test(cells[0]) || (/^(ГОСТ|ОСТ|ТУ\s|[А-ЯЁ]{4}\.\d{6}\.\d{3}\s?ТУ|[\d.\-]+\s?ТУ$)/.test(cells[0]) && cells.length <= 2 && ['Стандартные изделия', 'Прочие изделия', 'Материалы'].indexOf(section) >= 0)) && items[items.length - 1].page === p.num) {
        var li = items[items.length - 1]; // продолжение наименования на следующей строке
        li.name = /-$/.test(li.name) ? li.name + cells[0] : li.name + ' ' + cells[0];
        return;
      }
      var lead, name, rest;
      if (k >= 0) {
        lead = (cells.slice(0, k).join(' ') + ' ' + cells[k].slice(0, d.index)).trim().split(/\s+/);
        name = cells[k + 1] || '';
        rest = cells.slice(k + 2);
      } else {
        if (['Стандартные изделия', 'Прочие изделия', 'Материалы'].indexOf(section) < 0) return;
        var mm = /^((?:А\d|A\d|БЧ|\*\))\s+)?(\d{1,3})\s+(.*)$/.exec(cells.join('   '));
        if (!mm || !/[A-Za-zА-Яа-яЁё]/.test(mm[3])) return;
        lead = [(mm[1] || '').trim(), mm[2]]; var sp = mm[3].split(/\s{3,}/); name = sp[0]; rest = sp.slice(1);
      }
      // количество и примечание (для спецификации с одной графой «Кол.»)
      var qty = '', note = '', multi = false;
      if (rest.length && /^(\d+([.,]\d+)?(\s?(кг|г|т|м|мм|см|м2|м3|л|мл|шт|компл)\.?)?|[\d\/]+)$/.test(rest[0])) { qty = rest[0]; note = rest.slice(1).join(' '); }
      else if (rest.length && /^([\d.,\/]+|[-–—]|[хxХX])(\s+([\d.,\/]+|[-–—]|[хxХX]))+/.test(rest[0])) multi = true;
      else note = rest.join(' ');
      var fmt = '', pos = '';
      lead.forEach(function (tk) { if (/^(А\d|A\d|БЧ|\*\))$/.test(tk)) fmt = tk; else if (/^\d{1,3}$/.test(tk)) pos = tk; });
      if (d && own && d.base === own.base && !d.code && !fmt) return; // обозначение в основной надписи последующих листов
      if (/^\d+([\/.,]\d+)?$/.test(name)) name = '';
      // графы количества на исполнения в групповой спецификации («1 1 – 1», «х х х»)
      var tk = name.split(/\s+/), q = tk.length;
      while (q > 0 && /^(\d+([.,\/]\d+)?|[-–—]|[хxХX])$/.test(tk[q - 1])) q--;
      if (tk.length - q >= 2 || (tk.length - q === 1 && /^[хxХX]$/.test(tk[q]))) { if (tk.length - q >= 2) multi = true; name = tk.slice(0, q).join(' '); }
      else if (tk.length - q === 1) { if (!qty && /^\d+([.,]\d+)?$/.test(tk[q])) qty = tk[q]; name = tk.slice(0, q).join(' '); }
      items.push({ section: section, pos: pos ? +pos : null, format: fmt, base: d ? d.base : '', code: d ? d.code : '', name: name, page: p.num, qty: multi ? '' : qty, note: note, multi: multi });
    }); });
    return items;
  }

  var NOTICE_NO = /[А-ЯЁA-Z]{2,6}\.\d{1,6}-\d{2,4}/;
  var CHANGE_REC = /(?:^|\s)(\d{1,3})\s+(ЗАМ|НОВ|ИЗМ|АНН|Зам\.?|Нов\.?|Изм\.?|Анн\.?)\s+([А-ЯЁA-Z]{2,6}\.\d{1,6}-\d{2,4})/g;

  function sheetList(t) {
    var out = [], m, re = /Лист(?:ы)?\s*(\d+)(?:\s*[–—-]\s*(\d+))?/g;
    while ((m = re.exec(t || ''))) { var a = +m[1], b = m[2] ? +m[2] : a; for (var i = a; i <= b && i - a < 200; i++) out.push(i); }
    return out;
  }

  function parseNotice(doc, meta) {
    var lines = doc.pages.map(function (p) { return p.lines; }).reduce(function (a, b) { return a.concat(b); }, []);
    var head = lines.slice(0, 6).join(' '), m = NOTICE_NO.exec(head);
    meta.noticeNo = m ? m[0] : '';
    var entries = [], inTable = false;
    lines.forEach(function (l) {
      if (/Документ\s+заменить|Содержание изменения|Изм\.\s+Документ/.test(l)) { inTable = true; return; }
      if (/^Примечание|^Документ\s+Изменение|^Составил/.test(l)) { inTable = false; return; }
      var e = new RegExp('^\\s*(\\d{1,3})\\s+(' + DESIG + ')(?:\\s+([А-ЯЁ]{1,3}\\d{0,2}(?:-[А-ЯЁ]{2})?))?(?![' + L + '\\d.])(.*)$').exec(l);
      if (!e || !inTable) return;
      entries.push({ izm: +e[1], base: e[2], code: e[3] || '', full: e[2] + (e[3] ? ' ' + e[3] : ''), sheets: sheetList(e[4]), text: l });
    });
    meta.noticeEntries = entries;
  }

  function changeRecords(doc) {
    var recs = [];
    doc.pages.forEach(function (p) { p.lines.forEach(function (l) { eachMatch(CHANGE_REC, l, function (m) { recs.push({ page: p.num, izm: +m[1], kind: m[2], no: m[3] }); }); }); });
    return recs;
  }

  function analyze(doc) {
    if (doc.meta) return doc.meta;
    var meta = doc.meta = { hasTB: false, nameLines: [], kind: '', productName: '', tbDesig: null, fileDesig: parseDesig(doc.name), spec: null, positions: null };
    var p1 = doc.pages[0];
    if (!p1) return meta;
    var A = null, U = null, Lt = null, dre = new RegExp('^' + DESIG);
    p1.segs.forEach(function (s) {
      if (!A && /^Разраб/.test(s.text)) A = s;
      if (/^Утв/.test(s.text)) U = s;
      if (!Lt) {
        var li = s.text.indexOf('Лит.');
        if (li === 0) Lt = s;
        else if (li > 0 && /(^|\s)Лит\.\s/.test(s.text + ' ')) { // «Наименование … Лит. Лист Листов» одним фрагментом
          var k = (s.x1 - s.x0) / Math.max(1, s.text.length);
          Lt = { text: s.text.slice(li), x0: s.x0 + k * li, x1: s.x1, y: s.y, fs: s.fs, cut: s, cutAt: li };
        }
      }
    });
    if (A && U && Lt && Lt.x0 > A.x0 && A.y > U.y) {
      meta.hasTB = true;
      var w = Lt.x0 - A.x0, r = (A.y - U.y) / 4.5, D = null;
      p1.segs.forEach(function (s) {
        if (dre.test(s.text) && s.x0 > A.x0 + 0.3 * w && s.y > A.y - r && s.y < A.y + 7 * r && (!D || s.y < D.y)) D = s;
      });
      if (D) meta.tbDesig = parseDesig(D.text);
      else {
        var any = /^([А-ЯЁ]{2,4}\.[0-9А-ЯЁ.\-]{3,})(?:\s([А-ЯЁ]{1,3}\d{0,2}))?$/;
        p1.segs.forEach(function (s) {
          var mm = any.exec(s.text);
          if (mm && s.x0 > A.x0 + 0.3 * w && s.y > A.y - r && s.y < A.y + 7 * r && s.fs >= A.fs && (!D || s.y < D.y)) { D = s; meta.tbDesig = { base: mm[1], code: mm[2] || '', full: s.text, nonstd: true }; }
        });
      }
      var top = D ? D.y - 0.4 * r : A.y + 2.5 * r;
      var cell = p1.segs.filter(function (s) {
        var cx = (s.x0 + s.x1) / 2;
        if (s.y > Lt.y - 2.2 * r && s.y < Lt.y + 0.5 * r && cx > Lt.x0 - 1.4 * r) return false; // значения граф «Лит.», «Лист», «Листов»
        if (s === Lt.cut) return true;
        return cx > A.x0 + 0.44 * w && (s.x1 < Lt.x0 + 0.02 * w || (s.x0 < Lt.x0 - 2 * r && cx < Lt.x0)) && s.y > U.y - 0.6 * r && s.y < top && !dre.test(s.text);
      }).sort(function (a, b) { return b.y - a.y; });
      meta.graphic = p1.segs.some(function (s) { return /Масса|Масштаб/.test(s.text) && s.y > U.y && s.y < A.y + 6 * r; });
      if (meta.graphic) {
        var mat = cell.filter(function (s) { return s.y < U.y + 2.6 * r && s !== Lt.cut; });
        meta.material = mat.map(function (s) { return s.text; }).join(' ');
        cell = cell.filter(function (s) { return mat.indexOf(s) < 0; });
      }
      meta.nameLines = cell.map(function (s) {
        var t = s === Lt.cut ? s.text.slice(0, Lt.cutAt) : s.text;
        t = t.replace(/^((Изм|Лист|N|№|докум|Подп|Дата|Кол\.уч)\.?\s*)+/, '').replace(/\s+(Лит\.|Масса|Масштаб|Лист|Листов)(\s+(Масса|Масштаб|Лист|Листов))*\s*$/, '');
        return t.trim();
      }).filter(Boolean);
      meta.tb = { x0: A.x0, top: (D ? D.y : A.y) + r };
    }
    var rest = [];
    meta.nameLines.forEach(function (l) { if (KIND_BY_NAME[norm(l)] && !meta.kind) meta.kind = KIND_BY_NAME[norm(l)]; else rest.push(l); });
    meta.productName = rest.join(' ').replace(/\s+/g, ' ').trim();
    meta.desig = meta.tbDesig || meta.fileDesig;
    if (!meta.desig) {
      var cnt = {}, best = null;
      doc.pages.forEach(function (p) { p.segs.forEach(function (s) { var d = parseDesig(s.text); if (d) { cnt[d.full] = (cnt[d.full] || 0) + 1; if (!best || cnt[d.full] > cnt[best.full]) best = d; } }); });
      meta.desig = best;
    }
    var head = p1.segs.slice(0, 80).map(function (s) { return s.text; }).join(' ');
    meta.notice = /ИЗВЕЩЕНИЕ/i.test(head) && /(Причина|Указание о заделе|Указание о внедрении|Срок изм)/i.test(doc.pages.map(function (p) { return p.lines.join(' '); }).join(' ').slice(0, 4000));
    if (meta.notice) parseNotice(doc, meta);
    var hasHead = p1.segs.some(function (s) { return /^Обозначение/.test(s.text); }) && p1.segs.some(function (s) { return /Наименование/.test(s.text); });
    var secNorm = SPEC_SECTIONS.map(norm);
    if (hasHead && p1.segs.some(function (s) { return secNorm.indexOf(norm(s.text)) >= 0; }) && !(meta.desig && meta.desig.code)) meta.spec = parseSpec(doc, meta.desig);
    if (!meta.spec && meta.hasTB) {
      var ints = [], all = [], mentioned = {};
      doc.pages.forEach(function (p) {
        p.segs.forEach(function (s) {
          if (p.num === 1 && meta.tb && s.x0 >= meta.tb.x0 - 2 && s.y <= meta.tb.top) return;
          if (/^\d{1,3}$/.test(s.text)) { s.page = p.num; ints.push(s); all.push(s.fs); }
          else if (/^[\d.,±+\-–xх×°RØ⌀M ]+$/.test(s.text) && /\d/.test(s.text)) all.push(s.fs);
        });
        p.blocks.forEach(function (b) { eachMatch(/поз\.\s?(\d{1,3})/g, b.text, function (m) { mentioned[+m[1]] = 1; }); });
      });
      var drawn = null, anyInt = {}, mn = all.length ? Math.min.apply(null, all) : 0;
      ints.forEach(function (s) { anyInt[+s.text] = 1; });
      // номера позиций крупнее размерных чисел; сравниваем в пределах каждого листа
      doc.pages.forEach(function (p) {
        var pi = ints.filter(function (s) { return s.page === p.num; });
        if (!pi.length) return;
        var mx = Math.max.apply(null, pi.map(function (s) { return s.fs; }));
        if (mx >= 1.2 * mn) { drawn = drawn || {}; pi.forEach(function (s) { if (s.fs >= 0.92 * mx) drawn[+s.text] = 1; }); }
      });
      meta.positions = { drawn: drawn, anyInt: anyInt, mentioned: mentioned };
    }
    return meta;
  }

  /* ---------- 2б. Проверка комплекта документов ---------- */

  var SET_RULES = [
    { id: 'set-names', title: 'Наименования и обозначения в комплекте', basis: 'ГОСТ Р 2.104-2023, ГОСТ Р 2.106-2019' },
    { id: 'set-pos', title: 'Позиции: спецификация и сборочный чертёж', basis: 'ГОСТ Р 2.106-2019, ГОСТ Р 2.109-2023' },
    { id: 'set-complete', title: 'Комплектность: приложены ли документы из спецификации', basis: 'ГОСТ Р 2.106-2019, п. 4.2.3' },
    { id: 'set-notice', title: 'Извещение: приложены ли документы и внесены ли изменения', basis: 'ГОСТ Р 2.503-2023' }
  ];

  function checkNotices(notices, ok, add) {
    notices.forEach(function (N) {
      var no = N.meta.noticeNo, E = N.meta.noticeEntries || [], nf = [N.name];
      if (!no) { add('set-notice', 'warn', 'В извещении «' + N.name + '» не удалось прочитать его номер', '', nf); return; }
      add('set-notice', 'ok', 'Основной документ комплекта — извещение ' + no + '. Комплектность проверяется по его перечню, а не по спецификации.', '', nf);
      if (!E.length) { add('set-notice', 'warn', 'В извещении ' + no + ' не найден перечень изменяемых документов', 'Ожидаются строки вида «5   АБВГ.123456.001 СБ (Лист 1; Лист 2)» после заголовка «Документ заменить».', nf); return; }
      var used = {};
      E.forEach(function (e) {
        var hits = ok.filter(function (d) { var g = d.meta.tbDesig || d.meta.desig, f = d.meta.fileDesig; return (g && g.base === e.base && g.code === e.code) || (f && f.base === e.base && (f.code === e.code || (f.code === 'СП' && !e.code))); });
        if (!hits.length) {
          var alt = ok.filter(function (d) { return !used[d.name] && changeRecords(d).some(function (r) { return r.no === no; }) && !E.some(function (x) { var g = d.meta.tbDesig || d.meta.desig; return g && g.base === x.base && g.code === x.code; }); });
          add('set-notice', 'err', 'Документ ' + e.full + ' указан в извещении ' + no + ' (изм. ' + e.izm + '), но не приложен',
            alt.length ? 'С записью этого извещения приложен документ ' + alt.map(function (d) { return (d.meta.tbDesig || d.meta.desig || {}).full || d.name; }).join(', ') + ': проверьте обозначение в извещении или в документе.' : '', nf);
          return;
        }
        var D = hits[0], recs = changeRecords(D).filter(function (r) { return r.no === no; }), files = [N.name, D.name];
        used[D.name] = 1;
        var sheets = e.sheets.length ? e.sheets : D.pages.map(function (p) { return p.num; });
        var bad = [], wrongIzm = [];
        sheets.forEach(function (sh) {
          if (sh > D.pages.length) { bad.push(sh + ' (в файле ' + D.pages.length + ' лист.)'); return; }
          var r = recs.filter(function (x) { return x.page === sh; });
          if (!r.length) bad.push(sh); else if (!r.some(function (x) { return x.izm === e.izm; })) wrongIzm.push(sh + ' (указано изм. ' + r[0].izm + ')');
        });
        var extra = recs.filter(function (r) { return sheets.indexOf(r.page) < 0; }).map(function (r) { return r.page; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
        if (bad.length) add('set-notice', 'err', D.name + ': нет записи «' + e.izm + ' … ' + no + '» в графах изменений на листах ' + bad.join(', '), 'Листы указаны в извещении ' + no + ' как изменяемые.', files);
        if (wrongIzm.length) add('set-notice', 'err', D.name + ': номер изменения не совпадает с извещением (ожидается изм. ' + e.izm + ') на листах ' + wrongIzm.join(', '), '', files);
        if (extra.length) add('set-notice', 'warn', D.name + ': запись об извещении ' + no + ' есть на листах ' + extra.join(', ') + ', но эти листы в извещении не перечислены', '', files);
        if (!bad.length && !wrongIzm.length && !extra.length) add('set-notice', 'ok', D.name + ': записи об изменении ' + e.izm + ' по извещению ' + no + ' есть на всех указанных листах (' + sheets.join(', ') + ')', '', files);
      });
      ok.forEach(function (d) {
        if (used[d.name]) return;
        var has = changeRecords(d).some(function (r) { return r.no === no; });
        add('set-notice', has ? 'warn' : 'note', has ? d.name + ': в документе есть записи по извещению ' + no + ', но в перечне извещения он не указан' : d.name + ': документ не упоминается в извещении ' + no, has ? '' : 'Если он приложен для справки, замечание можно не учитывать.', [d.name]);
      });
    });
  }

  function sameName(a, b) { a = norm(a); b = norm(b); return !a || !b || a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0; }
  function keys(o) { return Object.keys(o).map(Number).sort(function (x, y) { return x - y; }); }

  function checkSet(docs, disabled) {
    disabled = disabled || {};
    var all = docs.filter(function (d) { return !d.error && d.pages.length; });
    var notices = all.filter(function (d) { return analyze(d).notice; });
    var out = [], ok = all.filter(function (d) { return !d.meta.notice; });
    function add(rule, sev, msg, fix, files) { if (!disabled[rule]) out.push({ rule: rule, sev: sev, msg: msg, fix: fix || '', files: files || [], title: SET_RULES.filter(function (r) { return r.id === rule; })[0].title }); }
    ok.forEach(analyze);
    if (notices.length) checkNotices(notices, ok, add);
    var seen = {};
    ok.forEach(function (d) {
      var g = d.meta.desig; if (!g) return;
      if (seen[g.full]) add('set-names', 'warn', 'Два файла с одним обозначением ' + g.full, '', [seen[g.full].name, d.name]); else seen[g.full] = d;
    });
    function codeOk(g, codes) { return codes.indexOf(g.code) >= 0 || (g.code === 'СП' && codes.indexOf('') >= 0); }
    function find(base, codes) {
      var grp = base.replace(/-\d{2,3}$/, ''), hit = null;
      [function (g) { return g.base === base; }, function (g) { return g.base === grp; }].some(function (same) {
        hit = ok.filter(function (d) { var g = d.meta.desig; return g && same(g) && codeOk(g, codes); })[0] ||
              ok.filter(function (d) { var g = d.meta.fileDesig; return g && same(g) && codeOk(g, codes); })[0];
        return hit;
      });
      return hit;
    }

    ok.forEach(function (S) {
      var items = S.meta.spec; if (!items) return;
      var B = S.meta.desig ? S.meta.desig.base : '';
      var sb = B ? find(B, ['СБ']) : null;
      // позиции внутри спецификации
      var specPos = {}, prev = 0;
      items.forEach(function (it) {
        if (it.pos == null) return;
        if (specPos[it.pos]) add('set-pos', 'err', 'В спецификации позиция ' + it.pos + ' встречается дважды', '', [S.name]);
        else if (it.pos < prev) add('set-pos', 'warn', 'В спецификации позиция ' + it.pos + ' записана после позиции ' + prev + ' (номера идут не по возрастанию)', '', [S.name]);
        specPos[it.pos] = it; prev = Math.max(prev, it.pos);
      });
      if (sb) {
        var m = sb.meta, files = [S.name, sb.name];
        var wrongSb = m.tbDesig && m.tbDesig.base !== B;
        if (wrongSb) add('set-names', 'err', 'Файл «' + sb.name + '» назван как сборочный чертёж ' + B + ' СБ, но в его основной надписи обозначение ' + m.tbDesig.full, 'Проверьте, тот ли чертёж приложен и верна ли запись в разделе «Документация» спецификации. Наименование и позиции с этим чертежом не сверялись.', files);
      }
      if (sb && !(sb.meta.tbDesig && sb.meta.tbDesig.base !== B)) {
        var m = sb.meta, files = [S.name, sb.name];
        if (S.meta.productName && m.productName && norm(S.meta.productName) !== norm(m.productName))
          add('set-names', 'err', 'Наименование изделия в спецификации и на сборочном чертеже различается', 'Спецификация: «' + S.meta.productName + '». Сборочный чертёж: «' + m.productName + '»', files);
        if (m.positions) {
          var P = m.positions, onDrawing = {}, maxPos = Math.max.apply(null, keys(specPos).concat([0])), lim = maxPos * 1.5 + 5;
          var drawnOk = P.drawn ? keys(P.drawn).filter(function (n) { return n >= 1 && n <= lim; }) : [];
          var sure = drawnOk.length >= 2;
          keys(P.mentioned).forEach(function (n) { if (n <= lim) onDrawing[n] = 1; });
          if (sure) drawnOk.forEach(function (n) { onDrawing[n] = 1; });
          var extra = keys(onDrawing).filter(function (n) { return !specPos[n]; });
          var missing = keys(specPos).filter(function (n) { return !(onDrawing[n] || P.anyInt[n]); });
          var partial = sb.findings && sb.findings.some(function (f) { return f.rule === 'sheets'; });
          extra.forEach(function (n) { add('set-pos', 'err', 'Позиция ' + n + ' есть на сборочном чертеже, но отсутствует в спецификации', '', files); });
          missing.forEach(function (n) { add('set-pos', sure ? 'warn' : 'note', 'Позиция ' + n + ' («' + (specPos[n].name || specPos[n].base) + '») есть в спецификации, но на сборочном чертеже не найдена', partial ? 'В файле чертежа не все листы: позиция может быть на отсутствующем листе.' : '', files); });
          if (!extra.length && !missing.length) add('set-pos', 'ok', 'Позиции спецификации и сборочного чертежа совпадают: ' + keys(specPos).join(', '), sure ? '' : 'Номера позиций на чертеже не удалось отличить от размеров по высоте шрифта; проверено только наличие чисел.', files);
          else if (!sure) add('set-pos', 'note', 'Номера позиций на чертеже не удалось отличить от размерных чисел по высоте шрифта', 'Сверка выполнена по упоминаниям «поз. N» в тексте и по наличию чисел на чертеже, возможны пропуски.', files);
        }
      } else if (items.some(function (it) { return it.section === 'Документация' && it.code === 'СБ'; })) {
        add('set-pos', 'note', 'Сборочный чертёж ' + B + ' СБ не загружен, позиции не сверены', '', [S.name]);
      }
      // комплектность и наименования составных частей
      var need = items.filter(function (it) { return it.base && ['Сборочные единицы', 'Детали', 'Комплексы', 'Комплекты'].indexOf(it.section) >= 0 && it.format !== 'БЧ'; });
      var miss = [], have = 0;
      need.forEach(function (it) {
        var d = find(it.base, it.section === 'Детали' ? [''] : ['', 'СБ']);
        if (!d) { miss.push(it.base + (it.name ? ' ' + it.name : '')); return; }
        have++;
        if (d.meta.productName && it.name && !sameName(it.name, d.meta.productName))
          add('set-names', 'warn', 'Наименование ' + it.base + ' в спецификации и в основной надписи документа различается', 'Спецификация: «' + it.name + '». Документ: «' + d.meta.productName + '»', [S.name, d.name]);
      });
      if (notices.length) return; // в комплекте по извещению комплектность определяет извещение
      if (need.length) {
        if (miss.length) add('set-complete', 'warn', 'Составные части: приложено документов ' + have + ' из ' + need.length + '. Не приложены: ' + miss.length, miss.join('; '), [S.name]);
        else add('set-complete', 'ok', 'На все составные части из спецификации (' + need.length + ') документы приложены', '', [S.name]);
      }
      var docsNeed = items.filter(function (it) { return it.section === 'Документация' && it.base && it.format !== 'БЧ'; });
      var dm = docsNeed.filter(function (it) { return !find(it.base, [it.code]); }).map(function (it) { return it.base + ' ' + it.code + (it.name ? ' ' + it.name : ''); });
      if (docsNeed.length && dm.length) add('set-complete', 'note', 'Раздел «Документация»: приложено ' + (docsNeed.length - dm.length) + ' из ' + docsNeed.length + '. Не приложены: ' + dm.length, dm.join('; '), [S.name]);
    });
    var order = { err: 0, warn: 1, note: 2, ok: 3 };
    out.sort(function (a, b) { return order[a.sev] - order[b.sev]; });
    return out;
  }

  /* ---------- 3. Правила ---------- */

  function alt(list) {
    return list.slice().sort(function (a, b) { return b.length - a.length; })
      .map(function (u) { return u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|');
  }
  function snip(text, idx, len) {
    var a = Math.max(0, idx - 45), b = Math.min(text.length, idx + len + 45);
    return { pre: (a > 0 ? '…' : '') + text.slice(a, idx), hit: text.slice(idx, idx + len), post: text.slice(idx + len, b) + (b < text.length ? '…' : '') };
  }
  function eachMatch(re, text, fn) { var m; re.lastIndex = 0; while ((m = re.exec(text))) { fn(m); if (m.index === re.lastIndex) re.lastIndex++; } }

  // Правило по регулярному выражению над блоками текста
  function reRule(o) {
    o.run = function (doc, out) {
      doc.pages.forEach(function (p) {
        p.blocks.forEach(function (b) {
          eachMatch(o.re(), b.text, function (m) {
            var r = o.test ? o.test(m, b.text) : {};
            if (r === false) return;
            out({ page: p.num, snip: snip(b.text, m.index, m[0].length), msg: (r && r.msg) || o.msg, fix: r && r.fix, repl: r && r.repl && r.repl.to !== r.repl.from ? r.repl : undefined });
          });
        });
      });
    };
    return o;
  }

  var RULES = [
    {
      id: 'titleblock', sev: 'err', title: 'Реквизиты: наименование и обозначение', basis: 'ГОСТ Р 2.104-2023, ГОСТ Р 2.102-2023 (таблица 1)',
      run: function (doc, out) {
        var m = analyze(doc), g = m.tbDesig, f = m.fileDesig;
        if (m.notice) return;
        if (m.hasTB && !g) out({ page: 1, msg: 'В основной надписи не найдено обозначение документа' });
        if (g && g.nonstd) out({ page: 1, sev: 'warn', msg: 'Обозначение «' + g.full + '» в основной надписи не соответствует структуре ГОСТ Р 2.201 (ХХХХ.ХХХХХХ.ХХХ)' });
        if (m.hasTB && !m.productName) out({ page: 1, msg: 'В основной надписи не найдено наименование изделия' });
        var code = g ? g.code : (f ? f.code : '');
        var kindName = DOC_KIND[code];
        if (kindName) {
          var where = m.hasTB ? m.nameLines : (doc.pages[0] ? doc.pages[0].segs.map(function (s) { return s.text; }) : []);
          if (!where.some(function (l) { return norm(l).indexOf(norm(kindName)) >= 0; }))
            out({ page: 1, sev: m.hasTB ? 'warn' : 'note', msg: 'Код документа «' + code + '», но наименование документа «' + kindName + '» ' + (m.hasTB ? 'в основной надписи' : 'на первом листе') + ' не найдено' });
        }
        if (m.hasTB && m.kind && g && g.code !== m.kind)
          out({ page: 1, sev: 'warn', msg: 'В основной надписи указано «' + DOC_KIND[m.kind] + '», а код документа в обозначении ' + (g.code ? '«' + g.code + '»' : 'отсутствует'), fix: 'Ожидается обозначение ' + g.base + ' ' + m.kind });
        if (!f) out({ page: 0, sev: 'note', msg: 'В имени файла нет обозначения документа' + (g ? ' (в основной надписи: ' + g.full + ')' : '') });
        else if (g && f.base !== g.base) out({ page: 1, msg: 'Обозначение в имени файла (' + f.full + ') не совпадает с обозначением в основной надписи (' + g.full + ')' });
        else if (g && f.code !== g.code && !(f.code === 'СП' && !g.code)) out({ page: 1, msg: 'Код документа в имени файла (' + (f.code || 'нет') + ') не совпадает с кодом в основной надписи (' + (g.code || 'нет') + ')' });
        if (m.hasTB && g) doc.pages.forEach(function (p) {
          if (p.num > 1 && !p.segs.some(function (s) { return s.text.indexOf(g.base) >= 0; })) out({ page: p.num, sev: 'warn', msg: 'На листе ' + p.num + ' не найдено обозначение документа ' + g.base });
        });
        doc.stats.name = m.productName; doc.stats.tbDesig = g ? g.full : '';
      }
    },
    reRule({
      id: 'unit-case', sev: 'err', title: 'Регистр букв в обозначении единицы', basis: 'ГОСТ 8.417-2024, разд. 7 и 8',
      msg: 'Обозначение единицы записано с неверным регистром букв',
      re: function () { return new RegExp('(\\d+(?:[.,]\\d+)?)(\\s?)(' + alt(UNITS_CASE) + ')(?![' + L + '])', 'gi'); },
      test: function (m) {
        var canon = UNITS_CASE.filter(function (u) { return u.toLowerCase() === m[3].toLowerCase(); });
        if (canon.indexOf(m[3]) >= 0) return false;
        if (/^[мМ][вВ][тТ]$/.test(m[3]) && (m[3] === 'МВт' || m[3] === 'мВт')) return false;
        return { fix: 'Правильно: ' + canon.join(' или '), repl: canon.length === 1 ? { from: m[0], to: m[1] + m[2] + canon[0] } : undefined };
      }
    }),
    reRule({
      id: 'unit-space', sev: 'warn', title: 'Пробел между числом и единицей', basis: 'ГОСТ 8.417-2024, п. 8.3',
      msg: 'Между числовым значением и обозначением единицы нужен пробел',
      re: function () { return new RegExp('(?<![' + L + '\\d.,/-])(\\d+(?:[.,]\\d+)?)(' + alt(UNITS_SPACE) + ')(?![' + L + '\\d])', 'g'); },
      test: function (m, text) {
        if (/^[АВ]$/.test(m[2]) && /(д|дом|стр|корп|кв|оф|уч|к)\.?\s*$/i.test(text.slice(Math.max(0, m.index - 8), m.index))) return false; // адрес: «д. 45А»
        return { fix: 'Правильно: ' + m[1] + ' ' + m[2], repl: { from: m[0], to: m[1] + ' ' + m[2] } };
      }
    }),
    reRule({
      id: 'range', sev: 'note', title: 'Запись диапазона значений', basis: 'ГОСТ Р 2.105-2019, п. 6.16.5',
      msg: 'Диапазон значений записывают словами «от … до …», единицу указывают после последнего числа',
      re: function () { return new RegExp('(?<![' + L + '\\d.,-])\\(?(\\d+(?:[.,]\\d+)?)\\s?(?:–|—|-|\\.\\.\\.|…|÷)\\s?(\\d+(?:[.,]\\d+)?)\\)?\\s?(' + alt(UNITS_RANGE) + ')(?![' + L + '\\d])', 'g'); },
      test: function (m) { return { fix: 'Например: от ' + m[1] + ' до ' + m[2] + ' ' + m[3] }; }
    }),
    reRule({
      id: 'temp-sign', sev: 'warn', title: 'Знак перед значением температуры', basis: 'ГОСТ Р 2.105-2019, п. 5.2.4',
      msg: 'В тексте вместо знаков «−» и «+» перед значением пишут слова «минус» и «плюс»',
      re: function () { return /(?<![\dA-Za-zА-Яа-яЁё])([-–−+])\s?(\d+(?:[.,]\d+)?)(?=\s?°\s?[СC]|\s+до\s+[-–−+а-яё]*\s?\d+(?:[.,]\d+)?\s?°\s?[СC])/g; },
      test: function (m) { var t = (m[1] === '+' ? 'плюс ' : 'минус ') + m[2]; return { fix: 'Правильно: ' + t, repl: { from: m[0], to: t } }; }
    }),
    reRule({
      id: 'grammar', sev: 'warn', title: 'Типовые ошибки в оборотах', basis: 'Нормы русского языка',
      msg: 'Ошибка в устойчивом обороте',
      re: function () { return /согласно\s+(требований|ГОСТа|чертежа|приказа|договора|паспорта|графика|плана|руководства|регламента|стандарта|документа)|в\s+соответствие\s+с(?=\s)|в\s+течении\s+(?=\d|всего|срока|гарантийного|одного|двух|тр[её]х)|во\s+избежании|по\s+(окончанию|истечению|завершению|прибытию)\s/gi; },
      test: function (m) {
        var s = m[0].toLowerCase(), src = m[0], to;
        var DAT = { 'требований': 'требованиям', 'госта': 'ГОСТу', 'чертежа': 'чертежу', 'приказа': 'приказу', 'договора': 'договору', 'паспорта': 'паспорту', 'графика': 'графику', 'плана': 'плану', 'руководства': 'руководству', 'регламента': 'регламенту', 'стандарта': 'стандарту', 'документа': 'документу' };
        function keepCase(t) { return /^[А-ЯЁ]/.test(src) ? t.charAt(0).toUpperCase() + t.slice(1) : t; }
        if (s.indexOf('согласно') === 0) { to = src.replace(/(\s+)(\S+)$/, function (a, sp, w) { return sp + (DAT[w.toLowerCase()] || w); }); return { fix: '«Согласно» требует дательного падежа: согласно требованиям, чертежу, ГОСТу', repl: { from: src, to: to } }; }
        if (s.indexOf('соответствие') > 0) return { fix: 'Правильно: в соответствии с', repl: { from: src, to: keepCase(src.replace(/соответствие/i, 'соответствии')) } };
        if (s.indexOf('течении') > 0) return { fix: 'Правильно: в течение', repl: { from: src.trim(), to: src.trim().replace(/течении/i, 'течение') } };
        if (s.indexOf('избежании') > 0) return { fix: 'Правильно: во избежание', repl: { from: src, to: src.replace(/избежании/i, 'избежание') } };
        return { fix: 'Правильно: по окончании, по истечении, по завершении, по прибытии', repl: { from: src.trim(), to: src.trim().replace(/ию$/i, 'ии') } };
      }
    }),
    reRule({
      id: 'mixed-script', sev: 'warn', title: 'Смешение кириллицы и латиницы в слове', basis: 'Поиск и учёт документов',
      msg: 'В одном слове есть и русские, и латинские буквы',
      re: function () { return /[A-Za-zА-Яа-яЁё]{2,}/g; },
      test: function (m) {
        var w = m[0];
        if (!(/[A-Za-z]/.test(w) && /[А-Яа-яЁё]/.test(w))) return false;
        var L2C = { A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у' }, C2L = {};
        Object.keys(L2C).forEach(function (k) { C2L[L2C[k]] = k; });
        var nLat = (w.match(/[A-Za-z]/g) || []).length, nCyr = w.length - nLat, to = null;
        if (nCyr > nLat && w.replace(/[A-Za-z]/g, function (c) { return L2C[c] ? '' : c; }).match(/[A-Za-z]/) === null) to = w.replace(/[A-Za-z]/g, function (c) { return L2C[c]; });
        else if (nLat > nCyr && w.replace(/[А-Яа-яЁё]/g, function (c) { return C2L[c] ? '' : c; }).match(/[А-Яа-яЁё]/) === null) to = w.replace(/[А-Яа-яЁё]/g, function (c) { return C2L[c]; });
        return { fix: 'Проверьте раскладку: «' + w.replace(/[A-Za-z]/g, function (c) { return '[' + c + ']'; }) + '» (латинские буквы в скобках)', repl: to ? { from: w, to: to } : undefined };
      }
    }),
    reRule({
      id: 'gost-format', sev: 'warn', title: 'Запись обозначения стандарта', basis: 'Принятая запись обозначений стандартов',
      msg: 'Между словом «ГОСТ» и номером нужен пробел',
      re: function () { return /ГОСТ(?:\s?Р)?\d/g; },
      test: function (m) { return { repl: { from: m[0], to: m[0].replace(/^ГОСТ\s?(Р)?(\d)$/, function (a, r, d) { return 'ГОСТ ' + (r ? 'Р ' : '') + d; }) } }; }
    }),
    {
      id: 'gost-replaced', sev: 'err', title: 'Ссылки на заменённые стандарты', basis: 'Перечень действующих стандартов',
      run: function (doc, out) {
        doc.pages.forEach(function (p) { p.blocks.forEach(function (b) {
          eachMatch(/ГОСТ(\s?Р)?\s?(\d+(?:\.\d+)*)\s?[-–—]\s?(\d{2,4})/g, b.text, function (m) {
            var key = 'ГОСТ ' + (m[1] ? 'Р ' : '') + m[2] + '-' + m[3];
            doc.stats.gost = (doc.stats.gost || 0) + 1;
            if (REPLACED[key]) out({ page: p.num, snip: snip(b.text, m.index, m[0].length), msg: 'Стандарт заменён', fix: 'Действует ' + REPLACED[key][0] + (REPLACED[key][1] ? '' : ' (запись перечня не сверена, проверьте)') });
          });
        }); });
      }
    },
    {
      id: 'pairs', sev: 'warn', title: 'Непарные кавычки и скобки', basis: 'Правила пунктуации',
      run: function (doc, out) {
        var opens = [], closes = [];
        doc.pages.forEach(function (p) { p.blocks.forEach(function (b) {
          var t = b.text, q = [], r = [];
          for (var k = 0; k < t.length; k++) {
            var ch = t[k];
            if (ch === '«') q.push(k);
            else if (ch === '»') { if (q.length) q.pop(); else closes.push({ b: b, p: p.num, i: k, kind: 'q' }); }
            else if (ch === '(') r.push(k);
            else if (ch === ')') {
              if (r.length) r.pop();
              else if (!/(^|[\s;:.,(])[а-яёa-z0-9*]{0,2}$/i.test(t.slice(0, k))) closes.push({ b: b, p: p.num, i: k, kind: 'r' });
            }
          }
          q.forEach(function (k) { opens.push({ b: b, p: p.num, i: k, kind: 'q' }); });
          r.forEach(function (k) { opens.push({ b: b, p: p.num, i: k, kind: 'r' }); });
        }); });
        // Текст, перенесённый в следующую колонку или на следующий лист: открытие в конце одного блока, закрытие в начале другого
        closes.forEach(function (c) {
          if (c.i > 160 || !/^[а-яё]/.test(c.b.text)) return;
          for (var n = 0; n < opens.length; n++) {
            var o = opens[n];
            if (o.used || o.kind !== c.kind || o.b === c.b || o.p > c.p || o.b.text.length - o.i > 300) continue;
            o.used = c.used = true; break;
          }
        });
        var cellNote = 'Похоже на ячейку таблицы: текст мог продолжиться в соседней ячейке.';
        opens.forEach(function (o) { if (!o.used) out({ page: o.p, sev: o.b.text.length < 140 ? 'note' : undefined, fix: o.b.text.length < 140 ? cellNote : '', snip: snip(o.b.text, o.i, 1), msg: o.kind === 'q' ? 'Кавычка открыта, но не закрыта' : 'Скобка открыта, но не закрыта' }); });
        closes.forEach(function (c) { if (!c.used) out({ page: c.p, sev: c.b.text.length < 140 ? 'note' : undefined, fix: c.b.text.length < 140 ? cellNote : '', snip: snip(c.b.text, c.i, 1), msg: c.kind === 'q' ? 'Закрывающая кавычка без открывающей' : 'Закрывающая скобка без открывающей' }); });
      }
    },
    {
      id: 'xref', sev: 'warn', title: 'Ссылки на рисунки и таблицы', basis: 'ГОСТ Р 2.105-2019, пп. 6.8.3, 6.9.1, 6.9.3',
      run: function (doc, out) {
        ['Таблица', 'Рисунок'].forEach(function (kind) {
          var cap = {}, ref = {};
          var capRe = kind === 'Рисунок'
            ? /^(?:Рисунок|Рис\.)\s?(\d+(?:\.\d+)?)(?=\s*$|\s*[–—-]\s|\s*\(|\s+[А-ЯЁ])/
            : new RegExp('^' + kind + '\\s+(\\d+(?:\\.\\d+)?)(?=\\s*$|\\s*[–—-]\\s|\\s*\\(|\\s+[А-ЯЁ])');
          var lowRe = kind === 'Таблица' ? /(таблиц(?:а|е|ы|у|ах|ами|ам)|табл\.)\s?(\d+(?:\.\d+)?)/g : /(рисун(?:ок|ка|ке|ку|ком|ки|ках|ков|кам|ками)|рис\.)\s?(\d+(?:\.\d+)?)/gi;
          var capWordRe = new RegExp(kind + '\\s+(\\d+(?:\\.\\d+)?)', 'g');
          function addRef(n, page, text, idx, len) { (ref[n] = ref[n] || []).push({ page: page, snip: snip(text, idx, len) }); }
          doc.pages.forEach(function (p) {
            p.segs.forEach(function (s) {
              var m = capRe.exec(s.text);
              if (m) (cap[m[1]] = cap[m[1]] || []).push({ page: p.num, text: s.text });
              eachMatch(capWordRe, s.text, function (r) { if (!(r.index === 0 && m)) addRef(r[1], p.num, s.text, r.index, r[0].length); });
            });
            p.blocks.forEach(function (b) {
              eachMatch(lowRe, b.text, function (r) {
                addRef(r[2], p.num, b.text, r.index, r[0].length);
                // перечни и диапазоны: «рисунки 4.4 – 4.11», «рис. 3 и 4», «таблицы 2, 3»
                var tail = b.text.slice(r.index + r[0].length, r.index + r[0].length + 60), mm, last = r[2];
                var lr = /^\s*(?:,|и|–|—|\s-\s|\.\.\.|…)\s*([1-9]\d*(?:\.\d+)?)(?![\d-])/;
                while ((mm = lr.exec(tail))) {
                  var a = last.split('.'), z = mm[1].split('.');
                  if (/[–—-]|\.\.\.|…/.test(mm[0]) && a.length === z.length && a.slice(0, -1).join('.') === z.slice(0, -1).join('.')) {
                    for (var v = +a[a.length - 1] + 1; v < +z[z.length - 1] && v - a[a.length - 1] < 60; v++) addRef(a.slice(0, -1).concat([v]).join('.'), p.num, b.text, r.index, r[0].length);
                  }
                  addRef(mm[1], p.num, b.text, r.index, r[0].length);
                  last = mm[1]; tail = tail.slice(mm[0].length);
                }
              });
            });
          });
          var acc = kind === 'Таблица' ? 'таблицу ' : 'рисунок ';
          Object.keys(ref).forEach(function (n) {
            if (!cap[n]) out({ page: ref[n][0].page, snip: ref[n][0].snip, msg: 'Ссылка на ' + acc + n + ', но подпись «' + kind + ' ' + n + '» в документе не найдена' });
          });
          Object.keys(cap).forEach(function (n) {
            var graphic = analyze(doc).graphic;
            if (!ref[n] && !graphic) out({ page: cap[n][0].page, snip: { pre: '', hit: cap[n][0].text.slice(0, 80), post: '' }, sev: 'note', msg: 'На ' + acc + n + ' нет ссылки в тексте' });
            if (cap[n].length > 1 && !graphic) out({ page: cap[n][1].page, snip: { pre: '', hit: cap[n][1].text.slice(0, 80), post: '' }, msg: 'Подпись «' + kind + ' ' + n + '» встречается ' + cap[n].length + ' раза' });
          });
          var nums = Object.keys(cap).filter(function (n) { return /^\d+$/.test(n); }).map(Number).sort(function (x, y) { return x - y; });
          for (var i = 1; nums.length && i <= nums[nums.length - 1]; i++) {
            if (nums.indexOf(i) < 0) out({ page: 0, sev: 'note', msg: 'Нарушена нумерация: нет подписи «' + kind + ' ' + i + '» (есть до ' + nums[nums.length - 1] + ')' });
          }
          doc.stats[kind === 'Таблица' ? 'tables' : 'figures'] = Object.keys(cap).length;
        });
      }
    },
    {
      id: 'numbering', sev: 'note', title: 'Нумерация пунктов', basis: 'ГОСТ Р 2.105-2019, пп. 6.5.4, 6.5.5',
      run: function (doc, out) {
        var seen = {}, where = {};
        doc.pages.forEach(function (p) { p.segs.forEach(function (s) {
          var d = /^(\d{1,2}(?:\.\d{1,2}){1,3})\.\s+[А-ЯЁA-Z]/.exec(s.text);
          if (d) out({ page: p.num, sev: 'warn', snip: { pre: '', hit: d[1] + '.', post: s.text.slice(d[1].length + 1, 70) }, msg: 'После номера пункта точка не ставится' });
          var m = /^(\d{1,2}(?:\.\d{1,2}){1,3})\.?\s+[А-ЯЁA-Z]/.exec(s.text);
          if (!m) return;
          var parts = m[1].split('.').map(Number);
          if (parts[0] === 0 || parts[0] > 30) return;
          var parent = parts.slice(0, -1).join('.'), n = parts[parts.length - 1];
          (seen[parent] = seen[parent] || {})[n] = (seen[parent][n] || 0) + 1;
          where[m[1]] = p.num; doc.stats.items = (doc.stats.items || 0) + 1;
        }); });
        Object.keys(seen).forEach(function (parent) {
          var ns = Object.keys(seen[parent]).map(Number).sort(function (a, b) { return a - b; });
          if (ns.length < 2) return;
          for (var i = 1; i < ns[ns.length - 1]; i++) {
            if (!seen[parent][i]) out({ page: where[parent + '.' + (i + 1)] || 0, msg: 'Пропущен пункт ' + parent + '.' + i + ' (есть ' + parent + '.' + (i - 1 || 1) + ' и ' + parent + '.' + ns[ns.length - 1] + ')' });
          }
        });
      }
    },
    {
      id: 'sheets', sev: 'err', title: 'Количество листов в основной надписи', basis: 'ГОСТ Р 2.104-2023',
      run: function (doc, out) {
        var found = null;
        doc.pages.forEach(function (p) { p.lines.forEach(function (l) {
          var m = /Листов\s+(\d{1,3})(?!\d)/.exec(l);
          if (m && !found) found = { n: +m[1], page: p.num, line: l, idx: m.index, len: m[0].length };
        }); });
        if (found && found.n !== doc.pages.length) {
          out({ page: found.page, snip: snip(found.line, found.idx, found.len), msg: 'В основной надписи указано листов: ' + found.n + ', в файле страниц: ' + doc.pages.length });
        }
      }
    },
    {
      id: 'desig', sev: 'err', title: 'Обозначение документа', basis: 'ГОСТ Р 2.201-2023, п. 5.2.3',
      run: function (doc, out) {
        var all = {}, total = 0;
        var re = new RegExp('(?<![' + L + '\\d.])' + DESIG + '(?:\\s(?:' + DOC_CODES.join('|') + ')(?![' + L + ']))?', 'g');
        doc.pages.forEach(function (p) { p.segs.forEach(function (s) {
          eachMatch(re, s.text, function (m) {
            all[m[0]] = (all[m[0]] || 0) + 1; total++;
            if (/[A-Z]/.test(m[0].slice(0, 4))) out({ page: p.num, sev: 'warn', snip: snip(s.text, m.index, m[0].length), msg: 'В буквенном коде обозначения есть латинские буквы' });
          });
        }); });
        doc.stats.desig = total; if (fm) doc.stats.fileDesig = fm[0];
        var fm = re.exec(doc.name); re.lastIndex = 0;
        if (fm && !analyze(doc).tbDesig) {
          doc.stats.fileDesig = fm[0];
          var base = fm[0].replace(/\s.*$/, '');
          var hit = Object.keys(all).some(function (k) { return k.indexOf(base) === 0; });
          if (!hit) out({ page: 0, msg: 'Обозначение из имени файла (' + fm[0] + ') в тексте документа не найдено' });
          var code = /\s(\S+)$/.exec(fm[0]);
          if (code && hit && !all[fm[0]]) out({ page: 0, sev: 'warn', msg: 'В имени файла код документа «' + code[1] + '», но обозначение «' + fm[0] + '» в тексте не встречается' });
        }
      }
    },
    {
      id: 'sections', sev: 'warn', title: 'Состав документа', basis: 'ГОСТ Р 2.610-2019, ГОСТ 2.114-2016',
      run: function (doc, out) {
        var def = DOC_SECTIONS[doc.type];
        if (!def) return;
        var text = doc.pages.map(function (p) { return p.blocks.map(function (b) { return b.text; }).join('\n'); }).join('\n');
        def.parts.forEach(function (part) {
          if (!part[1].test(text)) out({ page: 0, sev: 'note', basis: def.basis,
            msg: 'Не найден раздел «' + part[0] + '»', fix: 'Раздел входит в общий состав документа «' + def.name + '». Если он исключён намеренно, замечание можно не учитывать.' });
        });
      }
    },
    reRule({
      id: 'unit-dot', sev: 'warn', title: 'Точка после обозначения единицы', basis: 'ГОСТ 8.417-2024, п. 8.2',
      msg: 'В обозначениях единиц точку как знак сокращения не ставят',
      re: function () { return new RegExp('\\d\\s?(?:' + alt(UNITS_DOT) + ')\\.(?=\\s+[а-яё(]|[,;])', 'g'); },
      test: function (m) { return { repl: { from: m[0], to: m[0].slice(0, -1) } }; }
    }),
    reRule({
      id: 'unit-product', sev: 'warn', title: 'Произведение единиц', basis: 'ГОСТ 8.417-2024, п. 8.8',
      msg: 'Обозначения единиц, входящих в произведение, отделяют точкой на средней линии',
      re: function () { return new RegExp('(\\d+(?:[.,]\\d+)?\\s?)(' + alt(Object.keys(UNITS_PRODUCT)) + ')(?![' + L + '])', 'g'); },
      test: function (m) { return { fix: 'Правильно: ' + UNITS_PRODUCT[m[2]], repl: { from: m[0], to: m[1] + UNITS_PRODUCT[m[2]] } }; }
    }),
    reRule({
      id: 'gost-noindex', sev: 'note', title: 'Индекс стандарта без номера', basis: 'ГОСТ Р 2.105-2019, п. 5.2.4',
      msg: 'Индекс «ГОСТ» приведён без регистрационного номера',
      re: function () { return /(?<![A-Za-zА-Яа-яЁё])ГОСТ(?!\s?(?:(?:Р|РВ|В|ИСО|МЭК|ISO|IEC|EN|ЕН|ИСО\/МЭК|ISO\/IEC)\s?)*\d)(?![А-Яа-яЁёA-Za-z])/g; }
    }),
    {
      id: 'diameter', sev: 'warn', title: 'Знак диаметра в тексте', basis: 'ГОСТ Р 2.105-2019, п. 5.2.4',
      run: function (doc, out) {
        if (!TEXT_TYPES[doc.type]) return;
        doc.pages.forEach(function (p) { p.blocks.forEach(function (b) {
          eachMatch(/[Ø⌀∅]/g, b.text, function (m) { out({ page: p.num, snip: snip(b.text, m.index, 1), msg: 'В тексте документа вместо знака диаметра пишут слово «диаметр»' }); });
        }); });
      }
    },
    {
      id: 'heading-dot', sev: 'note', title: 'Точка в конце заголовка раздела', basis: 'ГОСТ Р 2.105-2019, п. 6.6.2',
      run: function (doc, out) {
        if (!TEXT_TYPES[doc.type]) return;
        doc.pages.forEach(function (p) { p.segs.forEach(function (s) {
          var m = /^(\d{1,2})\s+[А-ЯЁ][^.!?:;]{2,70}\.$/.exec(s.text);
          if (m && +m[1] > 0 && +m[1] <= 30) out({ page: p.num, snip: { pre: s.text.slice(0, -1), hit: '.', post: '' }, msg: 'Заголовки печатают без точки в конце', fix: 'Если это не заголовок раздела, а пункт, замечание можно не учитывать.', repl: { from: s.text, to: s.text.slice(0, -1) } });
        }); });
      }
    },
    {
      id: 'appendix', sev: 'warn', title: 'Приложения', basis: 'ГОСТ Р 2.105-2019, пп. 6.3.3, 6.3.5',
      run: function (doc, out) {
        var cap = {}, ref = {};
        doc.pages.forEach(function (p) {
          p.segs.forEach(function (s) {
            var m = /^Приложение\s+([А-ЯЁA-Z])(?![A-Za-zА-Яа-яЁё])\s*(\(.*\))?$/.exec(s.text) || /^ПРИЛОЖЕНИЕ\s+([А-ЯЁA-Z])(?![A-Za-zА-Яа-яЁё])\s*(\(.*\))?$/.exec(s.text);
            if (m) {
              (cap[m[1]] = cap[m[1]] || []).push(p.num);
              if (/[ЁЗЙОЧЬЫЪIO]/.test(m[1])) out({ page: p.num, snip: { pre: 'Приложение ', hit: m[1], post: '' }, msg: 'Для обозначения приложений не применяют буквы Ё, З, Й, О, Ч, Ь, Ы, Ъ и латинские I, O' });
            }
          });
          p.blocks.forEach(function (b) {
            eachMatch(/приложени(?:и|е|ю|я|ем)\s+([А-ЯЁA-Z])(?![A-Za-zА-Яа-яЁё])/g, b.text, function (m) {
              if (/^\s*(к\s+)?(ГОСТ|ОСТ|СТО|ТУ|СП|СНиП|ТР|Технического|Федерального|документа|стандарта|[А-ЯЁ]{4}\.\d)/.test(b.text.slice(m.index + m[0].length, m.index + m[0].length + 20))) return; // приложение другого документа
              (ref[m[1]] = ref[m[1]] || []).push({ page: p.num, snip: snip(b.text, m.index, m[0].length) });
            });
          });
        });
        Object.keys(ref).forEach(function (k) { if (!cap[k]) out({ page: ref[k][0].page, snip: ref[k][0].snip, msg: 'Ссылка на приложение ' + k + ', но заголовок «Приложение ' + k + '» в документе не найден' }); });
        Object.keys(cap).forEach(function (k) { if (!ref[k]) out({ page: cap[k][0], sev: 'note', msg: 'На приложение ' + k + ' нет ссылки в тексте' }); });
      }
    },
    {
      id: 'spec-order', sev: 'warn', title: 'Порядок разделов спецификации', basis: 'ГОСТ Р 2.106-2019, п. 4.2.3',
      run: function (doc, out) {
        var found = [];
        doc.pages.forEach(function (p) { p.segs.forEach(function (s) {
          var t = s.text.replace(/["«»]/g, '').trim().toLowerCase();
          SPEC_SECTIONS.forEach(function (name, i) { if (t === name.toLowerCase() && !found.some(function (f) { return f.i === i; })) found.push({ i: i, name: name, page: p.num }); });
        }); });
        if (found.length < 2) return;
        for (var k = 1; k < found.length; k++) {
          if (found[k].i < found[k - 1].i) out({ page: found[k].page, snip: { pre: '', hit: found[k].name, post: '' }, msg: 'Раздел «' + found[k].name + '» расположен после раздела «' + found[k - 1].name + '»', fix: 'Порядок: ' + SPEC_SECTIONS.join(', ') });
        }
      }
    },
    {
      id: 'tt-numbering', sev: 'note', title: 'Нумерация технических требований на чертеже', basis: 'ГОСТ Р 2.316-2023, п. 6.6',
      run: function (doc, out) {
        if (TEXT_TYPES[doc.type]) return;
        doc.pages.forEach(function (p) {
          if (!p.lines.some(function (l) { return /Масштаб|Лит\./.test(l); })) return;
          var nums = {};
          p.segs.forEach(function (s) { var m = /^(\d{1,2})\.?\s+[А-ЯЁ*][а-яё]/.exec(s.text); if (m) nums[+m[1]] = 1; });
          var ks = Object.keys(nums).map(Number).sort(function (x, y) { return x - y; });
          if (ks.length < 2 || ks[0] !== 1) return;
          for (var i = 1; i < ks[ks.length - 1]; i++) if (!nums[i]) out({ page: p.num, msg: 'В технических требованиях пропущен пункт ' + i + ' (нумерация должна быть сквозной)' });
        });
      }
    }
  ];

  function detectType(doc) {
    if (!doc.pages.length) return '';
    var mt = analyze(doc);
    if (mt.spec || mt.notice || mt.graphic) return '';
    if (mt.tbDesig && /^(ПС|РЭ|ЭТ|ФО|ТУ)$/.test(mt.tbDesig.code)) return mt.tbDesig.code;
    if (mt.hasTB && mt.tbDesig && mt.tbDesig.code) return '';
    var m = new RegExp(DESIG + '\\s?(ПС|РЭ|ЭТ|ФО|ТУ)(?![' + L + '])').exec(doc.name);
    if (m) return m[1];
    var head = doc.pages.length ? doc.pages[0].segs.map(function (s) { return s.text; }).join('\n') : '';
    if (/(^|\n)\s*Паспорт\s*(\n|$)/i.test(head)) return 'ПС';
    if (/(^|\n)\s*Руководство по эксплуатации\s*(\n|$)/i.test(head) && !/Спецификац|Обозначение\s+Наименование/i.test(head)) return 'РЭ';
    if (/(^|\n)\s*Этикетка\s*(\n|$)/i.test(head) && !/Обозначение\s+Наименование/i.test(head)) return 'ЭТ';
    if (/(^|\n)\s*Формуляр\s*(\n|$)/i.test(head)) return 'ФО';
    if (/(^|\n)\s*Технические условия\s*(\n|$)/i.test(head) && !/Обозначение\s+Наименование/i.test(head)) return 'ТУ';
    return '';
  }

  function check(doc, disabled) {
    disabled = disabled || {};
    doc.stats = { chars: 0 };
    doc.pages.forEach(function (p) { p.segs.forEach(function (s) { doc.stats.chars += s.text.length; }); });
    if (doc.type === undefined || doc.type === 'auto') doc.type = detectType(doc);
    var findings = [];
    if (doc.stats.chars < 40) {
      findings.push({ rule: 'no-text', title: 'Текстовый слой', basis: '', sev: 'err', page: 0, msg: 'В файле нет текстового слоя (скан или текст в кривых). Проверка невозможна.' });
      return findings;
    }
    var notice = analyze(doc).notice;
    if (notice) doc.kindLabel = 'Извещение об изменении';
    var SKIP_NOTICE = { titleblock: 1, xref: 1, numbering: 1, sheets: 1, desig: 1, sections: 1, appendix: 1, pairs: 1, 'heading-dot': 1, 'tt-numbering': 1, 'spec-order': 1 };
    RULES.forEach(function (r) {
      if (disabled[r.id] || (notice && SKIP_NOTICE[r.id])) return;
      var seen = {};
      r.run(doc, function (f) {
        var key = f.page + '|' + f.msg + '|' + (f.snip ? f.snip.hit + f.snip.pre.slice(-12) : '');
        if (seen[key]) return; seen[key] = 1;
        f.rule = r.id; f.title = r.title; f.basis = f.basis || r.basis; f.sev = f.sev || r.sev;
        findings.push(f);
      });
    });
    var order = { err: 0, warn: 1, note: 2 };
    findings.sort(function (a, b) { return order[a.sev] - order[b.sev] || a.page - b.page; });
    return findings;
  }

  var api = { buildPage: buildPage, check: check, checkSet: checkSet, analyze: analyze, SET_RULES: SET_RULES, RULES: RULES, REPLACED: REPLACED, DOC_SECTIONS: DOC_SECTIONS, detectType: detectType, VERSION: '0.8' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PNK = api;
})(typeof window !== 'undefined' ? window : globalThis);
