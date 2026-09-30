# دليل نشر نظام API — شركة الإلمام للخدمات اللوجستية

هذا الدليل يفترض إنك ما جربت VPS من قبل، فراح نمشي خطوة بخطوة من الصفر لين ما يصير
`api.alelmam.com` شغّال بشهادة أمان (HTTPS) كاملة.

---

## 1) اختيار واستئجار الـ VPS

اختر أي مزوّد VPS (كلهم يشتغلون بنفس الطريقة تقريباً):
- **Hetzner** (رخيص جداً وممتاز، يبدأ من ~5 دولار شهرياً)
- **DigitalOcean** (سهل جداً للمبتدئين)
- **AWS Lightsail** / **Linode**

**المواصفات الكافية للبداية:** 1-2 vCPU، 2GB RAM، Ubuntu 24.04 LTS.

بعد إنشاء السيرفر، بيعطيك المزوّد **عنوان IP** (مثال: `164.90.123.45`) — هذا هو
الرقم اللي بتحتاجه لاحقاً في إعدادات DNS.

---

## 2) الاتصال بالسيرفر أول مرة

من جهازك (Mac)، افتح تطبيق **Terminal** واكتب:

```bash
ssh root@YOUR_SERVER_IP
```

(استبدل `YOUR_SERVER_IP` برقم الـ IP الفعلي). بيطلب منك كلمة مرور أول مرة (يعطيك
إياها المزوّد بالإيميل).

---

## 3) الإعداد الأساسي للسيرفر (مرة واحدة فقط)

انسخ هذي الأوامر والصقها بالترتيب:

```bash
# تحديث النظام
apt update && apt upgrade -y

# تثبيت Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# تثبيت PostgreSQL
apt install -y postgresql postgresql-contrib

# تثبيت Redis
apt install -y redis-server

# تثبيت Nginx
apt install -y nginx

# تثبيت PM2 (يدير تشغيل السيرفر بشكل دائم)
npm install -g pm2

# تثبيت Certbot (شهادات SSL المجانية)
apt install -y certbot python3-certbot-nginx

# جدار حماية أساسي
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

---

## 4) إعداد قاعدة البيانات

```bash
sudo -u postgres psql -c "CREATE USER alelmam WITH PASSWORD 'اكتب_كلمة_مرور_قوية_هنا';"
sudo -u postgres psql -c "CREATE DATABASE alelmam_api OWNER alelmam;"
```

⚠️ **غيّر كلمة المرور** لشي قوي وخاص فيك، واحتفظ فيها — بتحتاجها بالخطوة الجاية.

---

## 5) رفع كود المشروع للسيرفر

من جهازك، بمجلد المشروع (بعد ما تفك ضغط الملف اللي أعطيتك إياه):

```bash
# من جهاز الماك (Terminal) — يرفع المشروع كامل للسيرفر
scp -r alelmam-api root@YOUR_SERVER_IP:/root/
```

بعدها ارجع لجلسة SSH على السيرفر:

```bash
cd /root/alelmam-api
npm install --production
```

---

## 6) إعداد متغيرات البيئة (.env)

```bash
cp .env.example .env
nano .env
```

عبّي القيم التالية على الأقل:

```
DATABASE_URL="postgresql://alelmam:كلمة_المرور_اللي_حطيتها@localhost:5432/alelmam_api?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="اكتب نص عشوائي طويل جداً وغريب هنا — مثال: openssl rand -hex 32"
NODE_ENV=production
PORT=4000
CORS_ORIGINS="https://www.alelmam.com,https://alelmam.com"
```

لتوليد `JWT_SECRET` قوي تلقائياً:
```bash
openssl rand -hex 32
```
انسخ الناتج وحطه بدل القيمة.

احفظ الملف: `Ctrl+O` ثم `Enter` ثم `Ctrl+X` (نانو محرر النصوص).

---

## 7) قاعدة البيانات والحساب الأول (تلقائي)

**ما تحتاج تشغّل أي أمر.** النظام ينشئ الجداول وشركات الشحن لحاله عند أول تشغيل.

بعد ما يشتغل السيرفر (خطوة 8)، افتح `https://api.alelmam.com/admin` من المتصفح — بتظهر لك
شاشة **"أهلاً بك"** تنشئ منها حساب المدير الأول باسمك وكلمة مرور تختارها.

