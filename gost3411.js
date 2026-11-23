/* ГОСТ Р 34.11-2012 «Стрибог», 256 бит. Табличная реализация; константы стандарта. */
(function (root) {
  'use strict';
  var PI = [252,238,221,17,207,110,49,22,251,196,250,218,35,197,4,77,233,119,240,219,147,46,153,186,23,54,241,187,20,205,95,193,249,24,101,90,226,92,239,33,129,28,60,66,139,1,142,79,5,132,2,174,227,106,143,160,6,11,237,152,127,212,211,31,235,52,44,81,234,200,72,171,242,42,104,162,253,58,206,204,181,112,14,86,8,12,118,18,191,114,19,71,156,183,93,135,21,161,150,41,16,123,154,199,243,145,120,111,157,158,178,177,50,117,25,61,255,53,138,126,109,84,198,128,195,189,13,87,223,245,36,169,62,168,67,201,215,121,214,246,124,34,185,3,224,15,236,222,122,148,176,188,220,232,40,80,78,51,10,74,167,151,96,115,30,0,98,68,26,184,56,130,100,159,38,65,173,69,70,146,39,94,85,47,140,163,165,125,105,213,149,59,7,88,179,64,134,172,29,247,48,55,107,228,136,217,231,137,225,27,131,73,76,63,248,254,141,83,170,144,202,216,133,97,32,113,103,164,45,43,9,91,203,155,37,208,190,229,108,82,89,166,116,210,230,244,180,192,209,102,175,194,57,75,99,182];
  var A = [0x8e20faa7,0x2ba0b470,0x47107ddd,0x9b505a38,0xad08b0e0,0xc3282d1c,0xd8045870,0xef14980e,0x6c022c38,0xf90a4c07,0x3601161c,0xf205268d,0x1b8e0b0e,0x798c13c8,0x83478b07,0xb2468764,0xa011d380,0x818e8f40,0x5086e740,0xce47c920,0x2843fd20,0x67adea10,0x14aff010,0xbdd87508,0xad97808,0xd06cb404,0x5e23c04,0x68365a02,0x8c711e02,0x341b2d01,0x46b60f01,0x1a83988e,0x90dab52a,0x387ae76f,0x486dd415,0x1c3dfdb9,0x24b86a84,0xe90f0d2,0x125c3542,0x7487869,0x92e9421,0x8d243cba,0x8a174a9e,0xc8121e5d,0x4585254f,0x64090fa0,0xaccc9ca9,0x328a8950,0x9d4df05d,0x5f661451,0xc0a878a0,0xa1330aa6,0x60543c50,0xde970553,0x302a1e28,0x6fc58ca7,0x18150f14,0xb9ec46dd,0xc84890a,0xd27623e0,0x642ca05,0x693b9f70,0x321658c,0xba93c138,0x86275df0,0x9ce8aaa8,0x439da078,0x4e745554,0xafc0503c,0x273aa42a,0xd960281e,0x9d1d5215,0xe230140f,0xc0802984,0x71180a89,0x60409a42,0xb60c05ca,0x30204d21,0x5b068c65,0x1810a89e,0x456c3488,0x7a3805b9,0xac361a44,0x3d1c8cd2,0x561b0d22,0x900e4669,0x2b838811,0x480723ba,0x9bcf4486,0x248d9f5d,0xc3e92243,0x12c8c1a0,0xeffa11af,0x964ee50,0xf97d86d9,0x8a327728,0xe4fa2054,0xa80b329c,0x727d102a,0x548b194e,0x39b00815,0x2acb8227,0x92580484,0x15eb419d,0x492c0242,0x84fbaec0,0xaa160121,0x42f35760,0x550b8e9e,0x21f7a530,0xa48b474f,0x9ef5dc18,0x70a6a56e,0x2440598e,0x3853dc37,0x1220a247,0x1ca76e95,0x91051ad,0xedd37c4,0x8a08a6d8,0x7e09562,0x4504536c,0x8d70c431,0xac02a736,0xc8386296,0x5601dd1b,0x641c314b,0x2b8ee083];
  var CH = ["0745a6f2596580dd234d74cc3674760515d360a4082a42a20169679291e07c4bfcc485758db84e7116d0452e43766a2f1f7c65c0812fcbebe9daca1eda5b08b1","b79bb121700479e656cdcbd71ba2dd55caa70adbc261b55c5899d6126b17b59a3101b5160f5ed561982b230a72eafef3d7b5700f469de34f1a2f9da98ab5a36f","b20aba0af5961e9931db7a8643f4b6c209db6260373ac9c1b19e3590e40fe2d37b7b29b11475eaf28b1f9c525f5ef10635843d6a28fc390ac72fce2bacdc74f5","2ed1e384bcbe0c22f137e893a1ea5334be0352933313b7d875d603ed822cd7a93f355e68ad1c729d7d3c5c337e858e48dde4715da0e148f9d26615e8b3df1fef","57fe6c7cfd581760f563eaa97ea2567a161a2723b700ffdfa3f53a254717cdbfbdff0f80d7359e354a1086161f1c157f6323a96c0c413f9a994747adac6bea4b","6e7d64467a4068fa354f903672c571bfb6c6bec2661ff20ab4b79a1cb7a6facfc68ef09ab49a7f186ca44251f9c4662dc039307a3bc3a46fd9d33a1daeae4fae","93d4143a4d568688f34a3ca24c45173504054a2883694706372c822dc5ab9209c9937a19333e47d3c987bfe6c7c69e39540924bffe86ac51ecc5aaee160ec7f4","1ee702bfd40d7fa4d9a8515935c2ac362fc4a5d12b8dd16990069b92cb2b89f49ac4db4d3b44b4891ede369c71f8b74e41416e0c02aae703a7c9934d425b1f9b","db5a238351446172602a1fcb92dc380e549c07a69a8a2b7bb1ceb2db0b440a8084090de0b755d93c244289251b3a7d3ade5f16ecd89a4c949b223116545a8f37","ed9c4598fbc7b474c3b63b15d1fa9836f452763b306c1e7a4b3369af0267e79f0361331b8ae1ff1fdb788aff1ce74189f3f3e4b248e52a38526f0580a6debeab","1b2df381cda4ca6b5dd86fc04a59a2de986e477d1dcdbaefcab948eaef711d8a79668414218001206107abebbb6bfad894fe5a63cdc60230fb89c8efd09ecd7b","20d71bf14a92bc48991bb2d9d517f4fa5228e188aaa41de786cc91189def805d9b9f2130d41220f8771ddfbc323ca4cd7ab14904b08013d2ba3116f167e78e37"];
  var T = new Uint32Array(8 * 256 * 2), Cc = [];
  (function () {
    var Alo = [], Ahi = [];
    for (var i = 0; i < 64; i++) { Ahi.push(A[2 * i] >>> 0); Alo.push(A[2 * i + 1] >>> 0); }
    for (var j = 0; j < 8; j++) for (var b = 0; b < 256; b++) {
      var v = PI[b], lo = 0, hi = 0;
      for (var k = 0; k < 8; k++) if ((v >> k) & 1) { var bit = 8 * j + k, ai = 63 - bit; lo ^= Alo[ai]; hi ^= Ahi[ai]; }
      T[(j * 256 + b) * 2] = lo >>> 0; T[(j * 256 + b) * 2 + 1] = hi >>> 0;
    }
    CH.forEach(function (h) { var u = new Uint8Array(64); for (var i = 0; i < 64; i++) u[i] = parseInt(h.substr(i * 2, 2), 16); Cc.push(new Uint32Array(u.buffer.slice(0))); });
  })();
  var LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  function lps(x, r) {
    for (var i = 0; i < 8; i++) {
      var w = i < 4 ? 0 : 1, sh = (i & 3) * 8, lo = 0, hi = 0;
      for (var j = 0; j < 8; j++) { var idx = (j * 256 + ((x[2 * j + w] >>> sh) & 255)) * 2; lo ^= T[idx]; hi ^= T[idx + 1]; }
      r[2 * i] = lo; r[2 * i + 1] = hi;
    }
  }
  var K = new Uint32Array(16), S = new Uint32Array(16), t = new Uint32Array(16);
  function g(h, N, m) {
    var i;
    for (i = 0; i < 16; i++) t[i] = h[i] ^ N[i];
    lps(t, K);
    for (i = 0; i < 16; i++) t[i] = K[i] ^ m[i];
    for (var r = 0; r < 12; r++) {
      lps(t, S);
      var c = Cc[r];
      for (i = 0; i < 16; i++) t[i] = K[i] ^ c[i];
      lps(t, K);
      for (i = 0; i < 16; i++) t[i] = S[i] ^ K[i];
    }
    for (i = 0; i < 16; i++) h[i] ^= t[i] ^ m[i];
  }
  function add(a, b) { var c = 0; for (var i = 0; i < 16; i++) { var s = a[i] + b[i] + c; a[i] = s >>> 0; c = s > 0xFFFFFFFF ? 1 : 0; } }
  function addBits(a, n) { var c = n; for (var i = 0; i < 16 && c; i++) { var s = a[i] + c; a[i] = s >>> 0; c = s > 0xFFFFFFFF ? 1 : 0; } }
  function words(bytes, off) { var w = new Uint32Array(16); for (var i = 0; i < 16; i++) { var p = off + i * 4; w[i] = (bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16) | (bytes[p + 3] << 24)) >>> 0; } return w; }
  var Z = new Uint32Array(16);
  function hash256(data, onProgress) {
    data = data instanceof Uint8Array ? data : new Uint8Array(data);
    var h = new Uint32Array(16).fill(0x01010101), N = new Uint32Array(16), Sg = new Uint32Array(16), off = 0, len = data.length;
    for (; len - off >= 64; off += 64) {
      var m = words(data, off); g(h, N, m); addBits(N, 512); add(Sg, m);
      if (onProgress && (off & 0xFFFFF) === 0) onProgress(off / len);
    }
    var last = new Uint8Array(64); last.set(data.subarray(off)); last[len - off] = 1;
    var ml = words(last, 0); g(h, N, ml); addBits(N, (len - off) * 8); add(Sg, ml);
    g(h, Z, N); g(h, Z, Sg);
    var out = new Uint8Array(64);
    for (var i = 0; i < 16; i++) { out[i * 4] = h[i] & 255; out[i * 4 + 1] = (h[i] >>> 8) & 255; out[i * 4 + 2] = (h[i] >>> 16) & 255; out[i * 4 + 3] = h[i] >>> 24; }
    return out.slice(32);
  }
  function hex256(data, onProgress) { var o = hash256(data, onProgress), s = ''; for (var i = 0; i < o.length; i++) s += (o[i] < 16 ? '0' : '') + o[i].toString(16); return s; }
  var api = { hash256: hash256, hex256: hex256, NAME: 'ГОСТ Р 34.11-2012 (256 бит)' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GOST3411 = api;
})(typeof window !== 'undefined' ? window : globalThis);
