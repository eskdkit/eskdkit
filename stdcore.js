/* Проверка актуальности ссылочных стандартов: поиск обозначений ГОСТ, ГОСТ Р, ПНСТ в тексте и сверка
   с каталогами Росстандарта (открытые данные) и дополнениями. Без сети. */
(function (root) {
  'use strict';

  // Обозначение: индекс, международная приставка, номер (с частями), год
  var IDX = '(ГОСТ\\s*Р|ГОСТ|ПНСТ)';
  var INTL = '(?:\\s*(ИСО\\/МЭК|ISO\\/IEC|ИСО|МЭК|ISO|IEC|EN|ЕН|ASTM|IEEE|ИСО\\/ТС|ISO\\/TS|МЭК\\/ТС|IEC\\/TS|МЭК\\/ТО|IEC\\/TR|ИСО\\/ТО|ISO\\/TR))?';
  var NUM = '\\s*(\\d+(?:\\.\\d+)*(?:[-–]\\d+(?:\\.\\d+)*)*)';
  var RE = new RegExp('(?<![А-ЯЁA-Zа-яёa-z])' + IDX + INTL + NUM + '(?![\\d]|\\.\\d)', 'g');

  var LAT = { 'ИСО': 'ISO', 'МЭК': 'IEC', 'ЕН': 'EN', 'ТС': 'TS', 'ТО': 'TR' };
  function intlNorm(s) { if (!s) return ''; return s.toUpperCase().replace(/ИСО|МЭК|ЕН|ТС|ТО/g, function (m) { return LAT[m]; }); }
  function idxNorm(s) { return /Р$/.test(s.replace(/\s+/g, '')) ? 'ГОСТ Р' : s.replace(/\s+/g, ''); }

  // «2.104-2006» -> номер 2.104, год 2006; «60204-1-2011» -> 60204-1, 2011; «15150-69» -> 15150, 1969
  function splitNum(s, intl) {
    var g = s.replace(/–/g, '-').split('-'), year = null;
    if (g.length > 1) {
      var last = g[g.length - 1];
      if (/^(19|20)\d\d$/.test(last)) year = +last;
      else if (/^\d\d$/.test(last) && !intl) year = 1900 + +last; // после 2000 года год пишут четырьмя цифрами
      else if (/^\d\d$/.test(last) && intl && g.length > 2) year = 1900 + +last;
      if (year) g.pop();
    }
    return { num: g.join('-'), year: year };
  }

  function parse(designation) {
    RE.lastIndex = 0;
    var m = RE.exec(String(designation).replace(/ /g, ' '));
    if (!m) return null;
    return make(m);
  }
  function make(m) {
    var idx = idxNorm(m[1]), intl = intlNorm(m[2]), sn = splitNum(m[3], intl);
    var base = idx + (intl ? ' ' + intl : '') + ' ' + sn.num;
    return { idx: idx, intl: intl, num: sn.num, year: sn.year, base: base, key: base + (sn.year ? '-' + sn.year : ''),
      family: (intl ? intl + ' ' : '') + sn.num }; // номер без индекса: ГОСТ 2.104 и ГОСТ Р 2.104 — одна «семья»
  }

  function extract(text) {
    var out = [], m; text = String(text || '').replace(/ /g, ' ');
    RE.lastIndex = 0;
    while ((m = RE.exec(text))) {
      var r = make(m); r.raw = m[0].replace(/\s+/g, ' ').trim(); r.at = m.index;
      out.push(r);
    }
    return out;
  }

  /* База: строки «обозначение\tстатус\tзаглавие» из перечней Росстандарта (только действующие и принятые
     стандарты; отменённых там нет). Статус: a — действует, n — принят, ещё не введён, c — отменён/заменён (из дополнений). */
  // Дополнения после даты выгрузки и уточнения: сверены по текстам стандартов
  var EXTRA = [
    { d: 'ГОСТ 8.417-2002', s: 'c', rep: 'ГОСТ 8.417-2024' },
    { d: 'ГОСТ 8.417-2024', s: 'a', t: 'Государственная система обеспечения единства измерений. Единицы величин' },
    { d: 'ГОСТ Р 2.111-2026', s: 'n', t: 'Единая система конструкторской документации. Нормоконтроль', note: 'вводится с 01.10.2027, досрочное применение разрешено' },
    { d: 'ГОСТ Р 2.301-2026', s: 'n', t: 'Единая система конструкторской документации. Форматы', note: 'вводится с 01.10.2027, досрочное применение разрешено' }
  ];

  function Db(rows, extra) {
    var byKey = {}, byFam = {};
    function add(d, s, t, o) {
      var p = parse(d); if (!p) return;
      o = o || {};
      var old = byKey[p.key];
      var e = { d: d.replace(/\s+/g, ' ').trim(), s: s, t: t || (old ? old.t : ''), rep: o.rep || null, note: o.note || '', src: o.src || 'rst', p: p };
      if (old && !o.src) return;
      byKey[p.key] = e;
      var fam = byFam[p.family] = byFam[p.family] || [];
      if (old) fam.splice(fam.indexOf(old), 1);
      fam.push(e);
    }
    rows.forEach(function (r) { var f = r.split('\t'); add(f[0], f[1], f[2]); });
    (extra || EXTRA).forEach(function (x) { add(x.d, x.s, x.t, { rep: x.rep, note: x.note, src: 'extra' }); });
    Object.keys(byFam).forEach(function (k) { byFam[k].sort(function (a, b) { return (b.p.year || 0) - (a.p.year || 0); }); });
    this.byKey = byKey; this.byFam = byFam; this.size = rows.length;
  }
  // действующая редакция по номеру: сначала тот же индекс (ГОСТ Р / ГОСТ), затем самый новый год
  Db.prototype.current = function (p) {
    var act = (this.byFam[p.family] || []).filter(function (e) { return e.s === 'a'; });
    if (!act.length) return null;
    var newest = Math.max.apply(null, act.map(function (e) { return e.p.year || 0; }));
    act = act.filter(function (e) { return (e.p.year || 0) === newest; });
    act.sort(function (a, b) { return (b.p.idx === p.idx) - (a.p.idx === p.idx); });
    return act[0];
  };
  Db.prototype.upcoming = function (p, after) {
    return (this.byFam[p.family] || []).filter(function (e) { return e.s === 'n' && (e.p.year || 0) >= (after || 0); })[0] || null;
  };
  /* Результат: status — active | future | replaced | cancelled | wrongyear | absent | undated | undated-none */
  Db.prototype.check = function (ref) {
    var e = this.byKey[ref.key], res = { ref: ref, entry: e || null, status: '', current: null, next: null, note: '' };
    if (!ref.year) {
      res.current = this.current(ref);
      res.next = this.upcoming(ref, res.current ? res.current.p.year + 1 : 0);
      res.status = res.current ? 'undated' : res.next ? 'undated-future' : 'absent';
      return res;
    }
    if (e && e.s === 'a') {
      res.status = 'active';
      var nw = (this.byFam[ref.family] || []).filter(function (x) { return (x.p.year || 0) > ref.year && x.s === 'a'; })[0];
      if (nw) { res.current = nw; res.note = 'есть более новая редакция'; }
      res.next = this.upcoming(ref, ref.year + 1);
      return res;
    }
    if (e && e.s === 'n') { res.status = 'future'; res.current = this.current(ref); return res; }
    if (e && e.s === 'c') {
      res.status = 'replaced';
      res.current = (e.rep && this.byKey[(parse(e.rep) || {}).key]) || this.current(ref);
      return res;
    }
    // нет в перечне действующих и принятых
    var cur = this.current(ref);
    if (cur && (cur.p.year || 0) > ref.year) { res.status = 'replaced'; res.current = cur; }
    else if (cur) { res.status = 'wrongyear'; res.current = cur; }
    else { var up = this.upcoming(ref, 0); if (up) { res.status = 'replaced'; res.next = up; } else res.status = 'absent'; }
    return res;
  };

  // распаковка базы, встроенной в страницу (base64 deflate-raw)
  async function loadPacked(b64) {
    var bin = atob(b64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    var ds = new DecompressionStream('deflate-raw');
    var txt = await new Response(new Blob([u]).stream().pipeThrough(ds)).text();
    return txt.split('\n');
  }

  // нормализация статуса из каталога Росстандарта
  function statusCode(s) {
    s = String(s || '').toLowerCase();
    if (/замен/.test(s)) return 'r';
    if (/отмен|утрат|не действ|прекращ/.test(s)) return 'c';
    if (/принят|не введ|вводится|будущ/.test(s)) return 'n';
    if (/действ/.test(s)) return 'a';
    return 'u';
  }

  var api = { RE: RE, parse: parse, extract: extract, Db: Db, EXTRA: EXTRA, loadPacked: loadPacked, statusCode: statusCode, VERSION: '0.1' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.STD = api;
})(typeof window !== 'undefined' ? window : globalThis);
