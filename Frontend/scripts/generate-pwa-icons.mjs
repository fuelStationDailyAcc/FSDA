import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public')
const logoPath = path.join(outDir, 'logo.png')
const black = { r: 0, g: 0, b: 0, alpha: 1 }

await mkdir(outDir, { recursive: true })

async function emblemBuffer() {
  const { width, height } = await sharp(logoPath).metadata()
  if (!width || !height) throw new Error('Could not read public/logo.png')
  const side = Math.min(width, height)
  return sharp(logoPath)
    .extract({
      left: Math.round((width - side) / 2),
      top: Math.round((height - side) / 2),
      width: side,
      height: side,
    })
    .png()
    .toBuffer()
}

async function makeIcon(size, padRatio = 0.04) {
  const inner = Math.max(1, Math.round(size * (1 - padRatio * 2)))
  const mark = await sharp(await emblemBuffer())
    .resize(inner, inner, { fit: 'contain', background: black })
    .png()
    .toBuffer()

  return sharp({
    create: { width: size, height: size, channels: 4, background: black },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png({ compressionLevel: 9 })
}

const copies = [
  { name: 'favicon-32x32.png', size: 32, pad: 0.06 },
  { name: 'apple-touch-icon.png', size: 180, pad: 0.04 },
  { name: 'pwa-192x192.png', size: 192, pad: 0.04 },
  { name: 'pwa-512x512.png', size: 512, pad: 0.04 },
]

const emblem = await emblemBuffer()
for (const { name, size, pad } of copies) {
  await (await makeIcon(size, pad)).toFile(path.join(outDir, name))
}

await (await makeIcon(512, 0.12)).toFile(path.join(outDir, 'pwa-512x512-maskable.png'))
await sharp(emblem).resize(512, 512).png({ compressionLevel: 9 }).toFile(path.join(outDir, 'logo-mark.png'))

console.log('Generated PWA icons from public/logo.png')
