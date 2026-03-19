/**
 * توليد أيقونات PWA (192 و 512) من صورة مصدر واحدة.
 *
 * الاستخدام:
 * 1. ضعي صورتك (الشعار أو اللوغو) في: public/logo-source.png
 *    يمكن أن تكون بأي حجم — الأفضل مربعة (مثلاً 512×512 أو أكبر).
 *    المقاسات المدعومة: .png, .jpg, .jpeg, .webp
 * 2. نفّذي: npm run icons
 *
 * الناتج: public/icons/icon-192.png و public/icons/icon-512.png
 */

import { readFile, writeFile, access } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const publicDir = join(root, 'public')
const iconsDir = join(publicDir, 'icons')

const SOURCE_NAMES = ['logo-source.png', 'logo-source.jpg', 'logo-source.jpeg', 'logo-source.webp']
const SIZES = [192, 512]

async function findSource() {
  for (const name of SOURCE_NAMES) {
    const p = join(publicDir, name)
    try {
      await access(p)
      return p
    } catch {
      // continue
    }
  }
  return null
}

async function main() {
  const sourcePath = await findSource()
  if (!sourcePath) {
    console.error('لم تُوجَد صورة مصدر. ضعي أحد الملفات في مجلد public/:')
    SOURCE_NAMES.forEach((n) => console.error('  -', n))
    process.exit(1)
  }

  let sharp
  try {
    sharp = (await import('sharp')).default
  } catch {
    console.error('ثبّتي الحزمة أولاً: npm install sharp --save-dev')
    process.exit(1)
  }

  const buf = await readFile(sourcePath)
  await sharp(buf)
    .resize(192)
    .png()
    .toFile(join(iconsDir, 'icon-192.png'))
  await sharp(buf)
    .resize(512)
    .png()
    .toFile(join(iconsDir, 'icon-512.png'))

  console.log('تم إنشاء الأيقونات: public/icons/icon-192.png و icon-512.png')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
