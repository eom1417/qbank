import type { cliLoginEn } from './catalog-cli-login-en.js';

/** Strings of signing in through the providers' CLIs; same keys as catalog-cli-login-en.ts. */
export const cliLoginAr: Record<keyof typeof cliLoginEn, string> = {
  'cliLogin.title': 'تسجيل الدخول',
  'cliLogin.lead':
    'يعمل من أي جهاز: افتح الرابط من هنا، ووافق، ويُكمل QBank الباقي. يبقى دخولك قائماً ويتجدّد تلقائياً.',
  'cliLogin.method.codex.chatgpt': 'الدخول بحساب ChatGPT',
  'cliLogin.method.codex.chatgpt.hint':
    'الموصى به. يستخدم اشتراك ChatGPT Plus أو Pro، برمز لمرة واحدة.',
  'cliLogin.method.codex.apiKey': 'استخدام مفتاح OpenAI API',
  'cliLogin.method.codex.apiKey.hint': 'يُدفع حسب الاستخدام من حساب OpenAI.',
  'cliLogin.method.claude.subscription': 'الدخول بحساب Claude',
  'cliLogin.method.claude.subscription.hint': 'الموصى به. يستخدم اشتراك Claude Pro أو Max.',
  'cliLogin.method.claude.console': 'الدخول عبر Anthropic Console',
  'cliLogin.method.claude.console.hint': 'يُدفع حسب الاستخدام من حساب Anthropic API.',
  'cliLogin.apiKey': 'مفتاح OpenAI API',
  'cliLogin.saveKey': 'ادخل بهذا المفتاح',
  'cliLogin.preparing': 'نجهّز تسجيل الدخول…',
  'cliLogin.open': 'افتح صفحة الدخول',
  'cliLogin.enterCode': 'في تلك الصفحة، أدخل هذا الرمز:',
  'cliLogin.copy': 'انسخ الرمز',
  'cliLogin.waiting': 'بانتظار موافقتك في الصفحة…',
  'cliLogin.pasteCode': 'الرمز الذي تعرضه الصفحة بعد موافقتك',
  'cliLogin.pasteHint': 'انسخه من الصفحة والصقه هنا.',
  'cliLogin.confirm': 'أكمل تسجيل الدخول',
  'cliLogin.verifying': 'نتحقق…',
  'cliLogin.done': 'تم الدخول. يبقى قائماً ويتجدّد تلقائياً.',
  'cliLogin.failed': 'لم يكتمل تسجيل الدخول.',
  'cliLogin.expired': 'استغرق الدخول أكثر من 15 دقيقة. ابدأ من جديد.',
  'cliLogin.cancelled': 'أُلغي تسجيل الدخول.',
  'cliLogin.replaced': 'حلّ محلّه تسجيل دخول أحدث.',
  'cliLogin.unavailable': 'برنامج هذا المزوّد غير موجود حيث يعمل QBank.',
  'cliLogin.again': 'ابدأ من جديد',
  'cliLogin.signOut': 'تسجيل الخروج',
  'cliLogin.signOut.confirm': 'سجّل الخروج من هذا المزوّد',
  'ai.model.default': 'النموذج الافتراضي',
  'import.ai.read': 'دع الذكاء الاصطناعي يقرأ الصفحات كاملة',
  'import.ai.read.hint':
    'الأفضل للصفحات الممسوحة والتنسيقات المعقدة: يقرأ صورة كل صفحة ويأخذ الأسئلة والخيارات والإجابة والشرح المطبوعين في الصفحة، والصور. أبطأ: طلب لكل صفحة من اشتراكك. الأسئلة تُحفظ كما طُبعت، وما فيه شك وحده ينتظر مراجعتك.',
};