> 💡 لو النظام منشور على الإنترنت قبل ما تفتح اللوحة، أضف في ملف `.env` السطر
> `SETUP_KEY="أي_كلمة_سرية"` — وقتها ما يقدر أحد ينشئ أول حساب إلا بها.

---

## 8) تشغيل السيرفر بشكل دائم عبر PM2

```bash
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup
```

آخر أمر (`pm2 startup`) بيطبع لك سطر أمر لازم تنسخه وتشغّله (يخلي PM2 يشتغل
تلقائياً حتى لو أعدت تشغيل السيرفر). انسخه ونفّذه.

للتأكد إن كل شي شغّال:
```bash
pm2 status
pm2 logs alelmam-api
```

---

## 9) إعداد Nginx

```bash
cp deploy/nginx.conf /etc/nginx/sites-available/api.alelmam.com
ln -s /etc/nginx/sites-available/api.alelmam.com /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## 10) ربط الدومين الفرعي (api.alelmam.com) — من لوحة Squarespace

بما إن دومينك مستضاف على Squarespace (نفس الصورة اللي أرسلتها):

1. ادخل: `account.squarespace.com` → دومينك `alelmam.com` → **DNS Settings**
2. تحت "Custom records" اضغط **Add Record**
3. من قائمة **TYPE** اختر **A**
4. في **NAME** اكتب: `api`
5. في **IP ADDRESS** اكتب رقم الـ IP الفعلي لسيرفرك (اللي حصلت عليه في الخطوة 1)
6. اضغط **SAVE**

⏳ التغيير يحتاج من دقائق لين بضع ساعات ليصل لكل مكان في العالم (Propagation).

للتأكد إنه اشتغل، من جهازك:
```bash
ping api.alelmam.com
```
لازم يطلع لك نفس رقم IP سيرفرك.

---

## 11) إصدار شهادة SSL (HTTPS)

بعد ما تتأكد إن الدومين يوصل للسيرفر (خطوة 10):

```bash
certbot --nginx -d api.alelmam.com
```

بيسألك إيميلك، وبعدين يوافق على الشروط، وبيطلع لك خيار تحويل http لـ https تلقائياً
— اختر **نعم**. الشهادة تتجدد تلقائياً كل 90 يوم بدون أي تدخل منك.

---

## 12) التحقق النهائي

افتح من أي متصفح:
- `https://api.alelmam.com/health` → لازم يطلع `{"status":"ok"}`
- `https://api.alelmam.com/admin` → **لوحة التحكم** (أنشئ حساب المدير الأول من هنا)
- `https://api.alelmam.com/api-docs` → توثيق Swagger التفاعلي (للمبرمجين)

🎉 **مبروك، نظامك شغّال رسمياً على الإنترنت!**

---

## 13) إضافة بيانات اعتماد شركات الشحن الحقيقية لاحقاً

لما توقّعون عقود رسمية مع أرامكس/سمسا/سبل وتستلمون بياناتهم:

1. افتح لوحة التحكم ← **شركات الشحن**
2. اختر الشركة، عبّي الحقول، واضغط **حفظ بيانات الربط** (تُحفظ مشفّرة، ولا تحتاج إعادة تشغيل)

راجع أيضاً ملفات `src/integrations/adapters/` (أرامكس، سمسا، سبل) مع فنّي للتأكد من مطابقة
مسارات الربط للتوثيق الرسمي النهائي من كل شركة قبل أول شحنة حقيقية.

---

## 14) كيف تحدّث الكود لاحقاً؟

```bash
# من جهازك
scp -r alelmam-api root@YOUR_SERVER_IP:/root/

# على السيرفر
cd /root/alelmam-api
npm install --production
npm run migrate    # فقط إذا أضفنا جداول جديدة
pm2 restart alelmam-api
```

---

## 15) نصائح أمان إضافية (موصى بها لاحقاً)

- أنشئ مستخدم غير `root` للعمل اليومي على السيرفر
- فعّل نسخ احتياطي دوري لقاعدة البيانات (`pg_dump`)
- راقب السجلات دورياً: `pm2 logs alelmam-api --lines 100`
- غيّر كلمة مرور حساب المدير الافتراضي فور أول تسجيل دخول
