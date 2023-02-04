'use strict'

const fp = require('fastify-plugin')
const { ethers } = require("ethers");

/**
 * This plugins adds some utilities to handle http errors
 *
 * @see https://github.com/fastify/fastify-sensible
 */
module.exports = fp(async function (fastify, opts) {
  const provider = new ethers.providers.JsonRpcProvider(process.env.ETH_PROVIDER);
  const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);

  fastify.decorate('provider', provider);
  fastify.decorate('wallet', wallet);
  fastify.decorate('ethers', ethers);
})
