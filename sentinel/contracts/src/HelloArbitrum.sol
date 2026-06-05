// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title HelloArbitrum
/// @notice Day-1 eligibility de-risk: a trivial contract to prove the deploy + Arbiscan verify
///         pipeline on Arbitrum Sepolia before shipping the real stack.
contract HelloArbitrum {
    string public greeting = "SENTINEL is live on Arbitrum";
    address public immutable deployer;
    uint256 public blocks;

    event Pinged(address indexed who, uint256 total);

    constructor() {
        deployer = msg.sender;
    }

    function ping() external returns (uint256) {
        blocks += 1;
        emit Pinged(msg.sender, blocks);
        return blocks;
    }
}
