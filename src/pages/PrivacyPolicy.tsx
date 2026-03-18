import { Link } from 'react-router-dom'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-dvh bg-rosera-light px-4 py-8 pb-28 dark:bg-rosera-dark">
      <div className="mx-auto max-w-lg">
        <Link to="/profile" className="mb-6 inline-flex items-center gap-1 text-primary font-semibold">
          ← العودة
        </Link>
        <h1 className="text-2xl font-extrabold text-foreground">سياسة الخصوصية</h1>
        <p className="mt-2 text-sm text-rosera-gray">آخر تحديث: 2025</p>
        <div className="mt-8 space-y-8 text-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-primary">جمع البيانات</h2>
            <p className="mt-2">
              نجمع البيانات التي تقدمينها عند التسجيل (رقم الجوال، الاسم، المدينة)، وبيانات الحجوزات والطلبات، وبيانات التصفح اللازمة لتشغيل التطبيق وتحسين تجربتكِ. لا نبيع بياناتكِ الشخصية لأطراف ثالثة.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-primary">استخدام البيانات</h2>
            <p className="mt-2">
              نستخدم البيانات لإدارة حسابكِ، تنفيذ الحجوزات والطلبات، إرسال التذكيرات والعروض (بموافقتكِ)، وتحسين خدماتنا. قد نستخدم بيانات مجمّعة لأغراض تحليلية دون تحديد هويتكِ.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-primary">مشاركة البيانات</h2>
            <p className="mt-2">
              قد نشارك بياناتكِ مع الصالونات التي تحجزين لديها (الاسم ورقم الجوال) لتأكيد الموعد. نتعامل مع مزودي بنية تحتية (مثل استضافة التطبيق) بمعايير حماية مناسبة. لا نشارك بياناتكِ لأغراض تسويقية لجهات أخرى دون موافقتكِ.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-primary">تخزين البيانات</h2>
            <p className="mt-2">
              نخزن بياناتكِ على خوادم آمنة. نحتفظ بالبيانات طوال فترة استخدامكِ للحساب، وبعد الحذف قد نحتفظ بنسخ لأغراض قانونية لفترة محدودة ثم نحذفها.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-primary">حقوق المستخدم</h2>
            <p className="mt-2">
              يمكنكِ في أي وقت طلب الوصول إلى بياناتكِ أو تصحيحها أو حذف حسابكِ من خلال الإعدادات. لديكِ الحق في الاعتراض على استخدام بياناتكِ لأغراض تسويقية أو سحب الموافقة. للاستفسارات: تواصلي معنا عبر التطبيق.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
