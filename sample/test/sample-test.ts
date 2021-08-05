// Copyright (c) 2021 Curvegrid Inc.

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { assert, expect } from "chai";
import { Contract } from "ethers";
import hre from "hardhat";
import { DeployResult } from "hardhat-multibaas-plugin/lib/type-extensions";

describe("Greeter", function () {
  it("Should return the new greeting once it's changed", async function (): Promise<void> {
    const { contract, mbContract, mbAddress } = (await hre.run("deploy", {
      contract: "greeter",
    })) as DeployResult;

    // MultiBaas deployment tests
    expect(mbContract.label).to.equal("greeter");
    expect(mbContract.contractName).to.equal("Greeter");
    expect(mbAddress.label).to.equal("greeter");
    expect(mbAddress.address).to.equal(contract.address);
    expect(
      mbAddress.contracts.findIndex(({ label }) => label === "greeter")
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

    metaCoinInstance = (await hre.run("deploy", {
      contract: "metacoin",
    })) as Contract;
  });

  it("should put 10000 MetaCoin in the first account", async (): Promise<void> => {
    const balance = await metaCoinInstance["getBalance"](account1.address);

    assert.equal(balance.valueOf(), 10000, "10000 wasn't in the first account");
  });

  it("should call a function that depends on a linked library", async (): Promise<void> => {
    const metaCoinBalance = (
      await metaCoinInstance["getBalance"](account1.address)
    ).toNumber();
    const metaCoinEthBalance = (
      await metaCoinInstance["getBalanceInEth"](account1.address)
    ).toNumber();

    assert.equal(
      metaCoinEthBalance,
      2 * metaCoinBalance,
      "Library function returned unexpected function, linkage may be broken"
    );
  });

  it("should send coin correctly", async (): Promise<void> => {
    // Setup 2 accounts.
    const accountOne = account1.address;
    const accountTwo = account2.address;

    // Get initial balances of first and second account.
    const accountOneStartingBalance = (
      await metaCoinInstance["getBalance"](accountOne)
    ).toNumber();
    const accountTwoStartingBalance = (
      await metaCoinInstance["getBalance"](accountTwo)
    ).toNumber();

    // Make transaction from first account to second.
    const amount = 10;
    await metaCoinInstance["sendCoin"](accountTwo, amount, {
      from: accountOne,
    });

    // Get balances of first and second account after the transactions.
    const accountOneEndingBalance = (
      await metaCoinInstance["getBalance"](accountOne)
    ).toNumber();
    const accountTwoEndingBalance = (
      await metaCoinInstance["getBalance"](accountTwo)
    ).toNumber();

    assert.equal(
      accountOneEndingBalance,
      accountOneStartingBalance - amount,
      "Amount wasn't correctly taken from the sender"
    );
    assert.equal(
      accountTwoEndingBalance,
      accountTwoStartingBalance + amount,
      "Amount wasn't correctly sent to the receiver"
    );
  });
});
