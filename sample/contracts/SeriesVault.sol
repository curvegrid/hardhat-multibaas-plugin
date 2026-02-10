// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract SeriesVault {
    address public token;
    address public registry;
    address public owner;

    event Deposited(address indexed from, uint256 amount);

    constructor(address token_, address registry_) {
        token = token_;
        registry = registry_;
        owner = msg.sender;
    }

    function deposit(uint256 amount) external {
        emit Deposited(msg.sender, amount);
    }
}
