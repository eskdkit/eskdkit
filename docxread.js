/* Чтение DOCX в браузере без сети и без библиотек: ZIP (DecompressionStream), разбор XML, нумерация списков,
   таблицы, колонтитулы. Результат раскладывается на листы как элементы текста pdf.js (с координатами),
   чтобы к Word-документу применялись те же правила, что и к PDF. */
(function (root) {
  'use strict';

  /* ---------- ZIP ---------- */
  async function inflateRaw(data) {
    var ds = new DecompressionStream('deflate-raw');
    var out = new Response(new Blob([data]).stream().pipeThrough(ds));
    return new Uint8Array(await out.arrayBuffer());
  }
  async function unzip(bytes, want) {
    var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), n = bytes.length, eocd = -1;
    for (var i = n - 22; i >= Math.max(0, n - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Файл не похож на документ Word (.docx)');
    var cnt = dv.getUint16(eocd + 10, true), off = dv.getUint32(eocd + 16, true), files = {}, dec = new TextDecoder('utf-8');
    for (var k = 0; k < cnt; k++) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      var method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true), nlen = dv.getUint16(off + 28, true),
        elen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true), lho = dv.getUint32(off + 42, true);
      var name = dec.decode(bytes.subarray(off + 46, off + 46 + nlen));
      off += 46 + nlen + elen + clen;
      if (want && !want(name)) continue;
      var ln = dv.getUint16(lho + 26, true), le = dv.getUint16(lho + 28, true), start = lho + 30 + ln + le;
      var raw = bytes.subarray(start, start + csize);
      files[name] = method === 0 ? raw : method === 8 ? await inflateRaw(raw) : null;
    }
    return files;
  }

  /* ---------- XML (минимальный разбор, без DOMParser — работает и в Node) ---------- */
  var ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  function unesc(s) { return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, function (m, e) { if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)); return ENT[e] != null ? ENT[e] : m; }); }
  function parseXml(s) {
    var rootEl = { n: '#root', a: {}, c: [] }, st = [rootEl], re = /<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|([^<]+)/g, m;
    while ((m = re.exec(s))) {
      var top = st[st.length - 1];
      if (m[6] != null) { top.c.push(unesc(m[6])); continue; }
      if (m[5] != null) { top.c.push(m[5]); continue; }
      if (!m[2]) continue;
      if (m[1]) { if (st.length > 1) st.pop(); continue; }
      var el = { n: m[2], a: {}, c: [] }, ar = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, am;
      while ((am = ar.exec(m[3]))) el.a[am[1]] = unesc(am[2] != null ? am[2] : am[3]);
      top.c.push(el);
      if (!m[4]) st.push(el);
    }
    return rootEl;
  }
  function kids(el, name) { return el ? el.c.filter(function (x) { return typeof x !== 'string' && (!name || x.n === name); }) : []; }
  function kid(el, name) { if (!el) return null; for (var i = 0; i < el.c.length; i++) { var x = el.c[i]; if (typeof x !== 'string' && x.n === name) return x; } return null; }
  function find(el, name, out) { out = out || []; if (!el) return out; el.c.forEach(function (x) { if (typeof x === 'string') return; if (x.n === name) out.push(x); find(x, name, out); }); return out; }
  function attr(el, name) { return el ? el.a['w:' + name] : undefined; }
  function onOff(el) { if (!el) return false; var v = attr(el, 'val'); return v == null || !/^(0|false|off)$/i.test(v); }

  /* ---------- Стили и нумерация ---------- */
  function readStyles(xml) {
    var st = { byId: {}, defSz: 24 };
    if (!xml) return st;
    var r = parseXml(xml), styles = kid(r, 'w:styles');
    var dd = kid(styles, 'w:docDefaults'), rpr = dd && kid(kid(dd, 'w:rPrDefault'), 'w:rPr'), sz = rpr && kid(rpr, 'w:sz');
    if (sz) st.defSz = +attr(sz, 'val') || 24;
    var ppd = dd && kid(kid(dd, 'w:pPrDefault'), 'w:pPr'), spd = ppd && kid(ppd, 'w:spacing');
    st.defLine = spd && attr(spd, 'line') && (attr(spd, 'lineRule') || 'auto') === 'auto' ? +attr(spd, 'line') / 240 : 1.15;
    kids(styles, 'w:style').forEach(function (s) {
      var id = attr(s, 'styleId'), ppr = kid(s, 'w:pPr'), rp = kid(s, 'w:rPr'), np = ppr && kid(ppr, 'w:numPr');
      var nm = kid(s, 'w:name'), based = kid(s, 'w:basedOn'), ol = ppr && kid(ppr, 'w:outlineLvl');
      st.byId[id] = { type: s.a['w:type'], name: nm ? attr(nm, 'val') : id, based: based ? attr(based, 'val') : null,
        sz: rp && kid(rp, 'w:sz') ? +attr(kid(rp, 'w:sz'), 'val') : null,
        numId: np && kid(np, 'w:numId') ? attr(kid(np, 'w:numId'), 'val') : null, ilvl: np && kid(np, 'w:ilvl') ? +attr(kid(np, 'w:ilvl'), 'val') : null,
        line: ppr && kid(ppr, 'w:spacing') && attr(kid(ppr, 'w:spacing'), 'line') && (attr(kid(ppr, 'w:spacing'), 'lineRule') || 'auto') === 'auto' ? +attr(kid(ppr, 'w:spacing'), 'line') / 240 : null,
        outline: ol ? +attr(ol, 'val') : null, pageBreakBefore: ppr ? onOff(kid(ppr, 'w:pageBreakBefore')) : false };
    });
    st.get = function (id, key) { var s = st.byId[id], d = 0; while (s && d++ < 12) { if (s[key] != null && s[key] !== false) return s[key]; s = st.byId[s.based]; } return null; };
    return st;
  }
  function readNumbering(xml) {
    var nb = { abs: {}, num: {} };
    if (!xml) return nb;
    var r = kid(parseXml(xml), 'w:numbering');
    kids(r, 'w:abstractNum').forEach(function (a) {
      var lv = {};
      kids(a, 'w:lvl').forEach(function (l) {
        var g = function (n) { var e = kid(l, n); return e ? attr(e, 'val') : null; };
        lv[+attr(l, 'ilvl')] = { start: +(g('w:start') || 1), fmt: g('w:numFmt') || 'decimal', text: g('w:lvlText') || '' };
      });
      nb.abs[attr(a, 'abstractNumId')] = lv;
    });
    kids(r, 'w:num').forEach(function (n) {
      var an = kid(n, 'w:abstractNumId'), ov = {};
      kids(n, 'w:lvlOverride').forEach(function (o) { var so = kid(o, 'w:startOverride'); if (so) ov[+attr(o, 'ilvl')] = +attr(so, 'val'); });
      nb.num[attr(n, 'numId')] = { abs: an ? attr(an, 'val') : null, ov: ov };
    });
    return nb;
  }
  var RU = 'абвгдежиклмнпрстуфхцшщэюя'; // ГОСТ Р 2.105: строчные русские буквы без ё, з, й, о, ч, ъ, ы, ь
  function fmtNum(n, fmt) {
    switch (fmt) {
      case 'decimal': case 'decimalZero': return fmt === 'decimalZero' && n < 10 ? '0' + n : String(n);
      case 'lowerLetter': return String.fromCharCode(96 + ((n - 1) % 26) + 1);
      case 'upperLetter': return String.fromCharCode(64 + ((n - 1) % 26) + 1);
      case 'russianLower': return RU[(n - 1) % RU.length];
      case 'russianUpper': return RU[(n - 1) % RU.length].toUpperCase();
      case 'lowerRoman': case 'upperRoman': {
        var v = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']], o = '';
        v.forEach(function (p) { while (n >= p[0]) { o += p[1]; n -= p[0]; } });
        return fmt === 'upperRoman' ? o.toUpperCase() : o;
      }
      case 'none': return '';
      default: return String(n);
    }
  }
  function numberer(nb) {
    var counters = {};
    return function (numId, ilvl) {
      var num = nb.num[numId]; if (!num || numId === '0') return '';
      var lv = nb.abs[num.abs]; if (!lv || !lv[ilvl]) return '';
      var key = num.abs, c = counters[key] || (counters[key] = {});
      if (!c['_' + numId] && num.ov[ilvl] != null) { c[ilvl] = num.ov[ilvl] - 1; }
      c['_' + numId] = 1;
      c[ilvl] = (c[ilvl] != null ? c[ilvl] : lv[ilvl].start - 1) + 1;
      for (var d = ilvl + 1; d < 9; d++) delete c[d];
      var L = lv[ilvl];
      if (L.fmt === 'bullet') return /[–—-]/.test(L.text) ? '–' : '•';
      return L.text.replace(/%(\d)/g, function (m, k) { var j = +k - 1, l = lv[j]; var val = c[j] != null ? c[j] : (l ? l.start : 1); return fmtNum(val, (l || L).fmt); });
    };
  }

  /* ---------- Содержимое ---------- */
  // Абзац -> { runs текста с разрывами }. Разрывы: 'page' (явный или последняя отрисовка Word), 'line'.
  function paraContent(p, st, ctx) {
    var parts = [{ t: '', sz: 0 }], sizes = [], brk = [];
    var ppr = kid(p, 'w:pPr'), pst = ppr && kid(ppr, 'w:pStyle'), style = pst ? attr(pst, 'val') : null;
    function cur() { return parts[parts.length - 1]; }
    function walk(el, inFld) {
      el.c.forEach(function (x) {
        if (typeof x === 'string') return;
        switch (x.n) {
          case 'w:r': {
            var rp = kid(x, 'w:rPr'), sz = rp && kid(rp, 'w:sz') ? +attr(kid(rp, 'w:sz'), 'val') : 0;
            var vanish = rp && onOff(kid(rp, 'w:vanish'));
            x.c.forEach(function (y) {
              if (typeof y === 'string') return;
              if (y.n === 'w:fldChar') { var t = attr(y, 'fldCharType'); if (t === 'begin') ctx.fld++; else if (t === 'separate') ctx.fldRes++; else if (t === 'end') { ctx.fld = Math.max(0, ctx.fld - 1); ctx.fldRes = Math.max(0, ctx.fldRes - 1); } return; }
              if (ctx.fld > ctx.fldRes) return; // код поля, не результат
              if (vanish) return;
              if (y.n === 'w:t') { var s = y.c.join(''); cur().t += s; if (s.trim()) sizes.push(sz); }
              else if (y.n === 'w:tab' || y.n === 'w:ptab') cur().t += ' ';
              else if (y.n === 'w:noBreakHyphen') cur().t += '-';
              else if (y.n === 'w:softHyphen') { /* мягкий перенос не печатается */ }
              else if (y.n === 'w:sym') { var ch = attr(y, 'char'); if (ch) { var cp = parseInt(ch, 16); cur().t += cp >= 0xF000 ? String.fromCharCode(cp - 0xF000) : String.fromCharCode(cp); } }
              else if (y.n === 'w:br' || y.n === 'w:cr') { var bt = attr(y, 'type'); parts.push({ t: '', brk: bt === 'page' ? 'page' : bt === 'column' ? 'line' : 'line' }); }
              else if (y.n === 'w:lastRenderedPageBreak') { ctx.hasLRPB = true; parts.push({ t: '', brk: 'lrpb' }); }
            });
            break;
          }
          case 'w:del': case 'w:moveFrom': case 'w:pPr': case 'w:rPr': break;
          default: walk(x, inFld);
        }
      });
    }
    walk(p, false);
    var szs = sizes.filter(Boolean);
    var fs = (szs.length ? szs.sort(function (a, b) { return a - b; })[Math.floor(szs.length / 2)] : (style && st.get(style, 'sz')) || st.defSz) / 2;
    // нумерация
    var np = ppr && kid(ppr, 'w:numPr'), numId = null, ilvl = 0;
    if (np) { var ni = kid(np, 'w:numId'), il = kid(np, 'w:ilvl'); numId = ni ? attr(ni, 'val') : null; ilvl = il ? +attr(il, 'val') : 0; }
    if (numId == null && style) { numId = st.get(style, 'numId'); var sl = st.get(style, 'ilvl'); ilvl = sl != null ? sl : 0; }
    var label = numId != null && numId !== '0' ? ctx.num(numId, ilvl) : '';
    var pbb = (ppr && onOff(kid(ppr, 'w:pageBreakBefore'))) || (style && st.get(style, 'pageBreakBefore'));
    var outline = style ? st.get(style, 'outline') : null, sname = style && st.byId[style] ? st.byId[style].name : '';
    var heading = outline != null || /^(heading|заголовок)\s*\d/i.test(sname || '');
    var spc = ppr && kid(ppr, 'w:spacing'), line = spc && attr(spc, 'line') && (attr(spc, 'lineRule') || 'auto') === 'auto' ? +attr(spc, 'line') / 240 : (style && st.get(style, 'line')) || st.defLine || 1.15;
    return { parts: parts, fs: fs || 12, line: line, label: label, pbb: !!pbb, heading: heading, style: sname };
  }

  function readBlocks(container, st, ctx) {
    var out = [];
    container.c.forEach(function (el) {
      if (typeof el === 'string') return;
      if (el.n === 'w:p') {
        var pc = paraContent(el, st, ctx);
        var sp = kid(el, 'w:pPr'), sect = sp && kid(sp, 'w:sectPr');
        out.push({ type: 'p', p: pc, sectBreak: !!sect });
      } else if (el.n === 'w:tbl') {
        out.push(readTable(el, st, ctx));
      } else if (el.n === 'w:sdt') {
        var sc = kid(el, 'w:sdtContent'); if (sc) out = out.concat(readBlocks(sc, st, ctx));
      } else if (el.n === 'w:customXml' || el.n === 'w:ins' || el.n === 'w:moveTo') {
        out = out.concat(readBlocks(el, st, ctx));
      }
    });
    return out;
  }
  function readTable(el, st, ctx) {
    var tp = kid(el, 'w:tblPr'), grid = kids(kid(el, 'w:tblGrid'), 'w:gridCol').map(function (g) { return (+attr(g, 'w') || 0) / 20; });
    var ind = tp && kid(tp, 'w:tblInd') ? (+attr(kid(tp, 'w:tblInd'), 'w') || 0) / 20 : 0;
    var fl = tp && kid(tp, 'w:tblpPr');
    var rows = kids(el, 'w:tr').map(function (tr) {
      var trp = kid(tr, 'w:trPr'), th = trp && kid(trp, 'w:trHeight');
      var cells = [], col = 0;
      var gb = trp && kid(trp, 'w:gridBefore'); if (gb) col += +attr(gb, 'val') || 0;
      kids(tr, 'w:tc').forEach(function (tc) {
        var tcp = kid(tc, 'w:tcPr'), gs = tcp && kid(tcp, 'w:gridSpan'), vm = tcp && kid(tcp, 'w:vMerge'), td = tcp && kid(tcp, 'w:textDirection');
        var span = gs ? +attr(gs, 'val') || 1 : 1;
        var blocks = readBlocks(tc, st, ctx);
        cells.push({ col: col, span: span, cont: !!vm && attr(vm, 'val') !== 'restart', rot: td ? /btLr|tbRl|tbLrV|tbRlV/.test(attr(td, 'val')) : false, blocks: blocks });
        col += span;
      });
      return { h: th ? (+attr(th, 'val') || 0) / 20 : 0, exact: th ? attr(th, 'hRule') === 'exact' : false, cells: cells };
    });
    return { type: 'tbl', grid: grid, ind: ind, floating: !!fl, rows: rows };
  }

  async function read(bytes) {
    var files = await unzip(bytes, function (n) { return /^word\/(document|styles|numbering|header\d*|footer\d*)\.xml$|^word\/_rels\/document\.xml\.rels$/.test(n); });
    var dec = new TextDecoder('utf-8'), txt = function (n) { return files[n] ? dec.decode(files[n]) : ''; };
    if (!files['word/document.xml']) throw new Error('В файле нет word/document.xml — это не документ Word (.docx)');
    var st = readStyles(txt('word/styles.xml')), nb = readNumbering(txt('word/numbering.xml'));
    var ctx = { num: numberer(nb), fld: 0, fldRes: 0, hasLRPB: false };
    var doc = parseXml(txt('word/document.xml')), body = kid(kid(doc, 'w:document'), 'w:body');
    var blocks = readBlocks(body, st, ctx);
    // параметры раздела (последний sectPr) и колонтитулы
    var sect = kid(body, 'w:sectPr'), rels = {};
    var rx = parseXml(txt('word/_rels/document.xml.rels'));
    find(rx, 'Relationship').forEach(function (r) { rels[r.a.Id] = 'word/' + r.a.Target.replace(/^\/?word\//, ''); });
    var pgSz = sect && kid(sect, 'w:pgSz'), pgMar = sect && kid(sect, 'w:pgMar');
    var num = function (el, n, d) { var v = el ? +attr(el, n) : NaN; return isFinite(v) ? v / 20 : d; };
    var page = { W: num(pgSz, 'w', 595.3), H: num(pgSz, 'h', 841.9), top: num(pgMar, 'top', 56.7), bottom: num(pgMar, 'bottom', 56.7), left: num(pgMar, 'left', 85), right: num(pgMar, 'right', 42.5), footer: num(pgMar, 'footer', 35.4), header: num(pgMar, 'header', 35.4) };
    var titlePg = sect ? onOff(kid(sect, 'w:titlePg')) : false, foot = {};
    function part(kind) {
      var o = {};
      if (sect) kids(sect, 'w:' + kind + 'Reference').forEach(function (r) {
        var f = rels[r.a['r:id']]; if (!f || !files[f]) return;
        var x = parseXml(txt(f)), c = kid(x, kind === 'footer' ? 'w:ftr' : 'w:hdr');
        var cx = { num: function () { return ''; }, fld: 0, fldRes: 0 };
        o[attr(r, 'type') || 'default'] = c ? readBlocks(c, st, cx) : [];
      });
      return o;
    }
    foot = part('footer');
    return { blocks: blocks, page: page, titlePg: titlePg, footers: foot, headers: part('header'), hasLRPB: ctx.hasLRPB };
  }

  /* ---------- Раскладка на листы (элементы как у pdf.js: str, transform, width) ---------- */
  var CW = 0.5; // средняя ширина знака в долях кегля
  function wrapText(t, width, fs) {
    var cap = Math.max(8, Math.floor(width / (CW * fs))), out = [];
    t.split('\n').forEach(function (line) {
      line = line.replace(/\s+/g, ' ').trim();
      while (line.length > cap) {
        var k = line.lastIndexOf(' ', cap); if (k < cap * 0.5) k = cap;
        out.push(line.slice(0, k)); line = line.slice(k).trim();
      }
      out.push(line);
    });
    return out;
  }
  function paraText(pc) {
    // части абзаца: отрезки между разрывами; возвращаем [{text, brk}]
    var segs = [], acc = '';
    pc.parts.forEach(function (x, i) {
      if (x.brk) { segs.push({ t: acc, brk: x.brk }); acc = ''; }
      acc += x.t;
    });
    segs.push({ t: acc });
    if (pc.label && segs.length) segs[0].t = pc.label + (/[.)]$/.test(pc.label) || /^[–•]$/.test(pc.label) ? ' ' : ' ') + segs[0].t.replace(/^\s+/, '');
    return segs;
  }
  function item(s, x, y, fs) { return { str: s, transform: [fs, 0, 0, fs, x, y], width: s.length * CW * fs }; }

  function cellText(blocks) {
    var o = [];
    blocks.forEach(function (b) {
      if (b.type === 'p') o.push({ t: paraText(b.p).map(function (s) { return s.t; }).join(' ').replace(/\s+/g, ' ').trim(), fs: b.p.fs });
      else b.rows.forEach(function (r) { r.cells.forEach(function (c) { o = o.concat(cellText(c.blocks)); }); });
    });
    return o.filter(function (x) { return x.t; });
  }

  // таблица колонтитула — по сетке и высотам строк, прижата к низу листа
  function footerItems(blocks, P) {
    var items = [];
    var tables = blocks.filter(function (b) { return b.type === 'tbl' && !b.floating; });
    tables.forEach(function (tb) {
      var H = tb.rows.reduce(function (a, r) { return a + (r.h || 14); }, 0), yTop = P.footer + H, x0 = P.left + tb.ind;
      var xs = [x0]; tb.grid.forEach(function (w) { xs.push(xs[xs.length - 1] + w); });
      tb.rows.forEach(function (r) {
        var h = r.h || 14;
        r.cells.forEach(function (c) {
          if (c.cont || c.rot) return;
          var lines = cellText(c.blocks); if (!lines.length) return;
          var cx0 = xs[Math.min(c.col, xs.length - 1)], lh = lines.reduce(function (a, l) { return a + l.fs * 1.15; }, 0);
          var y = yTop - (h - lh) / 2;
          lines.forEach(function (l) { y -= l.fs * 1.15; items.push(item(l.t, cx0 + 1.5, y + 0.2 * l.fs, l.fs)); });
        });
        yTop -= h;
      });
    });
    return items;
  }

  function layout(d) {
    var P = d.page, pages = [], cur = [], y = P.H - P.top, bodyW = P.W - P.left - P.right;
    var useLR = d.hasLRPB;
    function fh(bl) { return (bl || []).filter(function (b) { return b.type === 'tbl' && !b.floating; }).reduce(function (a, t) { return a + t.rows.reduce(function (q, r) { return q + (r.h || 14); }, 0); }, 0); }
    var fFirst = (d.titlePg && d.footers.first) || d.footers['default'], fOther = d.footers['default'];
    var bottoms = [Math.max(P.bottom, P.footer + fh(fFirst) + 4), Math.max(P.bottom, P.footer + fh(fOther) + 4)];
    var bottom = bottoms[0];
    function newPage() { pages.push(cur); cur = []; y = P.H - P.top; bottom = bottoms[1]; }
    function room(h) { if (!useLR && y - h < bottom && cur.length) newPage(); }
    function emitLines(lines, x, fs, k) {
      lines.forEach(function (l) { var lh = fs * 1.15 * (k || 1.15); room(lh); y -= lh; if (l) cur.push(item(l, x, y, fs)); });
    }
    function brk(kind) { if (kind === 'page' || (kind === 'lrpb' && useLR)) { if (cur.length) newPage(); } }
    d.blocks.forEach(function (b) {
      if (b.type === 'p') {
        var pc = b.p;
        if (pc.pbb && cur.length) newPage();
        var segs = paraText(pc);
        segs.forEach(function (s) {
          if (s.t.trim()) emitLines(wrapText(s.t, bodyW, pc.fs), P.left, pc.fs, pc.line);
          else if (!s.brk) y -= pc.fs * 1.25;
          if (s.brk === 'line') { /* перенос строки внутри абзаца — уже отдельная строка */ }
          if (s.brk) brk(s.brk);
        });
        y -= pc.fs * 0.25;
      } else if (b.type === 'tbl') {
        if (b.floating) return;
        var xs = [P.left + b.ind]; b.grid.forEach(function (w) { xs.push(xs[xs.length - 1] + w); });
        if (!b.grid.length) xs = [P.left, P.left + bodyW];
        b.rows.forEach(function (r) {
          // разрывы страниц, отмеченные Word внутри строки таблицы
          var lrpb = useLR && r.cells.some(function (c) { return c.blocks.some(function (bb) { return bb.type === 'p' && bb.p.parts.some(function (pp) { return pp.brk === 'lrpb'; }); }); });
          if (lrpb && cur.length) newPage();
          var cols = r.cells.map(function (c) {
            var x0 = xs[Math.min(c.col, xs.length - 1)], x1 = xs[Math.min(c.col + c.span, xs.length - 1)];
            var lines = [];
            if (!c.cont && !c.rot) cellText(c.blocks).forEach(function (l) { wrapText(l.t, Math.max(20, x1 - x0 - 4), l.fs).forEach(function (t) { lines.push({ t: t, fs: l.fs }); }); });
            return { x: x0 + 2, lines: lines };
          });
          var fsMax = 10, n = 1;
          cols.forEach(function (c) { n = Math.max(n, c.lines.length); c.lines.forEach(function (l) { fsMax = Math.max(fsMax, l.fs); }); });
          var lh = fsMax * 1.2, h = Math.max(r.h || 0, n * lh + 2);
          room(h);
          var top = y;
          cols.forEach(function (c) { var yy = top - 1; c.lines.forEach(function (l) { yy -= lh; cur.push(item(l.t, c.x, yy, l.fs)); }); });
          y = top - h;
        });
        y -= 4;
      }
    });
    if (cur.length || !pages.length) pages.push(cur);
    // основная надпись из колонтитулов
    var first = (d.titlePg && d.footers.first) || d.footers['default'] || [], other = d.footers['default'] || [];
    var fi = footerItems(first, P), oi = footerItems(other, P);
    return pages.map(function (items, i) { return items.concat(i === 0 ? fi : oi); });
  }

  async function toDoc(name, bytes, buildPage) {
    var d = await read(bytes);
    var pages = layout(d);
    return { name: name, kind: 'docx', pages: pages.map(function (items, i) { return buildPage(i + 1, items); }), docx: { hasLRPB: d.hasLRPB, sheetsKnown: d.hasLRPB } };
  }

  var api = { unzip: unzip, parseXml: parseXml, read: read, layout: layout, toDoc: toDoc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DOCXR = api;
})(typeof window !== 'undefined' ? window : globalThis);
