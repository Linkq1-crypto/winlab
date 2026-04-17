// Generates PWA icons as solid-color PNGs — no external dependencies (uses built-in zlib)
import { createDeflate } from "zlib";
import { mkdirSync, writeFileSync } from "fs";
import { Readable, pipeline } from "stream";
import { promisify } from "util";

const pipelineAsync = promisify(pipeline);

// ── WINLAB brand colors ───────────────────────────────────────────────────────
const BG   = [10, 10, 11, 255];   // #0a0a0b
const BLUE = [37, 99, 235, 255];  // #2563eb

function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const crcData = Buffer.concat([typeBytes, data]);
  const crcBuf  = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcData));
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

async function buildPng(size) {
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8]  = 8;  // bit depth
  ihdr[9]  = 2;  // color type: RGB (no alpha needed)
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // Draw: solid BG with a centered blue square (logo placeholder)
  // Outer ring = BG, inner 60% = BLUE
  const logoStart = Math.floor(size * 0.2);
  const logoEnd   = Math.ceil(size * 0.8);

  const rawRows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3); // filter byte + RGB per pixel
    row[0] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const isLogo = x >= logoStart && x < logoEnd && y >= logoStart && y < logoEnd;
      const [r, g, b] = isLogo ? BLUE : BG;
      row[1 + x * 3]     = r;
      row[1 + x * 3 + 1] = g;
      row[1 + x * 3 + 2] = b;
    }
    rawRows.push(row);
  }
  const rawData = Buffer.concat(rawRows);

  // Compress with zlib
  const compressed = await new Promise((resolve, reject) => {
    const chunks = [];
    const deflate = createDeflate({ level: 6 });
    deflate.on("data", d => chunks.push(d));
    deflate.on("end", () => resolve(Buffer.concat(chunks)));
    deflate.on("error", reject);
    deflate.write(rawData);
    deflate.end();
  });

  const sig  = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

const iconsDir = new URL("../public/icons", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(iconsDir, { recursive: true });

for (const size of SIZES) {
  const png = await buildPng(size);
  const dest = `${iconsDir}/icon-${size}.png`;
  writeFileSync(dest, png);
  console.log(`✓ icon-${size}.png`);
}

// Also create shortcut icons (same 96px style)
for (const name of ["shortcut-terminal", "shortcut-raid"]) {
  const png = await buildPng(96);
  writeFileSync(`${iconsDir}/${name}.png`, png);
  console.log(`✓ ${name}.png`);
}

console.log(`\nAll icons written to public/icons/`);
