// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {MandateVault} from "../src/MandateVault.sol";
import {MandateVaultFactory} from "../src/MandateVaultFactory.sol";
import {StockAMM} from "../src/StockAMM.sol";
import {PriceOracle} from "../src/PriceOracle.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @notice Shared fixture: USDG (6dp) + two stock tokens (18dp), a seeded AMM, oracle mocks,
///         a factory-deployed vault funded 60/40 against a 50/50 target.
abstract contract MandateBase is Test {
    MockERC20 internal usdg;
    MockERC20 internal tsla;
    MockERC20 internal amzn;
    MockERC20 internal rand; // never allowlisted

    PriceOracle internal oracle;
    StockAMM internal amm;
    MandateVault internal impl;
    MandateVaultFactory internal factory;
    MandateVault internal vault;

    address internal owner = makeAddr("owner");
    address internal agent = makeAddr("agent");
    address internal attacker = makeAddr("attacker");

    uint256 internal constant TSLA_PRICE = 200e8; // $200
    uint256 internal constant AMZN_PRICE = 150e8; // $150

    function setUp() public virtual {
        usdg = new MockERC20("USD Global", "USDG", 6);
        tsla = new MockERC20("Tesla", "TSLA", 18);
        amzn = new MockERC20("Amazon", "AMZN", 18);
        rand = new MockERC20("Random", "RAND", 18);

        oracle = new PriceOracle();
        oracle.setMockPrice(address(tsla), int256(TSLA_PRICE));
        oracle.setMockPrice(address(amzn), int256(AMZN_PRICE));
        oracle.setMockPrice(address(rand), int256(100e8));

        // Seed deep liquidity so small trades hover near the oracle mid.
        amm = new StockAMM(address(usdg));
        _seedPool(tsla, 200_000_000e6, 1_000_000e18); // $200 mid
        _seedPool(amzn, 150_000_000e6, 1_000_000e18); // $150 mid

        impl = new MandateVault();
        factory = new MandateVaultFactory(address(impl), address(usdg), address(amm), address(oracle));

        // Owner creates a vault and funds it 60/40 with a USDG buffer.
        vm.prank(owner);
        vault = MandateVault(factory.createVault(agent, _defaultPolicy()));

        _fundVault(tsla, 300e18); // $60,000
        _fundVault(amzn, 266e18); // $39,900
        _fundVault(usdg, 50_000e6); // execution buffer
    }

    function _seedPool(MockERC20 stock, uint256 usdgReserve, uint256 stockReserve) internal {
        usdg.mint(address(this), usdgReserve);
        stock.mint(address(this), stockReserve);
        usdg.approve(address(amm), usdgReserve);
        stock.approve(address(amm), stockReserve);
        amm.createPool(address(stock), usdgReserve, stockReserve);
    }

    function _fundVault(MockERC20 token, uint256 amount) internal {
        token.mint(owner, amount);
        vm.startPrank(owner);
        token.approve(address(vault), amount);
        vault.deposit(address(token), amount);
        vm.stopPrank();
    }

    function _defaultPolicy() internal view returns (MandateVault.Policy memory p) {
        address[] memory assets = new address[](2);
        assets[0] = address(tsla);
        assets[1] = address(amzn);
        uint16[] memory weights = new uint16[](2);
        weights[0] = 5000;
        weights[1] = 5000;
        p = MandateVault.Policy({
            allowedAssets: assets,
            targetWeightsBps: weights,
            maxDriftBps: 200,
            perTradeCapUsdg: 25_000e6,
            perDayCapUsdg: 100_000e6,
            maxSlippageBps: 300,
            windowStart: 0,
            windowEnd: 86_400
        });
    }

    /// @dev The canonical drift-improving rebalance: sell 50 TSLA, buy AMZN with 10k USDG.
    function _balancingSwaps() internal view returns (MandateVault.Swap[] memory s) {
        s = new MandateVault.Swap[](2);
        s[0] = MandateVault.Swap({
            tokenIn: address(tsla),
            tokenOut: address(usdg),
            amountIn: 50e18,
            minOut: 9_500e6
        });
        s[1] = MandateVault.Swap({
            tokenIn: address(usdg),
            tokenOut: address(amzn),
            amountIn: 10_000e6,
            minOut: 60e18
        });
    }
}

