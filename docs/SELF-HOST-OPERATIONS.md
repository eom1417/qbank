# تشغيل خادم QBank: النسخ الاحتياطي، وتنبيه السقوط، وكلمات المرور

تكملة [`SELF-HOST.md`](SELF-HOST.md). كل الأوامر من مجلد `qbank` على الخادم.

## النسخ الاحتياطي التلقائي

لا تحتاج أن تفعل شيئاً: خدمة `backup` في `compose.server.yaml` تعمل مع QBank، وتنسخ كل يوم شيئين معاً
في ملف واحد: قاعدة البيانات، ومجلد البيانات (الملفات المرفوعة وتسجيلات دخول المزوّدين). أول نسخة
بعد دقيقتين من التشغيل، ثم مرة كل يوم (`scripts/server-backup.sh`).

- **ما يُحفظ:** أحدث 7 نسخ يومية، ونسخة كل أسبوع (يوم الأحد) لأربعة أسابيع. والأقدم يُحذف وحده،
  فما يحذفه مستخدم يبقى في النسخ بضعة أسابيع على الأكثر ثم يختفي.
- **أين:** في مجلد Docker اسمه `qbank-backups` على الخادم نفسه: `daily/` و`weekly/`، واسم كل نسخة
  `qbank-YYYY-MM-DD.tar.gz`.
- **هل نجحت؟** افتح «إدارة الخادم»: ترى وقت آخر نسخة، وهل نجحت، وعدد النسخ المحفوظة. ويظهر تنبيه إن
  فشلت آخر نسخة أو مر أكثر من يومين بلا نسخة. والتفصيل في السجل:
  `sudo docker compose -f compose.server.yaml logs backup`.

### نسخة على قرص آخر (مقترح)

النسخة على قرص الخادم نفسه لا تنفع إن تعطل القرص. صل قرصاً ثانياً بالخادم (أو مجلداً مشتركاً من جهاز
آخر)، واكتب مكانه في `.env`:

```bash
QBANK_BACKUP_COPY_TO=/mnt/backup-disk/qbank
```

ثم `sudo docker compose -f compose.server.yaml up -d`. كل نسخة جديدة تُنسخ إلى هناك أيضاً، ويبقى
هناك أحدث 7 منها. احمِ هذا القرص كما تحمي الخادم: فيه كل البيانات.

### نسخة الآن

قبل تحديث كبير أو تجربة، خذ نسخة فوراً:

```bash
sudo docker compose -f compose.server.yaml exec backup sh /scripts/server-backup.sh --once
```

ينتهي الأمر بنجاح فقط إن نجحت النسخة، وتظهر في «إدارة الخادم».

### الاستعادة

الاستعادة **تستبدل كل شيء** بما كان في النسخة: قاعدة البيانات كلها ومجلد البيانات كله، وما جاء بعدها
يضيع. أوقف QBank أولاً حتى لا يكتب شيء أثناءها:

```bash
# 1. النسخ الموجودة
sudo docker compose -f compose.server.yaml exec backup ls /backups/daily /backups/weekly
# 2. أوقف QBank والنسخ
sudo docker compose -f compose.server.yaml stop qbank backup
# 3. استعد نسخة (يسألك، فاكتب yes)
sudo docker compose -f compose.server.yaml run --rm restore /backups/daily/qbank-2026-11-10.tar.gz
# 4. شغّلهما من جديد
sudo docker compose -f compose.server.yaml start qbank backup
```

ولاستعادة نسخة من القرص الآخر، أضف بعد `run --rm`:
`-v /mnt/backup-disk/qbank/qbank-2026-11-10.tar.gz:/restore.tar.gz:ro`، واكتب `/restore.tar.gz`
بدل المسار.

**تنبيه:** النسخة فيها كل شيء، ومنه تسجيلات دخول المستخدمين في مزوّدي الذكاء الاصطناعي. احفظها كما
تحفظ كلمة سر.

يفحص `scripts/server-restore.sh` الملف قبل أن يمس شيئاً، ولا يغيّر شيئاً إن لم تكتب `yes`.

## تنبيه إن سقط الخادم

