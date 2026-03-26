/**
 * Generates supabase/migrations/064_seed_store_products_100.sql
 * Run: node scripts/generate-products-100-sql.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.join(__dirname, '../supabase/migrations/064_seed_store_products_100.sql')

const cats = [
  'عناية بالبشرة',
  'مكياج',
  'عناية بالشعر',
  'عطور',
  'أظافر',
  'أجهزة تجميل',
  'سبا',
  'عناية بالجسم',
]

/** Unsplash — beauty / cosmetics / wellness (valid CDN URLs) */
const IMAGES = [
  'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1541643600914-78b084683601?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1612817288484-6f916e8d0d7b?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1570172619640-dbf03a2adf2e?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1556229010-aa6e1e1f6e72?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1620916563495-1d4b8b9b0e0?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1596755105010-1e3a3e8e9e0?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1505944270255-72b8c68c6b12?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=600&q=80&auto=format&fit=crop',
]

const products = [
  // عناية بالبشرة — 13
  ['سيروم نياسيناميد 10%', 'Niacinamide 10% Serum', 'ذا أورديناري', 'The Ordinary', 'سيروم لتوحيد لون البشرة وتقليل اللمعان.', 'Serum for tone balance and oil control.', 'عناية بالبشرة', 89],
  ['سيروم حمض الهيالورونيك B5', 'Hyaluronic Acid B5 Serum', 'لاروش بوزيه', 'La Roche-Posay', 'مرطب عميق للبشرة الحساسة.', 'Deep hydration for sensitive skin.', 'عناية بالبشرة', 125],
  ['كريم سيرافيه المرطب', 'Moisturizing Cream', 'سيرافيه', 'CeraVe', 'كريم يومي بسيراميدز.', 'Daily cream with ceramides.', 'عناية بالبشرة', 72],
  ['تونر غليكوليك 7%', 'Glycolic Acid 7% Toning Solution', 'ذا أورديناري', 'The Ordinary', 'تقشير لطيف لإشراق البشرة.', 'Gentle exfoliation for radiance.', 'عناية بالبشرة', 55],
  ['واقي شمس أنثيليوس', 'Anthelios SPF50+', 'لاروش بوزيه', 'La Roche-Posay', 'حماية عالية ضد الأشعة.', 'High broad-spectrum UV protection.', 'عناية بالبشرة', 98],
  ['سيروم فيتامين سي', 'Vitamin C Brightening Serum', 'أولاي', 'Olay', 'لتفتيح البشرة وتوحيد اللون.', 'Brightening and even tone.', 'عناية بالبشرة', 110],
  ['مرطب جيلي للوجه', 'Water Gel Moisturizer', 'نيوتروجينا', 'Neutrogena', 'ترطيب خفيف غير دهني.', 'Lightweight oil-free hydration.', 'عناية بالبشرة', 65],
  ['ماسك الطين المغربي', 'Moroccan Clay Mask', 'فريمان', 'Freeman', 'تنظيف عميق للمسام.', 'Deep pore cleansing mask.', 'عناية بالبشرة', 42],
  ['سيروم ريتينول 0.5%', 'Retinol 0.5% Serum', 'ذا أورديناري', 'The Ordinary', 'للتجديد الليلي ومكافحة التجاعيد.', 'Night renewal and fine lines.', 'عناية بالبشرة', 78],
  ['كريم عيني بكافيين', 'Caffeine Eye Serum', 'ذا أورديناري', 'The Ordinary', 'لتقليل الانتفاخ والهالات.', 'Reduces puffiness and dark circles.', 'عناية بالبشرة', 48],
  ['منظف رغوي لطيف', 'Gentle Foaming Cleanser', 'سيرافيه', 'CeraVe', 'ينظف دون إزالة الترطيب.', 'Cleanses without stripping moisture.', 'عناية بالبشرة', 58],
  ['زيت تنظيف', 'Cleansing Oil', 'دي إتش سي', 'DHC', 'يزيل المكياج والشوائب.', 'Removes makeup and impurities.', 'عناية بالبشرة', 95],
  ['سيروم حمض الساليسيليك 2%', 'Salicylic Acid 2% Serum', 'ذا أورديناري', 'The Ordinary', 'لمسام أقل انسداداً.', 'Helps clear congested pores.', 'عناية بالبشرة', 52],
  // مكياج — 13
  ['فاونديشن برو لونغوير', 'Pro Longwear Foundation', 'إم إيه سي', 'MAC', 'تغطية كاملة ثبات طويل.', 'Full coverage long-wear.', 'مكياج', 185],
  ['كونسيلر راديانت', 'Radiant Creamy Concealer', 'نارس', 'NARS', 'تغطية طبيعية للهالات.', 'Natural under-eye coverage.', 'مكياج', 145],
  ['باليت ظلال عيون نيود', 'Nude Eyeshadow Palette', 'هودا بيوتي', 'Huda Beauty', 'ألوان عارية متعددة.', 'Versatile nude shades.', 'مكياج', 195],
  ['ماسكارا فولس لاش', 'False Lash Effect Mascara', 'مايبيلين', 'Maybelline', 'رموش أطول وأكثر كثافة.', 'Length and volume.', 'مكياج', 42],
  ['أحمر شفاه مات إنك', 'Superstay Matte Ink', 'مايبيلين', 'Maybelline', 'ثبات يصل لساعات.', 'Long-lasting liquid matte.', 'مكياج', 55],
  ['بلاشر سائل', 'Liquid Blush', 'رارب يوتي', 'Rare Beauty', 'لمسة طبيعية.', 'Natural flush finish.', 'مكياج', 88],
  ['بودرة شفافة', 'Translucent Setting Powder', 'لورا مرسييه', 'Laura Mercier', 'تثبيت المكياج بدون ثقل.', 'Sets makeup without cakiness.', 'مكياج', 165],
  ['برايمر وجه', 'Face Primer', 'سماشبوكس', 'Smashbox', 'يملأ الخطوط الدقيقة.', 'Smooths fine lines for base.', 'مكياج', 135],
  ['آيلاينر سائل أسود', 'Liquid Eyeliner', 'كات فون دي', 'KVD Beauty', 'خط دقيق ثابت.', 'Precise long-wear line.', 'مكياج', 95],
  ['برو حواجب', 'Brow Wiz', 'أناستازيا', 'Anastasia Beverly Hills', 'رسم حواجب طبيعي.', 'Natural brow definition.', 'مكياج', 115],
  ['هايلايتر بودرة', 'Powder Highlighter', 'بيكا', 'Becca', 'لمعة ناعمة.', 'Soft luminous glow.', 'مكياج', 128],
  ['إعداد رموش', 'Lash Primer', 'لانكوم', 'Lancôme', 'يقوي أثر الماسكارا.', 'Boosts mascara performance.', 'مكياج', 155],
  ['أحمر خدود كريمي', 'Cream Blush', 'فنتي بيوتي', 'Fenty Beauty', 'لمسة صحية.', 'Healthy skin-like flush.', 'مكياج', 98],
  // عناية بالشعر — 13
  ['شامبو بوند إنفورس', 'Bond Maintenance Shampoo', 'أولابلكس', 'Olaplex', 'للشعر المعالج كيميائياً.', 'For chemically treated hair.', 'عناية بالشعر', 145],
  ['ماسك الشعر الغني', 'Nutritive Hair Mask', 'كيراستاس', 'Kérastase', 'تغذية عميقة للجاف.', 'Deep nourishment for dry hair.', 'عناية بالشعر', 220],
  ['زيت أرغان', 'Moroccanoil Treatment', 'موروكان أويل', 'Moroccanoil', 'لمعان وحماية الأطراف.', 'Shine and split-end care.', 'عناية بالشعر', 175],
  ['شامبو خالٍ من الكبريتات', 'Sulfate-Free Shampoo', 'بانتين', 'Pantene', 'للشعر المصبوغ.', 'Gentle for color-treated hair.', 'عناية بالشعر', 38],
  ['بلسم الترميم الليلي', 'Night Repair Conditioner', 'هيربستاس', 'Herbal Essences', 'يسهل التسريح.', 'Detangling and softness.', 'عناية بالشعر', 32],
  ['سيروم حراري للشعر', 'Heat Protectant Serum', 'تريزيمي', 'TRESemmé', 'قبل استخدام السشوار.', 'Before heat styling.', 'عناية بالشعر', 45],
  ['بخاخ ملح بحري', 'Sea Salt Spray', 'باتيست', 'Batiste', 'لمسة شاطئية.', 'Beachy texture.', 'عناية بالشعر', 55],
  ['شامبو جاف', 'Dry Shampoo', 'كلاين', 'Klorane', 'ينعش بين الغسلات.', 'Refreshes between washes.', 'عناية بالشعر', 68],
  ['كريم تصفيف كيرلي', 'Curl Defining Cream', 'شيا مويستشر', 'Shea Moisture', 'يعرّف التموجات.', 'Defines curls without crunch.', 'عناية بالشعر', 62],
  ['زيت جوز الهند للشعر', 'Coconut Hair Oil', 'غارنييه', 'Garnier', 'ترطيب اقتصادي.', 'Affordable nourishment.', 'عناية بالشعر', 28],
  ['شامبو ضد القشرة', 'Anti-Dandruff Shampoo', 'هيد آند شولدرز', 'Head & Shoulders', 'يهدئ فروة الرأس.', 'Soothes flaky scalp.', 'عناية بالشعر', 42],
  ['مصل فروة الرأس', 'Scalp Serum', 'ذا أورديناري', 'The Ordinary', 'للتوازن والراحة.', 'Balancing scalp care.', 'عناية بالشعر', 58],
  ['فرشاة فك تشابك', 'Detangling Brush', 'تانجل تيزر', 'Tangle Teezer', 'تسريح لطيف.', 'Gentle detangling.', 'عناية بالشعر', 85],
  // عطور — 12
  ['ماء عطر كوكو', 'Coco Mademoiselle EDP', 'شانيل', 'Chanel', 'أنيق زهري خشبي.', 'Elegant floral woody.', 'عطور', 890],
  ['ليلة لندن', 'Midnight London EDP', 'بنك بيري', 'Burberry', 'دافئ شرقي.', 'Warm oriental notes.', 'عطور', 450],
  ['سوفاج', 'Sauvage EDT', 'ديور', 'Dior', 'حيوي ومنعش.', 'Fresh spicy signature.', 'عطور', 520],
  ['بلاك أوبيوم', 'Black Opium EDP', 'إيف سان لوران', 'YSL', 'قهوة وزهور.', 'Coffee and white florals.', 'عطور', 480],
  ['لا في إي بيل', 'La Vie Est Belle', 'لانكوم', 'Lancôme', 'حلو أنثوي.', 'Sweet gourmand floral.', 'عطور', 395],
  ['لايت بلو', 'Light Blue EDT', 'دولتشي آند غابانا', 'Dolce & Gabbana', 'متوسطي منعش.', 'Fresh Mediterranean.', 'عطور', 365],
  ['أكوا ديجيو', 'Acqua di Giò EDT', 'أرماني', 'Giorgio Armani', 'بحري رجالي كلاسيكي.', 'Classic aquatic masculine.', 'عطور', 410],
  ['جادور', 'J\'adore EDP', 'ديور', 'Dior', 'زهور بيضاء فاخرة.', 'Luxurious white florals.', 'عطور', 550],
  ['فلاور بومب', 'Flowerbomb EDP', 'فيكتور آند رولف', 'Viktor & Rolf', 'زهور حلوة.', 'Sweet explosive florals.', 'عطور', 425],
  ['ذا ون', 'The One EDP', 'دولتشي آند غابانا', 'Dolce & Gabbana', 'شرقي أنثوي.', 'Warm oriental feminine.', 'عطور', 340],
  ['عطر عود فاخر', 'Luxury Oud EDP', 'رصاصي', 'Rasasi', 'عود شرقي.', 'Rich Middle Eastern oud.', 'عطور', 280],
  ['ماء توليت منعش', 'Fresh Citrus EDT', 'زارا', 'Zara', 'حمضيات يومية.', 'Everyday citrus.', 'عطور', 95],
  // أظافر — 12
  ['طلاء جيل لون عاري', 'Gel Polish Nude', 'أوبي', 'OPI', 'لمعان يدوم.', 'Long-wear gel shine.', 'أظافر', 52],
  ['مجموعة أظافر صناعية', 'Press-On Nails Set', 'كيس', 'Kiss', 'تركيب سريع.', 'Quick at-home manicure.', 'أظافر', 38],
  ['مقوي أظافر', 'Nail Strengthener', 'إيسي', 'Essie', 'يقلل التكسر.', 'Reduces breakage.', 'أظافر', 45],
  ['مزيل طلاء لطيف', 'Gentle Polish Remover', 'سالي هانسن', 'Sally Hansen', 'بدون أسيتون قاسٍ.', 'Acetone-free option.', 'أظافر', 28],
  ['فرشاة طلاء احترافية', 'Pro Nail Brush Set', 'سيجما', 'Sigma Beauty', 'دقة الرسم.', 'Precision application.', 'أظافر', 75],
  ['طلاء مات', 'Matte Top Coat', 'سي إن دي', 'CND', 'إنهاء غير لامع.', 'Velvet matte finish.', 'أظافر', 62],
  ['زيت بشرة الأظافر', 'Cuticle Oil', 'بوتير لندن', 'Butter London', 'يرطب الجلد المحيط.', 'Softens cuticles.', 'أظافر', 35],
  ['مانيكير كهربائي', 'Electric Manicure Kit', 'ريمينغتون', 'Remington', 'تلميع وليم.', 'Buff and shape.', 'أظافر', 125],
  ['أدوات ترصيع', 'Nail Art Rhinestones', 'مودانيسا', 'Madam Glam', 'للزينة.', 'Decorative accents.', 'أظافر', 22],
  ['قاعدة طلاء', 'Base Coat', 'أورلي', 'Orly', 'يحمي اللون.', 'Protects natural nail.', 'أظافر', 48],
  ['مجفف طلاء سريع', 'Quick-Dry Drops', 'سالي هانسن', 'Sally Hansen', 'يقلل وقت الجفاف.', 'Speeds drying time.', 'أظافر', 32],
  ['أظافر جل ملونة', 'Colored Gel Extensions', 'جيليش', 'Gelish', 'صالون منزلي.', 'Salon-style extensions.', 'أظافر', 165],
  // أجهزة تجميل — 12
  ['مجفف شعر سوبرسونيك', 'Supersonic Hair Dryer', 'دايسون', 'Dyson', 'تحكم حراري ذكي.', 'Intelligent heat control.', 'أجهزة تجميل', 1899],
  ['فرشاة تصفيف هوائية', 'Airwrap Styler', 'دايسون', 'Dyson', 'تجعيد بدون حرارة مفرطة.', 'Styles with less heat damage.', 'أجهزة تجميل', 2099],
  ['جهاز تنظيف بالموجات', 'Luna Mini 3', 'فوريو', 'Foreo', 'تنظيف عميق للوجه.', 'Sonic facial cleansing.', 'أجهزة تجميل', 750],
  ['جهاز شد بالضوء الأحمر', 'LED Light Therapy Mask', 'أوبالا', 'CurrentBody', 'جلسات منزلية.', 'At-home LED sessions.', 'أجهزة تجميل', 1295],
  ['مكواة شعر سيراميك', 'Ceramic Flat Iron', 'غات إتش دي', 'ghd', 'حرارة ثابتة.', 'Consistent styling heat.', 'أجهزة تجميل', 895],
  ['ماكينة حلاقة نسائية', 'Women\'s Electric Shaver', 'براون', 'Braun', 'للجسم والوجه.', 'Body and facial use.', 'أجهزة تجميل', 245],
  ['جهاز إزالة الشعر بالليزر منزلي', 'IPL Hair Removal Device', 'فيليبس لوميا', 'Philips Lumea', 'جلسات متكررة.', 'IPL hair reduction.', 'أجهزة تجميل', 1499],
  ['فرشاة أسنان كهربائية', 'Electric Toothbrush DiamondClean', 'فيليبس سونيكير', 'Philips Sonicare', 'تنظيف عميق.', 'Deep clean smile.', 'أجهزة تجميل', 485],
  ['جهاز بخار للوجه', 'Facial Steamer', 'باناسونيك', 'Panasonic', 'يفتح المسام.', 'Opens pores pre-mask.', 'أجهزة تجميل', 195],
  ['مجفف أظافر LED', 'LED Nail Lamp', 'سان يوفي', 'SunUV', 'لطلاء الجيل.', 'Cures gel polish.', 'أجهزة تجميل', 135],
  ['جهاز تقشير كهربائي', 'Microdermabrasion Wand', 'بوبي براون تول', 'Personal Microderm', 'تقشير لطيف.', 'Gentle exfoliation.', 'أجهزة تجميل', 165],
  ['فرشاة تسريح حرارية', 'Hot Air Brush', 'ريمنجتون', 'Remington', 'تجفيف وتصفيف.', 'Dry and style in one.', 'أجهزة تجميل', 155],
  // سبا — 12
  ['ملح استحمام باللافندر', 'Lavender Bath Salts', 'دريم تايم', 'Dr Teal\'s', 'استرخاء بعد يوم طويل.', 'Relaxing soak.', 'سبا', 48],
  ['شمعة معطرة فانيليا', 'Vanilla Soy Candle', 'يانكي كاندل', 'Yankee Candle', 'أجواء دافئة.', 'Cozy ambiance.', 'سبا', 85],
  ['زيت تدليك باللوز', 'Sweet Almond Massage Oil', 'وايلد تيربس', 'Weleda', 'انزلاق ناعم.', 'Smooth glide for massage.', 'سبا', 72],
  ['قناع طين للجسم', 'Body Clay Mask', 'ذا بادي شوب', 'The Body Shop', 'تنظيف الجسم.', 'Purifying body treatment.', 'سبا', 95],
  ['فرشاة جافة للجسم', 'Dry Body Brush', 'كيكو', 'Cactus', 'تحفيز الدورة.', 'Lymphatic brushing.', 'سبا', 42],
  ['رغوة استحمام فاخرة', 'Luxury Shower Foam', 'ريتuals', 'Rituals', 'ترطيب أثناء الاستحمام.', 'Rich lather hydration.', 'سبا', 68],
  ['كرة استحمام فوارة', 'Bath Bomb Set', 'لش', 'Lush', 'ألوان وروائح.', 'Aromatherapy fizz.', 'سبا', 55],
  ['قفاز تقشير', 'Exfoliating Mitt', 'موروكان أويل', 'Moroccanoil', 'بشرة ناعمة.', 'Smooth skin prep.', 'سبا', 38],
  ['زيت عطري للحمام', 'Bath Oil Rose', 'نيوتروجينا', 'Neutrogena', 'ترطيب الماء.', 'Softens bath water.', 'سبا', 58],
  ['بخور ومعطر غرفة', 'Incense & Room Mist', 'دي إس أند دي', 'Diptyque', 'فاخر للمنزل.', 'Luxury home scent.', 'سبا', 320],
  ['وسادة تدفئة', 'Heating Pad Spa', 'سانوسا', 'Sunbeam', 'راحة العضلات.', 'Muscle relief.', 'سبا', 125],
  ['مجموعة عناية يدين سبا', 'Spa Hand Care Kit', 'لوريال باريس', 'L\'Oréal Paris', 'ترطيب وتقشير.', 'Hydrate and exfoliate hands.', 'سبا', 78],
  // عناية بالجسم — 13
  ['لوشن جسم بالشيا', 'Shea Body Lotion', 'ذا بادي شوب', 'The Body Shop', 'ترطيب يومي.', 'Daily body hydration.', 'عناية بالجسم', 62],
  ['زبدة جسم', 'Body Butter Cocoa', 'فيكتوريا سيكريت', 'Victoria\'s Secret', 'غنية وعطرة.', 'Rich scented moisture.', 'عناية بالجسم', 88],
  ['مقشر سكر للجسم', 'Sugar Body Scrub', 'فريمان', 'Freeman', 'نعومة فورية.', 'Instant smoothness.', 'عناية بالجسم', 35],
  ['مزيل عرق 48 ساعة', '48h Antiperspirant', 'دوف', 'Dove', 'حماية ولطف.', 'Care and protection.', 'عناية بالجسم', 22],
  ['كريم أقدام', 'Intensive Foot Cream', 'شول', 'Scholl', 'للتشققات.', 'For cracked heels.', 'عناية بالجسم', 45],
  ['زيت جسم جاف', 'Dry Body Oil', 'نيفيا', 'Nivea', 'امتصاص سريع.', 'Fast-absorbing sheen.', 'عناية بالجسم', 38],
  ['صابون غلسيرين', 'Glycerin Soap Bar', 'دوف', 'Dove', 'لطيف للبشرة.', 'Mild cleansing.', 'عناية بالجسم', 18],
  ['مزيل شعر كريم', 'Hair Removal Cream', 'فيت', 'Veet', 'للبشرة الحساسة.', 'For sensitive skin.', 'عناية بالجسم', 32],
  ['واقي شمس للجسم SPF30', 'Body Sunscreen SPF30', 'لاروش بوزيه', 'La Roche-Posay', 'حماية واسعة.', 'Broad-spectrum body SPF.', 'عناية بالجسم', 108],
  ['مزيل مكياج الجسم', 'Body Makeup Remover', 'سينت إيف', 'Saint Ives', 'بعد الفعاليات.', 'After events cleanup.', 'عناية بالجسم', 28],
  ['كريم يدين مركز', 'Intensive Hand Cream', 'لوريال', 'L\'Oréal', 'للجفاف الشديد.', 'Severe dry hands.', 'عناية بالجسم', 24],
  ['زيت دوش مرطب', 'Moisturizing Shower Oil', 'أفين', 'Avène', 'للبشرة الجافة جداً.', 'Very dry skin shower.', 'عناية بالجسم', 92],
  ['بودرة جسم', 'Silky Body Powder', 'جونسون', 'Johnson\'s', 'انتعاش بعد الاستحمام.', 'Fresh after bath.', 'عناية بالجسم', 15],
]

