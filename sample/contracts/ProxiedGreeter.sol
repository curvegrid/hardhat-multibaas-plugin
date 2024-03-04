//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "hardhat/console.sol";

/// @custom:oz-upgrades-unsafe-allow state-variable-immutable
contract ProxiedGreeter is Initializable {
    string greeting;

    address immutable ORIGINAL_DEPLOYER;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _originalDeployer) {
        ORIGINAL_DEPLOYER = _originalDeployer;
        _disableInitializers();
    }

    function initialize(string memory _greeting) public initializer {
        console.log("Deploying a Greeter with greeting:", _greeting);
        greeting = _greeting;
    }

    function greet() public view returns (string memory) {
        return greeting;
    }

    function setGreeting(string memory _greeting) public {
        console.log("Changing greeting from '%s' to '%s'", greeting, _greeting);
        greeting = _greeting;
    }
}
