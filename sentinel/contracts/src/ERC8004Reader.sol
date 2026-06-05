// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IReputationRegistry} from "./interfaces/IReputationRegistry.sol";

/// @title ERC8004Reader
/// @notice Thin, read-only adapter over the live Arbitrum ERC-8004 Reputation Registry. It reads a
///         counterparty agent's aggregate feedback via `getSummary`, normalizes the signed
///         fixed-point result to 0–100, caches last-good, and **degrades gracefully** to a neutral
///         default (and the policy's local denylist) if the live read reverts or there's no data —
///         keeping ERC-8004 additive and off the critical path.
/// @dev    ERC-8004 indexes agents by `agentId`, with no on-chain reverse lookup from a wallet
///         address. So callers (or an off-chain resolver) register the address→agentId mapping for
///         counterparties they care about; unknown counterparties fall back to the default + denylist.
contract ERC8004Reader is Ownable {
    IReputationRegistry public reputationRegistry;

    /// @notice counterparty wallet => ERC-8004 agentId (0 = unknown).
    mapping(address counterparty => uint256 agentId) public agentIdOf;

    mapping(address account => uint16 reputation) public cachedReputation;
    mapping(address account => bool cached) public hasCache;

    /// @notice Reputation assumed for an unknown/unreachable counterparty (additive default).
    uint16 public defaultReputation = 50;

    event RegistrySet(address indexed registry);
    event AgentIdSet(address indexed counterparty, uint256 indexed agentId);
    event DefaultReputationSet(uint16 value);
    event ReputationCached(address indexed account, uint16 reputation);

    error InvalidDefault();

    constructor(address reputationRegistry_) Ownable(msg.sender) {
        reputationRegistry = IReputationRegistry(reputationRegistry_);
    }

    function setRegistry(address reputationRegistry_) external onlyOwner {
        reputationRegistry = IReputationRegistry(reputationRegistry_);
        emit RegistrySet(reputationRegistry_);
    }

    /// @notice Map a counterparty wallet to its ERC-8004 agentId (off-chain resolver / owner).
    function setAgentId(address counterparty, uint256 agentId) external onlyOwner {
        agentIdOf[counterparty] = agentId;
        emit AgentIdSet(counterparty, agentId);
    }

    function setDefaultReputation(uint16 value) external onlyOwner {
        if (value > 100) revert InvalidDefault();
        defaultReputation = value;
        emit DefaultReputationSet(value);
    }

    /// @notice Best-effort reputation read for a counterparty.
    /// @return reputation normalized 0–100
    /// @return live true if sourced from the live registry (or a prior cache), false if defaulted
    function reputationOf(address counterparty) public view returns (uint16 reputation, bool live) {
        uint256 agentId = agentIdOf[counterparty];
        if (address(reputationRegistry) == address(0) || agentId == 0) {
            return _fallback(counterparty);
        }
        try reputationRegistry.getSummary(agentId, new address[](0), "", "") returns (
            uint64 count, int128 summaryValue, uint8 decimals
        ) {
            if (count == 0) return _fallback(counterparty);
            return (_normalize(summaryValue, decimals), true);
        } catch {
            return _fallback(counterparty);
        }
    }

    /// @notice Persist the latest live reputation for `counterparty` (anyone may warm the cache).
    function refresh(address counterparty) external {
        (uint16 rep, bool live) = reputationOf(counterparty);
        if (live) {
            cachedReputation[counterparty] = rep;
            hasCache[counterparty] = true;
            emit ReputationCached(counterparty, rep);
        }
    }

    function _fallback(address counterparty) internal view returns (uint16, bool) {
        return hasCache[counterparty] ? (cachedReputation[counterparty], true) : (defaultReputation, false);
    }

    /// @dev Normalize signed fixed-point feedback to a clamped 0–100 score.
    function _normalize(int128 summaryValue, uint8 decimals) internal pure returns (uint16) {
        int256 v = int256(summaryValue);
        if (decimals > 0) v = v / int256(10 ** uint256(decimals));
        if (v < 0) return 0;
        if (v > 100) return 100;
        return uint16(uint256(v));
    }
}
