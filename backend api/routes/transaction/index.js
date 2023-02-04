module.exports = async function (fastify, opts) {
    
  fastify.get('/:id', {
  schema: {
    description: "returns the status of a mined transaction",
    tags: ['transaction'],
      params: {
                description: 'id (=hash) of transaction',
                type: 'object',
                properties: {
                    id: { type: 'string' } 
                }
            },
    response: {
        200: {
            type: 'object',
            properties: {
                mined: {type: 'boolean'},
                feeUSD: { type: 'number' },
                feeTMN: { type: 'number' },
                status: { type: 'number' }
            }
        },
        201: {
            type: 'object',
            properties: {
                mined: {type: 'boolean'},
                maxFeeUSD: { type: 'number' },
                maxFeeTMN: { type: 'number' },
            }
        },
  }
  }
}, async function (request, reply) {
      const { id } = request.params;
      
      let [tx, txR, feeUSD, feeTMN ] = await Promise.all([
          fastify.provider.getTransaction(id),
          fastify.provider.getTransactionReceipt(id),
          fastify.ethToUSD(1),
          fastify.ethToTMN(1)
      ])

      if (txR != null)
          return {
              mined:   true,
              feeUSD: feeUSD*txR.gasUsed*txR.effectiveGasPrice*1e-18,
              feeTMN: feeTMN*txR.gasUsed*txR.effectiveGasPrice*1e-18,
              status:  txR.status
          }
      else if (tx != null) {
          reply.code(201)
          return {
              mined: false,
              maxFeeUSD: feeUSD*tx.gasLimit*txR.gasPrice*1e-18,
              maxFeeTMN: feeTMN*tx.gasLimit*txR.gasPrice*1e-18,
          }
      } else {
          reply.code(400)
          return {
              message : 'transaction not found'
          }
      }
  })
}