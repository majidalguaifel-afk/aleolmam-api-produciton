/* دليل الربط — يُعطى للعميل (مثل شركة أوتو) ليربط نظامه بنظام الإلمام بدون الحاجة لخبير */
(function () {
  'use strict';
  const { esc, STATUS } = ALM;

  const payload = {
    carrierCode: 'internal',
    senderName: 'متجر المثال',
    senderPhone: '0512345678',
    senderAddress: 'حي النرجس، شارع الأمير سلطان',
    senderCity: 'الرياض',
    recipientName: 'أحمد العتيبي',
    recipientPhone: '0567891234',
    recipientAddress: 'حي الملقا، شارع أنس بن مالك',
    recipientCity: 'الرياض',
    weightKg: 2.5,
    packageDesc: 'طلب رقم 1001',
    codAmount: 150,
  };
  const json = JSON.stringify(payload, null, 2);
  const jsonInline = (indent) => JSON.stringify(payload, null, 2).split('\n').join('\n' + indent);

  function samples(base, key) {
    return {
      curl:
`curl -X POST "${base}/api/v1/shipments" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${key}" \\
  -d '${json}'`,
      js:
`const res = await fetch("${base}/api/v1/shipments", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "${key}"
  },
  body: JSON.stringify(${jsonInline('  ')})
});
const data = await res.json();
console.log(data.data.reference); // رقم الشحنة عندنا`,
      php:
`<?php
$ch = curl_init("${base}/api/v1/shipments");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    "Content-Type: application/json",
    "X-API-Key: ${key}"
  ],
  CURLOPT_POSTFIELDS => <<<'JSON'
${json}
JSON
]);
$response = json_decode(curl_exec($ch), true);
echo $response["data"]["reference"]; // رقم الشحنة عندنا`,
      python:
`import requests

res = requests.post(
    "${base}/api/v1/shipments",
    headers={"X-API-Key": "${key}"},
    json=${json.split('\n').join('\n    ')}
)
print(res.json()["data"]["reference"])  # رقم الشحنة عندنا`,
    };
  }

  const LANGS = [['curl', 'cURL'], ['js', 'JavaScript'], ['php', 'PHP'], ['python', 'Python']];

  function statusTable() {
    return `<table><thead><tr><th>الرمز (يصلك في الـ API)</th><th>المعنى</th></tr></thead><tbody>${Object.keys(STATUS)
      .map((k) => `<tr><td class="mono">${k}</td><td>${esc(STATUS[k].ar)}</td></tr>`)
      .join('')}</tbody></table>`;
  }

  const webhookSample = `{
  "event": "shipment.status_changed",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "data": {
    "shipmentId": "shp_xxxxxxxx",
    "reference": "ALM-7F3K9QX2",
    "previousStatus": "CREATED",
    "newStatus": "PICKED_UP"
  }
}`;

  const verifySample = (secret) => `// Node.js — للتحقق أن الإشعار فعلاً من الإلمام
const crypto = require("crypto");
const expected = crypto
  .createHmac("sha256", "${secret}")
  .update(rawBody)            // نص الطلب كما وصل بدون أي تعديل
  .digest("hex");
if (expected !== req.headers["x-alelmam-signature"]) {
  // ارفض الطلب — ليس من الإلمام
}`;

  /**
   * @param {string} base  رابط الخادم
   * @param {string} key   مفتاح API (أو نص بديل)
   * @param {object} opts  { clientName, forPrint }
   */
  ALM.guide = {
    html(base, key, opts) {
      const { clientName, forPrint } = opts || {};
      const sm = samples(base, key);
      const codeBlocks = forPrint
        ? LANGS.map(([k, label]) => `<h3>${label}</h3><pre class="code">${esc(sm[k])}</pre>`).join('')
        : `<div class="tabs">${LANGS.map(([k, l], i) => `<button type="button" class="${i === 0 ? 'active' : ''}" data-action="guide-tab" data-lang="${k}">${l}</button>`).join('')}</div>` +
          LANGS.map(([k], i) => `<div data-guide-panel="${k}" class="${i === 0 ? '' : 'hidden'}"><div class="row" style="margin-bottom:4px"><button type="button" class="btn ghost sm" data-action="copy-guide" data-lang="${k}">نسخ الكود</button></div><pre class="code" data-code="${k}">${esc(sm[k])}</pre></div>`).join('');

      return `<div class="guide">
        ${forPrint ? `<h1>دليل الربط مع نظام الإلمام للخدمات اللوجستية${clientName ? ' — ' + esc(clientName) : ''}</h1>` : ''}
        <div class="hint">الفكرة ببساطة: نظامك يرسل لنا طلب توصيل عبر رابط خاص (API)، ونحن نوصّله بمناديبنا ونبلغك بكل تحديث. الخطوات أدناه جاهزة للنسخ — سلّمها لمبرمج نظامكم وتخلص في دقائق.</div>

        <h2>1) بيانات الدخول</h2>
        <table><tbody>
          <tr><td style="width:150px">رابط الخادم</td><td class="mono">${esc(base)}</td></tr>
          <tr><td>مفتاح الربط (API Key)</td><td class="mono">${esc(key)}</td></tr>
          <tr><td>طريقة الإرسال</td><td>أضف الترويسة <span class="mono">X-API-Key</span> بقيمة المفتاح في كل طلب</td></tr>
        </tbody></table>
        <p class="muted">⚠️ المفتاح سري كأنه كلمة مرور — لا تضعه في تطبيق جوال أو موقع يراه الزوار، بل في خادم نظامكم فقط.</p>

        <h2>2) إرسال طلب توصيل جديد</h2>
        <p>أرسل الطلب التالي (POST). قيمة <span class="mono">carrierCode</span>: <span class="mono">internal</span> تعني "وصّلوها بمناديبكم".</p>
        ${codeBlocks}
        <p>الرد الناجح يحتوي رقم الشحنة (<span class="mono">reference</span>) — احفظه في نظامك لمتابعة الشحنة.</p>

        <h2>3) متابعة الشحنة</h2>
        <pre class="code">GET  ${esc(base)}/api/v1/shipments/{id}            ← بيانات الشحنة وحالتها
GET  ${esc(base)}/api/v1/shipments/{id}/tracking   ← سجل التتبع الكامل
GET  ${esc(base)}/api/v1/shipments?status=DELIVERED ← قائمة شحناتك
POST ${esc(base)}/api/v1/shipments/{id}/cancel     ← إلغاء الشحنة (قبل التسليم)</pre>

        <h2>4) الإشعارات الفورية (اختياري وموصى به)</h2>
        <p>بدل ما نظامك يسأل كل دقيقة "وين وصلت الشحنة؟"، سجّل رابطاً عندك وسنرسل لك إشعاراً لحظة تغيّر الحالة:</p>
        <pre class="code">POST ${esc(base)}/api/v1/webhooks
{ "url": "https://نظامكم.com/webhooks/alelmam", "events": ["shipment.status_changed"] }</pre>
        <p>سيصلك على الرابط طلب POST بهذا الشكل:</p>
        <pre class="code">${esc(webhookSample)}</pre>
        <p>عند التسجيل ستستلم <span class="mono">secret</span> — استخدمه للتأكد أن الإشعار حقيقي:</p>
        <pre class="code">${esc(verifySample('السر_الذي_استلمته'))}</pre>

        <h2>5) معاني حالات الشحنة</h2>
        ${statusTable()}

        <h2>6) الأخطاء الشائعة</h2>
        <table><tbody>
          <tr><td class="mono">401 MISSING_API_KEY / INVALID_API_KEY</td><td>المفتاح غير موجود أو خاطئ</td></tr>
          <tr><td class="mono">403 CLIENT_SUSPENDED</td><td>الحساب موقوف — تواصل مع الإلمام</td></tr>
          <tr><td class="mono">422 VALIDATION_ERROR</td><td>بيانات ناقصة أو خاطئة (مثلاً رقم جوال غير سعودي) — الرسالة توضح الحقل</td></tr>
          <tr><td class="mono">429 RATE_LIMITED</td><td>تجاوزت عدد الطلبات المسموح بالدقيقة — انتظر قليلاً</td></tr>
          <tr><td class="mono">404 SHIPMENT_NOT_FOUND</td><td>رقم الشحنة غير صحيح</td></tr>
        </tbody></table>

        <h2>7) توثيق تقني كامل</h2>
        <p>للمبرمجين: <a href="${esc(base)}/api-docs" target="_blank" rel="noopener">${esc(base)}/api-docs</a> (تقدر تجرّب الطلبات مباشرة من الصفحة).</p>
      </div>`;
    },
    samples,
  };
})();
