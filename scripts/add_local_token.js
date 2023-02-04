const { ethers, upgrades } = require("hardhat");
const fs = require('fs');
var jsonAddress = require('../addresses/local.json');


async function main() {
  const ownerAddr = jsonAddress.ownerAddr

  const MetrinaToken = await ethers.getContractFactory("MetrinaToken");
  const token = await upgrades.deployProxy(MetrinaToken, [
    ownerAddr,
    jsonAddress.processor,
    'Metrina Test Project 2',
    'MTR-TST2', 0, [ownerAddr], (Date.now() / 1000 | 0) + 3600,
    jsonAddress.stableCoin, ownerAddr
  ], { initializer: 'initialize(address, address, string, string, uint8, address[], uint256, address, address)' });
  await token.deployed();
  console.log("ANOTHER MetrinaToken deployed to:", token.address);
  jsonAddress.token.push(token.address)
  await token.setPriceOracle(jsonAddress.priceOracle)
  await token.addSupplier(ownerAddr)
  await token.setRules([0], [0])
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  fs.writeFileSync('addresses/local.json', JSON.stringify(jsonAddress));
});
