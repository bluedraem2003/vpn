import logging
from aiogram import Bot, Dispatcher, executor, types

# تنظیمات اصلی
API_TOKEN = '8772453599:AAEkwIYQDUhXOpUjNfh0ReZszBkDHp9lmDc' # توکن را اینجا قرار دهید
ADMIN_ID = 1732283989              # آیدی عددی خود را اینجا بگذارید

logging.basicConfig(level=logging.INFO)
bot = Bot(token=API_TOKEN)
dp = Dispatcher(bot)

# لیست قیمت
PRICE_LIST = "💙 لیست قیمت VPN:\n\n🔹 10 گیگ ➜ 150,000 تومان\n🔹 20 گیگ ➜ 300,000 تومان\n🔹 30 گیگ ➜ 450,000 تومان\n🔹 40 گیگ ➜ 600,000 تومان\n🔹 50 گیگ ➜ 750,000 تومان\n\nشماره کارت: 5041721232503384"

@dp.message_handler(commands=['start'])
async def start(message: types.Message):
    markup = types.ReplyKeyboardMarkup(resize_keyboard=True)
    markup.add("📊 مشاهده لیست قیمت", "💳 ارسال رسید پرداخت", "👤 پشتیبانی")
    await message.answer("سلام! به فروشگاه وی‌پی‌ان خوش آمدید.", reply_markup=markup)

@dp.message_handler(text="📊 مشاهده لیست قیمت")
async def prices(message: types.Message):
    await message.answer(PRICE_LIST)

@dp.message_handler(text="💳 ارسال رسید پرداخت")
async def send_receipt(message: types.Message):
    await message.answer("لطفاً عکس فیش واریزی خود را ارسال کنید.")

@dp.message_handler(content_types=['photo'])
async def handle_photo(message: types.Message):
    await bot.send_photo(ADMIN_ID, message.photo[-1].file_id, caption=f"رسید جدید از کاربر: {message.from_user.id}")
    await message.answer("رسید شما دریافت شد و در حال بررسی است. منتظر تایید ادمین باشید.")

@dp.message_handler(commands=['broadcast'])
async def broadcast(message: types.Message):
    if message.from_user.id == ADMIN_ID:
        text = message.get_args()
        # اینجا باید لیستی از کاربران در دیتابیس داشته باشید
        await message.answer("پیام شما برای کاربران ارسال شد.")

if __name__ == '__main__':
    executor.start_polling(dp, skip_updates=True)