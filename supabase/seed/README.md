# Manual business seeds (non-migration)

Files here are **not** run automatically by `supabase db push`. Apply when you have vetted data.

## How to run

1. Open **Supabase Dashboard → SQL Editor** for your project.
2. Paste the contents of `manual_batch_02_eastern_businesses.sql` (or a future batch file).
3. Execute.

Or with CLI (service role / DB URL):

```bash
cd rosera
psql "$DATABASE_URL" -f supabase/seed/manual_batch_02_eastern_businesses.sql
```

## Conventions

- **ROSERA is women-only:** do not seed men’s barbershops (`صالونات حلاقة رجالية`) or other male-only venues in manual batches.
- `is_demo = false`, `source_type = 'manual'`, `is_active = true`
- `city_id` resolved via `SELECT id FROM sa_cities WHERE name_ar = '…'`
- After inserts, confirm pins and phones in Google Maps and adjust lat/lng if needed.
- If you **already ran** older batch files (`manual_batch_02` … `manual_batch_05`) that included male barbers, **clean the database**: run **`delete_manual_male_barbers.sql` once** in the SQL Editor. That removes rows tagged `صالونات حلاقة رجالية` (and related manual barber names) with `source_type = 'manual'`. Editing the seed SQL files does **not** remove rows already inserted in Supabase.

## Batches

| File                                      | Rows (approx.)        |
|-------------------------------------------|-----------------------|
| `manual_batch_02_eastern_businesses.sql` | 12                    |
| `manual_batch_03_eastern_businesses.sql` | 23 (+ optional cities) |
| `manual_batch_04_eastern_businesses.sql` | 19 (+ optional cities) |
| `manual_batch_05_eastern_businesses.sql` | 26 (+ optional سيهات) |
| **`manual_batch_06_women_only.sql`**     | **35 (نسائي فقط — الدفعة الرسمية)** |
| `manual_batch_06_eastern_businesses.sql` | deprecated — لا تشغّلها مع الملف أعلاه |
| **`manual_batch_07_women_only.sql`**     | **23 مدرَجة فريدة** — الجزء 1 من دفعة 7؛ المكررة مع 02–06 موثّقة كتعليق `SKIPPED` داخل الملف؛ أرسلي بقية الأسماء لإكمال ~100 |

عند إضافة دفعة 7 كاملة: راجعي تعليق **`SKIPPED_DUPLICATES`** في `manual_batch_07_women_only.sql` ثم ألحقي باقي الصفوف أو أنشئي `manual_batch_07b_….sql`.

Append new batches as `manual_batch_08_….sql` or extend a file with more `INSERT` tuples inside the same `VALUES` list.
