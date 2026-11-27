/* wordcore.js — шаблон текстового документа Word по ГОСТ Р 2.105-2019: стили, нумерация, образец структуры. */
(function (root) {
'use strict';
var TW = 1440 / 25.4;
function tw(mm) { return Math.round(mm * TW); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
// Примерная структура по видам документов (уточняйте по стандарту на вид документа)
var KINDS = {
  'ПЗ': { name: 'Пояснительная записка', std: 'ГОСТ Р 2.106-2019', sec: ['Введение', 'Назначение и область применения', 'Техническая характеристика', 'Описание и обоснование выбранной конструкции', 'Расчеты, подтверждающие работоспособность и надежность конструкции', 'Ожидаемые технико-экономические показатели', 'Уровень стандартизации и унификации'] },
  'ТУ': { name: 'Технические условия', std: 'ГОСТ Р 2.114-2016', sec: ['Технические требования', 'Требования безопасности', 'Требования охраны окружающей среды', 'Правила приемки', 'Методы контроля', 'Транспортирование и хранение', 'Указания по эксплуатации', 'Гарантии изготовителя'], intro: true },
  'РЭ': { name: 'Руководство по эксплуатации', std: 'ГОСТ Р 2.610-2019', sec: ['Описание и работа', 'Использование по назначению', 'Техническое обслуживание', 'Текущий ремонт', 'Хранение', 'Транспортирование', 'Утилизация'] },
  'ПМ': { name: 'Программа и методика испытаний', std: 'ГОСТ Р 2.106-2019', sec: ['Объект испытаний', 'Цель испытаний', 'Общие положения', 'Объем испытаний', 'Условия и порядок проведения испытаний', 'Материально-техническое обеспечение испытаний', 'Метрологическое обеспечение испытаний', 'Отчетность'] },
  'Д': { name: 'Прочий документ', std: 'ГОСТ Р 2.105-2019', sec: ['Общие положения', 'Основная часть'] }
};
function styles(o) {
  var sz = Math.round(o.pt * 2), szS = Math.round((o.pt - 2) * 2), szH = Math.round((o.pt + 2) * 2), gap = Math.round(o.pt * 2 * 20); // 2 высоты шрифта, твипы
  var ind = tw(o.indent);
  function st(id, name, ppr, rpr, extra) { return '<w:style w:type="paragraph" w:customStyle="1" w:styleId="' + id + '"><w:name w:val="' + name + '"/><w:basedOn w:val="a"/><w:next w:val="a"/><w:qFormat/>' + (extra || '') + '<w:pPr>' + ppr + '</w:pPr><w:rPr>' + rpr + '</w:rPr></w:style>'; }
  var hNum = function (lvl) { return '<w:numPr><w:ilvl w:val="' + lvl + '"/><w:numId w:val="1"/></w:numPr>'; };
  return [
    '<w:style w:type="paragraph" w:styleId="1"><w:name w:val="heading 1"/><w:basedOn w:val="a"/><w:next w:val="a"/><w:qFormat/><w:pPr><w:keepNext/>' + (o.newPage ? '<w:pageBreakBefore/>' : '') + hNum(0) + '<w:spacing w:before="' + gap + '" w:after="' + gap + '"/><w:ind w:firstLine="' + ind + '"/><w:jc w:val="left"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="' + szH + '"/><w:szCs w:val="' + szH + '"/></w:rPr></w:style>',
    '<w:style w:type="paragraph" w:styleId="2"><w:name w:val="heading 2"/><w:basedOn w:val="a"/><w:next w:val="a"/><w:qFormat/><w:pPr><w:keepNext/>' + hNum(1) + '<w:spacing w:before="' + gap + '" w:after="' + gap + '"/><w:ind w:firstLine="' + ind + '"/><w:jc w:val="left"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>',
    st('Punkt', 'Пункт', hNum(2) + '<w:ind w:firstLine="' + ind + '"/>', ''),
    st('Podpunkt', 'Подпункт', hNum(3) + '<w:ind w:firstLine="' + ind + '"/>', ''),
    st('ListDash', 'Перечисление дефис', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr><w:ind w:firstLine="' + ind + '"/>', ''),
    st('ListLetter', 'Перечисление а)', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="3"/></w:numPr><w:ind w:firstLine="' + ind + '"/>', ''),
    st('ListNum', 'Перечисление 1)', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="4"/></w:numPr><w:ind w:firstLine="' + ind + '"/>', ''),
    st('TabTitle', 'Наименование таблицы', '<w:keepNext/><w:spacing w:before="120"/><w:ind w:firstLine="0"/><w:jc w:val="left"/>', ''),
    st('FigTitle', 'Подпись рисунка', '<w:spacing w:after="120"/><w:ind w:firstLine="0"/><w:jc w:val="center"/>', ''),
    st('Figure', 'Рисунок', '<w:keepNext/><w:spacing w:before="120"/><w:ind w:firstLine="0"/><w:jc w:val="center"/>', ''),
    st('TabText', 'Текст таблицы', '<w:spacing w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:jc w:val="left"/>', '<w:sz w:val="' + szS + '"/><w:szCs w:val="' + szS + '"/>'),
    st('Note', 'Примечание', '<w:ind w:firstLine="' + ind + '"/>', '<w:sz w:val="' + szS + '"/><w:szCs w:val="' + szS + '"/>'),
    st('Formula', 'Формула', '<w:tabs><w:tab w:val="center" w:pos="' + tw(o.textW / 2) + '"/><w:tab w:val="right" w:pos="' + tw(o.textW) + '"/></w:tabs><w:spacing w:before="120" w:after="120"/><w:ind w:firstLine="0"/><w:jc w:val="left"/>', ''),
    st('Where', 'Пояснение формулы (где)', '<w:ind w:firstLine="0"/>', ''),
    st('AppHead', 'Приложение заголовок', '<w:keepNext/><w:pageBreakBefore/><w:ind w:firstLine="0"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/>', '<w:b/>'),
    st('AppStatus', 'Приложение статус', '<w:keepNext/><w:ind w:firstLine="0"/><w:jc w:val="center"/>', ''),
    st('AppTitle', 'Приложение наименование', '<w:keepNext/><w:spacing w:after="' + gap + '"/><w:ind w:firstLine="0"/><w:jc w:val="center"/>', '<w:b/>'),
    st('TocHead', 'Содержание заголовок', '<w:keepNext/><w:spacing w:after="' + gap + '"/><w:ind w:firstLine="0"/><w:jc w:val="center"/>', '<w:b/><w:sz w:val="' + szH + '"/><w:szCs w:val="' + szH + '"/>'),
    '<w:style w:type="paragraph" w:styleId="11"><w:name w:val="toc 1"/><w:basedOn w:val="a"/><w:next w:val="a"/><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="' + tw(o.textW) + '"/></w:tabs><w:ind w:firstLine="0"/><w:jc w:val="left"/></w:pPr></w:style>',
    '<w:style w:type="paragraph" w:styleId="21"><w:name w:val="toc 2"/><w:basedOn w:val="a"/><w:next w:val="a"/><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="' + tw(o.textW) + '"/></w:tabs><w:ind w:left="' + Math.round(o.pt * 20 * 2 * 0.6) + '" w:firstLine="0"/><w:jc w:val="left"/></w:pPr></w:style>',
    '<w:style w:type="table" w:customStyle="1" w:styleId="GostTable"><w:name w:val="Таблица ГОСТ"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="6" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="6" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tblBorders><w:tblCellMar><w:left w:w="57" w:type="dxa"/><w:right w:w="57" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>'
  ].join('');
}
function numbering(o) {
  var ind = tw(o.indent);
  function lvl(i, fmt, text, extra) { return '<w:lvl w:ilvl="' + i + '"><w:start w:val="1"/><w:numFmt w:val="' + fmt + '"/>' + (extra || '') + '<w:lvlText w:val="' + text + '"/><w:lvlJc w:val="left"/><w:suff w:val="space"/><w:pPr><w:ind w:left="0" w:firstLine="' + ind + '"/></w:pPr></w:lvl>'; }
  var a1 = '<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="multilevel"/>' +
    lvl(0, 'decimal', '%1', '<w:pStyle w:val="1"/>') + lvl(1, 'decimal', '%1.%2', '<w:pStyle w:val="2"/>') +
    lvl(2, 'decimal', '%1.%2.%3', '<w:pStyle w:val="Punkt"/>') + lvl(3, 'decimal', '%1.%2.%3.%4', '<w:pStyle w:val="Podpunkt"/>') + '</w:abstractNum>';
  var a2 = '<w:abstractNum w:abstractNumId="2"><w:multiLevelType w:val="singleLevel"/>' + lvl(0, 'bullet', '-') + '</w:abstractNum>';
  var a3 = '<w:abstractNum w:abstractNumId="3"><w:multiLevelType w:val="singleLevel"/>' + lvl(0, 'russianLower', '%1)') + '</w:abstractNum>';
  var a4 = '<w:abstractNum w:abstractNumId="4"><w:multiLevelType w:val="singleLevel"/>' + lvl(0, 'decimal', '%1)') + '</w:abstractNum>';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' + a1 + a2 + a3 + a4 +
    '<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num><w:num w:numId="3"><w:abstractNumId w:val="3"/></w:num><w:num w:numId="4"><w:abstractNumId w:val="4"/></w:num></w:numbering>';
}
function r(t, rpr) { return '<w:r>' + (rpr ? '<w:rPr>' + rpr + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + esc(t) + '</w:t></w:r>'; }
function p(style, runs, ppr) { return '<w:p><w:pPr>' + (style ? '<w:pStyle w:val="' + style + '"/>' : '') + (ppr || '') + '</w:pPr>' + (runs || '') + '</w:p>'; }
function fld(instr, shown) { return '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ' + esc(instr) + ' </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' + r(shown) + '<w:r><w:fldChar w:fldCharType="end"/></w:r>'; }
var SP = '<w:spacing w:val="40"/>'; // разрядка
function table(rows, widths) {
  var grid = '<w:tblGrid>' + widths.map(function (w) { return '<w:gridCol w:w="' + tw(w) + '"/>'; }).join('') + '</w:tblGrid>';
  return '<w:tbl><w:tblPr><w:tblStyle w:val="GostTable"/><w:tblW w:w="' + tw(widths.reduce(function (a, b) { return a + b; }, 0)) + '" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr>' + grid +
    rows.map(function (row, i) { return '<w:tr>' + (i === 0 ? '<w:trPr><w:tblHeader/></w:trPr>' : '') + row.map(function (c, j) { return '<w:tc><w:tcPr><w:tcW w:w="' + tw(widths[j]) + '" w:type="dxa"/></w:tcPr>' + p('TabText', r(c), i === 0 ? '<w:jc w:val="center"/>' : '') + '</w:tc>'; }).join('') + '</w:tr>'; }).join('') + '</w:tbl>';
}
function body(o) {
  var K = KINDS[o.kind] || KINDS['Д'], out = [], first = true;
  if (o.toc) {
    out.push(p('TocHead', r('Содержание')));
    out.push('<w:p><w:pPr><w:pStyle w:val="11"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-2" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' + r('Обновите содержание: правая кнопка мыши → «Обновить поле» (F9).') + '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>');
  }
  if (K.intro) out.push(p(null, r('Настоящие технические условия распространяются на ' + (o.product || '[наименование изделия]') + ', предназначенное для [назначение]. Пример записи изделия при заказе: [запись].'), o.toc ? '<w:pageBreakBefore/>' : ''));
  K.sec.forEach(function (title, i) {
    out.push(p('1', r(title), (o.toc && first) || (first && !o.toc) ? '' : ''));
    if (first) {
      first = false;
      out.push(p('2', r('Подраздел')));
      out.push(p('Punkt', r('Текст пункта. Раздел и подраздел имеют заголовки, пункты, как правило, заголовков не имеют. Абзацный отступ, интервалы и нумерация заданы стилями — применяйте стили, а не ручное форматирование.')));
      out.push(p('Punkt', r('Перечисления оформляют так:')));
      out.push(p('ListDash', r('первое перечисление;')));
      out.push(p('ListDash', r('второе перечисление.')));
      out.push(p('Punkt', r('Перечисление с буквами — когда на элементы нужно ссылаться:')));
      out.push(p('ListLetter', r('первый элемент;')));
      out.push(p('ListLetter', r('второй элемент.')));
      out.push(p('Punkt', r('Основные параметры приведены в таблице ') + fld('REF _tab1 \\h', '1') + r('.')));
      out.push(p('TabTitle', r('Таблица', SP) + r(' ') + '<w:bookmarkStart w:id="1" w:name="_tab1"/>' + fld('SEQ Таблица \\* ARABIC', '1') + '<w:bookmarkEnd w:id="1"/>' + r(' — Основные параметры')));
      out.push(table([['Наименование параметра', 'Значение', 'Примечание'], ['Масса, кг, не более', '12', '—'], ['Напряжение питания, В', '24', '—']], [Math.round(o.textW * 0.55), Math.round(o.textW * 0.2), o.textW - Math.round(o.textW * 0.55) - Math.round(o.textW * 0.2)]));
      out.push(p(null, ''));
      out.push(p(null, r('Общий вид изделия показан на рисунке ') + fld('REF _fig1 \\h', '1') + r('.')));
      out.push(p('Figure', r('[место для рисунка]')));
      out.push(p('FigTitle', r('Рисунок ') + '<w:bookmarkStart w:id="2" w:name="_fig1"/>' + fld('SEQ Рисунок \\* ARABIC', '1') + '<w:bookmarkEnd w:id="2"/>' + r(' — Общий вид')));
      out.push(p(null, r('Массу определяют по формуле')));
      out.push(p('Formula', '<w:r><w:tab/></w:r>' + r('m = ρ · V,') + '<w:r><w:tab/></w:r>' + r('(') + fld('SEQ Формула \\* ARABIC', '1') + r(')')));
      out.push(p('Where', r('где ρ — плотность материала, кг/м³;')));
      out.push(p('Where', r('V — объем детали, м³.'), '<w:ind w:left="' + tw(7) + '" w:firstLine="0"/>'));
      out.push(p('Note', r('Примечание', SP) + r(' — Текст примечания печатают уменьшенным шрифтом с абзацного отступа.')));
    } else {
      out.push(p('Punkt', r('Текст.')));
    }
  });
  out.push(p('AppHead', r('Приложение А')));
  out.push(p('AppStatus', r('(справочное)')));
  out.push(p('AppTitle', r('Наименование приложения')));
  out.push(p(null, r('Текст приложения. Таблицы, рисунки и формулы в приложении нумеруют с обозначением приложения: Таблица А.1, Рисунок А.1, (А.1).')));
  return out.join('');
}
function build(o) {
  o = Object.assign({ pt: 12, line: 1.5, indent: 12.5, kind: 'ПЗ', toc: true, newPage: true, textW: 175 }, o || {});
  return { stylesXml: styles(o), numberingXml: numbering(o), bodyXml: body(o), line: Math.round(240 * o.line), bodyPt: o.pt, updateFields: true, gapSide: 5, gapTop: 10 };
}
var api = { VERSION: '0.1', KINDS: KINDS, build: build };
if (typeof module !== 'undefined') module.exports = api; else root.W105 = api;
})(this);
