require("@nomicfoundation/hardhat-toolbox");
require('@openzeppelin/hardhat-upgrades');
require("hardhat-gas-reporter");
require("@nomiclabs/hardhat-etherscan");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.6.2",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    goerli: {
      url: '',
      accounts: [''],
      timeout: 60000
    }
  },
  gasReporter: {
    currency: 'USD',
    enabled: true,
    coinmarketcap :""
  },
  etherscan: {
    apiKey: ""
  }
};
