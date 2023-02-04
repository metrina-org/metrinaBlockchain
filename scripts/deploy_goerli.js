var { ethers, upgrades } = require("hardhat");
var fs = require('fs');
var jsonAddress = require('../addresses/goerli.json');
if (Object.keys(jsonAddress).length != 0) {
    console.log('using pre-deployed addresses!')
}

USDC_ADDR = '0x07865c6E87B9F70255377e024ace6630C1Eaa37F'

async function main() {
    if (jsonAddress.ownerAddr == undefined) {
        console.log("deploying ownerAddr");
        var ownerAddr = (await ethers.provider.listAccounts())[0];
        console.log("Owner Address:", ownerAddr)
        jsonAddress.ownerAddr = ownerAddr
    } else {
        var ownerAddr = jsonAddress.ownerAddr
    }
    if (jsonAddress.complianceRegistry == undefined) {
        console.log("deploying ComplianceRegistry");
        var ComplianceRegistry = await ethers.getContractFactory("ComplianceRegistry");
        var complianceRegistry = await upgrades.deployProxy(ComplianceRegistry, [ownerAddr]);
        await complianceRegistry.deployed();
        console.log("ComplianceRegistry deployed to:", complianceRegistry.address);
        jsonAddress.complianceRegistry = complianceRegistry.address
    } else {
        var complianceRegistry = { address: jsonAddress.complianceRegistry }
    }
    if (jsonAddress.priceOracle == undefined) {
        console.log("deploying PriceOracle");
        var PriceOracle = await ethers.getContractFactory("PriceOracle");
        var priceOracle = await upgrades.deployProxy(PriceOracle, [ownerAddr]);
        await priceOracle.deployed();
        console.log("PriceOracle deployed to:", priceOracle.address);
        jsonAddress.priceOracle = priceOracle.address
    } else {
        var priceOracle = { address: jsonAddress.priceOracle }
    }
    if (jsonAddress.validRule == undefined) {
        console.log("deploying UserValidRule");
        var UserValidRule = await ethers.getContractFactory("UserValidRule");
        var validRule = await upgrades.deployProxy(UserValidRule, [complianceRegistry.address]);
        await validRule.deployed();
        console.log("UserValidRule deployed to:", validRule.address);
        jsonAddress.validRule = validRule.address
    } else {
        var validRule = { address: jsonAddress.validRule }
    }
    if (jsonAddress.ruleEngine == undefined) {
        console.log("deploying RuleEngine");
        var RuleEngine = await ethers.getContractFactory("RuleEngine");
        var ruleEngine = await upgrades.deployProxy(RuleEngine, [ownerAddr]);
        await ruleEngine.deployed();
        console.log("RuleEngine deployed to:", ruleEngine.address);
        jsonAddress.ruleEngine = ruleEngine.address
        await ruleEngine.setRules([validRule.address]);
    } else {
        var ruleEngine = { address: jsonAddress.ruleEngine }
    }
    if (jsonAddress.processor == undefined) {
        console.log("deploying Processor");
        var Processor = await ethers.getContractFactory("Processor");
        var processor = await upgrades.deployProxy(Processor, [ownerAddr, ruleEngine.address], { initializer: 'initialize(address, address)' });
        await processor.deployed();
        console.log("Processor deployed to:", processor.address);
        jsonAddress.processor = processor.address
    } else {
        var processor = { address: jsonAddress.processor }
    }
    if (jsonAddress.stableCoin == undefined) {
        console.log("deploying stableCoinAddr");
        var stableCoinAddr = USDC_ADDR
        console.log("Stablecoin at:", stableCoinAddr);
        jsonAddress.stableCoin = stableCoinAddr
    } else {
        var stableCoinAddr = jsonAddress.stableCoin
    }
    if (jsonAddress.token == undefined) {
        console.log("deploying MetrinaToken");
        var MetrinaToken = await ethers.getContractFactory("MetrinaToken");
        var token = await upgrades.deployProxy(MetrinaToken, [
            ownerAddr,
            processor.address,
            'Metrina Yousef-Abad Homayon 4',
            'MTR-YA4', 0, [ownerAddr], 1716249600,
            stableCoinAddr, ownerAddr
        ], { initializer: 'initialize(address, address, string, string, uint8, address[], uint256, address, address)' });
        await token.deployed();
        console.log("MetrinaToken deployed to:", token.address);
        jsonAddress.token = [token.address]
        await new Promise(resolve => setTimeout(resolve, 5000));
        await token.setPriceOracle(priceOracle.address)
        await new Promise(resolve => setTimeout(resolve, 5000));
        await token.addSupplier(ownerAddr)
        await new Promise(resolve => setTimeout(resolve, 5000));
        await token.setRules([0], [0])
    } else {
        var token = { address: jsonAddress.token[0] }
    }
    if (jsonAddress.sale == undefined) {
        console.log("deploying MetrinaTokenSale");
        var MetrinaTokenSale = await ethers.getContractFactory("MetrinaTokenSale");
        var sale = await upgrades.deployProxy(MetrinaTokenSale, [
            ownerAddr,
            token.address, stableCoinAddr,
            ownerAddr, ownerAddr, 'TMN', 1
        ], { initializer: 'initialize(address, address, address, address, address, string, uint8)' });
        await sale.deployed();
        console.log("MetrinaTokenSale deployed to:", sale.address);
        jsonAddress.sale = sale.address
    } else {
        var sale = { address: jsonAddress.sale }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}).finally(() => {
    fs.writeFileSync('addresses/goerli.json', JSON.stringify(jsonAddress));
});
