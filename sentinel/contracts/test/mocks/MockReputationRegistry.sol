// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IReputationRegistry} from "../../src/interfaces/IReputationRegistry.sol";

/// @notice Stand-in for the live Arbitrum ERC-8004 Reputation Registry in tests.
contract MockReputationRegistry is IReputationRegistry {
    uint256 public scale = 100;
    mapping(address => uint256) public raw;
    bool public shouldRevert;

    function setReputation(address account, uint256 score) external {
        raw[account] = score;
    }

    function setScale(uint256 scale_) external {
        scale = scale_;
    }

    /// @notice Simulate a flaky/unavailable registry to exercise the reader's graceful fallback.
    function setShouldRevert(bool v) external {
        shouldRevert = v;
    }

    function getReputation(address account) external view override returns (uint256, uint256) {
        require(!shouldRevert, "registry down");
        return (raw[account], scale);
    }
}
