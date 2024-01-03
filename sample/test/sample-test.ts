// Copyright (c) 2021 Curvegrid Inc.

import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { assert, expect } from "chai";
import { Contract } from "ethers";
import hre from "hardhat";
import {
  DeployResult,
  DeployProxyResult,
} from "hardhat-multibaas-plugin/lib/type-extensions";

describe("Greeter", function () {
  it("Should return the new greeting once it's changed", async function (): Promise<void> {
    const { contract, mbContract, mbAddress } = (await hre.run("deploy", {
      contract: "greeter",
    })) as DeployResult;

    // MultiBaas deployment tests
    expect(mbContract.label).to.equal("greeter");
    expect(mbContract.contractName).to.equal("Greeter");
    expect(mbAddress.label).to.equal("greeter");
    expect(mbAddress.address).to.equal(await contract.getAddress());
    expect(
      mbAddress.contracts.findIndex(({ label }) => label === "greeter"),
    ).to.not.equal(-1);

    // Contract method call tests
    expect(await contract["greet"]()).to.equal("Hello, world!");

    await contract["setGreeting"]("Hola, mundo!");
    expect(await contract["greet"]()).to.equal("Hola, mundo!");
  });

  it("Should operate on a linked Greeter", async function (): Promise<void> {
    const { contract, mbContract, mbAddress } = (await hre.run("deploy", {
      contract: "linked_greeter",
    })) as DeployResult;

    // MultiBaas deployment tests
    expect(mbContract.label).to.equal("greeter");
    expect(mbContract.contractName).to.equal("Greeter");
    expect(mbAddress.label).to.equal("linked_greeter");
    expect(mbAddress.address).to.equal(await contract.getAddress());
    expect(
      mbAddress.contracts.findIndex(({ label }) => label === "greeter"),
    ).to.not.equal(-1);

    // Contract method call tests
    expect(await contract["greet"]()).to.equal("Hello, world!");

    await contract["setGreeting"]("Hola, mundo!");
    expect(await contract["greet"]()).to.equal("Hola, mundo!");
  });
});

// tests based on Metacoin defined in truffle-box
describe("Metacoin", function () {
  let metaCoinInstance: Contract;
  let accounts: SignerWithAddress[];
  let account1: SignerWithAddress;
  let account2: SignerWithAddress;

  beforeEach(async function () {
    accounts = await hre.ethers.getSigners();
    expect(accounts[0]).to.exist;
    expect(accounts[1]).to.exist;
    account1 = accounts[0] as SignerWithAddress;
    account2 = accounts[1] as SignerWithAddress;

    ({ contract: metaCoinInstance } = (await hre.run("deploy", {
      contract: "metacoin",
    })) as DeployResult);
  });

  it("should put 10000 MetaCoin in the first account", async (): Promise<void> => {
    const balance = await metaCoinInstance["getBalance"](account1.address);

    assert.equal(balance.valueOf(), 10000, "10000 wasn't in the first account");
  });

  it("should call a function that depends on a linked library", async (): Promise<void> => {
    const metaCoinBalance = Number(
      await metaCoinInstance["getBalance"](account1.address),
    );
    const metaCoinEthBalance = Number(
      await metaCoinInstance["getBalanceInEth"](account1.address),
    );

    assert.equal(
      metaCoinEthBalance,
      2 * metaCoinBalance,
      "Library function returned unexpected function, linkage may be broken",
    );
  });

  it("should send coin correctly", async (): Promise<void> => {
    // Setup 2 accounts.
    const accountOne = account1.address;
    const accountTwo = account2.address;

    // Get initial balances of first and second account.
    const accountOneStartingBalance = Number(
      await metaCoinInstance["getBalance"](accountOne),
    );
    const accountTwoStartingBalance = Number(
      await metaCoinInstance["getBalance"](accountTwo),
    );

    // Make transaction from first account to second.
    const amount = 10;
    await metaCoinInstance["sendCoin"](accountTwo, amount, {
      from: accountOne,
    });

    // Get balances of first and second account after the transactions.
    const accountOneEndingBalance = Number(
      await metaCoinInstance["getBalance"](accountOne),
    );
    const accountTwoEndingBalance = Number(
      await metaCoinInstance["getBalance"](accountTwo),
    );

    assert.equal(
      accountOneEndingBalance,
      accountOneStartingBalance - amount,
      "Amount wasn't correctly taken from the sender",
    );
    assert.equal(
      accountTwoEndingBalance,
      accountTwoStartingBalance + amount,
      "Amount wasn't correctly sent to the receiver",
    );
  });
});

describe("ProxiedGreeter", function () {
  it("Should return the new greeting once it's changed", async function (): Promise<void> {
    const {
      contract,
      mbContract,
      mbAddress,
      adminAddress,
      implementationAddress,
    } = (await hre.run("deployProxy", {
      contract: "proxied_greeter",
    })) as DeployProxyResult;

    // MultiBaas deployment tests
    expect(mbContract.label).to.equal("proxied_greeter");
    expect(mbContract.contractName).to.equal("ProxiedGreeter");
    expect(mbAddress.label).to.equal("proxied_greeter");
    expect(mbAddress.address).to.equal(await contract.getAddress());
    expect(
      mbAddress.contracts.findIndex(({ label }) => label === "proxied_greeter"),
    ).to.not.equal(-1);
    expect(adminAddress).to.equal(
      await hre.upgrades.erc1967.getAdminAddress(mbAddress.address),
    );
    expect(implementationAddress).to.equal(
      await hre.upgrades.erc1967.getImplementationAddress(mbAddress.address),
    );

    // Contract method call tests
    expect(await contract["greet"]()).to.equal("Hello, world!");

    await contract["setGreeting"]("Hola, mundo!");
    expect(await contract["greet"]()).to.equal("Hola, mundo!");
  });
});
