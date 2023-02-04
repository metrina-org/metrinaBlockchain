const { expect } = require("chai");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers, upgrades } = require("hardhat");

describe("MetrinaToken", function () {
  async function deployTokenFixture() {
    const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
    const redemptionTime = (await time.latest()) + ONE_YEAR_IN_SECS;

    const ownerAddr = (await ethers.provider.listAccounts())[0];

    const ComplianceRegistry = await ethers.getContractFactory("ComplianceRegistry");
    const complianceRegistry = await upgrades.deployProxy(ComplianceRegistry, [ownerAddr]);
    await complianceRegistry.deployed();

    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const priceOracle = await upgrades.deployProxy(PriceOracle, [ownerAddr]);
    await priceOracle.deployed();

    const UserValidRule = await ethers.getContractFactory("UserValidRule");
    const validRule = await upgrades.deployProxy(UserValidRule, [complianceRegistry.address]);
    await validRule.deployed();

    const RuleEngine = await ethers.getContractFactory("RuleEngine");
    const ruleEngine = await upgrades.deployProxy(RuleEngine, [ownerAddr]);
    await ruleEngine.deployed();
    await ruleEngine.setRules([validRule.address]);

    const Processor = await ethers.getContractFactory("Processor");
    const processor = await upgrades.deployProxy(Processor, [ownerAddr, ruleEngine.address], { initializer: 'initialize(address, address)' });
    await processor.deployed();

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    const stableCoin = await ERC20Mock.deploy('Mock Dai', 'DAI', 6)
    await stableCoin.deployed();

    const provider = ethers.provider;
    let b0 = await provider.getBalance(ownerAddr)
    const MetrinaToken = await ethers.getContractFactory("MetrinaToken");
    const token = await upgrades.deployProxy(MetrinaToken, [
      ownerAddr,
      processor.address,
      'Metrina Test Project 1',
      'MTR-TST1', 0, [ownerAddr], redemptionTime, stableCoin.address, ownerAddr
    ], { initializer: 'initialize(address, address, string, string, uint8, address[], uint256, address, address)' });
    await token.deployed();
    await token.setPriceOracle(priceOracle.address)
    await token.addSupplier(ownerAddr)
    await token.setRules([0], [0])
    console.log('first deploy', b0-(await provider.getBalance(ownerAddr)))
    
    b0 = await provider.getBalance(ownerAddr)
    const token2 = await upgrades.deployProxy(MetrinaToken, [
      ownerAddr,
      processor.address,
      'Metrina Test Project 2',
      'MTR-TST2', 0, [ownerAddr], redemptionTime, stableCoin.address, ownerAddr
    ], { initializer: 'initialize(address, address, string, string, uint8, address[], uint256, address, address)' });
    await token2.deployed();
    await token2.setPriceOracle(priceOracle.address)
    await token2.addSupplier(ownerAddr)
    await token2.setRules([0], [0])
    console.log('second deploy', b0-(await provider.getBalance(ownerAddr)))

    const MetrinaTokenSale = await ethers.getContractFactory("MetrinaTokenSale");
    const sale = await upgrades.deployProxy(MetrinaTokenSale, [
      ownerAddr,
      token.address, stableCoin.address,
      ownerAddr, ownerAddr, 'TMN', 1
    ], { initializer: 'initialize(address, address, address, address, address, string, uint8)' });
    await sale.deployed();

    return { ownerAddr, complianceRegistry, priceOracle, processor, token, sale, stableCoin };
  }

  it("Should be possible to mint to unregistered user", async function () {
    const { token } = await loadFixture(deployTokenFixture);
    const user = (await ethers.provider.listAccounts())[1];
    await expect(token.mint(user, 100)).to.changeTokenBalance(
      token,
      user,
      100
    );
  });

  it("Should revert if unregistered user tries to transfer", async function () {
    const { token } = await loadFixture(deployTokenFixture);
    const user1 = (await ethers.provider.listAccounts())[1];
    const user2 = (await ethers.provider.listAccounts())[2];
    await token.mint(user1, 100)
    const user1Signer = (await ethers.getSigners())[1]
    await expect(token.connect(user1Signer).transfer(user2, 5)).to.be.revertedWith("RU03");
  });

  it("Should transfer registered user token", async function () {
    const { token, complianceRegistry } = await loadFixture(deployTokenFixture);
    const user1 = (await ethers.provider.listAccounts())[1];
    const user2 = (await ethers.provider.listAccounts())[2];
    const registerTime = (await time.latest()) + 3600 * 24;
    await complianceRegistry.registerUsers([user1, user2], [0, 0], [registerTime, registerTime])
    await token.mint(user1, 100)
    const user1Signer = (await ethers.getSigners())[1]
    await expect(token.connect(user1Signer).transfer(user2, 20)).to.changeTokenBalances(
      token,
      [user1, user2],
      [-20, 20]
    );
  });

  it("Should redeem token with correct price at right time", async function () {
    const { token, priceOracle, stableCoin, ownerAddr } = await loadFixture(deployTokenFixture);
    const user1 = (await ethers.provider.listAccounts())[1];
    const user2 = (await ethers.provider.listAccounts())[2];
    await token.mint(user1, 5)
    await token.mint(user2, 20)
    await expect(token.redeem([user1, user2])).to.be.revertedWith("RD01");

    const unlockTime = await token.redemptionTime()
    await time.increaseTo(unlockTime);
    await expect(token.redeem([user1, user2])).to.be.revertedWith("RD04");

    const tokenSymbol = await token.symbol()
    const stableSymbol = await stableCoin.symbol()
    await priceOracle.setPrice(
      ethers.utils.formatBytes32String(tokenSymbol),
      ethers.utils.formatBytes32String(stableSymbol),
      1, 7)
    expect(await priceOracle['getPrice(bytes32,bytes32)'](
      ethers.utils.formatBytes32String(tokenSymbol),
      ethers.utils.formatBytes32String(stableSymbol))).to.eql([ethers.BigNumber.from(1), 7])
    await expect(token.redeem([user1, user2])).to.be.revertedWith("RD02");

    await priceOracle.setPrice(
      ethers.utils.formatBytes32String(tokenSymbol),
      ethers.utils.formatBytes32String(stableSymbol),
      725, 2)
    await expect(token.redeem([user1, user2])).to.be.revertedWith("ERC20: transfer amount exceeds balance");

    const stablePrice = 7.25 * 1e6
    await expect(stableCoin.mint(ownerAddr, 25 * stablePrice)).to.changeTokenBalance(
      stableCoin, ownerAddr, 25 * stablePrice
    )
    await stableCoin.approve(token.address, 25 * stablePrice)
    await expect(token.redeem([user1, user2])).to.changeTokenBalances(
      stableCoin,
      [user1, user2, ownerAddr],
      [5 * stablePrice, 20 * stablePrice, -25 * stablePrice]
    );
  });

  it("Should sell token in exchange for stable coin and ref currency", async function () {
    const { token, priceOracle, stableCoin, sale, complianceRegistry, ownerAddr } = await loadFixture(deployTokenFixture);
    const user1 = (await ethers.provider.listAccounts())[1];

    await token.mint(ownerAddr, 15)
    await token.approve(sale.address, 15)

    const tokenSymbol = await token.symbol()
    const stableSymbol = await stableCoin.symbol()
    const refSymbol = await sale.refCurrency()
    await priceOracle.setPrice(
      ethers.utils.formatBytes32String(tokenSymbol),
      ethers.utils.formatBytes32String(stableSymbol),
      725, 2)
    await priceOracle.setPrice(
      ethers.utils.formatBytes32String(tokenSymbol),
      ethers.utils.formatBytes32String(refSymbol),
      1000, 1)
    const stablePrice = 7.25 * 1e6
    let refPrice = 100
    await expect(sale.investRefCurrency(user1, 5 * refPrice)).to.revertedWith("TS10")
    refPrice = 100 * 1e1
    await expect(sale.investRefCurrency(user1, 5 * refPrice)).to.revertedWith("RU03")
    const registerTime = (await time.latest()) + 3600 * 24;
    await complianceRegistry.registerUsers([user1, ownerAddr], [0, 0], [registerTime, registerTime])
    await expect(sale.investRefCurrency(user1, 5 * refPrice)).to.changeTokenBalances(
      token,
      [user1, ownerAddr],
      [5, -5]
    );

    await stableCoin.mint(user1, 10 * stablePrice)
    const user1Signer = (await ethers.getSigners())[1]
    await stableCoin.connect(user1Signer).approve(sale.address, 10 * stablePrice)
    await expect(sale.connect(user1Signer).investStable(10 * stablePrice)).to.revertedWith("TS01")
    const start = await time.latest()
    const end = (await time.latest()) + 3600 * 24;
    await sale.setSchedule(start, end)
    await expect(sale.connect(user1Signer).investStable(10 * stablePrice)).to.changeTokenBalances(
      token,
      [user1, ownerAddr],
      [10, -10]
    );
  });

  it("Should transfer feeless with permit function", async function () {
    const { token, complianceRegistry } = await loadFixture(deployTokenFixture);
    const provider = ethers.provider;
    const chainId = (await provider.getNetwork()).chainId

    const newUser = ethers.Wallet.createRandom();
    const newAddress = await newUser.getAddress();
    expect(await provider.getBalance(newAddress)).to.equal(0)

    const user1 = (await provider.listAccounts())[1];
    await token.mint(newAddress, 100)
    expect(await token.allowance(newAddress, user1)).to.equal(0)

    const types = {
      "Permit": [{
        "name": "owner",
        "type": "address"
      },
      {
        "name": "spender",
        "type": "address"
      },
      {
        "name": "value",
        "type": "uint256"
      },
      {
        "name": "nonce",
        "type": "uint256"
      },
      {
        "name": "deadline",
        "type": "uint256"
      }
      ]
    }
    const domain = {
      "name": await token.name(),
      "version": "2",
      "chainId": ethers.BigNumber.from(chainId),
      "verifyingContract": token.address
    }
    const value = {
      "owner": newAddress,
      "spender": user1,
      "value": ethers.BigNumber.from(50),
      "nonce": await token.nonces(newAddress),
      "deadline": ethers.constants.MaxUint256
    }
    const signature = await newUser._signTypedData(domain, types, value);
    const r = '0x' + signature.substring(2).substring(0, 64);
    const s = '0x' + signature.substring(2).substring(64, 128);
    const v = parseInt(signature.substring(2).substring(128, 130), 16);

    await token.permit(value.owner, value.spender, value.value, value.deadline, v, r, s);
    expect(await token.allowance(newAddress, user1)).to.equal(50)

    const registerTime = (await time.latest()) + 3600 * 24;
    await complianceRegistry.registerUsers([user1, newAddress], [0, 0], [registerTime, registerTime])
    const user1Signer = (await ethers.getSigners())[1]
    await expect(token.connect(user1Signer).transferFrom(newAddress, user1, 50)).to.changeTokenBalances(
      token,
      [user1, newAddress],
      [50, -50]
    );
  });

});