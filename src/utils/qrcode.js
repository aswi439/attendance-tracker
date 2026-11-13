// ISO/IEC 18004 Compliant QR Code Model 2 Generator (Byte Mode, Level M)
// Zero-dependency pure JavaScript vector path generator

class QRBitBuffer {
  constructor() {
    this.buffer = [];
    this.length = 0;
  }
  put(num, length) {
    for (let i = 0; i < length; i++) {
      const bit = ((num >>> (length - i - 1)) & 1) === 1;
      const bufIndex = Math.floor(this.length / 8);
      if (this.buffer.length <= bufIndex) this.buffer.push(0);
      if (bit) this.buffer[bufIndex] |= 0x80 >>> (this.length % 8);
      this.length++;
    }
  }
}

// GF(256) Tables
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0; i < 8; i++) EXP[i] = 1 << i;
for (let i = 8; i < 256; i++) EXP[i] = EXP[i - 4] ^ EXP[i - 5] ^ EXP[i - 6] ^ EXP[i - 8];
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
for (let i = 0; i < 255; i++) LOG[EXP[i]] = i;

function glog(n) { return LOG[n]; }
function gexp(n) {
  let v = n % 255;
  if (v < 0) v += 255;
  return EXP[v];
}

class QRPoly {
  constructor(num, shift = 0) {
    let offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Uint8Array(num.length - offset + shift);
    for (let i = 0; i < num.length - offset; i++) this.num[i] = num[offset + i];
  }
  multiply(e) {
    const num = new Uint8Array(this.num.length + e.num.length - 1);
    for (let i = 0; i < this.num.length; i++) {
      for (let j = 0; j < e.num.length; j++) {
        num[i + j] ^= gexp(glog(this.num[i]) + glog(e.num[j]));
      }
    }
    return new QRPoly(num);
  }
  mod(e) {
    if (this.num.length < e.num.length) return this;
    const ratio = glog(this.num[0]) - glog(e.num[0]);
    const num = new Uint8Array(this.num);
    for (let i = 0; i < e.num.length; i++) {
      num[i] ^= gexp(glog(e.num[i]) + ratio);
    }
    return new QRPoly(num).mod(e);
  }
}

const RS_BLOCKS_M = {
  1: [[1, 26, 16]],
  2: [[1, 44, 28]],
  3: [[1, 70, 44]],
  4: [[2, 50, 32]],
  5: [[2, 67, 43]],
  6: [[4, 43, 27]],
  7: [[4, 49, 31]],
  8: [[2, 60, 38], [2, 61, 39]],
  9: [[3, 58, 36], [2, 59, 37]],
  10: [[4, 69, 43], [1, 70, 44]]
};

const ALIGN_POS = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50]
];

function getRSPoly(ecLen) {
  let a = new QRPoly([1], 0);
  for (let i = 0; i < ecLen; i++) {
    a = a.multiply(new QRPoly([1, gexp(i)], 0));
  }
  return a;
}