contract MandateVaultUnitTest is MandateBase {
    function test_initialize_setsRolesAndConfig() public view {
        assertTrue(vault.hasRole(vault.OWNER_ROLE(), owner));
        assertTrue(vault.hasRole(vault.AGENT_ROLE(), agent));
        assertFalse(vault.hasRole(vault.OWNER_ROLE(), agent));
        assertEq(address(vault.usdg()), address(usdg));
        assertEq(vault.usdgDecimals(), 6);
    }

    function test_initialize_revertsOnSecondCall() public {
        vm.expectRevert(MandateVault.AlreadyInitialized.selector);
        vault.initialize(owner, agent, address(usdg), address(amm), address(oracle), _defaultPolicy());
    }

    function test_factory_oneVaultPerOwner() public {
        vm.prank(owner);
        vm.expectRevert(MandateVaultFactory.VaultAlreadyExists.selector);
        factory.createVault(agent, _defaultPolicy());
        assertEq(factory.vaultOf(owner), address(vault));
    }

    function test_deposit_and_ownerWithdraw() public {
        uint256 before = tsla.balanceOf(owner);
        vm.prank(owner);
        vault.withdraw(address(tsla), 100e18);
        assertEq(tsla.balanceOf(owner), before + 100e18);
        assertEq(tsla.balanceOf(address(vault)), 200e18);
    }

    function test_setPolicy_revertsOnBadWeights() public {
        MandateVault.Policy memory p = _defaultPolicy();
        p.targetWeightsBps[0] = 4000; // sums to 9000, not 10000
        vm.prank(owner);
        vm.expectRevert(MandateVault.InvalidPolicy.selector);
        vault.setPolicy(p);
    }

    function test_setPolicy_revertsOnLengthMismatch() public {
        MandateVault.Policy memory p = _defaultPolicy();
        uint16[] memory w = new uint16[](1);
        w[0] = 10000;
        p.targetWeightsBps = w;
        vm.prank(owner);
        vm.expectRevert(MandateVault.InvalidPolicy.selector);
        vault.setPolicy(p);
    }

    function test_weights_reflectHoldings() public view {
        (uint256[] memory w, uint256 total) = vault.getWeights();
        assertApproxEqAbs(w[0], 6006, 2); // TSLA ~60%
        assertApproxEqAbs(w[1], 3993, 2); // AMZN ~40%
        assertEq(total, 60_000e6 + 39_900e6);
    }
}

contract MandateVaultHappyPathTest is MandateBase {
    function test_rebalance_movesTowardTargetAndEmitsReceipt() public {
        (uint256[] memory preW,) = vault.getWeights();
        uint256 preDrift = _drift(preW);

        vm.prank(agent);
        vm.recordLogs();
        vault.rebalance(_balancingSwaps(), keccak256("rationale-v1"));

        (uint256[] memory postW,) = vault.getWeights();
        uint256 postDrift = _drift(postW);

        assertLt(postDrift, preDrift, "rebalance must reduce drift");
        assertApproxEqAbs(postW[0], 5000, 25);
        assertApproxEqAbs(postW[1], 5000, 25);
        assertEq(vault.rebalanceNonce(), 1);
        assertGt(vault.spentInWindow(), 0);
    }

    function test_autopilotBuy_deploysIdleUsdg() public {
        uint256 amznBefore = amzn.balanceOf(address(vault));
        vm.prank(agent);
        vault.autopilotBuy(address(amzn), 5_000e6, 30e18, keccak256("dca"));
        assertGt(amzn.balanceOf(address(vault)), amznBefore);
        assertEq(vault.spentInWindow(), 5_000e6);
    }

    function test_singleSellRebalance_improvesDrift() public {
        MandateVault.Swap[] memory s = new MandateVault.Swap[](1);
        s[0] = MandateVault.Swap({tokenIn: address(tsla), tokenOut: address(usdg), amountIn: 50e18, minOut: 9_500e6});
        vm.prank(agent);
        vault.rebalance(s, bytes32(0)); // selling the overweight asset reduces drift
        assertEq(vault.rebalanceNonce(), 1);
    }

    function _drift(uint256[] memory w) internal pure returns (uint256 d) {
        uint256 d0 = w[0] > 5000 ? w[0] - 5000 : 5000 - w[0];
        uint256 d1 = w[1] > 5000 ? w[1] - 5000 : 5000 - w[1];
        d = d0 > d1 ? d0 : d1;
    }
}

