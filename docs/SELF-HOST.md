# QBank على خادمك الخاص (للأهل والأصحاب)

تشغّل QBank على جهاز افتراضي عندك برابط https، فيفتحه أي أحد تعطيه الرابط من جواله أو حاسبه،
ويدخل بحساب Google، ويربط مزوّد الذكاء الاصطناعي الخاص به، ويبني بنوكه. كل حساب لا يرى إلا
بياناته. لا تكاليف غير جهازك: عميل Google للدخول مجاني، وخدمة تنبيه السقوط اختيارية ومجانية.

> للاستخدام الشخصي على جهازك وحدك لا تحتاج هذا الدليل: `docker compose up -d` يكفي (README).

## ما تحتاجه

| الشيء        | المقترح                                                             |
| ------------ | ------------------------------------------------------------------- |
| جهاز افتراضي | Ubuntu 24.04، و2–4 معالجات، وذاكرة 8GB، وقرص 50GB (يكفي 5–20 شخصاً) |
| نطاق         | مثل `qbank.example.com`، يشير سجلّه `A` إلى عنوان IP العام لبيتك    |
| الراوتر      | تحويل المنفذين 80 و443 إلى الجهاز الافتراضي                         |
| حساب Google  | لإنشاء «عميل Google» يدخل به الناس (القسم «الدخول بحساب Google»)    |

ذاكرة 8GB تتسع لست جلسات AI معاً واستيرادين. والمنفذ 80 يلزم لإصدار شهادة https المجانية
وتجديدها تلقائياً. إن كان مزوّد الإنترنت لا يعطيك عنواناً عاماً (CGNAT)، فتحتاج نفقاً مثل Cloudflare
Tunnel، وهذا خارج هذا الدليل.

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
nano .env    # QBANK_DOMAIN و QBANK_OPERATOR_EMAIL و QBANK_OPERATOR_NAME وعميل Google

# 4. التشغيل
sudo docker compose -f compose.server.yaml up -d --build
```

البناء الأول يأخذ 5–15 دقيقة. بعده افتح `https://نطاقك`: تظهر صفحة QBank.

- **مع عميل Google** (المقترح، القسم التالي): اضغط «متابعة بحساب Google» بالحساب الذي بريده في
  `QBANK_OPERATOR_EMAIL`، فتظهر لك «إدارة الخادم» مباشرة. لا تأكيد من الخادم: Google أثبت أن البريد
  لك.
- **بلا عميل Google:** يبقى الدخول بالبريد وكلمة المرور، وتأكيد المدير من الخادم (قسم «خادم بكلمات
  المرور» في [`SELF-HOST-OPERATIONS.md`](SELF-HOST-OPERATIONS.md)).

ثم أرسل الرابط لمن تريد.

## الدخول بحساب Google

مع عميل Google يدخل الناس بحساباتهم في Google وحدها: لا كلمات مرور تُنسى، ولا «نسيت كلمة المرور»،
ولا بريد يُكتب خطأً، لأن Google يعطي QBank البريد موثّقاً والاسم فقط. ومن سجّل قبل ذلك ببريد وكلمة
مرور يدخل بحساب Google الذي له البريد نفسه، فيُربط حسابه القديم ببياناته كلها. إنشاء العميل مجاني،
ويُعمل مرة واحدة:

