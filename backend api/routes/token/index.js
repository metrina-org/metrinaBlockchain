var TokenArtifact = require("../../contracts/token/MetrinaToken.sol/MetrinaToken.json");
var jsonAddress = require('../../addresses/local.json');

module.exports = async function (fastify, opts) {
    
    fastify.get('/list', {
          schema: {
            description: 'get list of tokens addresses',
            tags: ['token'],
            response: {
                200: {
                type: 'object',
                properties: {
                    token: { 
                        type: 'array',
                        items: {
                          type: 'string'
                        }
                    },
                    network: {
                        type: 'object',
                        properties: {
                            name: {type: 'string'},
                            url: {type: 'string'},
                            chainId: {type: 'number'},
                            symbol: {type: 'string'}
                        }
                    },
                    stableCoin: {
                        type: 'string'
                    },
                    serverAddress: {
                        type: 'string'
                    }
                }
                
            }
          }
      }
    }, async function (request, reply) {
        const network = await fastify.provider.getNetwork()
        return {
            token: jsonAddress['token'],
            serverAddress: jsonAddress['ownerAddr'],
            stableCoin: jsonAddress['stableCoin'],
            network: {
                name: network.name,
                chainId: network.chainId,
                url: fastify.provider.connection.url,
                symbol: 'ETH'
            }
        }
  })
    
  fastify.get('/info/:address', {
  schema: {
    description: 'get info about specified token address',
    tags: ['token'],
       params: {
                description: 'address of token',
                type: 'object',
                properties: {
                    address: { type: 'string' } 
                }
            },
    response: {
        200: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                symbol: { type: 'string' },
                totalSupply: { type: 'number' },
                decimals: { type: 'number' }
            }
    }
  }
  }
}, async function (request, reply) {
      const { address } = request.params;
      let token = new fastify.ethers.Contract(address, TokenArtifact.abi)
      token = token.connect(fastify.provider)
      
      let [name,symbol,totalSupply,decimals] = await Promise.all([token.name(),token.symbol(),token.totalSupply(),token.decimals()])
      
    return {
                name: name,
                symbol: symbol,
                totalSupply: totalSupply,
                decimals: decimals
            }
  })
}