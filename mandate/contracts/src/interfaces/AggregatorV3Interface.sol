// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title AggregatorV3Interface
/// @notice Minimal Chainlink price-feed interface. `PriceOracle` sits behind this so
///         guardrail math is identical whether a real feed or a labeled mock is used.
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}
