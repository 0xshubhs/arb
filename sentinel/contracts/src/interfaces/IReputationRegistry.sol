// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IReputationRegistry
/// @notice Minimal read surface for the live-on-Arbitrum ERC-8004 Reputation Registry.
/// @dev    The on-chain schema is still evolving; `ERC8004Reader` adapts this shape and
///         normalizes to 0–100. Kept intentionally small + read-only.
interface IReputationRegistry {
    /// @return score raw reputation score for `account`
    /// @return scale the maximum possible score, used to normalize to 0–100
    function getReputation(address account) external view returns (uint256 score, uint256 scale);
}
