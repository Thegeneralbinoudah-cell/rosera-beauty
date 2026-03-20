-- السماح لـ owner, admin, supervisor بقراءة كل صفوف admins (لصفحة الفريق)
CREATE POLICY "admins_select_admin_team" ON public.admins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin', 'supervisor')
    )
  );

-- السماح لـ owner و admin بإضافة أعضاء الفريق
CREATE POLICY "admins_insert_admin_owner" ON public.admins FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin')
    )
  );

-- السماح لـ owner و admin بتحديث (مثلاً تغيير role العضو)
CREATE POLICY "admins_update_admin_owner" ON public.admins FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin')
    )
  );

-- حذف عضو الفريق: owner فقط
CREATE POLICY "admins_delete_owner_only" ON public.admins FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'owner'
    )
  );
