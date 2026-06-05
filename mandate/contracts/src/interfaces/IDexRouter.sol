// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IDexRouter
/// @notice Minimal swap interface so the vault's rebalance path is router-agnostic.
///         The in-repo `StockAMM` implements this; a production router (e.g. 0x) can
///         be swapped in without touching `MandateVault`.
interface IDexRouter {
    /// @notice Swap exactly `amountIn` of `tokenIn` for `tokenOut`; revert if out < `minOut`.
    function swapExactIn(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut)
        external
        returns (uint256 amountOut);

    /// @notice View the amount of `tokenOut` returned for `amountIn` of `tokenIn`.
    function quote(address tokenIn, address tokenOut, uint256 amountIn)
        external
        view
        returns (uint256 amountOut);
}
