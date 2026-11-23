/* Сравнение двух BOM по позиционным обозначениям и по количеству одинаковых компонентов */
(function (root) {
  'use strict';
  function str(v) { return v == null ? '' : String(v).replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }
  var CYR2LAT = { 'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X', 'У': 'Y' };
  function nd(d) { return str(d).replace(/\s+/g, '').replace(/[АВЕКМНОРСТХУ]/g, function (c) { return CYR2LAT[c]; }).toUpperCase(); }
  function desCmp(a, b) {
    var ma = /^([A-Z]+)(\d+)(.*)$/.exec(a), mb = /^([A-Z]+)(\d+)(.*)$/.exec(b);
    if (ma && mb) return ma[1] < mb[1] ? -1 : ma[1] > mb[1] ? 1 : (+ma[2] - +mb[2]) || (ma[3] < mb[3] ? -1 : ma[3] > mb[3] ? 1 : 0);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  // Таблица → { headers, byDes: {R1: {cols: {Comment: '10k', ...}, key: '…'}}, warnings }
  function load(rows, info, PE) {
    var sel = info.sel, headers = info.headers, out = {}, warn = [], dup = 0, noDes = 0;
    var skip = {}; skip[sel.desig] = 1; if (sel.qty != null) skip[sel.qty] = 1;
    var cols = headers.map(function (h, i) { return { h: h, i: i }; }).filter(function (c) { return c.h && !skip[c.i]; });
    for (var r = info.headerRow + 1; r < rows.length; r++) {
      var row = rows[r] || [], dc = str(row[sel.desig]);
      if (!dc) { if (row.some(function (c) { return str(c); })) noDes++; continue; }
      var vals = {}; cols.forEach(function (c) { vals[c.h] = str(row[c.i]); });
      var key = sel.name != null ? [str(row[sel.name]), sel.name2 != null ? str(row[sel.name2]) : ''].filter(Boolean).join(' ') : cols.map(function (c) { return vals[c.h]; }).join(' ');
      PE.splitDes(dc).forEach(function (d) {
        var k = nd(d);
        if (out[k]) dup++;
        out[k] = { des: k, cols: vals, key: key, row: r + 1 };
      });
    }
    if (dup) warn.push('Повторяющихся позиционных обозначений: ' + dup + ' — учтено последнее вхождение.');
    if (noDes) warn.push('Строк без позиционного обозначения: ' + noDes + ' — не сравниваются.');
    return { headers: cols.map(function (c) { return c.h; }), byDes: out, warnings: warn };
  }

  function compare(A, B) {
    var common = A.headers.filter(function (h) { return B.headers.indexOf(h) >= 0; });
    var all = Object.keys(A.byDes).concat(Object.keys(B.byDes).filter(function (d) { return !A.byDes[d]; })).sort(desCmp);
    var added = [], removed = [], changed = [], same = 0;
    all.forEach(function (d) {
      var a = A.byDes[d], b = B.byDes[d];
      if (!a) { added.push({ des: d, key: b.key }); return; }
      if (!b) { removed.push({ des: d, key: a.key }); return; }
      var diffs = [];
      common.forEach(function (h) { if (a.cols[h] !== b.cols[h]) diffs.push({ col: h, from: a.cols[h], to: b.cols[h] }); });
      if (!common.length && a.key !== b.key) diffs.push({ col: 'Наименование', from: a.key, to: b.key });
      if (diffs.length) changed.push({ des: d, diffs: diffs, from: a.key, to: b.key }); else same++;
    });
    // количество одинаковых компонентов (по наименованию)
    var qa = {}, qb = {};
    Object.keys(A.byDes).forEach(function (d) { var k = A.byDes[d].key; (qa[k] = qa[k] || []).push(d); });
    Object.keys(B.byDes).forEach(function (d) { var k = B.byDes[d].key; (qb[k] = qb[k] || []).push(d); });
    var qty = [];
    Object.keys(qa).concat(Object.keys(qb).filter(function (k) { return !qa[k]; })).forEach(function (k) {
      var na = (qa[k] || []).length, nb = (qb[k] || []).length;
      if (na !== nb) qty.push({ key: k, from: na, to: nb });
    });
    qty.sort(function (x, y) { return Math.abs(y.to - y.from) - Math.abs(x.to - x.from) || (x.key < y.key ? -1 : 1); });
    var onlyA = A.headers.filter(function (h) { return B.headers.indexOf(h) < 0; }), onlyB = B.headers.filter(function (h) { return A.headers.indexOf(h) < 0; });
    return { added: added, removed: removed, changed: changed, same: same, qty: qty, common: common, onlyA: onlyA, onlyB: onlyB };
  }

  function sheets(res) {
    var pos = [['Поз. обозначение', 'Изменение', 'Было', 'Стало', 'Что изменилось']];
    res.removed.forEach(function (r) { pos.push([r.des, 'удалён', r.key, '', '']); });
    res.added.forEach(function (r) { pos.push([r.des, 'добавлен', '', r.key, '']); });
    res.changed.forEach(function (r) { pos.push([r.des, 'изменён', r.from, r.to, r.diffs.map(function (d) { return d.col + ': ' + (d.from || '—') + ' → ' + (d.to || '—'); }).join('; ')]); });
    pos = [pos[0]].concat(pos.slice(1).sort(function (a, b) { return desCmp(a[0], b[0]); }));
    var q = [['Компонент', 'Было, шт.', 'Стало, шт.', 'Разница']];
    res.qty.forEach(function (r) { q.push([r.key, r.from, r.to, r.to - r.from]); });
    return { positions: pos, quantity: q };
  }

  var api = { load: load, compare: compare, sheets: sheets, desCmp: desCmp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BOMCMP = api;
})(typeof window !== 'undefined' ? window : globalThis);
