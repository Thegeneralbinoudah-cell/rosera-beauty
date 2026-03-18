-- حذف الحساب: السماح للمستخدم بحذف ملفه
CREATE POLICY "p_profiles_delete" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- متجر الجمال: منتجات، طلبات، تفاصيل الطلب
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  brand_ar TEXT,
  description_ar TEXT,
  category TEXT NOT NULL,
  image_url TEXT,
  price DECIMAL(10,2) NOT NULL,
  rating DECIMAL(2,1) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delivery_address TEXT,
  payment_method TEXT DEFAULT 'mada',
  status TEXT DEFAULT 'pending',
  total DECIMAL(10,2) NOT NULL,
  shipping DECIMAL(10,2) DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name_ar TEXT NOT NULL,
  product_image_url TEXT,
  price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "p_products_select" ON public.products FOR SELECT USING (is_active = true);
CREATE POLICY "p_orders_all" ON public.orders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "p_order_items_select" ON public.order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
);
CREATE POLICY "p_order_items_insert" ON public.order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
);

-- عينة منتجات للمتجر
INSERT INTO public.products (id, name_ar, brand_ar, description_ar, category, image_url, price, rating, review_count) VALUES
(gen_random_uuid(), 'سيروم فيتامين سي', 'لوريال', 'سيروم عناية بالبشرة غني بفيتامين سي لتوحيد اللون وإشراق البشرة.', 'عناية بالبشرة', 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400', 89.00, 4.5, 120),
(gen_random_uuid(), 'أحمر شفاه مات', 'ماك', 'أحمر شفاه بتشطيرة ماتية طويلة الثبات بألوان متنوعة.', 'مكياج', 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=400', 95.00, 4.8, 89),
(gen_random_uuid(), 'شامبو مغذٍ للشعر', 'كيراستاس', 'شامبو خالٍ من الكبريتات مغذٍ للشعر التالف.', 'عناية بالشعر', 'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=400', 65.00, 4.3, 200),
(gen_random_uuid(), 'عطر ورد', 'شانيل', 'عطر نسائي برائحة الورد والياسمين.', 'عطور', 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=400', 320.00, 4.9, 45),
(gen_random_uuid(), 'طلاء أظافر جيل', 'أوبي', 'طلاء أظافر بتشطيرة جيل لامعة طويلة الثبات.', 'أظافر', 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400', 42.00, 4.4, 156),
(gen_random_uuid(), 'كريم مرطب ليلي', 'سيرافيتم', 'كريم ليلي غني يرطب البشرة ويجددها أثناء النوم.', 'عناية بالبشرة', 'https://images.unsplash.com/photo-1556229010-aa6e1e1f6e72?w=400', 78.00, 4.6, 98),
(gen_random_uuid(), 'كونسيلر سائل', 'مايبلين', 'كونسيلر خفيف لتغطية الهالات والبقع.', 'مكياج', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400', 55.00, 4.2, 167),
(gen_random_uuid(), 'زيت شعر أرغان', 'موروكانويل', 'زيت أرغان لعناية أطراف الشعر والتلميع.', 'عناية بالشعر', 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400', 72.00, 4.7, 134);
