const { Telegraf, Scenes, session, Markup } = require('telegraf');
const fs = require('fs');

// === Настройки ===
const BOT_TOKEN = '7088809054:AAEz2xMrDsnmIpms7JFqy_uSZ0jHZd-zgUo';
const ADMIN_ID = 1704458173;
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
    await ctx.reply('Введите ваш ID от 🍾Vodka.bet:');
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (ctx.message.text === '⬅️ Назад') {
      return ctx.scene.leave();
    }
    if (ctx.message.text === '🔁 Рестарт') {
      return ctx.wizard.selectStep(0);
    }
    ctx.wizard.state.data.vodkaID = ctx.message.text;
    await ctx.reply('Введите ваш Никнейм на Kick:');
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (ctx.message.text === '⬅️ Назад') {
        await ctx.reply('Введите ваш ID от 🍾Vodka.bet:');
        return ctx.wizard.selectStep(1);
      }
      if (ctx.message.text === '🔁 Рестарт') {
        await ctx.reply('Начинаем заново.');
        return ctx.wizard.selectStep(0);
      }
    ctx.wizard.state.data.kickNick = ctx.message.text;
    await ctx.reply('🤔Введите какой будет максимальный X за сегодняшний день марафона:');
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (ctx.message.text === '⬅️ Назад') {
        await ctx.reply('Введите ваш ID от 🍾Vodka.bet:');
        return ctx.wizard.selectStep(1);
      }
      if (ctx.message.text === '🔁 Рестарт') {
        await ctx.reply('Начинаем заново.');
        return ctx.wizard.selectStep(0);
      }
    ctx.wizard.state.data.maxX = ctx.message.text;
    await ctx.reply('🧐Введите какой будет Конечный баланс сегодняшнего дня марафона:');
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (ctx.message.text === '⬅️ Назад') {
        await ctx.reply('🤔Введите какой будет максимальный X за сегодняшний день марафона:');
        return ctx.wizard.selectStep(3);
      }
      if (ctx.message.text === '🔁 Рестарт') {
        await ctx.reply('Начинаем заново.');
        return ctx.wizard.selectStep(0);
      }
    ctx.wizard.state.data.finalBalance = ctx.message.text;

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
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.reply('⛔ У вас нет прав на сброс данных.');
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
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.reply('⛔ У вас нет прав на блокировку данных.');
  }

  isLocked = true;
  saveLockState();
  await ctx.reply('✅ Заявки на участие в марафоне закрыты.');
});

// Команда для разблокировки таблицы
bot.command('unlock', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.reply('⛔ У вас нет прав на разблокировку данных.');
  }

  isLocked = false;
  saveLockState();
  await ctx.reply('✅ Заявки на участие в марафоне открыты.');
});

// Команда для расчёта победителей
bot.command('cal', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
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

    return ctx.reply(
      `📊 Расчёт завершён\n\n` +
      `🎯 Итоговый Max X: ${finalX}\n` +
      `💰 Итоговый Final Balance: ${finalBalance}\n\n` +
      `🏆 Победитель по Max X:\n👤 ${closestX.telegramName} — ${closestX.maxX}\n\n` +
      `🏆 Победитель по Final Balance:\n👤 ${closestBalance.telegramName} — ${closestBalance.finalBalance}`
    );
  }
});

// Запуск бота
bot.launch();
console.log('🤖 Бот запущен');
