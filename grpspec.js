/* Групповая спецификация (ГОСТ 2.113, спецификация с графами «Кол. на исполнение»): разбор PDF по координатам текста.
   Вход: страницы pdf.js (items с transform и width). Выход: исполнения и строки с количеством по каждому исполнению. */
(function (root) {
  'use strict';
  var MM = 25.4 / 72;
  var DESIG = /^[А-ЯЁA-Z]{2,4}\.\d{6}\.\d{3}(?:-\d{2,3}(?:\.\d{2})?)?$/;
  var CONT = /^-\d{2,3}(?:\.\d{2})?$/;
  var SECTIONS = ['Документация', 'Комплексы', 'Сборочные единицы', 'Детали', 'Стандартные изделия', 'Прочие изделия', 'Материалы', 'Комплекты'];
  function str(v) { return v == null ? '' : String(v).replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }
  function low(v) { return str(v).toLowerCase().replace(/ё/g, 'е'); }

  function mul(a, b) { return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]; }
  // vt — viewport.transform страницы (масштаб 1), H — высота вьюпорта в пт: учитывает поворот страницы
  function tokens(items, vt, H) {
    var out = [];
    items.forEach(function (it) {
      var s = str(it.str); if (!s) return;
      var t = it.transform, x, y, rot;
      if (vt) { var m = mul(vt, t); rot = Math.abs(m[1]) > 0.2 * Math.abs(m[0]); x = m[4] * MM; y = (H - m[5]) * MM; }
      else { rot = Math.abs(t[1]) > 0.2 * Math.abs(t[0]); x = t[4] * MM; y = t[5] * MM; }
      var w = (it.width || 0) * MM;
      var parts = s.split(' ');
      if (parts.length === 1 || rot) { out.push({ s: s, x: x, y: y, w: w, rot: rot }); return; }
      var cw = w / s.length, pos = 0;
      parts.forEach(function (p) { if (p) out.push({ s: p, x: x + pos * cw, y: y, w: p.length * cw, rot: false }); pos += p.length + 1; });
    });
    return out;
  }
  function find(tk, re) { return tk.filter(function (t) { return re.test(t.s); }); }
  function joinWords(ws) {
    var s = '', last = null;
    ws.forEach(function (w) {
      if (!s) { s = w.s; last = w; return; }
      var tight = last && last.x != null && w.x != null && w.x - (last.x + last.w) < 0.5;
      if (tight || (/[-–]$/.test(s) && !/^[-–]/.test(w.s))) s += w.s; else s += ' ' + w.s;
      last = w;
    });
    return s;
  }

  // геометрия страницы: заголовок «Кол. на исполнение», метки исполнений, границы граф
  function layout(tk) {
    var kol = find(tk, /^Кол\.?$/).filter(function (t) { return !t.rot; });
    var isp = find(tk, /^исполнен/i).filter(function (t) { return !t.rot; });
    isp = isp.filter(function (t) { return kol.some(function (k) { return Math.abs(k.y - t.y) < 1.5 && k.x < t.x; }); });
    if (!kol.length || !isp.length) return null;
    var hy = isp[0].y;
    var note = find(tk, /^Примечани/).filter(function (t) { return !t.rot; })[0];
    var nameH = find(tk, /^Наименовани/).filter(function (t) { return !t.rot && Math.abs(t.y - hy) < 12; })[0];
    var desH = find(tk, /^Обозначени/).filter(function (t) { return !t.rot && Math.abs(t.y - hy) < 12; })[0];
    if (!nameH || !desH) return null;
    var xL = nameH.x + nameH.w, xR = note ? note.x : 1e9;
    var labels = tk.filter(function (t) { return !t.rot && t.y < hy - 1.5 && t.y > hy - 14 && t.x > xL && t.x < xR && /^(?:[-–—]|-?\d{2,3})$/.test(t.s); });
    // берём одну строку меток (самую заполненную по y)
    var byY = {};
    labels.forEach(function (t) { var k = Math.round(t.y); (byY[k] = byY[k] || []).push(t); });
    var best = Object.keys(byY).sort(function (a, b) { return byY[b].length - byY[a].length; })[0];
    if (!best) return null;
    labels = byY[best].sort(function (a, b) { return a.x - b.x; });
    if (labels.length < 1) return null;
    var cx = labels.map(function (t) { return t.x + t.w / 2; });
    var gaps = []; for (var i = 1; i < cx.length; i++) gaps.push(cx[i] - cx[i - 1]);
    gaps.sort(function (a, b) { return a - b; });
    var step = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 10;
    var headBase = tk.filter(function (t) { return !t.rot && Math.abs(t.y - hy) < 1.5 && t.x > isp[0].x && DESIG.test(t.s); })[0];
    var desC = desH.x + desH.w / 2, nameC = nameH.x + nameH.w / 2;
    return {
      headY: labels[0].y, hy: hy, labels: labels.map(function (t) { var s = t.s.replace(/^[–—]$/, '-'); return s === '-' ? '-' : s.replace(/^-/, ''); }), cx: cx, step: step,
      qL: cx[0] - step * 0.6, qR: cx[cx.length - 1] + step * 0.6,
      desStart: desC - 36, nameStart: desC + (nameC - desC) * 70 / 133,
      noteX: cx[cx.length - 1] + step * 0.6,
      base: headBase ? headBase.s : ''
    };
  }

  function parse(pages, opt) {
    opt = opt || {};
    var L0 = null, rows = [], warns = [], section = '', lastFull = '', open = null, base = '';
    pages.forEach(function (pg, pi) {
      var tk = tokens(pg.items || pg, pg.vt, pg.H);
      var L = layout(tk);
      if (!L) return;
      if (!L0) L0 = L;
      else if (L.labels.join('|') !== L0.labels.join('|')) warns.push({ sev: 'warn', msg: 'На листе ' + (pi + 1) + ' другой набор исполнений (' + L.labels.join(', ') + '). Использован набор первого листа.' });
      if (L.base && !base) base = L.base;
      var bottom = pi === 0 ? 45 : 20;
      var data = tk.filter(function (t) { return !t.rot && t.y < L.headY - 2.5 && t.y > bottom; });
      // строки по y
      data.sort(function (a, b) { return b.y - a.y || a.x - b.x; });
      var lines = [];
      data.forEach(function (t) { var l = lines[lines.length - 1]; if (l && Math.abs(l.y - t.y) < 1.3) l.t.push(t); else lines.push({ y: t.y, t: [t] }); });
      var lastY = null;
      lines.forEach(function (ln) {
        var pos = [], fmt = [], des = [], name = [], qty = L.labels.map(function () { return ''; }), note = [], anyQty = false;
        ln.t.sort(function (a, b) { return a.x - b.x; });
        ln.t.forEach(function (t) {
          var c = t.x + t.w / 2;
          if (t.x >= L.noteX) { note.push(t); return; }
          if (c >= L.qL && c <= L.qR && t.x > L.nameStart + 20) {
            var k = 0, d = 1e9; L.cx.forEach(function (x, i) { var dd = Math.abs(x - c); if (dd < d) { d = dd; k = i; } });
            qty[k] += t.s; anyQty = true; return;
          }
          if (t.x < L.desStart) { if (/^(\d+|[-–])$/.test(t.s)) pos.push(t); else fmt.push(t); return; }
          if (t.x < L.nameStart) des.push(t); else name.push(t);
        });
        var desS = joinWords(des).replace(/\s+-\s*/g, '-').replace(/-\s+/g, '-');
        var nameS = joinWords(name), noteS = joinWords(note);
        var gap = lastY == null ? 1e9 : lastY - ln.y;
        var secTitle = !anyQty && !des.length && !pos.length && !fmt.length && SECTIONS.filter(function (s) { return low(s) === low(nameS); })[0];
        if (secTitle) { section = secTitle; open = null; lastY = ln.y; return; }
        var full = '', dm = desS.split(' ')[0];
        if (DESIG.test(dm)) { full = dm; lastFull = dm; }
        else if (CONT.test(dm) && lastFull) full = lastFull.replace(/-\d{2,3}(?:\.\d{2})?$/, '') + dm;
        var rest = DESIG.test(dm) || CONT.test(dm) ? desS.slice(dm.length).trim() : desS;
        if (/^[-–—]$/.test(rest)) rest = '';
        var label = full ? '' : rest;
        var hasStart = !!full || pos.length > 0 || fmt.length > 0;
        function addName(r, t) { if (t) r.name = r.name ? joinWords([{ s: r.name }, { s: t }]) : t; }
        function newRow() {
          var r = { section: section, pos: pos.length ? pos[0].s : '', desig: full + (rest && full ? ' ' + rest : ''), base: full, name: '', qty: qty, note: noteS, page: pi + 1, awaitQty: !anyQty, late: false };
          addName(r, [label, nameS].filter(Boolean).join(' '));
          rows.push(r); open = r; return r;
        }
        if (hasStart) { newRow(); lastY = ln.y; return; }
        if (anyQty) {
          if (open && open.awaitQty && gap < 9) {
            addName(open, [label, nameS].filter(Boolean).join(' ')); open.qty = qty; open.awaitQty = false; open.late = true;
            if (noteS) open.note = str(open.note + ' ' + noteS);
          } else newRow();
          lastY = ln.y; return;
        }
        if (!nameS && !noteS && !label) return;
        if (open && gap < 9 && (open.awaitQty || !open.late)) {
          addName(open, [label, nameS].filter(Boolean).join(' '));
          if (noteS) open.note = str(open.note + ' ' + noteS);
        } else if (gap < 9 || open === null) {
          // начало многострочной записи без позиции (количество — на последней строке)
          if (nameS || label) newRow(); else if (open) open.note = str(open.note + ' ' + noteS);
        }
        lastY = ln.y;
      });
    });
    if (!L0) return null;
    rows = rows.filter(function (r) { return !(r.awaitQty && !r.base && !r.pos); });
    rows.forEach(function (r) { if (r.awaitQty && r.section !== 'Документация') warns.push({ sev: 'warn', msg: 'Строка «' + (r.desig || r.name) + '» (лист ' + r.page + '): не найдено количество.' }); delete r.awaitQty; delete r.late; });
    base = base || opt.base || '';
    var execs = L0.labels.map(function (l) { return l === '-' ? '' : '-' + l; });
    return { base: base, labels: L0.labels, execs: execs, rows: rows, warnings: warns };
  }

  // в обычные «виртуальные» спецификации — по одной на исполнение
  function toSpecs(g, file, name) {
    return g.execs.map(function (e, i) {
      var items = [];
      g.rows.forEach(function (r) {
        var q = str(r.qty[i]).replace(/^[–—]$/, '-');
        if (!q || q === '-' || /^[хxХX]$/.test(q)) return;
        items.push({ section: r.section, base: r.base, name: r.name, qty: q, note: r.note, multi: false });
      });
      return { file: file, base: g.base + e, name: name || '', items: items, group: false, execOf: g.base, execLabel: g.labels[i], kind: 'pdf', ok: true };
    });
  }

  var api = { parse: parse, toSpecs: toSpecs, tokens: tokens, layout: layout, VERSION: '0.1' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GRP = api;
})(typeof window !== 'undefined' ? window : globalThis);
