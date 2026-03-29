#!/usr/bin/env node
/**
 * Audit salon category consistency (focus city: Al Khobar by default).
 *
 * Why:
 * - Some women/family salons may be missing `category_value='salon'`
 * - This can reduce results in Home/Search "صالون نسائي"
 *
 * Env:
 *   VITE_SUPABASE_URL | SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env:
 *   AUDIT_CITY=الخبر
 *   AUDIT_LIMIT=120
 *   WRITE_SQL=1           // writes SQL patch file with suggested updates
 *
 * Usage:
 *   npm run audit:salon-categories
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadDotEnv() {
  const paths = [
    join(root, '.env.local'),
    join(root, '.env'),
    join(root, '..', '.env.local'),
    join(root, '..', '.env'),
    join(root, '.secrets.env'),
    join(root, '..', '.secrets.env'),
  ]
  for (const p of paths) {
    if (!existsSync(p)) continue
    const txt = readFileSync(p, 'utf8')
    for (let line of txt.split('\n')) {
      line = line.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq < 1) continue
      const k = line.slice(0, eq).trim()
      let v = line.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (process.env[k] == null || process.env[k] === '') process.env[k] = v
    }
  }
}

function norm(s) {
  return String(s ?? '')
    .replace(/\u0640/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function toLower(s) {
  return norm(s).toLowerCase()
}

function hasFemaleOrFamilySignal(row) {
  const blob = [row.name_ar, row.name_en, row.category_label, row.description_ar].filter(Boolean).join(' ')
  if (!blob.trim()) return false
  if (/نسائي|للنساء|للسيدات|سيدات|مشغل\s*نسائي|صالون\s*نسائي|للعائلة|عائلي|بنات|فتيات/i.test(blob)) return true
  const low = blob.toLowerCase()
  return /\bladies\b|\blady\b|\bwomen\b|\bwoman\b|\bfemale\b|\bfamily\b|\bgirls\b/.test(low)
}

function isMaleOnly(row) {
  const blob = [row.name_ar, row.name_en, row.category_label, row.category].filter(Boolean).join(' ')
  if (!blob.trim()) return false
  if (/حلاقة\s*رجال|حلاق\s*رجال|حلاقة\s*رجالية|رجالي\s*فقط|للرجال|رجال\s*فقط|حلاق\s*رجالي/i.test(blob)) return true
  const low = blob.toLowerCase()
  return /\bbarbershop\b|\bgents\b|\bmen'?s\s+salon\b|\bmale\s+only\b|\bfor\s+men\b|\bbarber\b/.test(low) &&
    !/\bwomen\b|\bladies\b|نسائي|سيدات|للنساء/.test(blob)
}

function isGym(row) {
  const blob = [row.name_ar, row.name_en, row.category_label, row.category].filter(Boolean).join(' ')
  if (!blob.trim()) return false
  if (/نادي رياضي|صالة رياضية|رياضة ولياقة|لياقة بدنية|كروسفت/i.test(blob)) return true
  return /\bgym\b|\bfitness\b|\bcrossfit\b/.test(blob.toLowerCase())
}

function isClinicSpaEtc(row) {
  const cv = toLower(row.category_value)
  const cat = toLower(row.category)
  const lbl = norm(row.category_label)
  if (cv === 'clinic' || cv === 'spa' || cv === 'makeup' || cv === 'skincare') return true
  if (cat === 'clinic' || cat === 'spa' || cat === 'makeup' || cat === 'skincare') return true
  if (['سبا ومساج', 'مكياج', 'عناية بالبشرة', 'عيادة تجميل', 'عيادات تجميل', 'عيادة جلدية', 'عيادة ليزر'].includes(lbl))
    return true
  return false
}

function cityMatches(row, targetCity) {
  const city = norm(row.city)
  const tc = norm(targetCity)
  if (!tc) return true
  if (city === tc) return true
  const lowCity = city.toLowerCase()
  const lowTc = tc.toLowerCase()
  return lowCity.includes(lowTc) || lowTc.includes(lowCity)
}

function sqlEsc(s) {
  return String(s).replace(/'/g, "''")
}

async function main() {
  loadDotEnv()

  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const targetCity = (process.env.AUDIT_CITY || 'الخبر').trim()
  const limit = Math.max(1, Number.parseInt(process.env.AUDIT_LIMIT || '120', 10) || 120)
  const writeSql = process.env.WRITE_SQL === '1' || process.env.WRITE_SQL === 'true'

  if (!url || !serviceKey) {
    console.error('Missing env: VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

  const pageSize = 1000
  let from = 0
  const all = []
  for (;;) {
    const { data, error } = await supabase
      .from('businesses')
      .select('id,name_ar,name_en,city,region,category,category_label,category_value,description_ar,is_active,is_demo')
      .eq('is_active', true)
      .eq('is_demo', false)
      .range(from, from + pageSize - 1)
    if (error) {
      console.error('[audit] fetch failed:', error.message)
      process.exit(1)
    }
    if (!data?.length) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  const cityRows = all.filter((r) => cityMatches(r, targetCity))
  const byCategoryValue = new Map()
  const byCategory = new Map()
  for (const r of cityRows) {
    const cv = toLower(r.category_value) || '(empty)'
    const cat = toLower(r.category) || '(empty)'
    byCategoryValue.set(cv, (byCategoryValue.get(cv) || 0) + 1)
    byCategory.set(cat, (byCategory.get(cat) || 0) + 1)
  }

  const candidates = cityRows.filter((r) => {
    if (isMaleOnly(r) || isGym(r)) return false
    if (isClinicSpaEtc(r)) return false
    const cv = toLower(r.category_value)
    if (cv === 'salon') return false
    const cat = toLower(r.category)
    const salonLikeCategory = cat === 'salon' || cat === 'beauty_salon' || cat === ''
    return salonLikeCategory || hasFemaleOrFamilySignal(r)
  })

  console.log('\n=== Salon Category Audit ===')
  console.log(`City target: ${targetCity}`)
  console.log(`Active rows in city: ${cityRows.length}`)
  console.log('\nBy category_value:')
  for (const [k, v] of [...byCategoryValue.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`- ${k}: ${v}`)
  }
  console.log('\nBy category:')
  for (const [k, v] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`- ${k}: ${v}`)
  }

  console.log(`\nSuggested "salon" candidates: ${candidates.length}`)
  const preview = candidates.slice(0, limit)
  if (preview.length > 0) {
    console.log('\nTop candidates:')
    for (const r of preview) {
      console.log(
        `- ${r.id} | ${r.name_ar || '(no-name)'} | city=${r.city || ''} | category=${r.category || ''} | category_value=${r.category_value || ''} | label=${r.category_label || ''}`
      )
    }
  }

  if (writeSql && candidates.length > 0) {
    const outDir = join(root, 'supabase', 'seed')
    mkdirSync(outDir, { recursive: true })
    const outPath = join(outDir, 'tmp_fix_salon_category_value.sql')
    const lines = []
    lines.push('-- Generated by scripts/audit-salon-categories.mjs')
    lines.push(`-- City: ${targetCity}`)
    lines.push(`-- Rows: ${candidates.length}`)
    lines.push('BEGIN;')
    for (const r of candidates) {
      lines.push(
        `UPDATE public.businesses SET category_value = 'salon' WHERE id = '${sqlEsc(r.id)}' AND COALESCE(category_value,'') <> 'salon';`
      )
    }
    lines.push('COMMIT;')
    lines.push('')
    writeFileSync(outPath, lines.join('\n'), 'utf8')
    console.log(`\nSQL patch file written: ${outPath}`)
  } else if (candidates.length > 0) {
    console.log('\nTip: set WRITE_SQL=1 to generate SQL patch file automatically.')
  }
}

main().catch((e) => {
  console.error('[audit] fatal:', e?.message || e)
  process.exit(1)
})

