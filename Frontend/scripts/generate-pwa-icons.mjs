import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public')
const logoPath = path.join(outDir, 'logo.png')
const navy = { r: 0, g: 45, b: 86, alpha: 1 }

await mkdir(outDir, { recursive: true })

async function fromLogo(size, logoSize = size) {
  const logo = await sharp(logoPath)
    .resize(logoSize, logoSize, { fit: 'contain', background: navy })
    .png()
    .toBuffer()

  return sharp({
    create: { width: size, height: size, channels: 4, background: navy },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
}

const copies = [
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
]

for (const { name, size } of copies) {
  await (await fromLogo(size)).toFile(path.join(outDir, name))
}

await (await fromLogo(512, 384)).toFile(path.join(outDir, 'pwa-512x512-maskable.png'))

console.log('Generated PWA icons from public/logo.png')
