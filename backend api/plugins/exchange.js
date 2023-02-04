const axios = require('axios');

'use strict'

const fp = require('fastify-plugin')

module.exports = fp(async function (fastify, opts) {
    fastify.decorate('ethToUSD', async (amount) => {
            let response = null;
            return new Promise(async (resolve, reject) => {
              try {
                response = await axios.get(
                    `https://pro-api.coinmarketcap.com/v2/tools/price-conversion?amount=${amount}&symbol=ETH`, {
                  headers: {
                    'X-CMC_PRO_API_KEY': process.env.COIN_MARKET_API,
                  },
                });
              } catch(ex) {
                response = null;
                reject(ex);
              }
              if (response) {
                const json = response.data;
                resolve(json.data[0].quote.USD.price);
              }
        });
    })
    
    fastify.decorate('ethToTMN', async (amount) => {
            let response = null;
            return new Promise(async (resolve, reject) => {
              try {
                response = await axios.get('https://api.wallex.ir/v1/markets');
              } catch(ex) {
                response = null;
                reject(ex);
              }
              if (response) {
                const json = response.data;
                if(!json.success) {
                    response = null;
                    reject(ex);
                }
                resolve(json.result.symbols.ETHTMN.stats.bidPrice*amount);
              }
        });
    })
})
