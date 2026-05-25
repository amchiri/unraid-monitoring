// Génère les icônes PWA (PNG) sans dépendance : encodeur PNG maison via zlib.
// Dessin : carré arrondi en dégradé bleu + 3 barres blanches (stockage) + LED verte (statut).
import zlib from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(OUT, { recursive: true })

// --- Encodeur PNG (RGBA, 8 bits) ---
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crc])
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const stride = width * 4 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0 // filtre none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// --- Dessin ---
function sdfRoundRect(px, py, cx, cy, ex, ey, r) {
  const dx = Math.abs(px - cx) - (ex - r)
  const dy = Math.abs(py - cy) - (ey - r)
  const ox = Math.max(dx, 0)
  const oy = Math.max(dy, 0)
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - r
}
const clamp01 = (v) => Math.max(0, Math.min(1, v))
const lerp = (a, b, t) => a + (b - a) * t

function draw(N) {
  const buf = Buffer.alloc(N * N * 4)
  const over = (i, r, g, b, a) => {
    // composite source-over sur buf
    const ba = buf[i + 3] / 255
    const sa = a
    const oa = sa + ba * (1 - sa)
    if (oa <= 0) return
    buf[i] = Math.round((r * sa + buf[i] * ba * (1 - sa)) / oa)
    buf[i + 1] = Math.round((g * sa + buf[i + 1] * ba * (1 - sa)) / oa)
    buf[i + 2] = Math.round((b * sa + buf[i + 2] * ba * (1 - sa)) / oa)
    buf[i + 3] = Math.round(oa * 255)
  }

  const rad = N * 0.22
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4
      // fond : carré arrondi, dégradé vertical #38bdf8 -> #2563eb
      const dBg = sdfRoundRect(x + 0.5, y + 0.5, N / 2, N / 2, N / 2, N / 2, rad)
      const aBg = clamp01(0.5 - dBg)
      if (aBg > 0) {
        const t = y / N
        over(i, Math.round(lerp(56, 37, t)), Math.round(lerp(189, 99, t)), Math.round(lerp(248, 235, t)), aBg)
      }
    }
  }

  // 3 barres blanches (stockage)
  const bh = N * 0.115
  const gap = N * 0.075
  const groupH = 3 * bh + 2 * gap
  const top = (N - groupH) / 2
  const x0 = N * 0.24
  const x1 = N * 0.76
  const exBar = (x1 - x0) / 2
  const cxBar = (x0 + x1) / 2
  for (let k = 0; k < 3; k++) {
    const cy = top + bh / 2 + k * (bh + gap)
    for (let y = Math.floor(top + k * (bh + gap)) - 1; y < top + k * (bh + gap) + bh + 1; y++) {
      for (let x = Math.floor(x0) - 1; x < x1 + 1; x++) {
        if (x < 0 || y < 0 || x >= N || y >= N) continue
        const i = (y * N + x) * 4
        const d = sdfRoundRect(x + 0.5, y + 0.5, cxBar, cy, exBar, bh / 2, bh / 2)
        const a = clamp01(0.5 - d) * 0.96
        if (a > 0) over(i, 248, 250, 252, a)
        // petit témoin bleu à gauche de chaque barre
        const dd = Math.hypot(x + 0.5 - (x0 + bh * 0.7), y + 0.5 - cy) - bh * 0.22
        const ad = clamp01(0.5 - dd)
        if (ad > 0) over(i, 2, 132, 199, ad)
      }
    }
  }

  // LED verte de statut (coin haut-droit)
  const lx = N * 0.74
  const ly = N * 0.26
  const lr = N * 0.055
  for (let y = Math.floor(ly - lr - 2); y < ly + lr + 2; y++) {
    for (let x = Math.floor(lx - lr - 2); x < lx + lr + 2; x++) {
      if (x < 0 || y < 0 || x >= N || y >= N) continue
      const i = (y * N + x) * 4
      const d = Math.hypot(x + 0.5 - lx, y + 0.5 - ly) - lr
      const a = clamp01(0.5 - d)
      if (a > 0) over(i, 34, 197, 94, a)
    }
  }

  return encodePng(N, N, buf)
}

for (const size of [180, 192, 512]) {
  writeFileSync(path.join(OUT, `icon-${size}.png`), draw(size))
}
writeFileSync(path.join(OUT, 'favicon.png'), draw(64))
console.log('Icônes générées dans public/ :', [180, 192, 512].map((s) => `icon-${s}.png`).join(', '), '+ favicon.png')
