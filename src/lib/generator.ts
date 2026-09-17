import type {
  ContentFormat,
  GenerateInput,
  GeneratedContent,
  Language,
  Tone,
} from '../types'

const hooks: Record<Tone, string[]> = {
  friendly: [
    'اگر دنبال {topic} هستی، همین پست مال توئه.',
    'راستش رو بخوای، {topic} از چیزی که فکر می‌کنی ساده‌تره.',
    'امروز یه نکته کوچیک درباره {topic} که خیلی‌ها نمی‌دونن.',
  ],
  pro: [
    '۳ اصل کلیدی برای بهتر شدن در {topic}',
    'تحلیل کوتاه و کاربردی درباره {topic}',
    'اگر می‌خوای در {topic} نتیجه بگیری، از اینجا شروع کن.',
  ],
  witty: [
    '{topic} رو سخت گرفتن؟ بیا ساده‌اش کنیم.',
    'قبل از اینکه باز هم درباره {topic} استرس بگیری، اینو بخون.',
    'راز {topic}؟ کمتر پیچیده فکر کردن.',
  ],
  inspiring: [
    'هر روز یه قدم نزدیک‌تر به {topic}',
    'تو می‌تونی {topic} رو به سبک خودت بسازی.',
    'شروع، مهم‌ترین بخش {topic} است.',
  ],
  luxury: [
    'جزئیاتی از {topic} که تفاوت می‌سازند.',
    'نگاهی دقیق‌تر به تجربهٔ ممتاز {topic}',
    'وقتی {topic} با سلیقه همراه می‌شود.',
  ],
}

const bodyBlocks: Record<Tone, string[]> = {
  friendly: [
    'اول از همه، مخاطبت رو بشناس و نیازش رو ساده بیان کن. بعد با یه مثال واقعی نشون بده چرا {topic} مهمه. در نهایت یه اقدام خیلی کوچک پیشنهاد بده تا حس پیشرفت ایجاد بشه.',
    'برای {topic} لازم نیست همه‌چیز رو یک‌شبه عوض کنی. همین امروز یکی از این کارها رو انجام بده و نتیجه‌ش رو یادداشت کن. پیشرفت از همین نقطه‌های کوچیک شروع می‌شه.',
  ],
  pro: [
    'چارچوب پیشنهادی: ۱) تعریف هدف مشخص برای {topic} ۲) انتخاب یک معیار قابل‌اندازه‌گیری ۳) اجرای آزمایش کوچک ۴) بازخورد و بهبود. این چرخه ساده، کیفیت خروجی رو پایدار می‌کنه.',
    'در {topic}، تمرکز روی ارزش واضح برای مخاطب مهم‌تر از تولید زیاد است. پیام را کوتاه، ساختارمند و قابل‌اجرا نگه دارید تا نرخ تعامل افزایش یابد.',
  ],
  witty: [
    'فرمول ضدخستگی برای {topic}: قلاب قوی + یک حقیقت ساده + یه شوخی کوچیک + دعوت به اقدام. تمام. لازم نیست رمان بنویسی.',
    'اگه {topic} برات گیج‌کننده‌ست، احتمالاً داری ده‌تا کار رو با هم قاطی می‌کنی. یکی رو انتخاب کن، تمومش کن، بعد برو سراغ بعدی.',
  ],
  inspiring: [
    'مسیر {topic} همیشه خط‌کشیده نیست؛ اما هر انتخاب آگاهانه، هویت برندت رو شفاف‌تر می‌کنه. امروز همون نقطه‌ایه که می‌تونی متفاوت دیده بشی.',
    'به جای منتظر ماندن برای شرایط ایده‌آل، نسخهٔ سادهٔ {topic} را منتشر کن. عمل، اعتماد می‌سازد و اعتماد، مخاطب می‌آورد.',
  ],
  luxury: [
    'در فضای {topic}، کیفیت روایت و هماهنگی بصری، حس اعتماد را منتقل می‌کند. کمتر بگو، دقیق‌تر بگو، و هر جزئیات را هم‌راستا با هویت برند نگه دار.',
    'تجربهٔ ممتاز در {topic} از سرعت نمی‌آید؛ از انتخاب‌های سنجیده می‌آید. پیام، تصویر و ریتم محتوا باید یک امضای واحد بسازند.',
  ],
}

