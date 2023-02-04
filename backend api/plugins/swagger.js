'use strict'

const fp = require('fastify-plugin')

module.exports = fp(async function(fastify, opts, done) {
    await fastify.register(require('@fastify/swagger'), {
        swagger: {
          info: {
            title: 'Metrina Blockchain API',
            description: 'used by backend to access evm functioanlities',
            version: '0.0.2'
          },
          externalDocs: {
            url: 'https://github.com/metrina-org/metrina-blockchain/blob/main/API.md',
            description: 'smart contract API'
          },
          host: '',
          schemes: ['https', 'http'],
        }
    })
    await fastify.register(require('@fastify/swagger-ui'), {
        routePrefix: '/swagger',
        exposeRoute: true
      })
    fastify.ready()
})