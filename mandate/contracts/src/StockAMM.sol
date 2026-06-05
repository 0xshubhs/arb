// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IDexRouter} from "./interfaces/IDexRouter.sol";

/// @title StockAMM
/// @notice Minimal constant-product (x*y=k) AMM, one pool per `stockToken/USDG` pair.
///         Seeded from faucet tokens so the rebalance path is fully self-contained and
///         demo-deterministic — it never waits on an unconfirmed external DEX.
/// @dev    Implements `IDexRouter` so a real router can replace it without touching the vault.
contract StockAMM is IDexRouter, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Swap fee in basis points (0.30%).
    uint256 public constant FEE_BPS = 30;
    uint256 private constant BPS = 10_000;

    IERC20 public immutable usdg;

    struct Pool {
        uint256 usdgReserve;
        uint256 stockReserve;
        bool exists;
    }

    mapping(address stockToken => Pool) public pools;

    event PoolCreated(address indexed stockToken, uint256 usdgReserve, uint256 stockReserve);
    event LiquidityAdded(address indexed stockToken, uint256 usdgIn, uint256 stockIn);
    event Swapped(
        address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, address indexed to
    );

    error PoolExists(address stockToken);
    error UnknownPool(address stockToken);
    error InvalidPair();
    error InsufficientLiquidity();
    error InsufficientInput();
    error SlippageExceeded();

    constructor(address usdg_) Ownable(msg.sender) {
        usdg = IERC20(usdg_);
    }

    /// @notice Create and seed a `stockToken/USDG` pool. Pulls both reserves from the caller.
    function createPool(address stockToken, uint256 usdgReserve, uint256 stockReserve) external onlyOwner {
        if (stockToken == address(usdg) || stockToken == address(0)) revert InvalidPair();
        if (pools[stockToken].exists) revert PoolExists(stockToken);
        if (usdgReserve == 0 || stockReserve == 0) revert InsufficientLiquidity();

        pools[stockToken] = Pool({usdgReserve: usdgReserve, stockReserve: stockReserve, exists: true});
        usdg.safeTransferFrom(msg.sender, address(this), usdgReserve);
        IERC20(stockToken).safeTransferFrom(msg.sender, address(this), stockReserve);
        emit PoolCreated(stockToken, usdgReserve, stockReserve);
    }

    /// @notice Top up an existing pool's reserves (owner only).
    function addLiquidity(address stockToken, uint256 usdgIn, uint256 stockIn) external onlyOwner {
        Pool storage p = pools[stockToken];
        if (!p.exists) revert UnknownPool(stockToken);
        p.usdgReserve += usdgIn;
        p.stockReserve += stockIn;
        usdg.safeTransferFrom(msg.sender, address(this), usdgIn);
        IERC20(stockToken).safeTransferFrom(msg.sender, address(this), stockIn);
        emit LiquidityAdded(stockToken, usdgIn, stockIn);
    }

    /// @dev Uniswap-v2 style constant-product output net of fee.
    function _getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        internal
        pure
        returns (uint256)
    {
        if (amountIn == 0) revert InsufficientInput();
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();
        uint256 amountInWithFee = amountIn * (BPS - FEE_BPS);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * BPS + amountInWithFee;
        return numerator / denominator;
    }

    /// @dev Resolve which pool/direction a (tokenIn,tokenOut) pair maps to.
    function _resolve(address tokenIn, address tokenOut)
        internal
        view
        returns (address stockToken, bool buyingStock, uint256 reserveIn, uint256 reserveOut)
    {
        address usdgAddr = address(usdg);
        if (tokenIn == usdgAddr && tokenOut != usdgAddr) {
            stockToken = tokenOut;
            buyingStock = true;
        } else if (tokenOut == usdgAddr && tokenIn != usdgAddr) {
            stockToken = tokenIn;
            buyingStock = false;
        } else {
            revert InvalidPair();
        }
        Pool memory p = pools[stockToken];
        if (!p.exists) revert UnknownPool(stockToken);
        (reserveIn, reserveOut) = buyingStock ? (p.usdgReserve, p.stockReserve) : (p.stockReserve, p.usdgReserve);
    }

    /// @inheritdoc IDexRouter
    function quote(address tokenIn, address tokenOut, uint256 amountIn)
        public
        view
        override
        returns (uint256 amountOut)
    {
        (,, uint256 reserveIn, uint256 reserveOut) = _resolve(tokenIn, tokenOut);
        amountOut = _getAmountOut(amountIn, reserveIn, reserveOut);
    }

    /// @inheritdoc IDexRouter
    function swapExactIn(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut)
        external
        override
        nonReentrant
        returns (uint256 amountOut)
    {
        (address stockToken, bool buyingStock, uint256 reserveIn, uint256 reserveOut) = _resolve(tokenIn, tokenOut);
        amountOut = _getAmountOut(amountIn, reserveIn, reserveOut);
        if (amountOut < minOut) revert SlippageExceeded();
        if (amountOut >= reserveOut) revert InsufficientLiquidity();

        // Effects: update reserves before paying out.
        Pool storage p = pools[stockToken];
        if (buyingStock) {
            p.usdgReserve = reserveIn + amountIn;
            p.stockReserve = reserveOut - amountOut;
        } else {
            p.stockReserve = reserveIn + amountIn;
            p.usdgReserve = reserveOut - amountOut;
        }

        // Interactions.
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
        emit Swapped(tokenIn, tokenOut, amountIn, amountOut, msg.sender);
    }
}
