# إعداد المصادقة — روزيرا

## 1. تفعيل تسجيل الدخول بالإيميل (Email Auth)

1. افتحي **Supabase Dashboard** → مشروعك (ntboqussygvnbbqspwjq).
2. **Authentication** → **Providers** → **Email**.
3. تأكدي أن **Email** مفعّل (Enable Email provider).
4. لطلب **Confirmation Email** قبل الدخول:
   - فعّلي **Confirm email**.
   - (اختياري) عدّلي قالب البريد من **Email Templates** → **Confirm signup**.

5. في **URL Configuration** → **Redirect URLs** أضيفي (إن لم تكوني أضفتها):
   - `https://your-domain.com/auth/email` (وبدون نطاق للتطوير: `http://localhost:5173/auth/email`)

بعد ذلك صفحة `/auth/email` ستسمح بتسجيل الدخول وإنشاء حساب مع إرسال رسالة تحقق إن كان التأكيد مفعّلاً.

---

## 2. ربط Twilio لـ OTP الجوال

الـ Edge Function `send-otp` ترسل رمز التحقق عبر **Twilio API** (SMS).

### في Supabase

1. **Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**.
2. أضيفي الأسرار:
   - `TWILIO_ACCOUNT_SID` — من لوحة Twilio
   - `TWILIO_AUTH_TOKEN` — من لوحة Twilio
   - `TWILIO_FROM` أو `TWILIO_PHONE_NUMBER` — رقم Twilio المرسل (مثل +966xxxxxxxxx)

### (اختياري) Supabase Auth كـ SMS Provider

لو أردتِ استخدام مصادقة الجوال المدمجة في Supabase بدل الـ Edge Function:

1. **Authentication** → **Providers** → **Phone**.
2. فعّلي **Phone** واختي **Twilio** كـ SMS provider.
3. أدخلي نفس بيانات Twilio.

المشروع الحالي يعتمد على **Edge Function** `send-otp` + `verify-otp` مع جدول `otp_codes`؛ ربط Twilio في الـ Dashboard اختياري للاستخدامات الأخرى.
