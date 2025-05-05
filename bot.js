const { Telegraf, Scenes, session, Markup } = require('telegraf');
const fs = require('fs');

// === Настройки ===
require('dotenv').config();
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS = process.env.ADMIN_IDS.split(',').map(id => Number(id.trim()));
const DATA_FILE = 'participants.json';
const LOCK_FILE = 'lock.json'; // Файл для блокировки

const bot = new Telegraf(BOT_TOKEN);
let awaitingFinals = {};

// Загрузка и сохранение участников
let participants = {};
let isLocked = false; // Состояние блокировки таблицы
if (fs.existsSync(DATA_FILE)) {
  participants = JSON.parse(fs.readFileSync(DATA_FILE));
}

if (fs.existsSync(LOCK_FILE)) {
  isLocked = JSON.parse(fs.readFileSync(LOCK_FILE)).isLocked;
}

function saveParticipants() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(participants, null, 2));
}

function saveLockState() {
  fs.writeFileSync(LOCK_FILE, JSON.stringify({ isLocked }, null, 2));
}

// FSM сцена для заполнения данных
const formWizard = new Scenes.WizardScene(
  'form-wizard',

  async (ctx) => {
    const id = String(ctx.from.id);
    if (participants[id]) {
      await ctx.reply('Вы уже участвовали в марафоне!');
      return ctx.scene.leave();
    }

    if (isLocked) {
      await ctx.reply('❌ Заявки на участие в марафоне закрыты.');
      return ctx.scene.leave();
    }

    ctx.wizard.state.data = {};
    await ctx.reply('Введите ваш ID от 🍾Vodka.bet (только английские буквы):');
    return ctx.wizard.next();
  },

  async (ctx) => {
    const vodkaID = ctx.message.text.trim();
    if (!/^[a-zA-Z0-9]+$/.test(vodkaID)) {
      return ctx.reply('❌ ID должен содержать только английские буквы и цифры. Попробуйте снова:');
    }
    ctx.wizard.state.data.vodkaID = vodkaID;
    await ctx.reply('Введите ваш Никнейм на Kick (только английские буквы):');
    return ctx.wizard.next();
  },

  async (ctx) => {
    const kickNick = ctx.message.text.trim();
    if (!/^[a-zA-Z0-9]+$/.test(kickNick)) {
      return ctx.reply('❌ Никнейм должен содержать только английские буквы и цифры. Попробуйте снова:');
    }
    ctx.wizard.state.data.kickNick = kickNick;
    await ctx.reply('🤔 Введите максимальный X за сегодняшний день (только число):');
    return ctx.wizard.next();
  },

  async (ctx) => {
    const maxX = ctx.message.text.trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(maxX)) {
      return ctx.reply('❌ Максимальный X должен быть числом. Попробуйте снова:');
    }
    ctx.wizard.state.data.maxX = maxX;
    await ctx.reply('🧐 Введите конечный баланс за сегодняшний день (только число):');
    return ctx.wizard.next();
  },

  async (ctx) => {
    const finalBalance = ctx.message.text.trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(finalBalance)) {
      return ctx.reply('❌ Конечный баланс должен быть числом. Попробуйте снова:');
    }
    ctx.wizard.state.data.finalBalance = finalBalance;

    const id = String(ctx.from.id);
    participants[id] = {
      telegramName: `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim(),
      telegramID: id,
      ...ctx.wizard.state.data,
    };
    saveParticipants();

    await ctx.reply('Спасибо! Вы успешно подали заявку ✅');
    return ctx.scene.leave();
  }
);

bot.action('restart_form', async (ctx) => {
    await ctx.answerCbQuery(); // закрыть "загрузка..."
    await ctx.scene.enter('form-wizard');
});

const stage = new Scenes.Stage([formWizard]);
bot.use(session());
bot.use(stage.middleware());

// Команда /start
bot.start(async (ctx) => {
  await ctx.reply(
    `👋 Добро пожаловать на марафон!\n\nНажмите кнопку ниже, чтобы подать заявку на участие.`,
    Markup.keyboard([['🎯 Участвовать в марафоне']]).resize()
  );
});

// Кнопка "Участвовать"
bot.hears('🎯 Участвовать в марафоне', (ctx) => ctx.scene.enter('form-wizard'));

// Команда для администратора для сброса
bot.command('reset', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) {
    return ctx.reply('⛔ У вас нет прав использовать эту команду.');
  }

  participants = {};
  saveParticipants();

  await ctx.reply('✅ Данные участников сброшены. Все могут участвовать снова.');
  if (ctx.message.text === '🔁 Рестарт') {
    await ctx.reply('Начинаем заново.');
    return ctx.wizard.selectStep(0);
  }
});

// Команда для блокировки таблицы
bot.command('lock', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) {
    return ctx.reply('⛔ У вас нет прав использовать эту команду.');
  }

  isLocked = true;
  saveLockState();
  await ctx.reply('✅ Заявки на участие в марафоне закрыты.');
});

// Команда для разблокировки таблицы
bot.command('unlock', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) {
    return ctx.reply('⛔ У вас нет прав использовать эту команду.');
  }

  isLocked = false;
  saveLockState();
  await ctx.reply('✅ Заявки на участие в марафоне открыты.');
});

// Команда для расчёта победителей
bot.command('cal', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) {
    return ctx.reply('⛔ У вас нет прав использовать эту команду.');
  }
  awaitingFinals[ctx.from.id] = { step: 'awaiting_maxX' };
  await ctx.reply('Введите итоговый максимальный X');
});

bot.on('text', async (ctx) => {
  const state = awaitingFinals[ctx.from.id];
  if (!state) return;

  if (state.step === 'awaiting_maxX') {
    const maxX = parseFloat(ctx.message.text.replace(',', '.'));
    if (isNaN(maxX)) return ctx.reply('❌ Введите корректное число для максимального икса.');
    state.finalX = maxX;
    state.step = 'awaiting_balance';
    return ctx.reply('Теперь введите итоговый Заключительный баланс:');
  }

  if (state.step === 'awaiting_balance') {
    const finalBalance = parseFloat(ctx.message.text.replace(',', '.'));
    if (isNaN(finalBalance)) return ctx.reply('❌ Введите корректное число для Конечного баланса.');

    const finalX = state.finalX;
    delete awaitingFinals[ctx.from.id]; // Очистка состояния

    const entries = Object.values(participants).map(p => ({
      ...p,
      maxXNum: parseFloat(String(p.maxX).replace(',', '.')) || 0,
      balanceNum: parseFloat(String(p.finalBalance).replace(',', '.')) || 0,
    }));

    if (entries.length === 0) {
      return ctx.reply('❌ Нет участников для расчёта.');
    }

    const closestX = entries.reduce((prev, curr) =>
      Math.abs(curr.maxXNum - finalX) < Math.abs(prev.maxXNum - finalX) ? curr : prev
    );

    const closestBalance = entries.reduce((prev, curr) =>
      Math.abs(curr.balanceNum - finalBalance) < Math.abs(prev.balanceNum - finalBalance) ? curr : prev
    );
// Отправка победителям
try {
  await bot.telegram.sendMessage(closestX.telegramID, `🎉 Поздравляем! Вы победили по максимальному X с результатом: ${closestX.maxX}`);
} catch (e) {
  console.error(`Не удалось отправить сообщение победителю X (${closestX.telegramID}):`, e);
}

try {
  await bot.telegram.sendMessage(closestBalance.telegramID, `🎉 Поздравляем! Вы победили по конечному балансу с результатом: ${closestBalance.finalBalance}`);
} catch (e) {
  console.error(`Не удалось отправить сообщение победителю Balance (${closestBalance.telegramID}):`, e);
}

// Формируем список участников
const participantList = entries.map((p, i) =>
  `${i + 1}. ${p.telegramName} | VodkaID: ${p.vodkaID} | Kick: ${p.kickNick} | Max X: ${p.maxX} | Final Balance: ${p.finalBalance}`
).join('\n');

// Рассылаем всем участникам
for (const p of entries) {
  try {
    await bot.telegram.sendMessage(p.telegramID, `📋 Список участников марафона:\n\n${participantList}`);
  } catch (e) {
    console.error(`Не удалось отправить участнику (${p.telegramID}):`, e);
  }
}

    return ctx.reply(
      `📊 Расчёт завершён\n\n` +
      `🎯 Итоговый Max X: ${finalX}\n` +
      `💰 Итоговый Final Balance: ${finalBalance}\n\n` +
      `🏆 Победитель по Max X:\n👤 ${closestX.telegramName} — ${closestX.maxX}\n\n` +
      `🏆 Победитель по Final Balance:\n👤 ${closestBalance.telegramName} — ${closestBalance.finalBalance}`
    );
  }
})

;

// Запуск бота
bot.launch();
console.log('🤖 Бот запущен');
