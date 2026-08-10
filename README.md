[🇺🇸 Read in English](README_en.md)

# 🤖 ربات هوشمند تلگرام بیزینس
[![JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript&logoColor=black)
[![Cloudflare Workers](https://workers.cloudflare.com/)](https://img.shields.io/badge/Cloudflare_Workers-Serverless-F38020?logo=cloudflare&logoColor=white]()
یک ربات تلگرام مبتنی بر Cloudflare Workers که با استفاده از مدل‌های Mistral AI به پیام‌های کاربران در حساب بیزینس تلگرام پاسخ می‌دهد. این ربات دارای قابلیت‌های زیر است:

- پاسخ‌دهی هوشمند با حفظ تاریخچه مکالمه (۶ پیام اخیر)
- تشخیص پیام‌های خود شما (مالک) و غیرفعال‌سازی موقت ربات برای جلوگیری از تداخل
- نمایش وضعیت تایپ در حین تولید پاسخ
- ارسال لاگ‌های عملیاتی به پیام‌های خصوصی شما
- پشتیبانی کامل از Telegram Business API

---

## ✨ ویژگی‌های کلیدی

| ویژگی | توضیح |
| :--- | :--- |
| **پاسخ‌دهی مبتنی بر AI** | استفاده از مدل‌های Mistral (یا هر سرویس سازگار با OpenAI) برای تولید پاسخ‌های طبیعی |
| **حافظه‌ی مکالمه** | ذخیره‌سازی ۶ پیام آخر هر چت در Cloudflare KV برای درک بهتر متن |
| **حالت سکوت (Pause)** | پس از ارسال پیام توسط مالک، ربات به مدت مشخص (پیش‌فرض ۱ دقیقه) در آن چت پاسخ نمی‌دهد تا تداخلی ایجاد نشود. |
| **لاگ‌های عملیاتی** | ارسال خودکار لاگ‌های خطا و وضعیت به پیام‌خصوصی مالک برای عیب‌یابی آسان |
| **واکنش تایپ** | نمایش وضعیت «در حال تایپ» در تلگرام هنگام تولید پاسخ |
| **سازگاری با Business API** | استفاده از `business_connection_id` برای ارسال پیام و action در چت‌های بیزینسی |

---

## 📋 پیش‌نیازها

| مورد | توضیحات |
| :--- | :--- |
| **حساب Cloudflare** | برای استفاده از Workers و KV Storage |
| **ربات تلگرام** | ساخته شده توسط [@BotFather](https://t.me/botfather) |
| **حساب بیزینس تلگرام** | فعال‌سازی Telegram Business (برای دریافت پیام‌های بیزینسی) |
| **کلید API Mistral** | دریافت از [Mistral AI Console](https://console.mistral.ai/) |
| **آیدی عددی تلگرام خود** | دریافت از ربات [@userinfobot](https://t.me/userinfobot) |

---

## 🛠️ راه‌اندازی گام‌به‌گام

### ۱. ایجاد Worker جدید در Cloudflare

1. وارد [داشبورد Cloudflare](https://dash.cloudflare.com/) شوید.
2. از منوی سمت چپ، **Workers & Pages** را انتخاب کنید.
3. روی **Create application** > **Create Worker** کلیک کنید.
4. یک نام دلخواه (مثلاً `telegram-business-bot`) وارد کرده و **Deploy** را بزنید.
5. پس از ایجاد، روی **Edit code** بروید.

### ۲. ایجاد KV Namespace برای ذخیره‌سازی تاریخچه و وضعیت

ربات برای ذخیره‌ی تاریخچه و وضعیت `pause` از Cloudflare KV استفاده می‌کند.

1. در داشبورد، از منوی سمت چپ به **Workers & Pages** بروید.
2. تب **KV** را انتخاب کرده و **Create namespace** را بزنید.
3. نامی مانند `BOT_KV` وارد کنید و ایجاد کنید.
4. به Worker خود برگردید و در بخش **Settings** > **Variables** > **KV Namespace Bindings**، یک binding با:
   - **Variable name**: `BOT_KV`
   - **KV namespace**: نام فضای ایجاد شده را انتخاب کنید.
   - روی **Save** کلیک کنید.

### ۳. تنظیم متغیرهای محیطی (اختیاری اما توصیه شده)

برای امنیت بیشتر، مقادیر حساس را به‌جای هاردکد در کد، به‌عنوان متغیر محیطی تنظیم کنید:

1. در Worker، به بخش **Settings** > **Variables** بروید.
2. در قسمت **Environment Variables**، مقادیر زیر را اضافه کنید:

| متغیر | مقدار نمونه | توضیح |
| :--- | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | `123456:ABC-DEF...` | توکن ربات تلگرام |
| `MY_TELEGRAM_ID` | `123456789` | آیدی عددی خودتان |
| `MISTRAL_API_KEY` | `xyz...` | کلید API میسترال |
| `MISTRAL_BASE_URL` | `https://api.mistral.ai/v1/chat/completions` | آدرس API (در صورت استفاده از سرویس دیگر تغییر دهید) |
| `MISTRAL_MODEL` | `mistral-large-latest` | نام مدل |

سپس در کد، به‌جای ثابت‌ها از `env.MY_VARIABLE` استفاده کنید (اگر کد فعلی را با ثابت‌ها نگه داشته‌اید، نیازی به این مرحله نیست).

### ۴. آپلود کد Worker

کد اصلی (`worker.js`) را که در اختیار دارید، در ویرایشگر Worker کپی کنید. در صورتی که از متغیرهای محیطی استفاده می‌کنید، ثابت‌های ابتدای کد را با `env.` جایگزین کنید؛ در غیر این صورت، مقادیر را مستقیماً در کد ویرایش کنید.

```javascript
const TELEGRAM_BOT_TOKEN = "توکن خود";  // یا env.TELEGRAM_BOT_TOKEN
const MY_TELEGRAM_ID = 123456789;      // یا env.MY_TELEGRAM_ID
const OFFLINE_TIMEOUT_MINUTES = 1;     // مدت زمان سکوت به دقیقه
const MISTRAL_API_KEY = "کلید API";    // یا env.MISTRAL_API_KEY
const MISTRAL_BASE_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL = "mistral-large-latest";
