// SPDX-License-Identifier: MIT
pragma solidity >=0.4.25;

import "./ConvertLib.sol";

// This is just a simple example of a coin-like contract.
// It is not standards compatible and cannot be expected to talk to other
// coin/token contracts. If you want to create a standards-compliant
// token, see: https://github.com/ConsenSys/Tokens. Cheers!

/**
 * @title MetaCoin
 * @dev A simple coin-like contract example. This contract is not standards compliant and is meant for educational purposes. (devdoc)
 * @notice A simple coin-like contract example. This contract is not standards compliant and is meant for educational purposes. (userdoc)
 */
contract MetaCoin {
    mapping(address => uint) balances;

    /**
     * @dev Event triggered when coins are transferred. (devdoc)
     * @notice Event triggered when coins are transferred. (userdoc)
     * @param _from The address from which the coins are sent.
     * @param _to The address to which the coins are sent.
     * @param _value The amount of coins transferred.
     */
    event Transfer(address indexed _from, address indexed _to, uint256 _value);

    /**
     * @dev Constructor that gives the contract creator an initial balance of 10000 MetaCoins. (devdoc)
     * @notice Constructor that gives the contract creator an initial balance of 10000 MetaCoins. (userdoc)
     */
    constructor() {
        balances[tx.origin] = 10000;
    }

    /**
     * @dev Transfers coins from sender's account to receiver's account if the sender has sufficient balance. (devdoc)
     * @notice Send `amount` of MetaCoins to `receiver`. (userdoc)
     * @param receiver The address of the receiver.
     * @param amount The amount of MetaCoins to send.
     * @return sufficient Returns true if the sender has enough balance, false otherwise.
     */
    function sendCoin(
        address receiver,
        uint amount
    ) public returns (bool sufficient) {
        if (balances[msg.sender] < amount) return false;
        balances[msg.sender] -= amount;
        balances[receiver] += amount;
        emit Transfer(msg.sender, receiver, amount);
        return true;
    }

    /**
     * @dev Converts the balance of `addr` from MetaCoins to Ether. (devdoc)
     * @notice Get the balance of `addr` in Ether. (userdoc)
     * @param addr The address whose balance is to be checked.
     * @return The balance in Ether.
     */
    function getBalanceInEth(address addr) public view returns (uint) {
        return ConvertLib.convert(getBalance(addr), 2);
    }

    /**
     * @dev Returns the balance of `addr`. (devdoc)
     * @notice Get the balance of `addr` in MetaCoins. (userdoc)
     * @param addr The address whose balance is to be checked.
     * @return The balance in MetaCoins.
     */
    function getBalance(address addr) public view returns (uint) {
        return balances[addr];
    }
}
