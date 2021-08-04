const { promises: fs } = require('fs')
const fetch = require('node-fetch')
const {Client, Intents} = require('discord.js');
const client = new Client({intents: [
    
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.GUILD_MESSAGE_TYPING,
    Intents.FLAGS.DIRECT_MESSAGES,
]});

let keys
const commands = [
    { command: '$$GME', desc: 'Replace GME with with your favorite stock' },
]

const asMoney = n => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

const toTheMoon = n => n > 25 ? '🚀🌑' : ''

const main = async () => {

    try {
        const fileData = (await fs.readFile('secret', 'utf8')).trim()
        keys = fileData.split('\n').reduce((prev, curr) => {
            const [key, value] = curr.split(':')
            prev[key] = value.trim()
            return prev
        }, {})
    } catch(error) { console.log(error)}

    const crytpoCommand = {
        name: 'crypto',
        description: 'Crypto',
        options: [{
          name: 'coin',
          type: 'STRING',
          description: 'The crypto.',
          required: true,
        }],
      }

      const stockCommand = {
        name: 'stock',
        description: 'Stonks',
        options: [{
          name: 'stock',
          type: 'STRING',
          description: 'The stonk.',
          required: true,
        }],
      }

      client.once('ready', async () => {
        const fileData = (await fs.readFile('guilds', 'utf8')).trim().split()
        
        fileData.forEach(x => {
            client.guilds.cache.get(x).commands.create(crytpoCommand)
            client.guilds.cache.get(x).commands.create(stockCommand)
        })
        
        console.log('I am ready!');
    });

    client.on('interaction', async interaction => {
        if (!interaction.isCommand()) return;

        if(interaction.commandName === 'stock') {
            const sym = interaction.options.get('stock').value
            const {ok, reply} = await getStock(sym)
            interaction.reply(reply)  
        }

        if (interaction.commandName === 'crypto') {
          const sym = interaction.options.get('coin').value
          const {ok, reply} = await getCrypto(sym)
          interaction.reply(reply)
        }
      })


    // @TODO(svavs): There is a pattern forming between commands and how messages are invoked
    client.on('message', async message => {
        if (message.author.bot) return false
        
        if(message.content.substr(0, 3) === ('$$$')) {
            const sym = message.content.split(' ')[0].substr(3)
            console.log(`Crypto: ${sym}`)
            const {ok, reply} = await getCrypto(sym)
            if(ok) {
                message.channel.send(reply)
            }

            return
        }
        // STONKS [..--'] <- chart of gains
        else if (message.content.includes('$$') && message.content.substr(0, 2) !== '$$') {
            const [j1, symsec] = message.content.split('$$')
            const [sym, j2] = symsec.split(' ')
            const { ok, reply } = await getStock(sym)

            if (ok) {
                message.channel.send(reply)
            }

            return
        }

        if (message.content.substr(0, 2) !== '$$' || message.content.substr(0, 3) === '$$$') return

        const uc = message.content.substr(2)
        const ucl = uc.toLowerCase()

        console.log(message.content)

        if (ucl.slice(0, 1) == '^') {
            message.channel.send('Indices are not implemented yet')
        } else {
            const [sym, j3] = uc.split(' ')
            const { ok, reply } = await getStock(sym)

            if(reply !== undefined) message.channel.send(reply)
        }
    });


        
    try { 
        await client.login(keys['DISCORD'])
    } catch (err) { 
        console.log(err)
    }
    
}

const getCrypto = async (sym) => {
    try {
        const curl = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?convert=USD&symbol=${sym}`

        const data = await fetch(curl, {
            headers:{
                'X-CMC_PRO_API_KEY': keys['COINMARKETCAP'],
                'Accept': 'application/json'
            }
        })

        if(!data.ok) {
            console.log('OH NO')
            console.log(await data.json())
            return { ok: false, reply: `Pooped myself :(`}
        }

        const stonks = await data.json()
        const name = stonks.data[sym.toUpperCase()].name
        const quote = stonks.data[sym.toUpperCase()].quote['USD']
        const price = quote.price
        const stats = x => x > 0 ? ['📈', '+'] : ['📉', '']
        const percents = [{ name: 'Hour', pct: quote.percent_change_1h }, {name: 'Day', pct: quote.percent_change_24h}]
        const reply = percents.reduce((p, c) => p + `\tPast ${c.name}: ${stats(c.pct)[1]}${asMoney((c.pct / 100.0) * price)} (${stats(c.pct)[1]}${c.pct.toFixed(2)}%) ${stats(c.pct)[0]} ${toTheMoon(c.pct)}\n`, `**${sym.toUpperCase()} (${name})**: ${asMoney(price)}\n`)

        return { ok: true, reply }

    } catch (error) {
        console.log(error)
        return { ok: false, reply: 'Oh no, I pooped myself 😞' }
    }
}

const getStock = async (sym) => {
    try {
        const yfurl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${sym}`
        const data = await fetch(yfurl)

        if (!data.ok) {
            return { ok: false, reply: `Unable to locate **${sym}**` }
        }

        const stocks = await data.json()
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


(async () => { 
        await main()
})()