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

## مفتاح قراءة فقط (المستودع خاص)

مستودع QBank خاص، فيحتاج الخادم مفتاحاً ليستنسخه ويحدّثه. أنشئ رمزاً دقيقاً (fine-grained) لا
يستطيع إلا القراءة من هذا المستودع وحده:

1. في GitHub: Settings ثم Developer settings ثم Personal access tokens ثم Fine-grained tokens ثم
   Generate new token.
2. Repository access: اختر Only select repositories، ثم `eom1417/qbank` وحده.
3. Permissions: في Repository permissions اجعل Contents على **Read-only**، ولا تضف غيرها
   (Metadata: Read-only تُضاف وحدها).
4. اختر مدة صلاحية (سنة مثلاً)، وجدّده قبل أن تنتهي. احفظه في مدير كلمات المرور، لا في ملف على
   الخادم.

الأوامر أدناه تطلب الرمز عند الحاجة: لا يظهر على الشاشة، ولا يُحفظ في سجل الأوامر، ولا يدخل في
عنوان المستودع، ولا يبقى على القرص. ومن يرى الخادم لا يستطيع به إلا قراءة الكود.

## التثبيت (مرة واحدة)

على الجهاز الافتراضي:

```bash
# 1. Docker
curl -fsSL https://get.docker.com | sudo sh

# 2. QBank: يُطلب الرمز ثم يُنسى بعد الاستنساخ
read -rs -p 'GitHub token: ' GH_TOKEN && echo && export GH_TOKEN
git -c credential.helper= \
  -c credential.helper='!f() { echo username=x-access-token; echo "password=$GH_TOKEN"; }; f' \
  clone https://github.com/eom1417/qbank.git
unset GH_TOKEN
cd qbank
# يقرأ git الرمز من الطرفية عند كل تحديث، ولا يحفظه (هذا السطر لا يحمل أي سر)
git config credential.helper ''
git config --add credential.helper \
  '!f() { test -n "$GH_TOKEN" && echo username=x-access-token && echo "password=$GH_TOKEN"; }; f'

# 3. الإعدادات: النطاق، وكلمة سر لقاعدة البيانات، وأنت مديراً للخادم
cp deploy/server.env.example .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" .env
nano .env    # QBANK_DOMAIN و QBANK_OPERATOR_EMAIL و QBANK_OPERATOR_NAME

# 4. التشغيل
sudo docker compose -f compose.server.yaml up -d --build
```

البناء الأول يأخذ 5–15 دقيقة. بعده افتح `https://نطاقك`: تظهر صفحة QBank. سجّل حسابك بالبريد الذي
كتبته في `QBANK_OPERATOR_EMAIL`، ثم أكّده من الخادم **قبل أن ترسل الرابط لأحد**:

```bash
sudo docker compose -f compose.server.yaml exec qbank node scripts/confirm-operator.mjs
```

يعرض الأمر اسم الحساب ووقت تسجيله، فاكتب `yes` إن كان حسابك. حدّث الصفحة، فتظهر لك «إدارة الخادم».
ثم أرسل الرابط لمن تريد.

لماذا التأكيد؟ البريد في `.env` يسمّي المدير فقط. ولو سبقك أحد بالتسجيل بهذا البريد لما صار مديراً،
لأن من يدخل الخادم وحده (أنت) يؤكد. وإن عرض الأمر حساباً ليس لك، فاكتب بريداً آخر لك في
`QBANK_OPERATOR_EMAIL`، وأعد التشغيل، وسجّل به، ثم أكّده.

### إعدادات الخادم في `.env`

| الإعداد                | معناه                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `QBANK_DOMAIN`         | العنوان الذي يفتحه أصحابك                                                                      |
| `POSTGRES_PASSWORD`    | كلمة سر طويلة لقاعدة البيانات (يكتبها الأمر أعلاه)                                             |
| `QBANK_OPERATOR_EMAIL` | بريد مدير الخادم (أنت). حسابك بهذا البريد يصير المدير بعد تأكيده بالأمر أعلاه، لا بالتسجيل وحده |
| `QBANK_OPERATOR_NAME`  | الاسم الذي يراه المستخدمون في «أين بياناتي؟» وصفحة الخصوصية، مثل اسمك الأول                    |
| `QBANK_IMPORT_WORKERS` | عدد الاستيرادات التي تعمل معاً، ولا يأخذ حساب واحد أكثر من واحد. 2 يناسب خادم 4GB              |

لا تترك قيمة فارغة: احذف السطر بدل ذلك. وبعد أي تعديل في `.env` شغّل
`sudo docker compose -f compose.server.yaml up -d` ليأخذ QBank الإعداد الجديد.

يعمل QBank بعد إعادة تشغيل الجهاز تلقائياً (`restart: unless-stopped`).

