const { Telegraf } = require("telegraf");
const fs = require("fs");
require("dotenv").config(); // локально подгружает .env, на Railway будет игнорироваться

console.log("BOT_TOKEN:", process.env.BOT_TOKEN ? "✅ найден" : "❌ нет");

const bot = new Telegraf(process.env.BOT_TOKEN);

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

// Команда /start
bot.start(async (ctx) => {
  await ctx.reply("Бот работает! 🚀");
});

// Обработка сообщений (логины)
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

  await ctx.reply(`✅ Логин "${message}" сохранён!`);
});

// Запуск
bot.launch();
console.log("🤖 Бот запущен");