QBank يرسل نبضة كل 5 دقائق إلى رابط تختاره. خدمة مراقبة مجانية تنبّهك (بالإيميل أو تيليجرام أو
غيرهما) إن توقفت النبضات، فتعرف أن الخادم سقط قبل أن يخبرك أحد. مثال بـ
[Healthchecks.io](https://healthchecks.io) (مجاني لـ 20 فحصاً):

1. أنشئ حساباً، ثم **Add Check**.
2. Name: `QBank`، وPeriod: **5 minutes**، وGrace: **10 minutes**. احفظ.
3. انسخ **ping URL** للفحص (مثل `https://hc-ping.com/…`).
4. ضعه في `.env`، ثم `sudo docker compose -f compose.server.yaml up -d`:

   ```bash
   QBANK_HEARTBEAT_URL=https://hc-ping.com/…
   ```

5. بعد دقائق يصير الفحص أخضر. وفي **Integrations** اختر كيف يصلك التنبيه.

الرابط يقبل `https` فقط. ولا تحمل النبضة أي بيانات: طلب فارغ إلى الرابط فقط.

## خادم بكلمات المرور (بلا عميل Google)

إن لم تضع `QBANK_GOOGLE_CLIENT_ID` و`QBANK_GOOGLE_CLIENT_SECRET`، يبقى الدخول بالبريد وكلمة المرور،
ومعه خطوتان لا يحتاجهما خادم Google.

### تأكيد المدير

سجّل حسابك بالبريد الذي كتبته في `QBANK_OPERATOR_EMAIL`، ثم أكّده من الخادم **قبل أن ترسل الرابط
لأحد**:

```bash
sudo docker compose -f compose.server.yaml exec qbank node scripts/confirm-operator.mjs
```

يعرض الأمر اسم الحساب ووقت تسجيله، فاكتب `yes` إن كان حسابك. حدّث الصفحة، فتظهر لك «إدارة الخادم».

لماذا التأكيد؟ البريد في `.env` يسمّي المدير فقط، ولا يتحقق أحد هنا من أنه بريدك. ولو سبقك أحد
بالتسجيل بهذا البريد لما صار مديراً، لأن من يدخل الخادم وحده (أنت) يؤكد. وإن عرض الأمر حساباً ليس
لك، فاكتب بريداً آخر لك في `QBANK_OPERATOR_EMAIL`، وأعد التشغيل، وسجّل به، ثم أكّده.

### صديق نسي كلمة المرور

الخادم لا يرسل إيميلات، فيمر الطلب بك:

1. يضغط صاحبك «نسيت كلمة المرور» ويكتب بريده. تقول له الصفحة إن طلبه وصل إليك.
2. افتح «إدارة الخادم» ثم «طلبات الاستعادة»: ترى بريده، ووقت الطلب، والمدة الباقية.
3. اضغط «انسخ الرابط» وأرسله بأي طريقة، أو «أرسل بالواتساب» فيفتح الواتساب برسالة جاهزة. الرابط
   لمرة واحدة وصالح لساعة، وإن انتهى قبل أن تراه فاضغط «أنشئ رابطاً جديداً»، ولا يحتاج صاحبك أن
   يطلب من جديد.

أنت لا ترى كلمة مروره ولا تغيّرها، وكل نسخ للرابط يُكتب في السجل.

**بديل بسطر الأوامر** (إن لم تفتح الشاشة لأي سبب):

```bash
sudo docker compose -f compose.server.yaml exec qbank node scripts/reset-link.mjs بريده@example.com
```

وإن أضفت عميل Google لاحقاً، فكل من سجّل بالبريد يدخل بحساب Google الذي له البريد نفسه، ويجد بياناته
كلها.

---

## English summary

- **Backups** run by themselves in the `backup` service (`scripts/server-backup.sh`): the database
  and the data volume in one archive a day, 2 minutes after start and then daily; the 7 newest
  daily and 4 weekly (Sunday) archives are kept in the `qbank-backups` volume, older ones are
  deleted. Server administration shows the last backup, whether it worked and how many are kept,
  and warns when it failed or is more than two days old. `QBANK_BACKUP_COPY_TO` (optional) also
  copies each new archive to a folder on another disk (7 kept there). Back up now:
  `exec backup sh /scripts/server-backup.sh --once`.
- **Restore** replaces the whole database and data volume: stop `qbank backup`, run
  `docker compose -f compose.server.yaml run --rm restore /backups/daily/<archive>`, type `yes`,
  start `qbank backup`. Archives hold users' AI sign-ins too: keep them as secret as a password.
- **Uptime alert:** set `QBANK_HEARTBEAT_URL` (https only) to an uptime service's ping URL, e.g. a
  Healthchecks.io check with period 5 minutes and grace 10 minutes. QBank pings it every 5 minutes
  with no data; the service alerts you when the pings stop.
- **Without a Google client** the server keeps e-mail and password: confirm the operator with
  `scripts/confirm-operator.mjs` before sharing the link, and hand password-reset links over from
  Server administration (or `scripts/reset-link.mjs <email>`).