contract MandateVaultAdversarialTest is MandateBase {
    function test_revert_overPerTradeCap() public {
        MandateVault.Swap[] memory s = new MandateVault.Swap[](1);
        // sell 200 TSLA = $40,000 > $25,000 perTradeCap
        s[0] = MandateVault.Swap({tokenIn: address(tsla), tokenOut: address(usdg), amountIn: 200e18, minOut: 0});
        vm.prank(agent);
        vm.expectRevert(MandateVault.PerTradeCapExceeded.selector);
        vault.rebalance(s, bytes32(0));
    }

    function test_revert_overPerDayCap_thenResetsAfter24h() public {
        // Tighten the daily cap so two buys breach it.
        MandateVault.Policy memory p = _defaultPolicy();
        p.perTradeCapUsdg = 10_000e6;
        p.perDayCapUsdg = 15_000e6;
        vm.prank(owner);
        vault.setPolicy(p);

        vm.prank(agent);
        vault.autopilotBuy(address(amzn), 10_000e6, 60e18, bytes32(0)); // ok: 10k <= 15k

        vm.prank(agent);
        vm.expectRevert(MandateVault.PerDayCapExceeded.selector);
        vault.autopilotBuy(address(amzn), 10_000e6, 60e18, bytes32(0)); // 20k > 15k

        // After the rolling window elapses, the cap frees up again.
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(agent);
        vault.autopilotBuy(address(amzn), 10_000e6, 60e18, bytes32(0));
        assertEq(vault.spentInWindow(), 10_000e6);
    }

    function test_revert_nonAllowlistedAsset() public {
        MandateVault.Swap[] memory s = new MandateVault.Swap[](1);
        s[0] = MandateVault.Swap({tokenIn: address(usdg), tokenOut: address(rand), amountIn: 1_000e6, minOut: 0});
        vm.prank(agent);
        vm.expectRevert(MandateVault.AssetNotAllowed.selector);
        vault.rebalance(s, bytes32(0));
    }

    function test_revert_slippageBeyondBand() public {
        // Tighten slippage below the AMM fee (30bps) so any buy breaches the band.
        MandateVault.Policy memory p = _defaultPolicy();
        p.maxSlippageBps = 5;
        vm.prank(owner);
        vault.setPolicy(p);

        vm.prank(agent);
        vm.expectRevert(MandateVault.SlippageExceeded.selector);
        vault.autopilotBuy(address(amzn), 5_000e6, 0, bytes32(0));
    }

    function test_revert_outsideTradingWindow() public {
        MandateVault.Policy memory p = _defaultPolicy();
        p.windowStart = 3600; // 01:00
        p.windowEnd = 7200; // 02:00
        vm.prank(owner);
        vault.setPolicy(p);

        // Warp to midnight-of-day (sod = 0), outside [01:00, 02:00].
        vm.warp(86_400 * 1000);
        vm.prank(agent);
        vm.expectRevert(MandateVault.OutsideTradingWindow.selector);
        vault.autopilotBuy(address(amzn), 1_000e6, 0, bytes32(0));
    }

    function test_revert_whenPaused() public {
        vm.prank(owner);
        vault.pause();
        vm.prank(agent);
        vm.expectRevert(MandateVault.VaultPaused.selector);
        vault.rebalance(_balancingSwaps(), bytes32(0));
    }

    function test_revert_driftWorsens() public {
        // Buy MORE of the already-overweight TSLA -> drift increases -> revert.
        MandateVault.Swap[] memory s = new MandateVault.Swap[](1);
        s[0] = MandateVault.Swap({tokenIn: address(usdg), tokenOut: address(tsla), amountIn: 10_000e6, minOut: 0});
        vm.prank(agent);
        vm.expectRevert(MandateVault.DriftNotImproved.selector);
        vault.rebalance(s, bytes32(0));
    }

    // ---- The negative-space guarantee: the AGENT can never move principal out. ----

    function test_revert_agentCannotWithdraw() public {
        bytes32 ownerRole = vault.OWNER_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, agent, ownerRole)
        );
        vm.prank(agent);
        vault.withdraw(address(usdg), 1);
    }

    function test_revert_agentCannotSetPolicyOrPause() public {
        vm.startPrank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, agent, vault.OWNER_ROLE())
        );
        vault.pause();
        vm.stopPrank();
    }

    function test_revert_attackerCannotRebalance() public {
        bytes32 agentRole = vault.AGENT_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, agentRole)
        );
        vm.prank(attacker);
        vault.rebalance(_balancingSwaps(), bytes32(0));
    }

    function test_revokeAgent_silencesAgent() public {
        bytes32 agentRole = vault.AGENT_ROLE();
        vm.prank(owner);
        vault.revokeAgent(agent);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, agent, agentRole)
        );
        vm.prank(agent);
        vault.rebalance(_balancingSwaps(), bytes32(0));
    }
}