const ctas: Record<Tone, string[]> = {
  friendly: [
    'اگر برات مفید بود، سیو کن و برای دوستت بفرست.',
    'تو کامنت بگو کدوم بخش برات جذاب‌تر بود؟',
    'برای نسخهٔ کامل‌تر، کلمهٔ «راهنما» رو کامنت کن.',
  ],
  pro: [
    'این چارچوب را ذخیره کنید و در تقویم محتوایی‌تان به کار بگیرید.',
    'در کامنت بنویسید بزرگ‌ترین چالش شما در این موضوع چیست.',
    'برای دریافت چک‌لیست اجرایی، «چک‌لیست» را کامنت کنید.',
  ],
  witty: [
    'سیو کن؛ فردا یادت می‌ره 😄',
    'اگه موافقی یه 🔥 بذار، اگه مخالفی هم بگو چرا.',
    'اشتراک‌گذاری = کمک به دوست گیج‌شده‌ت.',
  ],
  inspiring: [
    'اولین قدمت رو همین امروز بردار و توی استوری بهمون بگو.',
    'این پست رو سیو کن تا هفتهٔ بعد هم مسیرت رو ببینی.',
    'اگر آماده‌ای شروع کنی، زیر پست بنویس: شروع.',
  ],
  luxury: [
    'برای دریافت نسخهٔ کامل این راهنما، دایرکت دهید.',
    'این نگاه را ذخیره کنید و در استراتژی برندتان به‌کار بگیرید.',
    'اگر به همکاری علاقه‌مندید، در بیو با ما در ارتباط باشید.',
  ],
}

const visualIdeas: Record<ContentFormat, string[]> = {
  feed: [
    'تصویر مینیمال با تایپوگرافی بزرگ عنوان + پس‌زمینه بافت‌دار ملایم',
    'عکس محصول/صحنه واقعی + کادر متن کوتاه در یک‌سوم پایین',
    'قبل/بعد در یک قاب عمودی با کنتراست رنگی ملایم',
  ],
  reel: [
    'شات اول: هوک متنی ۳ ثانیه‌ای روی صحنه نزدیک، سپس کات سریع به مثال عملی',
    'صفحهٔ سیاه با متن سفید برای هوک، بعد نمایش فرآیند از زاویهٔ دست',
    'ریتم تند: مشکل → راه‌حل → نتیجه، با زیرنویس بزرگ و خوانا',
  ],
  story: [
    'استوری پرسش‌محور با استیکر نظرسنجی + پس‌زمینهٔ نرم گرادیانی',
    'سه‌فریم: سوال / نکته / دعوت به سوایپ‌آپ یا ریپلای',
    'کلوزآپ جزئیات + متن کوتاه و دکمهٔ «بیشتر در پست بعدی»',
  ],
  carousel: [
    'اسلاید ۱ هوک، ۲–۴ نکات، ۵ جمع‌بندی + CTA؛ فونت یکدست و فضای سفید زیاد',
    'کاور قوی با عدد (مثل «۵ نکته»)، سپس هر اسلاید یک نکتهٔ مستقل',
    'روایت مرحله‌ای: مشکل، علت، راه‌حل، مثال، اقدام بعدی',
  ],
}

const hashtagPools: Record<string, string[]> = {
  default: [
    'محتوا',
    'اینستاگرام',
    'تولیدمحتوا',
    'مارکتینگ',
    'برندینگ',
    'کسب‌وکار',
    'دیجیتال_مارکتینگ',
    'ایده_پست',
    'رشدپیج',
    'کپشن',
  ],
  beauty: ['زیبایی', 'مراقبت_پوست', 'آرایشی', 'بیوتی', 'اسکینکر'],
  food: ['غذا', 'آشپزی', 'رسپی', 'کافه', 'فود'],
  fitness: ['ورزش', 'فیتنس', 'سلامتی', 'تمرین', 'انگیزشی'],
  tech: ['تکنولوژی', 'استارتاپ', 'هوش_مصنوعی', 'برنامه_نویسی', 'نوآوری'],
  fashion: ['مد', 'استایل', 'فشن', 'لباس', 'ترند'],
}

const reelBeats = [
  '۰–۳ث: هوک متنی روی صورت/محصول',
  '۳–۱۰ث: طرح مشکل مخاطب',
  '۱۰–۲۵ث: راه‌حل در ۲–۳ نکته کوتاه',
  '۲۵–۳۵ث: مثال واقعی یا دمو',
  '۳۵–۴۵ث: CTA واضح (سیو / کامنت / فالو)',
]

const carouselTemplates = [
  'کاور: وعدهٔ ارزش',
  'نکته ۱',
  'نکته ۲',
  'نکته ۳',
  'اشتباه رایج',
  'جمع‌بندی + دعوت به اقدام',
]

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]
}

function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return h
}

function fill(template: string, topic: string): string {
  return template.replaceAll('{topic}', topic.trim() || 'این موضوع')
}

function detectNicheTags(niche: string): string[] {
  const n = niche.toLowerCase()
  if (/زیبا|آرای|پوست|beauty|skin/.test(n)) return hashtagPools.beauty
  if (/غذا|آشپ|کافه|food|recipe/.test(n)) return hashtagPools.food
  if (/ورزش|فیت|سلامت|fit|gym/.test(n)) return hashtagPools.fitness
  if (/تک|برنامه|استارتاپ|ai|tech/.test(n)) return hashtagPools.tech
  if (/مد|فشن|لباس|fashion|style/.test(n)) return hashtagPools.fashion
  return []
}

