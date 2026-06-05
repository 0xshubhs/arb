// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IDexRouter} from "./interfaces/IDexRouter.sol";
import {PriceOracle} from "./PriceOracle.sol";

/// @title MandateVault — the load-bearing contract
/// @notice A non-custodial vault holding one user's USDG + tokenized-stock basket. The OWNER
///         grants a scoped AI agent a *cryptographically bounded* mandate: the agent may ONLY
///         call `rebalance` / `autopilotBuy`, and every action is checked against an on-chain
///         policy (allowlist, per-trade & rolling-24h caps, slippage band, trading window,
///         drift-toward-target). Anything that breaches the policy reverts at the contract.
///
/// @dev    The guarantee is the *negative space*: there is no function that lets the AGENT
///         move assets to an arbitrary address. Only the OWNER can withdraw principal.
///         Deployed as an OZ minimal-proxy clone, so state is set via {initialize}, not a ctor.
contract MandateVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    struct Policy {
        address[] allowedAssets; // allowlisted stock tokens (USDG is implicit)
        uint16[] targetWeightsBps; // parallel to allowedAssets, must sum to 10000
        uint16 maxDriftBps; // a rebalance must not increase max drift beyond this intent
        uint256 perTradeCapUsdg; // max notional per single swap
        uint256 perDayCapUsdg; // rolling-24h cumulative notional cap
        uint16 maxSlippageBps; // realized price vs oracle mid tolerance
        uint64 windowStart; // seconds-of-day trading window start [0, 86400]
        uint64 windowEnd; // seconds-of-day trading window end   [0, 86400]
    }

    struct Swap {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minOut;
    }

    // ---------------------------------------------------------------------
    // Roles & constants
    // ---------------------------------------------------------------------

    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    uint256 private constant BPS = 10_000;
    uint256 private constant DAY = 86_400;
    uint256 private constant PRICE_SCALE = 1e8;

    // ---------------------------------------------------------------------
    // Storage (per-clone)
    // ---------------------------------------------------------------------

    IERC20 public usdg;
    IDexRouter public router;
    PriceOracle public oracle;
    uint8 public usdgDecimals;

    Policy private _policy;

    bool private _paused;
    bool private _initialized;

    uint256 public spentInWindow; // USDG notional spent in the current rolling window
    uint64 public windowAnchor; // start timestamp of the current rolling window
    uint256 public rebalanceNonce;

    // ---------------------------------------------------------------------
    // Events (the receipt trail)
    // ---------------------------------------------------------------------

    event Initialized(address indexed owner, address indexed agent);
    event Deposited(address indexed token, uint256 amount);
    event Withdrawn(address indexed token, uint256 amount);
    event PolicyUpdated(bytes32 policyHash);
    event AgentGranted(address indexed agent);
    event AgentRevoked(address indexed agent);
    event EmergencyPaused(bool paused);
    event Rebalanced(
        uint256 indexed nonce,
        int256[] preWeightsBps,
        int256[] postWeightsBps,
        uint256[] oraclePrices,
        uint256 notionalUsdg,
        bytes32 rationaleHash
    );
    event AutopilotBought(
        uint256 indexed nonce, address indexed stock, uint256 usdgIn, uint256 stockOut, bytes32 rationaleHash
    );

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error AlreadyInitialized();
    error ZeroAmount();
    error NoSwaps();
    error InvalidPolicy();
    error AssetNotAllowed();
    error PerTradeCapExceeded();
    error PerDayCapExceeded();
    error SlippageExceeded();
    error OutsideTradingWindow();
    error DriftNotImproved();
    error VaultPaused();

    // ---------------------------------------------------------------------
    // Init
    // ---------------------------------------------------------------------

    /// @notice One-time initializer (clones have no constructor).
    function initialize(
        address owner_,
        address agent_,
        address usdg_,
        address router_,
        address oracle_,
        Policy calldata policy_
    ) external {
        if (_initialized) revert AlreadyInitialized();
        _initialized = true;

        usdg = IERC20(usdg_);
        router = IDexRouter(router_);
        oracle = PriceOracle(oracle_);
        usdgDecimals = IERC20Metadata(usdg_).decimals();

        _validateAndSetPolicy(policy_);
        windowAnchor = uint64(block.timestamp);

        _grantRole(DEFAULT_ADMIN_ROLE, owner_);
        _grantRole(OWNER_ROLE, owner_);
        if (agent_ != address(0)) _grantRole(AGENT_ROLE, agent_);

        emit Initialized(owner_, agent_);
    }

    // ---------------------------------------------------------------------
    // Owner: principal & policy (the only paths that move funds out)
    // ---------------------------------------------------------------------

    /// @notice Deposit `amount` of `token` into the vault.
    function deposit(address token, uint256 amount) external onlyRole(OWNER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(token, amount);
    }

    /// @notice Withdraw `amount` of `token` to the owner. **Only the owner can move principal out.**
    function withdraw(address token, uint256 amount) external onlyRole(OWNER_ROLE) nonReentrant {
        if (amount == 0) revert ZeroAmount();
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Withdrawn(token, amount);
    }

    /// @notice Replace the active policy.
    function setPolicy(Policy calldata p) external onlyRole(OWNER_ROLE) {
        _validateAndSetPolicy(p);
    }

    /// @notice Kill switch: pause all agent activity instantly.
    function pause() external onlyRole(OWNER_ROLE) {
        _paused = true;
        emit EmergencyPaused(true);
    }

    /// @notice Resume agent activity.
    function unpause() external onlyRole(OWNER_ROLE) {
        _paused = false;
        emit EmergencyPaused(false);
    }

    /// @notice Revoke the agent's authority. Every in-flight agent op reverts thereafter.
    function revokeAgent(address agent_) external onlyRole(OWNER_ROLE) {
        _revokeRole(AGENT_ROLE, agent_);
        emit AgentRevoked(agent_);
    }

    /// @notice Grant / rotate an agent session key.
    function grantAgent(address agent_) external onlyRole(OWNER_ROLE) {
        _grantRole(AGENT_ROLE, agent_);
        emit AgentGranted(agent_);
    }

    // ---------------------------------------------------------------------
    // Agent: bounded actions
    // ---------------------------------------------------------------------

    /// @notice Execute a set of policy-legal swaps that move the basket toward target.
    /// @dev    Checks → effects → interactions, then post-interaction slippage/drift asserts
    ///         that revert (and roll back) on any breach. Guarded by `nonReentrant`.
    function rebalance(Swap[] calldata swaps, bytes32 rationaleHash)
        external
        onlyRole(AGENT_ROLE)
        nonReentrant
        whenActive
    {
        uint256 len = swaps.length;
        if (len == 0) revert NoSwaps();
        if (!_inWindow()) revert OutsideTradingWindow();

        // Pre-trade state.
        (uint256[] memory preW, uint256 preTotal) = _weights();
        uint256 preDrift = _maxDrift(preW);

        // Per-swap pre-checks (allowlist, per-trade cap) and notional aggregation.
        uint256 totalNotional;
        for (uint256 i; i < len; ++i) {
            uint256 notional = _classifyNotional(swaps[i]);
            if (notional > _policy.perTradeCapUsdg) revert PerTradeCapExceeded();
            totalNotional += notional;
        }

        // Effects: daily cap accrual + nonce.
        _accrueDaily(totalNotional);
        uint256 nonce = ++rebalanceNonce;

        // Interactions + realized-slippage verification.
        for (uint256 i; i < len; ++i) {
            uint256 amountOut = _exec(swaps[i]);
            _verifySlippage(swaps[i], amountOut);
        }

        // Post-trade: the basket must not drift further from target.
        (uint256[] memory postW, uint256 postTotal) = _weights();
        uint256 postDrift = _maxDrift(postW);
        if (preTotal > 0 && postTotal > 0 && postDrift > preDrift) revert DriftNotImproved();

        // Receipt.
        uint256 n = _policy.allowedAssets.length;
        uint256[] memory oraclePrices = new uint256[](n);
        for (uint256 j; j < n; ++j) {
            oraclePrices[j] = oracle.priceOf(_policy.allowedAssets[j]);
        }
        emit Rebalanced(nonce, _toInt(preW), _toInt(postW), oraclePrices, totalNotional, rationaleHash);
    }

    /// @notice Recurring/DCA buy of an allowlisted stock with idle USDG — through the *same* caps.
    function autopilotBuy(address stockOut, uint256 usdgAmount, uint256 minOut, bytes32 rationaleHash)
        external
        onlyRole(AGENT_ROLE)
        nonReentrant
        whenActive
    {
        if (usdgAmount == 0) revert ZeroAmount();
        _indexOf(stockOut); // reverts AssetNotAllowed if not allowlisted
        if (!_inWindow()) revert OutsideTradingWindow();
        if (usdgAmount > _policy.perTradeCapUsdg) revert PerTradeCapExceeded();

        _accrueDaily(usdgAmount);
        uint256 nonce = ++rebalanceNonce;

        Swap memory s = Swap({tokenIn: address(usdg), tokenOut: stockOut, amountIn: usdgAmount, minOut: minOut});
        uint256 amountOut = _exec(s);
        _verifySlippage(s, amountOut);

        emit AutopilotBought(nonce, stockOut, usdgAmount, amountOut, rationaleHash);
    }

    // ---------------------------------------------------------------------
    // Internal: validation helpers
    // ---------------------------------------------------------------------

    modifier whenActive() {
        if (_paused) revert VaultPaused();
        _;
    }

    function _validateAndSetPolicy(Policy calldata p) internal {
        uint256 n = p.allowedAssets.length;
        if (n == 0 || n != p.targetWeightsBps.length) revert InvalidPolicy();
        if (p.maxSlippageBps > BPS || p.maxDriftBps > BPS) revert InvalidPolicy();
        if (p.windowStart > DAY || p.windowEnd > DAY) revert InvalidPolicy();
        if (p.perTradeCapUsdg == 0 || p.perDayCapUsdg == 0) revert InvalidPolicy();

        uint256 sum;
        for (uint256 i; i < n; ++i) {
            if (p.allowedAssets[i] == address(0) || p.allowedAssets[i] == address(usdg)) revert InvalidPolicy();
            sum += p.targetWeightsBps[i];
        }
        if (sum != BPS) revert InvalidPolicy();

        _policy = p;
        emit PolicyUpdated(keccak256(abi.encode(p)));
    }

    /// @dev Validate a swap pairs USDG with an allowlisted stock and return its USDG notional.
    function _classifyNotional(Swap calldata s) internal view returns (uint256 notional) {
        address usdgAddr = address(usdg);
        if (s.amountIn == 0) revert ZeroAmount();
        if (s.tokenIn == usdgAddr && s.tokenOut != usdgAddr) {
            _indexOf(s.tokenOut); // must be allowlisted
            notional = s.amountIn; // USDG spent
        } else if (s.tokenOut == usdgAddr && s.tokenIn != usdgAddr) {
            _indexOf(s.tokenIn); // must be allowlisted
            notional = _usdgValue(s.tokenIn, s.amountIn); // oracle value of stock sold
        } else {
            revert AssetNotAllowed();
        }
    }

    /// @dev Realized price must be within `maxSlippageBps` of the oracle mid (symmetric band).
    function _verifySlippage(Swap memory s, uint256 amountOut) internal view {
        address usdgAddr = address(usdg);
        address stock = s.tokenIn == usdgAddr ? s.tokenOut : s.tokenIn;
        uint256 mid = oracle.priceOf(stock);
        uint256 scale = _valueScale(stock);

        uint256 realized;
        if (s.tokenIn == usdgAddr) {
            // buying stock: USDG in / stock out
            realized = (s.amountIn * scale) / amountOut;
        } else {
            // selling stock: USDG out / stock in
            realized = (amountOut * scale) / s.amountIn;
        }
        uint256 diff = realized > mid ? realized - mid : mid - realized;
        if (diff * BPS > mid * _policy.maxSlippageBps) revert SlippageExceeded();
    }

    /// @dev Roll the 24h window if elapsed, then enforce the cumulative daily cap.
    function _accrueDaily(uint256 amount) internal {
        if (block.timestamp >= uint256(windowAnchor) + DAY) {
            windowAnchor = uint64(block.timestamp);
            spentInWindow = 0;
        }
        if (spentInWindow + amount > _policy.perDayCapUsdg) revert PerDayCapExceeded();
        spentInWindow += amount;
    }

    function _inWindow() internal view returns (bool) {
        uint256 sod = block.timestamp % DAY;
        uint64 ws = _policy.windowStart;
        uint64 we = _policy.windowEnd;
        if (ws <= we) {
            return sod >= ws && sod <= we;
        }
        // wrap-around window (e.g. 22:00 -> 04:00)
        return sod >= ws || sod <= we;
    }

    function _exec(Swap memory s) internal returns (uint256 amountOut) {
        IERC20(s.tokenIn).forceApprove(address(router), s.amountIn);
        amountOut = router.swapExactIn(s.tokenIn, s.tokenOut, s.amountIn, s.minOut);
    }

    // ---------------------------------------------------------------------
    // Internal: valuation & weights
    // ---------------------------------------------------------------------

    /// @dev 10 ** (stockDecimals + 8 - usdgDecimals): converts (stockAmount * price1e8) -> USDG units.
    function _valueScale(address stock) internal view returns (uint256) {
        uint8 stockDec = IERC20Metadata(stock).decimals();
        return 10 ** (uint256(stockDec) + 8 - usdgDecimals);
    }

    /// @dev USDG value (in USDG base units) of `amount` of `stock`, via the oracle.
    function _usdgValue(address stock, uint256 amount) internal view returns (uint256) {
        return (amount * oracle.priceOf(stock)) / _valueScale(stock);
    }

    /// @dev Current basket weights (bps of total *stock* value) parallel to allowedAssets.
    function _weights() internal view returns (uint256[] memory w, uint256 totalStockValue) {
        uint256 n = _policy.allowedAssets.length;
        w = new uint256[](n);
        uint256[] memory vals = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            address a = _policy.allowedAssets[i];
            vals[i] = _usdgValue(a, IERC20(a).balanceOf(address(this)));
            totalStockValue += vals[i];
        }
        if (totalStockValue == 0) return (w, 0);
        for (uint256 i; i < n; ++i) {
            w[i] = (vals[i] * BPS) / totalStockValue;
        }
    }

    /// @dev Max absolute deviation (bps) of any asset weight from its target.
    function _maxDrift(uint256[] memory w) internal view returns (uint256 maxD) {
        uint256 n = _policy.targetWeightsBps.length;
        for (uint256 i; i < n; ++i) {
            uint256 t = _policy.targetWeightsBps[i];
            uint256 d = w[i] > t ? w[i] - t : t - w[i];
            if (d > maxD) maxD = d;
        }
    }

    function _indexOf(address token) internal view returns (uint256) {
        uint256 n = _policy.allowedAssets.length;
        for (uint256 i; i < n; ++i) {
            if (_policy.allowedAssets[i] == token) return i;
        }
        revert AssetNotAllowed();
    }

    function _toInt(uint256[] memory a) internal pure returns (int256[] memory b) {
        b = new int256[](a.length);
        for (uint256 i; i < a.length; ++i) {
            b[i] = int256(a[i]);
        }
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getPolicy() external view returns (Policy memory) {
        return _policy;
    }

    function getAllowedAssets() external view returns (address[] memory) {
        return _policy.allowedAssets;
    }

    function getWeights() external view returns (uint256[] memory weightsBps, uint256 totalStockValue) {
        return _weights();
    }

    function isPaused() external view returns (bool) {
        return _paused;
    }

    /// @notice USDG notional still spendable in the current rolling-24h window.
    function remainingDailyCap() external view returns (uint256) {
        if (block.timestamp >= uint256(windowAnchor) + DAY) return _policy.perDayCapUsdg;
        uint256 spent = spentInWindow;
        return spent >= _policy.perDayCapUsdg ? 0 : _policy.perDayCapUsdg - spent;
    }
}
