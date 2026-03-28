import { Link } from 'react-router-dom'

export default function Terms() {
  return (
    <div className="min-h-dvh bg-background px-4 py-8 pb-28">
      <div className="mx-auto max-w-lg">
        <Link to="/profile" className="mb-6 inline-flex items-center gap-1 font-semibold text-primary">
          ← العودة
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">الشروط والأحكام</h1>
        <p className="mt-2 text-sm text-rosera-gray">آخر تحديث: 2025</p>
        <div className="mt-8 space-y-8 text-foreground leading-relaxed">
          <section>
            <h2 className="border-s-4 border-accent ps-3 text-lg font-semibold text-foreground">شروط الاستخدام</h2>
            <p className="mt-2">
              باستخدام تطبيق روزيرا، فإنكِ توافقين على هذه الشروط. التطبيق مخصّص لربط المستخدمات بصالونات التجميل ومراكز الخدمات في المملكة. يُمنع استخدام التطبيق لأغراض غير قانونية أو مخالفة للآداب العامة. نحتفظ بحق تعليق أو إنهاء حساب أي مستخدم يخالف الشروط.
            </p>
          </section>
          <section>
            <h2 className="border-s-4 border-accent ps-3 text-lg font-semibold text-foreground">سياسة الحجز</h2>
            <p className="mt-2">
              الحجوزات عبر التطبيق تعتبر تأكيداً لرغبتكِ في الموعد. كل صالون يحدد سياسة الإلغاء أو التعديل (مثلاً إلغاء مجاني حتى 24 ساعة قبل الموعد). يرجى مراجعة سياسة الصالون قبل الحجز. روزيرا وسيط بينكِ وبين الصالون ولا تتحمل مسؤولية تنفيذ الخدمة داخل المنشأة.
            </p>
          </section>
          <section>
            <h2 className="border-s-4 border-accent ps-3 text-lg font-semibold text-foreground">الإلغاء والاسترداد</h2>
            <p className="mt-2">
              إلغاء الحجوزات يخضع لسياسة كل منشأة. في حال الدفع المسبق عبر التطبيق، يتم الاسترداد وفق نفس السياسة وفي المدة المتفق عليها. طلبات متجر الجمال قابلة للإرجاع وفق سياسة الإرجاع المعروضة في المتجر.
            </p>
          </section>
          <section>
            <h2 className="border-s-4 border-accent ps-3 text-lg font-semibold text-foreground">المسؤولية</h2>
            <p className="mt-2">
              روزيرا توفر منصة للاكتشاف والحجز ولا تتحمل مسؤولية جودة الخدمات المقدمة داخل الصالونات أو المنتجات المباعة من خلال المتجر من جهات خارجية. في حال نزاع مع منشأة، نشجّع التواصل المباشر مع المنشأة أولاً، ويمكنكِ أيضاً التواصل معنا لدعم الحل.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
