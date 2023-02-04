const { ethers, upgrades } = require("hardhat");
const fs = require('fs');
var jsonAddress = require('../addresses/local.json');

async function main() {
    const ownerAddr = (await ethers.provider.listAccounts())[0];
    console.log("Owner Address:", ownerAddr)
    jsonAddress.ownerAddr = ownerAddr

    const ComplianceRegistry = await ethers.getContractFactory("ComplianceRegistry");
    const complianceRegistry = await upgrades.deployProxy(ComplianceRegistry, [ownerAddr]);
    await complianceRegistry.deployed();
    console.log("ComplianceRegistry deployed to:", complianceRegistry.address);
    jsonAddress.complianceRegistry = complianceRegistry.address

    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const priceOracle = await upgrades.deployProxy(PriceOracle, [ownerAddr]);
    await priceOracle.deployed();
    console.log("PriceOracle deployed to:", priceOracle.address);
    jsonAddress.priceOracle = priceOracle.address

    const UserValidRule = await ethers.getContractFactory("UserValidRule");
    const validRule = await upgrades.deployProxy(UserValidRule, [complianceRegistry.address]);
    await validRule.deployed();
    console.log("UserValidRule deployed to:", validRule.address);
    jsonAddress.validRule = validRule.address

    const RuleEngine = await ethers.getContractFactory("RuleEngine");
    const ruleEngine = await upgrades.deployProxy(RuleEngine, [ownerAddr]);
    await ruleEngine.deployed();
    console.log("RuleEngine deployed to:", ruleEngine.address);
    jsonAddress.ruleEngine = ruleEngine.address
    await ruleEngine.setRules([validRule.address]);

    const Processor = await ethers.getContractFactory("Processor");
    const processor = await upgrades.deployProxy(Processor, [ownerAddr, ruleEngine.address], { initializer: 'initialize(address, address)' });
    await processor.deployed();
    console.log("Processor deployed to:", processor.address);
    jsonAddress.processor = processor.address

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    const stableCoin = await ERC20Mock.deploy('Mock Dai', 'DAI', 6)
    await stableCoin.deployed();
    console.log("ERC20Mock deployed to:", stableCoin.address);
    jsonAddress.stableCoin = stableCoin.address

    const MetrinaToken = await ethers.getContractFactory("MetrinaToken");
    const token = await upgrades.deployProxy(MetrinaToken, [
        ownerAddr,
        processor.address,
        'Metrina Test Project 1',
        'MTR-TST1', 0, [ownerAddr], (Date.now() / 1000 | 0) + 3600,
        stableCoin.address, ownerAddr
    ], { initializer: 'initialize(address, address, string, string, uint8, address[], uint256, address, address)' });
    await token.deployed();
    console.log("MetrinaToken deployed to:", token.address);
    jsonAddress.token = [token.address]
    await token.setPriceOracle(priceOracle.address)
    await token.addSupplier(ownerAddr)
    await token.setRules([0], [0])

    const MetrinaTokenSale = await ethers.getContractFactory("MetrinaTokenSale");
    const sale = await upgrades.deployProxy(MetrinaTokenSale, [
        ownerAddr,
        token.address, stableCoin.address,
        ownerAddr, ownerAddr, 'TMN', 1
    ], { initializer: 'initialize(address, address, address, address, address, string, uint8)' });
    await sale.deployed();
    console.log("MetrinaTokenSale deployed to:", sale.address);
    jsonAddress.sale = sale.address

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}).finally(() => {
    fs.writeFileSync('addresses/local.json', JSON.stringify(jsonAddress));
});
