# QBank على Coolify

نفس خادم الحسابات في [`SELF-HOST.md`](SELF-HOST.md)، لكن Coolify يتولى البناء والنشر وHTTPS بدل Caddy.
الملف: [`compose.coolify.yaml`](../compose.coolify.yaml) (قاعدة PostgreSQL 17، وQBank، والنسخ الاحتياطي اليومي).

## الإعداد

1. في Coolify: تطبيق جديد من المستودع عبر GitHub App، ونوع البناء **Docker Compose**، والملف
   `/compose.coolify.yaml`.
2. النطاق على خدمة `qbank` مع المنفذ 3000: `https://qbank.example.com:3000`.
3. المتغيرات:
   - `QBANK_DOMAIN`: النطاق وحده بلا `https://` (مثل `qbank.example.com`)، ومنه تُبنى الأصول المسموحة.
   - `SERVICE_PASSWORD_POSTGRES`: يولّده Coolify بنفسه ويحفظه سراً. لا تكتبه في المستودع.
   - اختياري: `QBANK_OPERATOR_EMAIL` و`QBANK_OPERATOR_NAME` (مدير الخادم)، و`QBANK_GOOGLE_CLIENT_ID`
     و`QBANK_GOOGLE_CLIENT_SECRET` معاً، و`QBANK_HEARTBEAT_URL`. الفارغ يعني غير مفعّل.
   - `QBANK_IMPORT_WORKERS` (افتراضياً 2) و`QBANK_AI_HOSTS_MAX` (افتراضياً 4) لخادم 12 GB و4 vCPU.
4. Auto Deploy يتبع الفرع المضبوط في التطبيق؛ كل دفع إليه ينشر من جديد.

البيانات في ثلاثة مجلدات Docker دائمة لا يمسها إعادة النشر: `qbank-db` و`qbank-data` و`qbank-backups`
(يسبقها Coolify بمعرّف التطبيق). لا تحذف التطبيق مع خيار حذف المجلدات.

## النسخ الاحتياطي والاستعادة

خدمة `backup` تنسخ القاعدة والملفات يومياً إلى `qbank-backups` (7 أيام و4 أسابيع)، وتظهر حالتها في لوحة
المدير. صورتها (`deploy/backup.Dockerfile`) تحمل السكربتات داخلها، لأن Coolify يحوّل المسار النسبي
`./scripts` إلى مجلد فارغ على الخادم.

نسخة فورية من طرفية الخادم (`<APP>` معرّف التطبيق في Coolify):

```sh
docker exec backup-<APP> sh /scripts/server-backup.sh --once
```

الاستعادة تستبدل كل شيء بما في النسخة: أوقف خدمتي `qbank` و`backup` أولاً، ثم:

```sh
docker run --rm -it --network <APP> --env-file <(docker exec backup-<APP> env | grep '^PG') \
  -v <APP>_qbank-data:/data -v <APP>_qbank-backups:/backups:ro \
  "$(docker inspect -f '{{.Config.Image}}' backup-<APP>)" \
  sh /scripts/server-restore.sh /backups/daily/qbank-YYYY-MM-DD.tar.gz
```

ثم أعد التشغيل من Coolify.
