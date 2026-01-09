import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("Greeter", function () {
  async function deployGreeter() {
    const greeter = await ethers.deployContract("Greeter", ["Hello, world!"]);
    await greeter.waitForDeployment();
    return greeter;
  }

  it("returns the greeting and can update it", async function () {
    const greeter = await deployGreeter();

    expect(await greeter.greet()).to.equal("Hello, world!");

    const tx = await greeter.setGreeting("Hola, mundo!");
    await tx.wait();

    expect(await greeter.greet()).to.equal("Hola, mundo!");
  });
});

describe("MetaCoin", function () {
  async function deployMetaCoin() {
    const convertLib = await ethers.deployContract("ConvertLib");
    await convertLib.waitForDeployment();

    const convertLibAddress = await convertLib.getAddress();
    const metaCoinFactory = await ethers.getContractFactory("MetaCoin", {
      libraries: {
        ConvertLib: convertLibAddress,
      },
    });
    const metaCoin = await metaCoinFactory.deploy();
    await metaCoin.waitForDeployment();
    return metaCoin;
  }

  it("assigns the initial balance to the deployer", async function () {
    const [account1] = await ethers.getSigners();
    const metaCoin = await deployMetaCoin();

    expect(await metaCoin.getBalance(account1.address)).to.equal(10000n);
  });

  it("uses the linked ConvertLib library", async function () {
    const [account1] = await ethers.getSigners();
    const metaCoin = await deployMetaCoin();

    const balance = await metaCoin.getBalance(account1.address);
    expect(await metaCoin.getBalanceInEth(account1.address)).to.equal(
      balance * 2n,
    );
  });

  it("transfers coins between accounts", async function () {
    const [account1, account2] = await ethers.getSigners();
    const metaCoin = await deployMetaCoin();

    const accountOneStartingBalance = await metaCoin.getBalance(
      account1.address,
    );
    const accountTwoStartingBalance = await metaCoin.getBalance(
      account2.address,
    );

    const amount = 10n;
    const tx = await metaCoin
      .connect(account1)
      .sendCoin(account2.address, amount);
    await tx.wait();

    const accountOneEndingBalance = await metaCoin.getBalance(account1.address);
    const accountTwoEndingBalance = await metaCoin.getBalance(account2.address);

    expect(accountOneEndingBalance).to.equal(accountOneStartingBalance - amount);
    expect(accountTwoEndingBalance).to.equal(accountTwoStartingBalance + amount);
  });
});

describe("ProxiedGreeter", function () {
  async function deployProxiedGreeter(initialGreeting: string) {
    const [admin, user] = await ethers.getSigners();
    const implementation = await ethers.deployContract("ProxiedGreeter", [
      admin.address,
    ]);
    await implementation.waitForDeployment();

    const initData = implementation.interface.encodeFunctionData("initialize", [
      initialGreeting,
    ]);
    const proxy = await ethers.deployContract("TransparentUpgradeableProxy", [
      await implementation.getAddress(),
      admin.address,
      initData,
    ]);
    await proxy.waitForDeployment();

    const proxiedGreeter = await ethers.getContractAt(
      "ProxiedGreeter",
      await proxy.getAddress(),
    );

    return { proxiedGreeter, user };
  }

  it("initializes through the proxy and updates the greeting", async function () {
    const { proxiedGreeter, user } =
      await deployProxiedGreeter("Hello, world!");
    const greeter = proxiedGreeter.connect(user);

    expect(await greeter.greet()).to.equal("Hello, world!");

    const tx = await greeter.setGreeting("Hola, mundo!");
    await tx.wait();

    expect(await greeter.greet()).to.equal("Hola, mundo!");
  });
});