## الأوامر اليومية

كلها من مجلد `qbank`:

| تريد                 | الأمر                                                             |
| -------------------- | ----------------------------------------------------------------- |
| تحديث لآخر إصدار     | انظر «التحديث» أدناه                                              |
| رؤية السجل عند مشكلة | `sudo docker compose -f compose.server.yaml logs -f qbank`        |
| إيقاف                | `sudo docker compose -f compose.server.yaml down` (البيانات تبقى) |
| صديق نسي كلمة المرور | «إدارة الخادم» ثم «طلبات الاستعادة» (القسم التالي)                |

### التحديث

```bash
read -rs -p 'GitHub token: ' GH_TOKEN && echo && export GH_TOKEN
git pull
unset GH_TOKEN
sudo docker compose -f compose.server.yaml up -d --build
```

التحديث يحدّث قاعدة البيانات وحده عند التشغيل، ولا يمس البيانات. خذ نسخة احتياطية قبله.

## إدارة الخادم

تظهر هذه الشاشة لك وحدك (الحساب الذي بريده `QBANK_OPERATOR_EMAIL`)، وفيها ثلاث بطاقات. لا ترى فيها
بنوك أحد ولا أسئلته، والخادم يرفض أي طلب منك لبيانات غيرك.

- **الملاحظات:** «أرسل ملاحظة» في صفحة المساعدة تصل إليك هنا: النص، والشاشة، والإصدار، والوقت،
  ومن أرسلها. لا يُرفق معها نص من الأسئلة إلا ما يكتبه صاحبها، ولكل حساب 10 ملاحظات في الساعة.
  أغلق الملاحظة إذا عالجتها.
- **طلبات الاستعادة:** انظر القسم التالي.
- **طابور الاستيراد:** المهام الجارية والمنتظرة: الحساب، وعدد الصفحات، ومنذ متى، وزر «أوقف» للمهمة
  العالقة. ويرى كل مستخدم ترتيب ملفه فقط، دون أسماء أصحاب الملفات الأخرى.

## صديق نسي كلمة المرور

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
- مدير الخادم يسمّيه بريده في `.env`، ولا يصير مديراً إلا بعد تأكيده من الخادم
  (`confirm-operator.mjs`)، فلا يكسب شيئاً من يسجّل بهذا البريد قبلك. والمدير يرى الملاحظات وطلبات
  الاستعادة والطابور فقط.
- رمز GitHub للقراءة فقط ولهذا المستودع وحده، ولا يُحفظ على الخادم. إن شككت فيه فاحذفه من GitHub
  وأنشئ غيره.
- قاعدة البيانات وQBank لا يصل إليهما أحد من خارج الجهاز؛ Caddy وحده على المنفذين 80 و443.
- كلمات المرور مخزّنة مشفّرة (argon2)، وكل حساب له مزوّد ذكاء خاص به لا يراه غيره.
- حدّث النظام دورياً: `sudo apt update && sudo apt upgrade`.

---

## English summary

QBank for a group on your own server: Docker, Postgres and Caddy (automatic HTTPS).

1. Ubuntu VM (2 vCPU, 4 GB RAM, 30 GB disk), a domain pointing at it, ports 80/443 forwarded.
2. The repository is private: make a fine-grained GitHub token with **Contents: Read-only** on this
   repository only. Clone with the commands above: the token is read with `read -rs`, handed to git
   by a credential helper from the environment, and never lands in shell history, the remote URL
   or the disk. The repository's git config then asks for it again on every update.
3. `cp deploy/server.env.example .env`; set `QBANK_DOMAIN`, a random `POSTGRES_PASSWORD`,
   `QBANK_OPERATOR_EMAIL` (you), `QBANK_OPERATOR_NAME` (the name users see) and
   `QBANK_IMPORT_WORKERS` (imports at once, one per account; 2 on 4 GB). Never leave a value empty.
4. `sudo docker compose -f compose.server.yaml up -d --build`, open `https://<your domain>`, sign
   up with the operator e-mail, then confirm it from the server before sharing the link:
   `sudo docker compose -f compose.server.yaml exec qbank node scripts/confirm-operator.mjs`
   (it shows the account's name and sign-up time; type `yes`). Reload: you get "Server
   administration". The e-mail alone grants nothing, so whoever signs up with it first gains nothing.
5. Update: enter the token, `git pull`, `unset GH_TOKEN`, then `up -d --build` (commands above).
6. Server administration: users' feedback, password-reset requests (Copy link or WhatsApp; a link
   works once, for one hour, and can be renewed) and the import queue. Never anyone's banks or
   questions. Fallback for a reset: `sudo docker compose -f compose.server.yaml exec qbank node
scripts/reset-link.mjs <email>`.
7. Back up with `pg_dump` and a tar of the `qbank-data` volume (commands above).
