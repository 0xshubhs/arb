// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {MandateVault} from "./MandateVault.sol";

/// @title MandateVaultFactory
/// @notice Deploys one `MandateVault` per user as an OZ minimal-proxy clone of a single
///         audited implementation, then initializes it with the caller's policy.
contract MandateVaultFactory {
    /// @notice The implementation all clones delegate to.
    address public immutable implementation;

    address public immutable usdg;
    address public immutable router;
    address public immutable oracle;

    mapping(address owner => address vault) public vaultOf;

    event VaultCreated(address indexed owner, address indexed vault, address agent);

    error VaultAlreadyExists();

    constructor(address implementation_, address usdg_, address router_, address oracle_) {
        implementation = implementation_;
        usdg = usdg_;
        router = router_;
        oracle = oracle_;
    }

    /// @notice Create the caller's personal vault.
    function createVault(address agent, MandateVault.Policy calldata policy) external returns (address vault) {
        if (vaultOf[msg.sender] != address(0)) revert VaultAlreadyExists();
        vault = Clones.clone(implementation);
        vaultOf[msg.sender] = vault;
        MandateVault(vault).initialize(msg.sender, agent, usdg, router, oracle, policy);
        emit VaultCreated(msg.sender, vault, agent);
    }

    /// @notice Deterministic address preview (CREATE2) for a given salt.
    function predictVault(bytes32 salt) external view returns (address) {
        return Clones.predictDeterministicAddress(implementation, salt, address(this));
    }
}
