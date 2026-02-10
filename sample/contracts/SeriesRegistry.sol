// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract SeriesRegistry {
    address public owner;
    address public factory;

    mapping(bytes32 => address) private _entries;

    event FactoryUpdated(address indexed factory);
    event EntryRegistered(bytes32 indexed key, address indexed addr);

    modifier onlyOwner() {
        require(msg.sender == owner, "SeriesRegistry: not owner");
        _;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "SeriesRegistry: not factory");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setFactory(address newFactory) external onlyOwner {
        factory = newFactory;
        emit FactoryUpdated(newFactory);
    }

    function register(bytes32 key, address addr) external onlyFactory {
        _entries[key] = addr;
        emit EntryRegistered(key, addr);
    }

    function get(bytes32 key) external view returns (address) {
        return _entries[key];
    }
}
