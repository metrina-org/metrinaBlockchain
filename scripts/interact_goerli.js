const { ethers } = require("hardhat");
var jsonAddress = require('../addresses/goerli.json');

async function mint() {
    const ownerAddr = jsonAddress.ownerAddr

    const MetrinaToken = await ethers.getContractFactory("MetrinaToken");
    const token = MetrinaToken.attach(jsonAddress.token[0]);
    await token.mint(ownerAddr, 10);

    console.log(`minted 10 to ${ownerAddr} on token ${await token.name()}`)
}

async function reg() {
    const ComplianceRegistry = await ethers.getContractFactory("ComplianceRegistry");
    const reg = ComplianceRegistry.attach(jsonAddress.complianceRegistry);
    users = ['0xa1eF58670368eCCB27EdC6609dea0fEFC5884f09',
        '0xA225e897AEc53fE0119Aff23c8959cA1d6E89761']
    const registerTime = (Date.now() / 1000 | 0) + 3600 * 24
    await reg.registerUsers(users, [0, 0], [registerTime, registerTime])

    console.log(`registered ${users} till ${registerTime}`)
}

async function init() {
    const ownerAddr = jsonAddress.ownerAddr
    const MetrinaToken = await ethers.getContractFactory("MetrinaToken");
    const token = MetrinaToken.attach(jsonAddress.token[0]);
    const isSupplier = await token.isSupplier(ownerAddr)
    const priceOracle = await token.priceOracle()
    const rules = await token.rules()
    const RuleEngine = await ethers.getContractFactory("RuleEngine");
    const engine = RuleEngine.attach(jsonAddress.ruleEngine);
    const ruleLength = await engine.ruleLength()
    const rule0 = await engine.rules([0])

    console.log(await token.name(), await token.symbol(), isSupplier, priceOracle, ruleLength, rules, rule0)

    if (rules[0].length == 0) {
        console.log('rules not initialized. setting rules...')
        await token.setRules([0], [0])
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
    if (!isSupplier) {
        console.log('owner not supplier, setting supplier...')
        await token.addSupplier(ownerAddr)
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}

init().catch((error) => {
    console.error(error);
    process.exitCode = 1;
})
