const logger = require('../config/logger');

/**
 * إرسال إيميل عبر Resend (خدمة مجانية حتى 3000 إيميل/شهر — https://resend.com).
 * يحتاج RESEND_API_KEY و EMAIL_FROM بملف .env.
 * لو ما فيه مفتاح مُعرَّف (بيئة تطوير محلية مثلاً)، يطبع الكود بالسجل بدل الإرسال الفعلي —
 * هذا يسمح للتطوير والاختبار المحلي بدون حساب Resend حقيقي.
 */
async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'الإلمام <onboarding@resend.dev>';

  if (!apiKey) {
    logger.warn(`⚠️ RESEND_API_KEY غير مُعرَّف — لن يُرسَل إيميل فعلي. (وضع تطوير)`);
    logger.warn(`📧 [محاكاة إرسال] إلى: ${to} | الموضوع: ${subject}`);
    return { simulated: true };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    logger.error(`فشل إرسال الإيميل عبر Resend: ${res.status} ${body}`);
    throw new Error('تعذّر إرسال إيميل التحقق، حاول مرة أخرى بعد قليل');
  }
  return res.json();
}

function verificationEmailHtml(code) {
  return `<div dir="rtl" style="font-family:sans-serif; max-width:420px; margin:0 auto; padding:24px; background:#f7f6f3">
    <h2 style="color:#0f2540">رمز التحقق الخاص بك</h2>
    <p style="color:#5a6478">أدخل هذا الرمز بتطبيق الإلمام لتأكيد حسابك:</p>
    <div style="background:#fff; border:1px solid #e2e0d8; border-radius:12px; padding:20px; text-align:center; font-size:32px; font-weight:700; letter-spacing:8px; color:#0f2540; direction:ltr">${code}</div>
    <p style="color:#5a6478; font-size:13px; margin-top:16px">الرمز صالح لمدة 10 دقائق. لو ما طلبت هذا الرمز، تجاهل هذا الإيميل.</p>
  </div>`;
}

module.exports = { sendEmail, verificationEmailHtml };
