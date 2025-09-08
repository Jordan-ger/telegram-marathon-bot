const { Telegraf } = require('telegraf');
const fs = require('fs');
require('dotenv').config();

// Читаем токен из .env
const BOT_TOKEN = process.env.BOT_TOKEN;

const bot = new Telegraf(BOT_TOKEN);

// Файл для хранения логинов
const DATA_FILE = 'logins.json';

// Загружаем сохранённые логины
let logins = {};
if (fs.existsSync(DATA_FILE)) {
  logins = JSON.parse(fs.readFileSync(DATA_FILE));
}

// Сохраняем логины в файл
function saveLogins() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(logins, null, 2));
}

// Команда /start
bot.start(async (ctx) => {
  await ctx.reply(
    `Привет! Мы на Балик в лицензионный казик закидываем. Депозит вносить не потребуется. Если что-то поднимешь, сможешь вывести на карту!  

https://t.me/casinobetlink/10

Регаешься по ссылке, с промокодом: UFO

И как зарегаешься, напиши свой логин сюда. 
Я переведу прямо на баланс!`
  );
});

// Обработка сообщений (логины)
bot.on('text', async (ctx) => {
  const userId = String(ctx.from.id);
  const message = ctx.message.text.trim();

  // Проверяем, сохранили ли уже логин
  if (logins[userId]) {
    return ctx.reply('❌ Вы уже отправили логин. Второй раз нельзя.');
  }

  // Сохраняем первый логин
  logins[userId] = {
    telegramName: `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim(),
    telegramID: userId,
    username: ctx.from.username || '',
    login: message,
  };
  saveLogins();

  await ctx.reply(`✅ Логин "${message}" сохранён!`);
});

// Запуск
bot.launch();
console.log('🤖 Бот запущен');
