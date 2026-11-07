# QBank على خادمك الخاص (للأهل والأصحاب)

تشغّل QBank على جهاز افتراضي عندك برابط https، فيفتحه أي أحد تعطيه الرابط من جواله أو حاسبه،
ويسجّل حسابه، ويربط مزوّد الذكاء الاصطناعي الخاص به، ويبني بنوكه. كل حساب لا يرى إلا بياناته.
لا تكاليف غير جهازك، ولا خدمة خارجية.

> للاستخدام الشخصي على جهازك وحدك لا تحتاج هذا الدليل: `docker compose up -d` يكفي (README).

## ما تحتاجه

| الشيء        | المقترح                                                          |
| ------------ | ---------------------------------------------------------------- |
| جهاز افتراضي | Ubuntu 24.04، ومعالجان، وذاكرة 4GB، وقرص 30GB (يكفي 5–20 شخصاً)  |
| نطاق         | مثل `qbank.example.com`، يشير سجلّه `A` إلى عنوان IP العام لبيتك |
| الراوتر      | تحويل المنفذين 80 و443 إلى الجهاز الافتراضي                      |

المنفذ 80 يلزم لإصدار شهادة https المجانية وتجديدها تلقائياً. إن كان مزوّد الإنترنت لا يعطيك
عنواناً عاماً (CGNAT)، فتحتاج نفقاً مثل Cloudflare Tunnel، وهذا خارج هذا الدليل.

## التثبيت (مرة واحدة)

على الجهاز الافتراضي:

```bash
# 1. Docker
curl -fsSL https://get.docker.com | sudo sh

# 2. QBank
git clone https://github.com/eom1417/qbank.git
cd qbank

# 3. الإعدادات: النطاق وكلمة سر لقاعدة البيانات
cp deploy/server.env.example .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" .env
nano .env    # اكتب نطاقك في QBANK_DOMAIN

# 4. التشغيل
sudo docker compose -f compose.server.yaml up -d --build
```

البناء الأول يأخذ 5–15 دقيقة. بعده افتح `https://نطاقك`: تظهر صفحة QBank، وسجّل أنت أول حساب.
ثم أرسل الرابط لمن تريد.

يعمل QBank بعد إعادة تشغيل الجهاز تلقائياً (`restart: unless-stopped`).

## الأوامر اليومية

كلها من مجلد `qbank`:

| تريد                 | الأمر                                                                  |
| -------------------- | ---------------------------------------------------------------------- |
| تحديث لآخر إصدار     | `git pull && sudo docker compose -f compose.server.yaml up -d --build` |
| رؤية السجل عند مشكلة | `sudo docker compose -f compose.server.yaml logs -f qbank`             |
| إيقاف                | `sudo docker compose -f compose.server.yaml down` (البيانات تبقى)      |
| صديق نسي كلمة المرور | انظر القسم التالي                                                      |

التحديث يحدّث قاعدة البيانات وحده عند التشغيل، ولا يمس البيانات. خذ نسخة احتياطية قبله.

## صديق نسي كلمة المرور

الخادم لا يرسل إيميلات. لذلك:

1. يضغط صاحبك «نسيت كلمة المرور» ويكتب بريده.
2. أنت تشغّل:

   ```bash
   sudo docker compose -f compose.server.yaml exec qbank node scripts/reset-link.mjs بريده@example.com
   ```

3. يظهر لك رابط الاستعادة؛ أرسله له في الواتساب. الرابط لمرة واحدة ومؤقت.

## النسخ الاحتياطي

شيئان تحفظهما: قاعدة البيانات، ومجلد البيانات (الملفات المرفوعة وتسجيلات دخول المزوّدين).

```bash
mkdir -p ~/qbank-backups
# قاعدة البيانات
sudo docker compose -f compose.server.yaml exec -T db pg_dump -U qbank qbank \
  | gzip > ~/qbank-backups/db-$(date +%F).sql.gz
# مجلد البيانات
sudo docker run --rm -v qbank_qbank-data:/data -v ~/qbank-backups:/out alpine \
  tar czf /out/data-$(date +%F).tar.gz -C /data .
```

اسم المجلد `qbank_qbank-data` يتبع اسم مجلد التثبيت (`qbank`)؛ تأكد منه بـ `sudo docker volume ls`.
ولنسخة يومية تلقائية ضع الأمرين في سكربت وأضفه إلى `sudo crontab -e`. والأفضل نسخ مجلد
`qbank-backups` إلى جهاز آخر، لأن النسخة على نفس القرص لا تنفع إن تعطل القرص.

## الأمان باختصار

- أي أحد معه الرابط يستطيع إنشاء حساب. هذا مقصود. لا تنشر الرابط علناً إن لم ترده عاماً.
- قاعدة البيانات وQBank لا يصل إليهما أحد من خارج الجهاز؛ Caddy وحده على المنفذين 80 و443.
- كلمات المرور مخزّنة مشفّرة (argon2)، وكل حساب له مزوّد ذكاء خاص به لا يراه غيره.
- حدّث النظام دورياً: `sudo apt update && sudo apt upgrade`.

---

## English summary

QBank for a group on your own server: Docker, Postgres and Caddy (automatic HTTPS).

1. Ubuntu VM (2 vCPU, 4 GB RAM, 30 GB disk), a domain pointing at it, ports 80/443 forwarded.
2. `curl -fsSL https://get.docker.com | sudo sh`, clone the repository, `cp deploy/server.env.example .env`,
   set `QBANK_DOMAIN` and a random `POSTGRES_PASSWORD`.
3. `sudo docker compose -f compose.server.yaml up -d --build`, then open `https://<your domain>`.
4. Update: `git pull && sudo docker compose -f compose.server.yaml up -d --build`.
5. Forgotten password (no e-mail on the server): the friend taps "Forgot password", then you run
   `sudo docker compose -f compose.server.yaml exec qbank node scripts/reset-link.mjs <email>` and send them the link.
6. Back up with `pg_dump` and a tar of the `qbank-data` volume (commands above).
