const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
require("dotenv").config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const GROUP_ID = -1003093096797;
const ADMIN_ID = 1704458173; // замени на свой ID

// Файл для логинов
const DATA_FILE = "logins.json";let logins = {};
if (fs.existsSync(DATA_FILE)) {
  logins = JSON.parse(fs.readFileSync(DATA_FILE));}
function saveLogins() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(logins, null, 2));
}

// --- Первый заход ---
bot.start(async (ctx) => {
  // Отправляем фотографию
  await ctx.replyWithPhoto(
    { url: "https://i.postimg.cc/Gh8DLWZ5/assets-task-01k4pkk5xpe88vt7gj3y6fjg7y-1757400501-img-0-1.jpg" }, // замени на свою первую фотку
    {
      caption: "Привет! Этот бот для раздачи денег 💸.\nЧтобы продолжить, нажми кнопку ниже:",
      ...Markup.inlineKeyboard([Markup.button.callback("➡️ Продолжить", "STEP1")]),
    }
  );
});

// --- Первый шаг после приветствия ---
bot.action("STEP1", async (ctx) => {
  // Редактируем сообщение или отправляем новую фотку + текст
  await ctx.replyWithPhoto(
    { url: "https://i.postimg.cc/wxbJdqbN/20250909-0107-remix-01k4nnt8knfgdap45g3kc78cxx-1.jpg" }, // замени на свою вторую фотку
    {
      caption: `Чтобы получить 300р, тебе нужно зарегистрироваться по ссылке:\nhttps://t.me/casinobetlink/10\nи прислать свой логин. В течение 2 часов деньги придут на аккаунт по логину.`,
      ...Markup.inlineKeyboard([Markup.button.callback("✏️ Прислать логин", "SEND_LOGIN")]),
    }
  );

  // Удаляем старое сообщение с кнопкой, чтобы не было кучи сообщений
  try { await ctx.deleteMessage(); } catch(e) {}
});

// --- Кнопка "Прислать логин" ---
bot.action("SEND_LOGIN", async (ctx) => {
  const userId = String(ctx.from.id);

  if (logins[userId]) {
    return ctx.reply("❌ Вы уже отправили логин. Второй раз нельзя.");
  }

  await ctx.reply("Напиши свой логин, который зарегистрировал:");

  // Флаг ожидания логина
  bot.context.waitingForLogin = bot.context.waitingForLogin || {};
  bot.context.waitingForLogin[userId] = true;
});

// --- Обработка текста с логином ---
bot.on("text", async (ctx) => {
  const userId = String(ctx.from.id);

  if (!bot.context.waitingForLogin?.[userId]) return;

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

  bot.context.waitingForLogin[userId] = false;

  await ctx.reply(`✅ Логин "${message}" сохранён! Деньги поступят в течение 2 часов.`);

await bot.telegram.sendMessage(GROUP_ID, message);

});

// --- Запуск ---
bot.launch().then(() => console.log("🤖 Бот запущен"));