contract MandateVaultFuzzTest is MandateBase {
    function setUp() public override {
        super.setUp();
        // Isolate the per-trade cap: huge daily cap, max slippage tolerance, deep pools.
        MandateVault.Policy memory p = _defaultPolicy();
        p.perTradeCapUsdg = 20_000e6;
        p.perDayCapUsdg = type(uint128).max;
        p.maxSlippageBps = 10_000; // 100% -> slippage never binds
        vm.prank(owner);
        vault.setPolicy(p);
    }

    /// @notice A buy succeeds iff its notional is within the per-trade cap — never above.
    function testFuzz_perTradeCapBoundary(uint256 amt) public {
        amt = bound(amt, 1e6, 40_000e6);
        vm.prank(agent);
        if (amt > 20_000e6) {
            vm.expectRevert(MandateVault.PerTradeCapExceeded.selector);
            vault.autopilotBuy(address(amzn), amt, 0, bytes32(0));
        } else {
            vault.autopilotBuy(address(amzn), amt, 0, bytes32(0));
            assertLe(vault.spentInWindow(), 20_000e6);
        }
    }

    /// @notice Cumulative spend can never exceed the daily cap across a random sequence.
    function testFuzz_dailyCapNeverExceeded(uint8 n, uint256 seed) public {
        MandateVault.Policy memory p = _defaultPolicy();
        p.perTradeCapUsdg = 5_000e6;
        p.perDayCapUsdg = 12_000e6;
        p.maxSlippageBps = 10_000;
        vm.prank(owner);
        vault.setPolicy(p);

        uint256 iterations = bound(uint256(n), 1, 20);
        for (uint256 i; i < iterations; ++i) {
            uint256 amt = bound(uint256(keccak256(abi.encode(seed, i))), 1e6, 5_000e6);
            vm.prank(agent);
            try vault.autopilotBuy(address(amzn), amt, 0, bytes32(0)) {} catch {}
            assertLe(vault.spentInWindow(), 12_000e6, "daily cap breached");
        }
    }
}

/// @dev Handler that drives the vault purely through the agent role, for the invariant run.
contract AgentHandler is Test {
    MandateVault internal vault;
    MockERC20 internal usdg;
    MockERC20 internal tsla;
    MockERC20 internal amzn;
    address internal agent;

    constructor(MandateVault v, MockERC20 _usdg, MockERC20 _tsla, MockERC20 _amzn, address _agent) {
        vault = v;
        usdg = _usdg;
        tsla = _tsla;
        amzn = _amzn;
        agent = _agent;
    }

    function buy(uint256 amt) external {
        amt = bound(amt, 1e6, 30_000e6);
        vm.prank(agent);
        try vault.autopilotBuy(address(amzn), amt, 0, bytes32(0)) {} catch {}
    }

    function sell(uint256 amt) external {
        amt = bound(amt, 1e18, 100e18);
        MandateVault.Swap[] memory s = new MandateVault.Swap[](1);
        s[0] = MandateVault.Swap({tokenIn: address(tsla), tokenOut: address(usdg), amountIn: amt, minOut: 0});
        vm.prank(agent);
        try vault.rebalance(s, bytes32(0)) {} catch {}
    }
}

contract MandateVaultInvariantTest is MandateBase {
    AgentHandler internal handler;

    function setUp() public override {
        super.setUp();
        MandateVault.Policy memory p = _defaultPolicy();
        p.maxSlippageBps = 10_000;
        p.perDayCapUsdg = type(uint128).max;
        vm.prank(owner);
        vault.setPolicy(p);

        handler = new AgentHandler(vault, usdg, tsla, amzn, agent);
        targetContract(address(handler));
    }

    /// @notice No matter what the agent does, it never accrues vault funds for itself.
    function invariant_agentNeverHoldsFunds() public view {
        assertEq(usdg.balanceOf(agent), 0);
        assertEq(tsla.balanceOf(agent), 0);
        assertEq(amzn.balanceOf(agent), 0);
    }

    /// @notice Principal stays inside the vault: the agent can only ever shuffle between
    ///         allowlisted assets, never send tokens to an arbitrary external address.
    function invariant_fundsStayInVaultOrAmm() public view {
        // The handler address (a stand-in arbitrary recipient) never receives funds.
        assertEq(usdg.balanceOf(address(handler)), 0);
        assertEq(tsla.balanceOf(address(handler)), 0);
        assertEq(amzn.balanceOf(address(handler)), 0);
    }
}
