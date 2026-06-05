// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title HelloRobinhood
/// @notice Day-1 eligibility de-risk: a trivial contract to prove the deploy + Blockscout
///         verify pipeline against Robinhood Chain (chainId 46630) before shipping the real stack.
contract HelloRobinhood {
    string public greeting = "Mandate is live on Robinhood Chain";
    address public immutable deployer;
    uint256 public pokes;

    event Poked(address indexed who, uint256 total);

    constructor() {
        deployer = msg.sender;
    }

    function poke() external returns (uint256) {
        pokes += 1;
        emit Poked(msg.sender, pokes);
        return pokes;
    }

    function setGreeting(string calldata g) external {
        greeting = g;
    }
}