function esc(s) {
  return String(s).replace(/'/g, "''")
}

function rating(i) {
  const x = 3.5 + ((i * 17) % 16) / 10
  return Math.min(5.0, Math.round(x * 10) / 10)
}

function reviews(i) {
  return 10 + ((i * 73) % 491)
}

let sql = `-- Seed 100 beauty products (bilingual + Store categories)
-- Run after migrations apply. Safe to re-run only if you truncate first.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS brand_en TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

INSERT INTO public.products (
  name_ar,
  name_en,
  brand_ar,
  brand_en,
  description_ar,
  description_en,
  category,
  image_url,
  price,
  rating,
  review_count,
  is_demo,
  is_active,
  source_type
) VALUES
`

const rows = products.map((p, i) => {
  const [nameAr, nameEn, brandAr, brandEn, descAr, descEn, cat, basePrice] = p
  const img = IMAGES[i % IMAGES.length]
  const r = rating(i)
  const rc = reviews(i)
  return `(
  '${esc(nameAr)}',
  '${esc(nameEn)}',
  '${esc(brandAr)}',
  '${esc(brandEn)}',
  '${esc(descAr)}',
  '${esc(descEn)}',
  '${esc(cat)}',
  '${esc(img)}',
  ${Number(basePrice).toFixed(2)},
  ${r.toFixed(1)},
  ${rc},
  false,
  true,
  'manual'
)`
})

sql += rows.join(',\n') + ';\n'

fs.writeFileSync(outPath, sql, 'utf8')
console.log('Wrote', outPath, rows.length, 'products')
