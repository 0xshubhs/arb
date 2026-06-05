// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ScoreInput} from "../RiskTypes.sol";

/// @title IRiskEngine
/// @notice Common surface for the Solidity twin and the Stylus (Rust) kernel so `AgentGuard`
///         is agnostic to which engine it calls.
interface IRiskEngine {
    /// @notice Register/fund an agent's notional balance (sets the drawdown high-water mark).
    function registerAgent(address agent, uint256 startBalance) external;

    /// @notice Stateful pre-settlement check. Records the spend iff allowed.
    function checkSpend(uint256 policyId, address agent, address to, uint256 amount)
        external
        returns (bool allowed, uint8 score, uint8 reasonCode);

    /// @notice Pure scoring core — the compute-heavy piece benchmarked Stylus-vs-Solidity.
    function scorePure(ScoreInput calldata input)
        external
        pure
        returns (bool allowed, uint8 score, uint8 reasonCode);
}
