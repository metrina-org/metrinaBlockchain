var TokenArtifact = require("../../contracts/token/MetrinaToken.sol/MetrinaToken.json");
var RegistryArtifact = require("../../contracts/operating/ComplianceRegistry.sol/ComplianceRegistry.json");
var jsonAddress = require('../../addresses/local.json');

module.exports = async function (fastify, opts) {
    
    fastify.post('/register', {
          schema: {
            description: 'get list of tokens addresses',
            tags: ['user','registry'],
              body: {
                description: 'Address of user to register',
                type: 'object',
                properties: {
                    address: { type: 'string' }
                }
            },
            response: {
                200: {
                    type: 'string',
                    description: 'transaction id of registering user'
            }
          }
      }
    }, async function (request, reply) {
        const { address } = request.body;
        const reg = new fastify.ethers.Contract(jsonAddress['complianceRegistry'],
                                                RegistryArtifact.abi, fastify.wallet)
        
        const dryResult = await reg.callStatic.registerUser(address, [0], [fastify.ethers.constants.MaxUint256])  
        
        const tx = await reg.registerUser(address, [0], [fastify.ethers.constants.MaxUint256])
        return tx.hash
  })
    
        fastify.post('/transfer', {
          schema: {
            description: 'transfers specified amount of token to a user',
            tags: ['user','token'],
              body: {
                description: 'Address of users and token and amount of transfer',
                type: 'object',
                properties: {
                    to: { type: 'string' },
                    amount: { type: 'number' },
                    token: { type: 'string' }
                }
            },
            response: {
                200: {
                    type: 'string',
                    description: 'transaction id of transfer'
            }
          }
      }
    }, async function (request, reply) {
        const { to,amount,token } = request.body;
            
        const tokenContract = new fastify.ethers.Contract(token,
                                                TokenArtifact.abi, fastify.wallet)
        const dryResult = await tokenContract.callStatic.transfer(to, amount)
        
        const tx = await tokenContract.transfer(to, amount)
        return tx.hash
  })
    
  fastify.get('/valid/:address', {
  schema: {
    description: "check if address is registered and hasn't expired",
    tags: ['user','registry'],
       params: {
                description: 'address of user',
                type: 'object',
                properties: {
                    address: { type: 'string' } 
                }
            },
    response: {
        200: {
            type: 'boolean'
    }
  }
  }
}, async function (request, reply) {
      const { address } = request.params;
      const reg = new fastify.ethers.Contract(jsonAddress['complianceRegistry'],
                                              RegistryArtifact.abi, fastify.provider)
      const trusted = await fastify.wallet.getAddress();
    return await reg.isAddressValid([trusted], address)
  })
    
      fastify.get('/balance/:address', {
  schema: {
    description: "balance of user in specified token",
    tags: ['user','token'],
    querystring: {
        type: 'object',
        properties: {
            token: { type: 'string' }
        },
        required: ['token']
    },
    params: {
            description: 'address of user and address of token',
            type: 'object',
            properties: {
                address: { type: 'string' } ,
            }
        },
    response: {
        200: {
            type: 'number'
    }
  }
  }
}, async function (request, reply) {
      const { address } = request.params;
      const { token } = request.query;

      const tokenContract = new fastify.ethers.Contract(token,
                                              TokenArtifact.abi, fastify.provider)
      
      return await tokenContract.balanceOf(address)
  })
    
}