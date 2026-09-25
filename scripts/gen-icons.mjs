// Genera iconos PWA (192/512 normal y maskable) con el rostro
// de NEXUS sobre fondo oscuro con anillo esmeralda.
// Ejecutar: node scripts/gen-icons.mjs
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const AVATAR = new URL('../public/img/nexus-avatar.png', import.meta.url).pathname
const OUT = new URL('../public/icons/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

// recorte circular del avatar
function circleMask(size) {
  return Buffer.from(
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
       <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/>
     </svg>`,
  )
}

async function avatarCircle(size) {
  return sharp(AVATAR)
    .resize(size, size, { fit: 'cover', position: 'top' })
    .composite([{ input: circleMask(size), blend: 'dest-in' }])
    .png()
    .toBuffer()
}

// fondo premium: gradiente oscuro + halo esmeralda + anillo
function bgSvg(maskable, size = 512) {
  const scale = maskable ? 0.74 : 0.94 // zona segura maskable
  const r = (size * scale) / 2
  const c = size / 2
  return Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0E1A2B"/>
      <stop offset="100%" stop-color="#0B0F17"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="42%" r="55%">
      <stop offset="0%" stop-color="#10B981" stop-opacity="0.5"/>
      <stop offset="60%" stop-color="#10B981" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#10B981" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${maskable ? 0 : 112}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" rx="${maskable ? 0 : 112}" fill="url(#halo)"/>
  <circle cx="${c}" cy="${c}" r="${r + 6}" fill="none" stroke="#10B981" stroke-opacity="0.85" stroke-width="7"/>
</svg>`)
}

const jobs = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-192.png', size: 192, maskable: true },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
]

for (const j of jobs) {
  const base = 512
  const scale = j.maskable ? 0.74 : 0.94
  const avatarSize = Math.round(base * scale)
  const offset = Math.round((base - avatarSize) / 2)

  const avatar = await avatarCircle(avatarSize)
  // ojo: sharp aplica resize ANTES que composite en la misma cadena,
  // así que primero componemos a 512 y luego reescalerto en otro paso
  const composed = await sharp(bgSvg(j.maskable))
    .composite([{ input: avatar, top: offset, left: offset }])
    .png()
    .toBuffer()
  await sharp(composed)
    .resize(j.size, j.size)
    .png()
    .toFile(OUT + j.file)
  console.log('✓', j.file)
}
console.log('Iconos regenerados con el rostro de NEXUS')
