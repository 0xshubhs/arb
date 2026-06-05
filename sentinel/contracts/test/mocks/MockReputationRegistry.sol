// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IReputationRegistry} from "../../src/interfaces/IReputationRegistry.sol";

/// @notice Stand-in for the live Arbitrum ERC-8004 ReputationRegistry in tests. Stores a feedback
///         summary per agentId, matching the real `getSummary` shape (signed fixed-point).
contract MockReputationRegistry is IReputationRegistry {
    struct Summary {
        uint64 count;
        int128 value;
        uint8 decimals;
    }

    mapping(uint256 agentId => Summary) public summaries;
    bool public shouldRevert;

    /// @notice Set the aggregate feedback summary for an agent (e.g. count=1, value=80, decimals=0 => 80/100).
    function setSummary(uint256 agentId, uint64 count, int128 value, uint8 decimals) external {
        summaries[agentId] = Summary(count, value, decimals);
    }

    /// @notice Simulate a flaky/unavailable registry to exercise the reader's graceful fallback.
    function setShouldRevert(bool v) external {
        shouldRevert = v;
    }

    function getSummary(uint256 agentId, address[] calldata, string calldata, string calldata)
        external
        view
        override
        returns (uint64, int128, uint8)
    {
        require(!shouldRevert, "registry down");
        Summary memory s = summaries[agentId];
        return (s.count, s.value, s.decimals);
    }
}
