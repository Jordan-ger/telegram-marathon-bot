const { Telegraf } = require("telegraf");
const fs = require("fs");
require("dotenv").config();

const bot = new Telegraf(process.env.BOT_TOKEN);

console.log("BOT_TOKEN из ENV:", process.env.BOT_TOKEN ? "✅ найден" : "❌ нет");

bot.start((ctx) => ctx.reply("Бот работает! 🚀"));
bot.launch();