1. افتح [Google Cloud Console](https://console.cloud.google.com/) بحسابك، وأنشئ مشروعاً جديداً
   (مثل `qbank`) من قائمة المشاريع أعلى الصفحة.
2. **APIs & Services** ثم **OAuth consent screen** (قد تسمى Google Auth Platform ثم Branding):
   - User type: **External**.
   - App name: `QBank` أو اسم خادمك، وUser support email: بريدك، وDeveloper contact: بريدك.
   - Scopes: `openid` و`email` و`profile` فقط (الأساسية، ولا تحتاج مراجعة من Google).
   - Audience: اضغط **Publish app** ليدخل أي حساب Google، أو أبقه في Testing وأضف بريد كل شخص في
     **Test users** (100 بحد أقصى).
3. **Credentials** ثم **Create credentials** ثم **OAuth client ID**:
   - Application type: **Web application**، وName: `QBank`.
   - Authorized redirect URIs: `https://<نطاقك>/api/auth/google/callback` حرفياً، مثل
     `https://qbank.example.com/api/auth/google/callback`.
   - اضغط Create، فيظهر **Client ID** و**Client secret**.
4. ضعهما في `.env`:

   ```bash
   nano .env
   # QBANK_GOOGLE_CLIENT_ID=....apps.googleusercontent.com
   # QBANK_GOOGLE_CLIENT_SECRET=...
   ```

5. أعد التشغيل: `sudo docker compose -f compose.server.yaml up -d`.

افتح صفحة الدخول: يظهر زر Google وحده. المدير هو صاحب حساب Google الذي بريده في
`QBANK_OPERATOR_EMAIL`، بلا أمر تأكيد. Client secret سرّ: لا ترسله لأحد، وإن تسرّب فأنشئ غيره من
Credentials واحذف القديم. ضع القيمتين معاً أو احذفهما معاً؛ واحدة دون الأخرى توقف QBank عن البدء.

## إعدادات الخادم في `.env`

| الإعداد                                                | معناه                                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `QBANK_DOMAIN`                                         | العنوان الذي يفتحه أصحابك                                                                                          |
| `POSTGRES_PASSWORD`                                    | كلمة سر طويلة لقاعدة البيانات (يكتبها الأمر أعلاه)                                                                 |
| `QBANK_OPERATOR_EMAIL`                                 | بريد مدير الخادم (أنت). مع Google: حساب Google بهذا البريد هو المدير. بلا Google: بعد تأكيده من الخادم فقط         |
| `QBANK_OPERATOR_NAME`                                  | الاسم الذي يراه المستخدمون في «أين بياناتي؟» وصفحة الخصوصية، مثل اسمك الأول                                        |
| `QBANK_IMPORT_WORKERS`                                 | عدد الاستيرادات التي تعمل معاً، ولا يأخذ حساب واحد أكثر من واحد. 2 يناسب خادم 8GB                                  |
| `QBANK_GOOGLE_CLIENT_ID` و`QBANK_GOOGLE_CLIENT_SECRET` | عميل Google (القسم السابق). معهما يكون الدخول بـ Google وحده                                                       |
| `QBANK_AI_HOSTS_MAX`                                   | جلسات AI التي تعمل معاً لكل الحسابات، 6 افتراضياً على الخادم. ومن يأتي بعد امتلائها يُطلب منه المحاولة بعد دقائق   |
| `QBANK_BACKUP_COPY_TO`                                 | اختياري: مجلد على قرص آخر تُنسخ إليه كل نسخة احتياطية جديدة ([`SELF-HOST-OPERATIONS.md`](SELF-HOST-OPERATIONS.md)) |
| `QBANK_HEARTBEAT_URL`                                  | اختياري: رابط خدمة مراقبة تنبّهك إن توقف الخادم ([`SELF-HOST-OPERATIONS.md`](SELF-HOST-OPERATIONS.md))             |

لا تترك قيمة فارغة: احذف السطر بدل ذلك. وبعد أي تعديل في `.env` شغّل
`sudo docker compose -f compose.server.yaml up -d` ليأخذ QBank الإعداد الجديد.

يعمل QBank بعد إعادة تشغيل الجهاز تلقائياً (`restart: unless-stopped`).

## الأوامر اليومية

كلها من مجلد `qbank`:

| تريد                 | الأمر                                                                   |
| -------------------- | ----------------------------------------------------------------------- |
| تحديث لآخر إصدار     | انظر «التحديث» أدناه                                                    |
| رؤية السجل عند مشكلة | `sudo docker compose -f compose.server.yaml logs -f qbank`              |
| إيقاف                | `sudo docker compose -f compose.server.yaml down` (البيانات تبقى)       |
| آخر نسخة احتياطية    | «إدارة الخادم»، أو [`SELF-HOST-OPERATIONS.md`](SELF-HOST-OPERATIONS.md) |

### التحديث

```bash
read -rs -p 'GitHub token: ' GH_TOKEN && echo && export GH_TOKEN
git pull
unset GH_TOKEN
sudo docker compose -f compose.server.yaml up -d --build
```

التحديث يحدّث قاعدة البيانات وحده عند التشغيل، ولا يمس البيانات. تأكد قبله أن آخر نسخة احتياطية
نجحت، أو خذ نسخة الآن ([`SELF-HOST-OPERATIONS.md`](SELF-HOST-OPERATIONS.md)).

## إدارة الخادم

تظهر هذه الشاشة لك وحدك (الحساب الذي بريده `QBANK_OPERATOR_EMAIL`). لا ترى فيها
بنوك أحد ولا أسئلته، والخادم يرفض أي طلب منك لبيانات غيرك.

- **الملاحظات:** «أرسل ملاحظة» في صفحة المساعدة تصل إليك هنا: النص، والشاشة، والإصدار، والوقت،
  ومن أرسلها. لا يُرفق معها نص من الأسئلة إلا ما يكتبه صاحبها، ولكل حساب 10 ملاحظات في الساعة.
  أغلق الملاحظة إذا عالجتها.
- **النسخ الاحتياطي:** وقت آخر نسخة، وهل نجحت، وعدد النسخ المحفوظة. وتنبيه إن فشلت أو تأخرت أكثر من
  يومين.
- **طلبات الاستعادة:** على خادم بكلمات المرور فقط ([`SELF-HOST-OPERATIONS.md`](SELF-HOST-OPERATIONS.md)).
- **طابور الاستيراد:** المهام الجارية والمنتظرة: الحساب، وعدد الصفحات، ومنذ متى، وزر «أوقف» للمهمة
  العالقة. ويرى كل مستخدم ترتيب ملفه فقط، دون أسماء أصحاب الملفات الأخرى.

## النسخ الاحتياطي، وتنبيه السقوط، وكلمات المرور

في [`SELF-HOST-OPERATIONS.md`](SELF-HOST-OPERATIONS.md): النسخ الاحتياطي اليومي التلقائي والاستعادة،
وتنبيهك إن توقف الخادم، وخادم بلا عميل Google (تأكيد المدير، وصديق نسي كلمة المرور).

## الأمان باختصار

- أي أحد معه الرابط يستطيع إنشاء حساب. هذا مقصود. لا تنشر الرابط علناً إن لم ترده عاماً.
- مدير الخادم يسمّيه بريده في `.env`. مع Google لا يدخل بهذا البريد إلا صاحبه، لأن Google يوثّقه.
  وبلا Google لا يصير مديراً إلا بعد تأكيده من الخادم (`confirm-operator.mjs`)، فلا يكسب شيئاً من
  يسجّل بهذا البريد قبلك. والمدير يرى الملاحظات والطابور والنسخ الاحتياطي (وطلبات الاستعادة بلا
  Google) فقط.
- رمز GitHub للقراءة فقط ولهذا المستودع وحده، ولا يُحفظ على الخادم. إن شككت فيه فاحذفه من GitHub
  وأنشئ غيره.
- قاعدة البيانات وQBank لا يصل إليهما أحد من خارج الجهاز؛ Caddy وحده على المنفذين 80 و443.
- مع Google لا يحفظ QBank كلمة مرور لأحد. وبلا Google تُحفظ كلمات المرور مشفّرة (argon2). وكل حساب
  له مزوّد ذكاء خاص به لا يراه غيره.
- النسخ الاحتياطية فيها كل البيانات: من يصل إلى القرص الآخر يصل إليها، فاحمه كما تحمي الخادم.
- حدّث النظام دورياً: `sudo apt update && sudo apt upgrade`.

---

## English summary

QBank for a group on your own server: Docker, Postgres and Caddy (automatic HTTPS).

1. Ubuntu VM (2–4 vCPU, 8 GB RAM, 50 GB disk), a domain pointing at it, ports 80/443 forwarded.
2. The repository is private: make a fine-grained GitHub token with **Contents: Read-only** on this
   repository only. Clone with the commands above: the token is read with `read -rs`, handed to git
   by a credential helper from the environment, and never lands in shell history, the remote URL
   or the disk. The repository's git config then asks for it again on every update.
3. `cp deploy/server.env.example .env`; set `QBANK_DOMAIN`, a random `POSTGRES_PASSWORD`,
   `QBANK_OPERATOR_EMAIL` (you), `QBANK_OPERATOR_NAME` (the name users see) and
   `QBANK_IMPORT_WORKERS` (imports at once, one per account; 2 on 8 GB). AI sessions at once:
   `QBANK_AI_HOSTS_MAX`, 6 by default on a server. Never leave a value empty.
4. Google sign-in (recommended): in Google Cloud Console create a project; APIs & Services → OAuth
   consent screen: External, app name, support e-mail, scopes `openid`, `email`, `profile`, then
   publish the app or add test users; Credentials → Create credentials → OAuth client ID → Web
   application, authorized redirect URI `https://<domain>/api/auth/google/callback`. Put
   `QBANK_GOOGLE_CLIENT_ID` and `QBANK_GOOGLE_CLIENT_SECRET` in `.env` (both or neither) and
   restart. People then sign in with Google only: no passwords, no reset; an existing e-mail
   account is linked on its first Google sign-in.
5. `sudo docker compose -f compose.server.yaml up -d --build`, open `https://<your domain>`. With
   Google, sign in with the operator e-mail's Google account: you get "Server administration" at
   once, no confirmation command. Without Google, sign up with that e-mail and confirm it from the
   server (`SELF-HOST-OPERATIONS.md`).
6. Update: enter the token, `git pull`, `unset GH_TOKEN`, then `up -d --build` (commands above).
7. Server administration: users' feedback, the import queue and the last backup (and password-reset
   requests without Google). Never anyone's banks or questions.
8. Backups run daily by themselves (7 daily and 4 weekly kept), an optional second copy goes to
   `QBANK_BACKUP_COPY_TO`, and `QBANK_HEARTBEAT_URL` pings an uptime service that alerts you when
   the server stops: `SELF-HOST-OPERATIONS.md`.
