const {Telegraf, Markup, session} = require('telegraf')
require('dotenv').config()
const help = require('./help')
const description = require('./description')
const callback = require('./callback')

const bot = new Telegraf(process.env.BOT_TOKEN)         //Токен бота

// Добавляем middleware для сессий
bot.use(session())

// Инициализация сессии пользователя
bot.use((ctx, next) => {
    // Создаем сессию для пользователя, если её нет
    ctx.session = ctx.session || {
        paymentStatus: false,
        waitingForPost: false,
        messageToForward: null,
        messageType: null
    }
    return next()
})

bot.start(async (ctx) => await ctx.reply(`Привет! ${ctx.from.first_name ? ctx.from.first_name : 'Незнакомец'}, обязательно ознакомься с правилами публикации`, Markup.keyboard([
    ['📝 Рекламная публикация'],
    ['📊 Правила публикации', '📌 Помощь'],
]).resize()))

bot.help((ctx) => ctx.reply(help.helpcommands))

bot.command('post', async (ctx) => {
    await ctx.reply((description.description), Markup.inlineKeyboard(
        [
            [Markup.button.callback('Публикация рекламных предложений', 'adPost')],
        ]
    ))
})

bot.action('adPost', async (ctx) => {
    await ctx.answerCbQuery()
    return ctx.replyWithInvoice(getInvoice(ctx.from.id))
})

bot.hears('📝 Рекламная публикация', async (ctx) => {
    return ctx.replyWithInvoice(getInvoice(ctx.from.id))
})

bot.hears('📊 Правила публикации', (ctx) => ctx.reply(description.description))
bot.hears('📌 Помощь', (ctx) => ctx.reply(help.helpcommands))
bot.hears('оплатить', (ctx) => {
    return ctx.replyWithInvoice(getInvoice(ctx.from.id))
})

const getInvoice = (id) => {
    const invoice = {
        chat_id: id,
        provider_token: process.env.PROVIDER_TOKEN,
        start_parameter: 'get_access',
        title: 'Публикация объявления',
        description: 'Публикация одного объявления в телеграм канале @baraxolka_krd',
        currency: 'RUB',
        protect_content: true,
        prices: [{label: 'Оплата за публикацию объявления', amount: 100 * 100}],
        payload: {
            unique_id: `${id}_${Number(new Date())}`,
            provider_token: process.env.PROVIDER_TOKEN
        }
    }

    return invoice
}

// Обработчик pre-checkout query
bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true))

// Обработчик успешной оплаты
bot.on('successful_payment', async (ctx) => {
    // Устанавливаем статус оплаты в сессии
    ctx.session.paymentStatus = true

    await ctx.reply((callback.callback), Markup.inlineKeyboard(
        [
            [Markup.button.callback('>>> Готово? Жми 🎬 <<<', 'readyPost')],
        ]
    ))
})

// Обработчик нажатия кнопки "Готово"
bot.action('readyPost', async (ctx) => {
    if (ctx.session.paymentStatus) {
        ctx.session.waitingForPost = true
        await ctx.reply('Отлично! Пришлите мне ваше объявление. Вы можете отправить текст, фото с подписью или любой другой контент.')
    } else {
        await ctx.reply('Сначала необходимо оплатить публикацию', Markup.inlineKeyboard(
            [
                [Markup.button.callback('Оплатить', 'adPost')],
            ]
        ))
    }
})

// Обработчик текстовых сообщений
bot.on('text', async (ctx) => {
    // Игнорируем команды и кнопки
    if (ctx.message.text.startsWith('/') || ['📝 Рекламная публикация', '📊 Правила публикации', '📌 Помощь', 'оплатить'].includes(ctx.message.text)) {
        return
    }

    // Проверяем, что пользователь в режиме ожидания поста
    if (ctx.session.waitingForPost) {
        ctx.session.messageToForward = ctx.message.text
        ctx.session.messageType = 'text'

        await ctx.reply('Ваш пост готов к публикации:', Markup.inlineKeyboard(
            [
                [Markup.button.callback('>>> Опубликовать 📨 <<<', 'postForward')],
                [Markup.button.callback('❌ Отменить', 'cancelPost')]
            ]
        ))
    } else {
        // Если сообщение отправлено без оплаты
        if (!ctx.session.paymentStatus) {
            await ctx.reply('Для публикации объявления необходимо сначала произвести оплату:',
                Markup.inlineKeyboard([
                    [Markup.button.callback('Оплатить публикацию', 'adPost')],
                ])
            )
        }
    }
})

// Обработчик фото
bot.on('photo', async (ctx) => {
    if (ctx.session.waitingForPost) {
        // Сохраняем ID фото и подпись
        ctx.session.messageToForward = {
            photoId: ctx.message.photo[ctx.message.photo.length - 1].file_id,
            caption: ctx.message.caption || ''
        }
        ctx.session.messageType = 'photo'

        await ctx.reply('Ваш пост с фото готов к публикации:', Markup.inlineKeyboard(
            [
                [Markup.button.callback('>>> Опубликовать 📨 <<<', 'postForward')],
                [Markup.button.callback('❌ Отменить', 'cancelPost')]
            ]
        ))
    } else {
        // Если фото отправлено без оплаты
        if (!ctx.session.paymentStatus) {
            await ctx.reply('Для публикации объявления необходимо сначала произвести оплату:',
                Markup.inlineKeyboard([
                    [Markup.button.callback('Оплатить публикацию', 'adPost')],
                ])
            )
        }
    }
})

