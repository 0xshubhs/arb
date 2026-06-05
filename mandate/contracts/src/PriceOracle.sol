// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";

/// @title PriceOracle
/// @notice Adapter behind Chainlink `AggregatorV3Interface`. One feed per stock token,
///         price quoted in USDG terms scaled to 1e8 (Chainlink convention).
/// @dev    If no live feed exists on the target testnet, the owner sets a *labeled* mock
///         price — the guardrail math (slippage, NAV/weights) is production-shaped either way.
contract PriceOracle is Ownable {
    /// @notice Scale all prices are normalized to (USDG per 1 whole stock, 1e8 fixed point).
    uint256 public constant PRICE_SCALE = 1e8;

    struct FeedConfig {
        AggregatorV3Interface aggregator; // address(0) when using a mock
        int256 mockPrice; // used iff aggregator == address(0); 1e8-scaled
        bool isMock; // true => mockPrice is authoritative (labeled testnet-only)
    }

    mapping(address token => FeedConfig) private _feeds;

    event FeedSet(address indexed token, address indexed aggregator);
    event MockPriceSet(address indexed token, int256 price);

    error NoFeed(address token);
    error StalePrice(address token);
    error NonPositivePrice(address token);

    constructor() Ownable(msg.sender) {}

    /// @notice Point a token at a live Chainlink aggregator.
    function setFeed(address token, address aggregator) external onlyOwner {
        _feeds[token] = FeedConfig({aggregator: AggregatorV3Interface(aggregator), mockPrice: 0, isMock: false});
        emit FeedSet(token, aggregator);
    }

    /// @notice Set a labeled mock price (testnet-only) for a token with no live feed.
    /// @param price USDG per 1 whole stock, scaled to 1e8.
    function setMockPrice(address token, int256 price) external onlyOwner {
        if (price <= 0) revert NonPositivePrice(token);
        _feeds[token] = FeedConfig({aggregator: AggregatorV3Interface(address(0)), mockPrice: price, isMock: true});
        emit MockPriceSet(token, price);
    }

    /// @notice True if this token's price is a labeled mock (surface in UI for honesty).
    function isMock(address token) external view returns (bool) {
        return _feeds[token].isMock;
    }

    /// @notice Price of `token` in USDG terms, scaled to 1e8.
    function priceOf(address token) external view returns (uint256 priceUsdg1e8) {
        FeedConfig memory cfg = _feeds[token];
        if (cfg.isMock) {
            // mockPrice already validated > 0 on set
            return uint256(cfg.mockPrice);
        }
        if (address(cfg.aggregator) == address(0)) revert NoFeed(token);

        (, int256 answer,, uint256 updatedAt,) = cfg.aggregator.latestRoundData();
        if (answer <= 0) revert NonPositivePrice(token);
        if (updatedAt == 0) revert StalePrice(token);

        uint8 dec = cfg.aggregator.decimals();
        uint256 raw = uint256(answer);
        if (dec == 8) {
            return raw;
        } else if (dec < 8) {
            return raw * (10 ** (8 - dec));
        } else {
            return raw / (10 ** (dec - 8));
        }
    }
}
