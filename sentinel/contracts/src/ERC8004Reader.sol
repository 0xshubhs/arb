// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IReputationRegistry} from "./interfaces/IReputationRegistry.sol";

/// @title ERC8004Reader
/// @notice Thin, read-only adapter over the live Arbitrum ERC-8004 Reputation Registry.
///         Normalizes reputation to 0–100, caches last-good, and **degrades gracefully** to a
///         neutral default (and the policy's local denylist) if the live read reverts — keeping
///         ERC-8004 additive and off the critical path.
contract ERC8004Reader is Ownable {
    IReputationRegistry public registry;

    mapping(address account => uint16 reputation) public cachedReputation;
    mapping(address account => bool cached) public hasCache;

    /// @notice Reputation assumed for an unknown counterparty when the registry is unreachable.
    uint16 public defaultReputation = 50;

    event RegistrySet(address indexed registry);
    event DefaultReputationSet(uint16 value);
    event ReputationCached(address indexed account, uint16 reputation);

    error InvalidDefault();

    constructor(address registry_) Ownable(msg.sender) {
        registry = IReputationRegistry(registry_);
    }

    function setRegistry(address registry_) external onlyOwner {
        registry = IReputationRegistry(registry_);
        emit RegistrySet(registry_);
    }

    function setDefaultReputation(uint16 value) external onlyOwner {
        if (value > 100) revert InvalidDefault();
        defaultReputation = value;
        emit DefaultReputationSet(value);
    }

    /// @notice Best-effort reputation read.
    /// @return reputation normalized 0–100
    /// @return live true if sourced from the live registry (or a prior cache), false if defaulted
    function reputationOf(address account) public view returns (uint16 reputation, bool live) {
        if (address(registry) == address(0)) {
            return hasCache[account] ? (cachedReputation[account], true) : (defaultReputation, false);
        }
        try registry.getReputation(account) returns (uint256 raw, uint256 scale) {
            uint16 norm = scale == 0 ? 0 : uint16(_min(100, (raw * 100) / scale));
            return (norm, true);
        } catch {
            return hasCache[account] ? (cachedReputation[account], true) : (defaultReputation, false);
        }
    }

    /// @notice Persist the latest live reputation for `account` (anyone may warm the cache).
    function refresh(address account) external {
        (uint16 rep, bool live) = reputationOf(account);
        if (live) {
            cachedReputation[account] = rep;
            hasCache[account] = true;
            emit ReputationCached(account, rep);
        }
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
