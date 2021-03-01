const { promises: fs } = require('fs')
const fetch = require('node-fetch')
const Discord = require('discord.js');
const client = new Discord.Client();

let keys
const commands = [
    { command: '$$GME', desc: 'Replace GME with with your favorite stock' },
]

// https://stackoverflow.com/questions/40263803/native-javascript-or-es6-way-to-encode-and-decode-html-entities 
// JavaScript is the future - this is fine...
const escapeHTML = str => str.replace(/[&<>'"]/g,
    tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag]));

const asMoney = n => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

const toTheMoon = n => n > 25 ? '🚀🌑' : ''

const main = async () => {
    const fileData = await (await fs.readFile('secret', 'utf8')).trim()
    keys = fileData.split('\n').reduce((prev, curr) => {
        const [key, value] = curr.split(':')
        prev[key] = value
        return prev
    }, {})

    client.on('ready', () => {
        console.log('I am ready!');
    });

    // @TODO(svavs): There is a pattern forming between commands and how messages are invoked
    client.on('message', async message => {

        if (message.content.includes('$$') && message.content.substr(0, 2) !== '$$') {
            const [j1, symsec] = message.content.split('$$')
            const [sym, j2] = symsec.split(' ')
            const { ok, reply } = await getStock(sym)

            if (ok) {
                message.channel.send(reply)
            }

            return
        }

        if (message.content.substr(0, 2) !== '$$') return

        const uc = message.content.substr(2)
        const ucl = uc.toLowerCase()

        console.log(message.content)

        if (ucl.slice(0, 1) == '^') {
            message.channel.send('Indices are not implemented yet')
        } else if (ucl === 'help') {
            const cons = commands.reduce((prev, curr) => `${prev}\t**${curr.command}:**\t ${curr.desc}\n`, '')
            message.channel.send(`List of commands: \n${cons}`)
        } else {
            const [sym, j3] = uc.split(' ')
            const { ok, reply } = await getStock(sym)

            if(reply !== undefined) message.channel.send(reply)
        }
    });

    client.login(keys['DISCORD']);
}

const getStock = async (sym) => {
    try {
        const yfurl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${sym}`
        const data = await fetch(yfurl)

        if (!data.ok) {
            return { ok: false, reply: `Unable to locate **${sym}**` }
        }

        const stocks = await data.json()
        console.log(stocks)
        if (stocks.quoteResponse.result === undefined || stocks.quoteResponse.result.length === 0) {
            return { ok: false, reply: `Unable to locate **${sym}**` }
        }

        const [stock] = stocks.quoteResponse.result
        console.log(stock)

        if (stock.quoteType !== 'EQUITY') {
            return { ok: false, reply: `I don't know what a ${stock.quoteType.toLowerCase()} is...` }
        }

        // @TODO(sjv): Yahoos finance API is strange - we should move all this logic to another function / file 
        //             The fn should return the data we need in a std format
        const ms = stock.marketState.replace('POSTPOST', 'POST').replace('CLOSED', 'POST')

        if (ms === "PRE" || ms === "POST") {
            let afterMarketMessage = undefined
            try {
                const state = ms.toLowerCase()
                const marketChange = stock[`${state}MarketChange`]
                const price = asMoney(stock[`${state}MarketPrice`])
                const change = asMoney(stock[`${state}MarketChange`])
                const percent = stock[`${state}MarketChangePercent`].toFixed(2)

                const [premoji, presuffix] = marketChange > 0 ? ['📈', '+'] : ['📉', '']
                afterMarketMessage = `**After Hours: ${sym.toUpperCase()}**: ${price} (${presuffix}${change}) (${percent}%) ${premoji} ${toTheMoon(stock[`${state}MarketChangePercent`])}`;
            } catch (error) { }


            const [moji, suffix] = stock.regularMarketChange > 0 ? ['📈', '+'] : ['📉', '']

            const dailyMarket = `**At Close: ${sym.toUpperCase()}**: ${asMoney(stock.regularMarketPrice)} (${suffix}${asMoney(stock.regularMarketChange)}) (${stock.regularMarketChangePercent.toFixed(2)}%) ${moji} ${toTheMoon(stock.regularMarketChangePercent)}`
            const msg = afterMarketMessage === undefined ? dailyMarket : [afterMarketMessage, dailyMarket].join('\n')

            return { ok: true, reply:  msg }
        } else if(ms === 'REGULAR') {
            const [moji, suffix] = stock.regularMarketChange > 0 ? ['📈', '+'] : ['📉', '']
            return { ok: true, reply: `**${sym.toUpperCase()}**: ${asMoney(stock.regularMarketPrice)} (${suffix}${asMoney(stock.regularMarketChange)}) (${stock.regularMarketChangePercent.toFixed(2)}%) ${moji} ${toTheMoon(stock.regularMarketChangePercent)}` }
        }

        return { ok: false, reply: undefined }

    } catch (error) {
        console.log(error)
        return { ok: false, reply: 'Oh no, I pooped myself 😞' }
    }

}

(async () => await main())()