export function generateQRCode(text) {
  const utf8 = new TextEncoder().encode(text);
  let ver = 1;
  while (ver <= 10) {
    const blocks = RS_BLOCKS_M[ver];
    let totalData = 0;
    for (const b of blocks) totalData += b[0] * b[2];
    const charBits = ver < 10 ? 8 : 16;
    if (4 + charBits + utf8.length * 8 <= totalData * 8) break;
    ver++;
  }
  if (ver > 10) ver = 10;

  const size = ver * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(null));
  const isFunc = Array.from({ length: size }, () => new Array(size).fill(false));

  function setMod(r, c, val, func = true) {
    modules[r][c] = val;
    if (func) isFunc[r][c] = true;
  }

  // 1. Finder patterns
  function addFinder(row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        if (row + r < 0 || row + r >= size || col + c < 0 || col + c >= size) continue;
        const outer = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6));
        const inner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        setMod(row + r, col + c, outer || inner);
      }
    }
  }
  addFinder(0, 0);
  addFinder(0, size - 7);
  addFinder(size - 7, 0);

  // 2. Alignment patterns
  if (ver >= 2) {
    const coords = ALIGN_POS[ver - 1];
    for (let i = 0; i < coords.length; i++) {
      for (let j = 0; j < coords.length; j++) {
        const r = coords[i];
        const c = coords[j];
        if (isFunc[r][c]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const edge = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
            setMod(r + dr, c + dc, edge);
          }
        }
      }
    }
  }

  // 3. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (modules[i][6] === null) setMod(i, 6, i % 2 === 0);
    if (modules[6][i] === null) setMod(6, i, i % 2 === 0);
  }

  // Dark module
  setMod(4 * ver + 9, 8, true);

  // Reserve format areas
  for (let i = 0; i < 9; i++) {
    if (modules[8][i] === null) setMod(8, i, false);
    if (modules[i][8] === null) setMod(i, 8, false);
  }
  for (let i = size - 8; i < size; i++) {
    if (modules[8][i] === null) setMod(8, i, false);
    if (modules[i][8] === null) setMod(i, 8, false);
  }

  // Bit buffer encoding
  const buf = new QRBitBuffer();
  buf.put(0x4, 4); // Byte mode
  buf.put(utf8.length, ver < 10 ? 8 : 16);
  for (let i = 0; i < utf8.length; i++) buf.put(utf8[i], 8);

  const blocks = RS_BLOCKS_M[ver];
  let totalData = 0;
  for (const b of blocks) totalData += b[0] * b[2];
  if (buf.length + 4 <= totalData * 8) buf.put(0, 4);
  else buf.put(0, totalData * 8 - buf.length);
  while (buf.length % 8 !== 0) buf.put(0, 1);
  while (buf.length < totalData * 8) {
    buf.put(0xec, 8);
    if (buf.length < totalData * 8) buf.put(0x11, 8);
  }

  // RS error correction
  const rsBlocks = [];
  let byteIdx = 0;
  for (const b of blocks) {
    const numB = b[0];
    const dataLen = b[2];
    const ecLen = b[1] - dataLen;
    for (let i = 0; i < numB; i++) {
      const data = buf.buffer.slice(byteIdx, byteIdx + dataLen);
      byteIdx += dataLen;
      const poly = getRSPoly(ecLen);
      const raw = new QRPoly(data, poly.num.length - 1);
      const mod = raw.mod(poly);
      const ecData = new Uint8Array(poly.num.length - 1);
      for (let j = 0; j < ecData.length; j++) {
        const mIdx = j + mod.num.length - ecData.length;
        ecData[j] = mIdx >= 0 ? mod.num[mIdx] : 0;
      }
      rsBlocks.push({ data, ecData });
    }
  }

  // Interleave
  const interleaved = [];
  let maxD = Math.max(...rsBlocks.map(b => b.data.length));
  for (let i = 0; i < maxD; i++) {
    for (const b of rsBlocks) if (i < b.data.length) interleaved.push(b.data[i]);
  }
  let maxEC = Math.max(...rsBlocks.map(b => b.ecData.length));
  for (let i = 0; i < maxEC; i++) {
    for (const b of rsBlocks) if (i < b.ecData.length) interleaved.push(b.ecData[i]);
  }

  // Matrix layout
  let inc = -1;
  let r = size - 1;
  let bitPos = 0;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    while (true) {
      for (let c = 0; c < 2; c++) {
        const cCol = col - c;
        if (!isFunc[r][cCol]) {
          let dark = false;
          if (bitPos < interleaved.length * 8) {
            const bIndex = Math.floor(bitPos / 8);
            const bBit = 7 - (bitPos % 8);
            dark = ((interleaved[bIndex] >>> bBit) & 1) === 1;
            bitPos++;
          }
          // Pattern 0 mask: (r + cCol) % 2 === 0
          const mask = (r + cCol) % 2 === 0;
          modules[r][cCol] = dark ^ mask;
        }
      }
      r += inc;
      if (r < 0 || r >= size) {
        r -= inc;
        inc = -inc;
        break;
      }
    }
  }

  // Format info (EC Level M, Mask 0 = 0x5412)
  const format = 0x5412;
  for (let i = 0; i < 15; i++) {
    const bit = ((format >>> i) & 1) === 1;
    if (i < 6) modules[i][8] = bit;
    else if (i < 8) modules[i + 1][8] = bit;
    else modules[size - 15 + i][8] = bit;

    if (i < 8) modules[8][size - i - 1] = bit;
    else if (i < 9) modules[8][15 - i] = bit;
    else modules[8][14 - i] = bit;
  }

  // Build SVG path
  let path = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y][x]) path += `M${x} ${y}h1v1h-1z`;
    }
  }

  return { size, path, modules };
}
