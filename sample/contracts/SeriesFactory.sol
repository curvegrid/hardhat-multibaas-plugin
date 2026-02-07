// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./SeriesRegistry.sol";
import "./SeriesVault.sol";

contract SeriesFactory {
    SeriesRegistry public registry;
    address public lastVault;

    event VaultCreated(address indexed token, address vault);

    constructor(address registry_) {
        registry = SeriesRegistry(registry_);
    }

    function createVault(address token) external returns (address) {
        SeriesVault vault = new SeriesVault(token, address(registry));
        lastVault = address(vault);
        emit VaultCreated(token, address(vault));
        return address(vault);
    }
}
