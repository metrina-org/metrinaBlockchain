'use strict'

const path = require('path')
const AutoLoad = require('@fastify/autoload')

module.exports = async function (fastify, opts) {
  fastify.setErrorHandler(function (error, request, reply) {
        switch (error.code) {
          case 'UNSUPPORTED_OPERATION':
          case 'INVALID_ARGUMENT':
            error.statusCode = 400
            error.message = 'provided address/parameter is not valid'
            break;
          case 'CALL_EXCEPTION':
            error.statusCode = 400
            if(error.message.includes('revert RU03'))
                error.message = 'user not registered'
            else if(error.message.includes('revert UR02'))
                error.message = 'user already registered'
            else if(error.message.includes('revert SafeMath: subtraction overflow'))
                error.message = 'balance is not enough'
            else
                error.message = 'smart contract rejected for unexpected reason'
            break;
          case 'NETWORK_ERROR':
                error.statusCode = 502
                error.message = 'internal server network error'
                break
        }
        reply.status(error.statusCode | 500).send(error)  
    })

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: Object.assign({}, opts)
  })

  // This loads all plugins defined in routes
  // define your routes in one of these
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: Object.assign({}, opts)
  })
}
