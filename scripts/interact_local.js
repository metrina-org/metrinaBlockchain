const { ethers } = require("hardhat");
var jsonAddress = require('../addresses/local.json');

async function mint() {
    const ownerAddr = jsonAddress.ownerAddr

    const MetrinaToken = await ethers.getContractFactory("MetrinaToken");
    const token = MetrinaToken.attach(jsonAddress.token[0]);
    await token.mint(ownerAddr, 1000);

    console.log(`minted 1000 to ${ownerAddr} on token ${await token.name()}`)
}

async function reg() {
    const ComplianceRegistry = await ethers.getContractFactory("ComplianceRegistry");
    const reg = ComplianceRegistry.attach(jsonAddress.complianceRegistry);
    users = ['0xa1eF58670368eCCB27EdC6609dea0fEFC5884f09',
        '0xA225e897AEc53fE0119Aff23c8959cA1d6E89761']
    const registerTime = (Date.now() / 1000 | 0) + 3600*24
    await reg.registerUsers(users, [0, 0], [registerTime, registerTime])

    console.log(`registered ${users} till ${registerTime}`)
}

mint().catch((error) => {
    console.error(error);
    process.exitCode = 1;
})
