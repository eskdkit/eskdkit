/* gtcore.js — общие допуски по ГОСТ 30893.1-2002 (ИСО 2768-1). Значения в мм. */
(function (root) {
'use strict';
var CL = { f: 'точный', m: 'средний', c: 'грубый', v: 'очень грубый' };
var IT_OF = { f: 12, m: 14, c: 16, v: 17 }; // приложение А, вариант 1
var LB = [0.5, 3, 6, 30, 120, 400, 1000, 2000, 4000, 6000, 8000, 10000];
var LIN = { // таблица 1: ±
  f: [0.05, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, null, null, null, null],
  m: [0.1, 0.1, 0.2, 0.3, 0.5, 0.8, 1.2, 2, 3, 5, 8],
  c: [0.2, 0.3, 0.5, 0.8, 1.2, 2, 3, 4, 8, 12, 20],
  v: [null, 0.5, 1, 1.5, 2.5, 4, 6, 8, 12, 20, 30] };
var ONE = { // таблица А.2: t (одностороннее)
  f: [0.1, 0.1, 0.2, 0.3, 0.4, 0.6, 1, null, null, null, null],
  m: [0.2, 0.2, 0.4, 0.6, 1, 1.6, 2.4, 4, 6, 10, 16],
  c: [0.4, 0.6, 1, 1.6, 2.4, 4, 6, 8, 16, 24, 40],
  v: [null, 1, 2, 3, 5, 8, 12, 16, 24, 40, 60] };
var RB = [0.5, 3, 6, Infinity];
var RAD = { f: [0.2, 0.5, 1], m: [0.2, 0.5, 1], c: [0.4, 1, 2], v: [0.4, 1, 2] }; // таблица 2
var AB = [10, 50, 120, 400, Infinity];
var ANG = { // таблица 3, в угловых минутах
  f: [60, 30, 20, 10, 5], m: [60, 30, 20, 10, 5], c: [90, 60, 30, 15, 10], v: [180, 120, 60, 30, 20] };

function rng(B, x) { // интервалы «св. B[i] до B[i+1] включ.»; первый — от B[0] включительно
  if (!(x >= B[0])) return -1;
  for (var i = 0; i < B.length - 1; i++) if (x <= B[i + 1]) return i;
  return -1;
}
function rangeTxt(B, i) { var a = B[i], b = B[i + 1]; return (i === 0 ? 'от ' + nf(a) : 'св. ' + nf(a)) + (b === Infinity ? '' : ' до ' + nf(b)); }
function nf(x) { return String(+(+x).toFixed(4)).replace('.', ','); }
function linear(size, cl) {
  var i = rng(LB, size);
  if (size < 0.5) return { err: 'Для размеров менее 0,5 мм отклонения указывают непосредственно у номинального размера (ГОСТ 30893.1, примечание к таблице 1).' };
  if (i < 0) return { err: 'ГОСТ 30893.1 устанавливает общие допуски линейных размеров до 10 000 мм.' };
  var t = LIN[cl][i];
  if (t == null) return { err: 'Для класса «' + CL[cl] + '» в интервале ' + rangeTxt(LB, i) + ' мм отклонения не установлены.' };
  return { pm: t, one: ONE[cl][i], range: rangeTxt(LB, i) };
}
function radius(size, cl) {
  if (size < 0.5) return { err: 'Для размеров менее 0,5 мм отклонения указывают у размера.' };
  var i = rng(RB, size); return { pm: RAD[cl][i], range: rangeTxt(RB, i) };
}
function angle(side, cl) {
  var i = side <= 10 ? 0 : side <= 50 ? 1 : side <= 120 ? 2 : side <= 400 ? 3 : 4;
  return { min: ANG[cl][i], range: ['до 10', 'св. 10 до 50', 'св. 50 до 120', 'св. 120 до 400', 'св. 400'][i], txt: angTxt(ANG[cl][i]) };
}
function angTxt(min) { var d = Math.floor(min / 60), m = min % 60; return '±' + (d ? d + '°' : '') + (m ? (d && m < 10 ? '0' : '') + m + '′' : ''); }
function note(cl, variant, gpClass) {
  var k = { f: 1, m: 2, c: 3, v: 4 }[cl], q = IT_OF[cl];
  if (variant === 1) return 'Общие допуски по ГОСТ 30893.1: H' + q + ', h' + q + ', ±IT' + q + '/2';
  if (variant === 2) return 'Общие допуски по ГОСТ 30893.1: +t' + k + ', −t' + k + ', ±t' + k + '/2';
  if (gpClass) return 'Общие допуски по ГОСТ 30893.2 — ' + cl + gpClass;
  return 'Общие допуски по ГОСТ 30893.1 — ' + cl;
}
// Разбор строки пакета: «25», «Ø25», «R3», «2x45°»/«фаска 2», «30° 20» (угол и длина меньшей стороны)
function parseLine(s) {
  var t = String(s || '').trim().replace(/,/g, '.').replace(/×|х/g, 'x'), m;
  if (!t) return null;
  if ((m = t.match(/^(\d+(?:\.\d+)?)\s*°\s*(?:(?:L|l|сторона)?\s*=?\s*(\d+(?:\.\d+)?))?$/))) return { kind: 'ang', val: +m[1], side: m[2] ? +m[2] : null, raw: s };
  if ((m = t.match(/^R\s*(\d+(?:\.\d+)?)$/i))) return { kind: 'rad', val: +m[1], raw: s };
  if ((m = t.match(/^(?:фаска\s*)?(\d+(?:\.\d+)?)\s*x\s*\d+\s*°?$/i)) || (m = t.match(/^фаска\s*(\d+(?:\.\d+)?)$/i))) return { kind: 'chf', val: +m[1], raw: s };
  if ((m = t.match(/^([ØøⲪ⌀]|D|d)?\s*(\d+(?:\.\d+)?)$/))) return { kind: 'lin', val: +m[2], dia: !!m[1], raw: s };
  return { kind: '?', raw: s };
}
var api = { VERSION: '0.1', CL: CL, IT_OF: IT_OF, LB: LB, LIN: LIN, ONE: ONE, RB: RB, RAD: RAD, AB: AB, ANG: ANG,
  linear: linear, radius: radius, angle: angle, angTxt: angTxt, note: note, parseLine: parseLine, nf: nf, rangeTxt: rangeTxt };
if (typeof module !== 'undefined') module.exports = api; else root.GT = api;
})(this);
