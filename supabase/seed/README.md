# Manual business seeds (non-migration)

Files here are **not** run automatically by `supabase db push`. Apply when you have vetted data.

## Regions / cities missing (error loading المناطق)

If **`sa_regions` / `sa_cities`** are empty or the Home screen shows a regions error:

1. From the repo root (`rosera/`), apply migrations: `supabase db push` (includes **`031_eastern_sa_regions_cities.sql`** — idempotent Eastern Province + cities: Dammam, Khobar, Dhahran, Ahsa, Qatif, Jubail, etc.).
2. Or run **`supabase/migrations/031_eastern_sa_regions_cities.sql`** manually in **Supabase → SQL Editor**.

## Eastern Province — 50 businesses (Al Khobar + Dammam)

**File:** `manual_eastern_50_khobar_dammam.sql` (25 الخبر + 25 الدمام), coordinates ~**26.2°N, 50.1°E**, tag `[RoseraEastern50:v1]`.

1. Requires **`028_businesses_source_verified.sql`** (or any migration that allows `source_type = 'verified'`).
2. Requires **`sa_cities`** rows for **الخبر** and **الدمام** (included in normal migrations).
3. **Regenerate SQL from repo:** `npm run seed:eastern50` (writes the same path).
4. **Apply:** Supabase **SQL Editor** → paste file contents → Run — or `psql "$DATABASE_URL" -f supabase/seed/manual_eastern_50_khobar_dammam.sql` from `rosera/`.

Names and phones are **synthetic / QA-style** for maps and UI testing; verify before production marketing.

## Full reset + master seed (QA / curated demo)

1. Apply migration **`028_businesses_source_verified.sql`** (`supabase db push` or SQL Editor) so `source_type = 'verified'` is allowed.
2. **⚠️ Destructive:** run `truncate_businesses_reset.sql` — wipes `businesses` and dependent rows (bookings, reviews, services, …).
3. Run **`master_seed.sql`** (500 rows: Riyadh, Jeddah, Dammam, Khobar, Dhahran, Qatif).  
   Regenerate from repo: `npm run seed:master` (writes `supabase/seed/master_seed.sql`).

Coordinates and phones are **for staging / QA**; replace with field-verified data before production.

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
| **`manual_batch_08_women_only.sql`**     | **20 مدرَجة فريدة** — قائمة المُرسل كانت ~32 سطراً (ليس 80)؛ الباقي مُستبعد كـ `SKIPPED_DUPLICATES` مقابل 02–07؛ يتضمّن إدراجاً idempotent لـ `سلوى` و`البطحاء` و`قرية العليا` و`رأس تنورة` في `sa_cities` إن لزم |
| **`manual_batch_09_women_only.sql`**     | **4 مدرَجة فريدة** — الرسالة ~26 سطراً وليست 80؛ الباقي مكرر مع 02–08 (انظر `SKIPPED_DUPLICATES` في الملف) |
| **`manual_batch_10_women_only.sql`**    | **9 مدرَجة فريدة** — القائمة ~32 سطراً؛ استبعاد بناءً على الهاتف + تكرار العلامة التجارية مقابل 02–09 (راجع `SKIPPED_DUPLICATES`) |
| **`manual_batch_11_women_only.sql`**     | **10 مدرَجة فريدة** — القائمة ~45 سطراً (ليس 100)؛ استبعاد vs 02–10 (هاتف، رقم وطني، مجمع بنفس السلسلة، علامات تالين/لافندر/لوزان/ندى… — راجع `SKIPPED_DUPLICATES`)؛ تنويع `category_label` لعشر تسميات عربية |
| **`manual_batch_13_riyadh_women_only.sql`** | **8** — شمال/وسط الرياض؛ **راجعي الأرقام على الخرائط** |
| **`manual_batch_14_riyadh_women_only.sql`** | **8** — غرب/شمال غرب الرياض؛ **راجعي الأرقام على الخرائط** |
| **`run_riyadh_batches_13_14_combined.sql`** | **16 صفاً في معاملة واحدة** — للنسخ كاملاً إلى **SQL Editor** (لا يشغَّل تلقائياً مع `db push`) |
| **`manual_batch_15_riyadh_women_only.sql`** | **4 مدرَجة** — شرق الرياض؛ القائمة المُرسل كانت ~17 سطراً (ليس 60)؛ الباقي مكرر/علامات تجارية مقابل 02–11 و13–14 |
| **`manual_batch_17_women_only.sql`** | **100 صفاً** — بيانات **placeholder** (أسماء عامة + أرقام 055170xxxx + إحداثيات مجرّفة حول المدن)؛ **9** `category_label` عربية بالتناوب؛ شغّلي في SQL Editor ثم استبدلي ببيانات حقيقية من الخرائط |
| **`manual_batch_18_women_only.sql`** | **100 صفاً** — 30 مدن «صفر/منخفض» + 35 شمال الرياض (ملقى/ياسمين/صحافة/عارض) + 35 دمام/خبر/جبيل/قطيف؛ هواتف **0551800001–0551800100** |
| **`manual_batch_19_final_expansion.sql`** | **150 صفاً** — حفر/خفجي (50) + جنوب/غرب الرياض الشفا/السويدي/نمار (50) + ضواحي أحساء/هفوف (30) + الغاط/ثادق/حريملاء (20)؛ **0551900001–0551900150** |
| **`truncate_businesses_reset.sql`** | **TRUNCATE CASCADE** — يفرّغ `businesses` وكل الجداول المرتبطة؛ للتطوير/إعادة البذرة فقط |
| **`master_seed.sql`** | **500 صفاً** — `is_demo=false`, `source_type=verified`, صور `placehold.co` متنوعة؛ يتطلب `028` + وجود المدن الست في `sa_cities` |
| **`manual_batch_21_eastern_low_coverage.sql`** | **100 صفاً** — 25×4: النعيرية، قرية العليا، الخفجي، حفر الباطن — لتقليل مدن «صفر»؛ أعد توليده: `npm run seed:batch21` |

عند إضافة دفعة 7 كاملة: راجعي تعليق **`SKIPPED_DUPLICATES`** في `manual_batch_07_women_only.sql` ثم ألحقي باقي الصفوف أو أنشئي `manual_batch_07b_….sql`.

Append new batches as `manual_batch_11_….sql` or extend a file with more `INSERT` tuples inside the same `VALUES` list.
