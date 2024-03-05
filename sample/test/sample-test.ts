// Copyright (c) 2021 Curvegrid Inc.

import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import hre from "hardhat";

describe("Greeter", function () {
  async function deployGreeterFixture() {
    const Greeter = await hre.ethers.getContractFactory('Greeter');
    const greeter = await Greeter.deploy("Hello, world!");

    return { greeter };
  }
  it("Should return the new greeting once it's changed", async function (): Promise<void> {
    const { greeter } = await loadFixture(deployGreeterFixture);

    // Contract method call tests
    expect(await greeter.greet()).to.equal("Hello, world!");

    await greeter.setGreeting("Hola, mundo!");
    expect(await greeter.greet()).to.equal("Hola, mundo!");
  });
});

// tests based on Metacoin defined in truffle-box
describe("Metacoin", function () {
  let accounts: SignerWithAddress[];
  let account1: SignerWithAddress;
  let account2: SignerWithAddress;
  async function deployMetaCoinFixture() {
    const ConvertLib = await hre.ethers.getContractFactory('ConvertLib');
    const convertLib = await ConvertLib.deploy();
    const MetaCoin = await hre.ethers.getContractFactory('MetaCoin',
      {
        libraries:  {
          ConvertLib: convertLib.target
        }
      }
    );
    // Link the ConvertLib library to MetaCoin and deploy
    const metaCoin = await MetaCoin.deploy();

    return { metaCoin };
  }

  beforeEach(async function () {
    accounts = await hre.ethers.getSigners();
    expect(accounts[0]).to.exist;
    expect(accounts[1]).to.exist;
    account1 = accounts[0] as SignerWithAddress;
    account2 = accounts[1] as SignerWithAddress;
  });

  it("should put 10000 MetaCoin in the first account", async (): Promise<void> => {
    const { metaCoin } = await loadFixture(deployMetaCoinFixture);

    expect(await metaCoin.getBalance(account1.address)).to.equal(10000);
  });

  it("should call a function that depends on a linked library", async (): Promise<void> => {
    const { metaCoin } = await loadFixture(deployMetaCoinFixture);
    // confirm library function linkage

    const metaCoinBalance = await metaCoin.getBalance(account1.address)
    expect(await metaCoin.getBalanceInEth(account1.address)).to.equal(metaCoinBalance * BigInt(2));
  });

  it("should send coin correctly", async (): Promise<void> => {
    const { metaCoin } = await loadFixture(deployMetaCoinFixture);

    // Get initial balances of first and second account.
    const accountOneStartingBalance = await metaCoin.getBalance(account1.address);
    const accountTwoStartingBalance = await metaCoin.getBalance(account2.address);

    // Make transaction from first account to second.
    const amount = BigInt(10);
    await metaCoin.connect(account1).sendCoin(account2.address, amount);

    // Get balances of first and second account after the transactions.
    const accountOneEndingBalance = await metaCoin.getBalance(account1.address);
    const accountTwoEndingBalance = await metaCoin.getBalance(account2.address);

    expect(accountOneEndingBalance).to.equal(accountOneStartingBalance - amount);
    expect(accountTwoEndingBalance).to.equal(accountTwoStartingBalance + amount);
  });
});

describe("ProxiedGreeter", function () {
  async function deployProxiedGreeterFixture() {
    const ProxiedGreeter = await hre.ethers.getContractFactory('ProxiedGreeter');
    const proxiedGreeter = await hre.upgrades.deployProxy(ProxiedGreeter, ["Hello, world!"]);

    return { proxiedGreeter };
  }

  it("Should return the new greeting once it's changed", async function (): Promise<void> {
    const { proxiedGreeter } = await loadFixture(deployProxiedGreeterFixture);

    // Contract method call tests
    expect(await (proxiedGreeter as any)['greet']()).to.equal("Hello, world!");

    await (proxiedGreeter as any)["setGreeting"]("Hola, mundo!");
    expect(await (proxiedGreeter as any)['greet']()).to.equal("Hola, mundo!");
  });
});
