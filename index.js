const {Telegraf, Markup} = require('telegraf')
require('dotenv').config()
const help = require('./help')
const description = require('./description')
const callback = require('./callback')


const bot = new Telegraf(process.env.BOT_TOKEN)         //Токен бота


bot.start(async (ctx) => await ctx.reply(`Привет! ${ctx.from.first_name ? ctx.from.first_name : 'Незнакомец'}, обязательно ознакомся с правилами публикации`, Markup.keyboard([
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
    return ctx.replyWithInvoice(getInvoice(ctx.from.id))          //  метод replyWithInvoice для выставления счета
})

bot.hears('📝 Рекламная публикация', async (ctx) => {
    return ctx.replyWithInvoice(getInvoice(ctx.from.id))          //  метод replyWithInvoice для выставления счета


})
bot.hears('📊 Правила публикации', (ctx) => ctx.reply(description.description))        //Правила публикации сообщений в телеграм канале
bot.hears('📌 Помощь', (ctx) => ctx.reply(help.helpcommands))            //Сообщение помощи при вводе команды /help


const getInvoice = (id) => {
    const invoice = {
        chat_id: id,
        provider_token: process.env.PROVIDER_TOKEN,  //Токен выданный BotFather для провайдера оплаты
        start_parameter: 'get_access', //Уникальный параметр глубинных ссылок. Если оставить поле пустым, переадресованные копии отправленного сообщения будут иметь кнопку «Оплатить», позволяющую нескольким пользователям производить оплату непосредственно из пересылаемого сообщения, используя один и тот же счет. Если не пусто, перенаправленные копии отправленного сообщения будут иметь кнопку URL с глубокой ссылкой на бота (вместо кнопки оплаты) со значением, используемым в качестве начального параметра.
        title: 'Публикация объявления', // Название продукта, 1-32 символа
        description: 'Публикация одного объявления в телеграм канале @baraxolka_krd', // Описание продукта, 1-255 знаков
        currency: 'RUB', // Трехбуквенный код валюты ISO 4217
        protect_content: true, // При передаче пользователю приложения для оплаты приложение должно предоставить возможность отменить платеж или отменить приложение для оплаты.
        prices: [{label: 'Оплата за публикацию объявления', amount: 100 * 100}], // Разбивка цен, сериализованный список компонентов в формате JSON 100 копеек * 100 = 100 рублей
        payload: { // Полезные данные счета-фактуры, определенные ботом, 1–128 байт. Это не будет отображаться пользователю, используйте его для своих внутренних процессов.
            unique_id: `${id}_${Number(new Date())}`,
            provider_token: process.env.PROVIDER_TOKEN      //Токен выданный BotFather для провайдера оплаты
        }
    }

    return invoice
}

bot.use(Telegraf.log())

bot.hears('оплатить', (ctx) => {  // это обработчик конкретного текста, данном случае это - "оплатить"
    return ctx.replyWithInvoice(getInvoice(ctx.from.id)) //  метод replyWithInvoice для выставления счета
})


bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true)) // ответ на предварительный запрос по оплате

bot.on('successful_payment', async (ctx) => {

    await ctx.reply((callback.callback), Markup.inlineKeyboard(      ////Сообщение возвращающееся после оплаты
        [
            [Markup.button.callback('>>> Готово? Жми 🎬 <<<', 'readyPost')],

        ]
    ))

    bot.action('readyPost', async (ctx) => {

        await ctx.reply('Отлично. Пришлите мне ваше объявление')

    })

    bot.on('message', async (ctx) => {
        const forwardText = ctx.message.text

        await ctx.reply((`${forwardText}`), Markup.inlineKeyboard(                         //Пересылаемое сообщение
                [
                    [Markup.button.callback('>>> Опубликовать 📨 <<<', 'postForward')],

                ]
            )
        )
    })

    bot.action('postForward', async (ctx) => {
        await ctx.forwardMessage(process.env.FORWADR_CHAT_ID, ctx.chat.id, ctx.forwardText)  // ID канала куда будет пересылка сообщения
        await ctx.reply('Объявление опубликовано')
    })
})

bot.launch()


// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))