function buildHashtags(topic: string, niche?: string): string[] {
  const topicTag = topic
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('_')
    .replace(/[^\w\u0600-\u06FF_]/g, '')
  const nicheTags = detectNicheTags(niche || topic)
  const pool = [...nicheTags, ...hashtagPools.default]
  const selected = Array.from(new Set([topicTag, ...pool])).filter(Boolean).slice(0, 12)
  return selected.map((t) => `#${t}`)
}

function localizeCaption(text: string, language: Language): string {
  if (language === 'fa') return text
  if (language === 'en') {
    return `Quick take on this topic:\n\n${text}\n\nSave this for later.`
  }
  return `${text}\n\n—\nEnglish tip: Keep one clear idea per post and end with a simple next step.`
}

function emojiWrap(text: string, include: boolean, tone: Tone): string {
  if (!include) return text
  const map: Record<Tone, string> = {
    friendly: '✨ ',
    pro: '📌 ',
    witty: '😄 ',
    inspiring: '🌱 ',
    luxury: '✦ ',
  }
  return `${map[tone]}${text}`
}

export function generateContent(
  input: GenerateInput,
  meta?: { pageName?: string; niche?: string; voice?: string },
): GeneratedContent {
  const seed = hash(`${input.topic}|${input.format}|${input.tone}|${Date.now() % 7}`)
  const topic = input.topic.trim() || 'رشد پیج اینستاگرام'
  const hook = emojiWrap(fill(pick(hooks[input.tone], seed), topic), input.includeEmoji, input.tone)
  const body = fill(pick(bodyBlocks[input.tone], seed + 1), topic)
  const goalLine = input.goal.trim()
    ? `\n\nهدف این محتوا: ${input.goal.trim()}.`
    : ''
  const voiceLine = meta?.voice?.trim()
    ? `\n\nلحن برند: ${meta.voice.trim()}.`
    : ''

  let caption = `${hook}\n\n${body}${goalLine}${voiceLine}`
  caption = localizeCaption(caption, input.language)

  const cta = input.includeCta ? pick(ctas[input.tone], seed + 2) : ''
  if (cta) caption = `${caption}\n\n${cta}`

  const hashtags = buildHashtags(topic, meta?.niche)
  const visualIdea = pick(visualIdeas[input.format], seed + 3)

  const altCaptions = [0, 1].map((i) => {
    const altHook = fill(pick(hooks[input.tone], seed + 10 + i), topic)
    const altBody = fill(pick(bodyBlocks[input.tone], seed + 20 + i), topic)
    return localizeCaption(`${altHook}\n\n${altBody}`, input.language)
  })

  const result: GeneratedContent = {
    id: `gen_${Date.now()}_${Math.abs(seed)}`,
    createdAt: Date.now(),
    input,
    pageName: meta?.pageName,
    hook,
    caption,
    hashtags,
    cta,
    visualIdea,
    altCaptions,
  }

  if (input.format === 'reel') {
    result.reelScript = [
      `موضوع: ${topic}`,
      ...reelBeats.map((b, i) => `${i + 1}) ${b}`),
      `متن روی ویدیو: ${hook}`,
      `پایان: ${cta || 'فالو برای نکات بعدی'}`,
    ].join('\n')
  }

  if (input.format === 'carousel') {
    result.carouselSlides = carouselTemplates.map((label, i) => {
      if (i === 0) return `${label}: ${hook}`
      if (i === carouselTemplates.length - 1) return `${label}: ${cta || 'سیو کن و شروع کن'}`
      return `${label} درباره ${topic}`
    })
  }

  return result
}

export const weeklyIdeas = [
  { day: 'شنبه', title: 'معرفی ارزش اصلی برند', format: 'feed' as ContentFormat },
  { day: 'یکشنبه', title: 'پشت‌صحنه کار یا تیم', format: 'story' as ContentFormat },
  { day: 'دوشنبه', title: 'آموزش کوتاه یک‌نکته‌ای', format: 'reel' as ContentFormat },
  { day: 'سه‌شنبه', title: 'سوال از مخاطب + نظرسنجی', format: 'story' as ContentFormat },
  { day: 'چهارشنبه', title: 'کاروسل چک‌لیست کاربردی', format: 'carousel' as ContentFormat },
  { day: 'پنجشنبه', title: 'داستان مشتری یا نتیجه', format: 'reel' as ContentFormat },
  { day: 'جمعه', title: 'جمع‌بندی هفته + CTA نرم', format: 'feed' as ContentFormat },
]

export const formatLabels: Record<ContentFormat, string> = {
  feed: 'پست فید',
  reel: 'ریلز',
  story: 'استوری',
  carousel: 'کاروسل',
}

export const toneLabels: Record<Tone, string> = {
  friendly: 'صمیمی',
  pro: 'حرفه‌ای',
  witty: 'شوخ',
  inspiring: 'الهام‌بخش',
  luxury: 'لوکس',
}
