-- Idempotent seed: core Saudi regions + example cities.
-- App tables are public.sa_regions / public.sa_cities (see 003_sa_regions_rebuild.sql).
-- Aligns with 004_seed_sa_full.sql UUIDs so no duplicate PKs.
-- Safe to re-run: ON CONFLICT DO NOTHING.

BEGIN;

INSERT INTO public.sa_regions (id, name_ar, capital_ar, image_url, sort_order) VALUES
  ('ea1d1ff8-dd96-497b-949e-02d51a55e97c', 'المنطقة الشرقية', 'الدمام', 'https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=800&q=80', 5),
  ('cfd89161-494b-4eb3-b979-44efe5abd39f', 'منطقة الرياض', 'الرياض', 'https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?w=800&q=80', 1),
  ('69f9b578-0a3b-4f08-b430-f2346a52686e', 'منطقة مكة المكرمة', 'مكة المكرمة', 'https://images.unsplash.com/photo-1591604129939-f1efa4f3d7d1?w=800&q=80', 2),
  ('ad1f4715-5504-405d-a65e-c100826490fd', 'منطقة المدينة المنورة', 'المدينة المنورة', 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80', 3)
ON CONFLICT (id) DO NOTHING;

-- Example cities: الدمام، الخبر (الشرقية) | الرياض | جدة
INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude) VALUES
  ('bdddbe45-81c5-4674-91b9-f4b7541801a5', 'ea1d1ff8-dd96-497b-949e-02d51a55e97c', 'الدمام', 26.41751818181818, 50.05425454545455),
  ('b4c8185e-557d-4a83-b9bd-3f210cb200a5', 'ea1d1ff8-dd96-497b-949e-02d51a55e97c', 'الخبر', 26.3807, 50.07243636363636),
  ('9bf42721-11fe-4061-a793-c0e59ed93acc', 'cfd89161-494b-4eb3-b979-44efe5abd39f', 'الرياض', 24.732236363636364, 46.66575454545455),
  ('5469270a-9636-44c0-91ff-a068543c1989', '69f9b578-0a3b-4f08-b430-f2346a52686e', 'جدة', 21.356827272727273, 39.86199090909091)
ON CONFLICT (id) DO NOTHING;

COMMIT;