// Обработчик видео
bot.on('video', async (ctx) => {
    if (ctx.session.waitingForPost) {
        ctx.session.messageToForward = {
            videoId: ctx.message.video.file_id,
            caption: ctx.message.caption || ''
        }
        ctx.session.messageType = 'video'

        await ctx.reply('Ваш пост с видео готов к публикации:', Markup.inlineKeyboard(
            [
                [Markup.button.callback('>>> Опубликовать 📨 <<<', 'postForward')],
                [Markup.button.callback('❌ Отменить', 'cancelPost')]
            ]
        ))
    } else {
        // Если видео отправлено без оплаты
        if (!ctx.session.paymentStatus) {
            await ctx.reply('Для публикации объявления необходимо сначала произвести оплату:',
                Markup.inlineKeyboard([
                    [Markup.button.callback('Оплатить публикацию', 'adPost')],
                ])
            )
        }
    }
})

// Обработчик документов
bot.on('document', async (ctx) => {
    if (ctx.session.waitingForPost) {
        ctx.session.messageToForward = {
            documentId: ctx.message.document.file_id,
            caption: ctx.message.caption || ''
        }
        ctx.session.messageType = 'document'

        await ctx.reply('Ваш документ готов к публикации:', Markup.inlineKeyboard(
            [
                [Markup.button.callback('>>> Опубликовать 📨 <<<', 'postForward')],
                [Markup.button.callback('❌ Отменить', 'cancelPost')]
            ]
        ))
    } else {
        // Если документ отправлен без оплаты
        if (!ctx.session.paymentStatus) {
            await ctx.reply('Для публикации объявления необходимо сначала произвести оплату:',
                Markup.inlineKeyboard([
                    [Markup.button.callback('Оплатить публикацию', 'adPost')],
                ])
            )
        }
    }
})

// Обработчик кнопки публикации
bot.action('postForward', async (ctx) => {
    try {
        if (!ctx.session.paymentStatus) {
            return await ctx.reply('Необходимо сначала оплатить публикацию.')
        }

        if (!ctx.session.messageToForward) {
            return await ctx.reply('Сначала отправьте сообщение для публикации.')
        }

        const chatId = process.env.FORWARD_CHAT_ID

        // Публикуем сообщение в зависимости от типа
        switch (ctx.session.messageType) {
            case 'text':
                await bot.telegram.sendMessage(chatId, ctx.session.messageToForward)
                break

            case 'photo':
                await bot.telegram.sendPhoto(chatId,
                    ctx.session.messageToForward.photoId,
                    { caption: ctx.session.messageToForward.caption }
                )
                break

            case 'video':
                await bot.telegram.sendVideo(chatId,
                    ctx.session.messageToForward.videoId,
                    { caption: ctx.session.messageToForward.caption }
                )
                break

            case 'document':
                await bot.telegram.sendDocument(chatId,
                    ctx.session.messageToForward.documentId,
                    { caption: ctx.session.messageToForward.caption }
                )
                break
        }

        // Сбрасываем сессию и предлагаем оплатить снова для новой публикации
        ctx.session.paymentStatus = false
        ctx.session.waitingForPost = false
        ctx.session.messageToForward = null
        ctx.session.messageType = null

        await ctx.reply('✅ Ваше объявление успешно опубликовано! Для размещения нового объявления необходимо снова произвести оплату.',
            Markup.inlineKeyboard([
                [Markup.button.callback('Разместить еще одно объявление', 'adPost')],
            ])
        )

    } catch (error) {
        console.error('Ошибка при публикации:', error)
        await ctx.reply('Произошла ошибка при публикации. Обратитесь к администратору @pravodoc_ru.')
    }
})

// Обработчик отмены публикации
bot.action('cancelPost', async (ctx) => {
    ctx.session.waitingForPost = false
    ctx.session.messageToForward = null
    ctx.session.messageType = null

    // Если оплата уже была произведена, предлагаем подготовить новое объявление
    if (ctx.session.paymentStatus) {
        await ctx.reply('Публикация отменена. Вы можете подготовить новое объявление и нажать кнопку "Готово" снова.',
            Markup.inlineKeyboard([
                [Markup.button.callback('>>> Готово? Жми 🎬 <<<', 'readyPost')],
            ])
        )
    } else {
        // Если оплаты не было, предлагаем оплатить
        await ctx.reply('Публикация отменена. Для размещения объявления необходимо произвести оплату:',
            Markup.inlineKeyboard([
                [Markup.button.callback('Оплатить публикацию', 'adPost')],
            ])
        )
    }
})

// Обработчик ошибок
bot.catch((err, ctx) => {
    console.error(`Ошибка для ${ctx.updateType}:`, err)
    ctx.reply('Произошла ошибка. Пожалуйста, обратитесь к администратору @pravodoc_ru.')
})

bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))