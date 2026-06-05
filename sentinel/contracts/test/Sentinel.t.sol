// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {PolicyRegistry} from "../src/PolicyRegistry.sol";
import {RiskEngine} from "../src/RiskEngine.sol";
import {AgentGuard} from "../src/AgentGuard.sol";
import {ERC8004Reader} from "../src/ERC8004Reader.sol";
import {ScoreInput, RiskScoreLib, RiskCodes} from "../src/RiskTypes.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockReputationRegistry} from "./mocks/MockReputationRegistry.sol";
import {MockReentrantUSDC} from "./mocks/MockReentrantUSDC.sol";

abstract contract SentinelBase is Test {
    MockERC20 internal usdc;
    PolicyRegistry internal registry;
    MockReputationRegistry internal repRegistry;
    ERC8004Reader internal reader;
    RiskEngine internal engine;
    AgentGuard internal guard;

    address internal honest = makeAddr("honest");
    address internal compromised = makeAddr("compromised");
    address internal denyAgent = makeAddr("denyAgent");

    address internal goodCp = makeAddr("goodCp");
    address internal badCp = makeAddr("badCp");
    address internal lowCp = makeAddr("lowCp");

    uint256 internal policyId;

    uint64 internal constant NEVER = type(uint64).max;

    function setUp() public virtual {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        registry = new PolicyRegistry();
        repRegistry = new MockReputationRegistry();
        repRegistry.setScale(100);
        repRegistry.setReputation(goodCp, 80);
        repRegistry.setReputation(lowCp, 10);

        reader = new ERC8004Reader(address(repRegistry));
        engine = new RiskEngine(address(registry), address(reader));
        guard = new AgentGuard(address(usdc), address(engine));
        engine.setGuard(address(guard), true);

        // Policy: $50/tx, $1000/day, 50% drawdown halt, counterparty reputation >= 30.
        policyId = registry.mint(
            PolicyRegistry.PolicyConfig({
                velocityCapPerTx: 50e6,
                dailyCapUSDC: 1_000e6,
                drawdownBps: 5_000,
                minCounterpartyReputation: 30,
                killSwitched: false
            })
        );
        registry.setDenied(policyId, badCp, true);

        // Sessions: per-call scope $50, fund each agent with $1000.
        _setupAgent(honest, 1_000e6);
        _setupAgent(compromised, 1_000e6);
        _setupAgent(denyAgent, 1_000e6);
    }

    function _setupAgent(address agent, uint256 fundAmt) internal {
        guard.registerSession(agent, policyId, agent, 50e6, NEVER);
        usdc.mint(address(this), fundAmt);
        usdc.approve(address(guard), fundAmt);
        guard.fund(agent, fundAmt);
    }
}

contract PolicyRegistryTest is SentinelBase {
    function test_mint_setsOwnerAndConfig() public view {
        assertEq(registry.ownerOf(policyId), address(this));
        PolicyRegistry.PolicyConfig memory cfg = registry.getConfig(policyId);
        assertEq(cfg.velocityCapPerTx, 50e6);
        assertEq(cfg.dailyCapUSDC, 1_000e6);
    }

    function test_update_onlyOwner() public {
        PolicyRegistry.PolicyConfig memory cfg = registry.getConfig(policyId);
        cfg.dailyCapUSDC = 2_000e6;
        registry.update(policyId, cfg);
        assertEq(registry.getConfig(policyId).dailyCapUSDC, 2_000e6);
    }

    function test_update_revertsForNonOwner() public {
        PolicyRegistry.PolicyConfig memory cfg = registry.getConfig(policyId);
        vm.prank(makeAddr("intruder"));
        vm.expectRevert(PolicyRegistry.NotPolicyOwner.selector);
        registry.update(policyId, cfg);
    }

    function test_killSwitch_onlyOwner() public {
        registry.killSwitch(policyId, true);
        assertTrue(registry.getConfig(policyId).killSwitched);
        vm.prank(makeAddr("intruder"));
        vm.expectRevert(PolicyRegistry.NotPolicyOwner.selector);
        registry.killSwitch(policyId, false);
    }

    function test_mint_revertsOnInvalidConfig() public {
        vm.expectRevert(PolicyRegistry.InvalidConfig.selector);
        registry.mint(
            PolicyRegistry.PolicyConfig({
                velocityCapPerTx: 0, // invalid
                dailyCapUSDC: 1_000e6,
                drawdownBps: 100,
                minCounterpartyReputation: 30,
                killSwitched: false
            })
        );
    }
}

contract RiskScorePureTest is SentinelBase {
    function _base() internal pure returns (ScoreInput memory s) {
        s = ScoreInput({
            amount: 10e6,
            velocityCapPerTx: 50e6,
            dailySpent: 0,
            dailyCap: 1_000e6,
            balance: 1_000e6,
            highWater: 1_000e6,
            drawdownBps: 5_000,
            reputation: 80,
            minReputation: 30,
            killSwitched: false
        });
    }

    function test_inPolicy_allowed() public view {
        (bool allowed, uint8 score, uint8 reason) = engine.scorePure(_base());
        assertTrue(allowed);
        assertLt(score, RiskCodes.THRESHOLD);
        assertEq(reason, RiskCodes.OK);
    }

    function test_velocityBreach() public view {
        ScoreInput memory s = _base();
        s.amount = 60e6; // > 50e6 cap
        (bool allowed, uint8 score, uint8 reason) = engine.scorePure(s);
        assertFalse(allowed);
        assertEq(score, 100);
        assertEq(reason, RiskCodes.VELOCITY);
    }

    function test_dailyBreach() public view {
        ScoreInput memory s = _base();
        s.dailySpent = 995e6;
        s.amount = 10e6; // 1005 > 1000
        (bool allowed,, uint8 reason) = engine.scorePure(s);
        assertFalse(allowed);
        assertEq(reason, RiskCodes.DAILY_CAP);
    }

    function test_drawdownBreach() public view {
        ScoreInput memory s = _base();
        s.balance = 600e6; // already down 40%
        s.amount = 50e6; // new balance 550 -> 45% > ... set tighter limit
        s.drawdownBps = 4_000; // 40% limit; 45% drawdown breaches
        (bool allowed,, uint8 reason) = engine.scorePure(s);
        assertFalse(allowed);
        assertEq(reason, RiskCodes.DRAWDOWN);
    }

    function test_counterpartyBreach() public view {
        ScoreInput memory s = _base();
        s.reputation = 10; // < 30
        (bool allowed,, uint8 reason) = engine.scorePure(s);
        assertFalse(allowed);
        assertEq(reason, RiskCodes.COUNTERPARTY);
    }

    function test_killSwitch() public view {
        ScoreInput memory s = _base();
        s.killSwitched = true;
        (bool allowed, uint8 score, uint8 reason) = engine.scorePure(s);
        assertFalse(allowed);
        assertEq(score, 100);
        assertEq(reason, RiskCodes.KILL_SWITCH);
    }

    function test_compositeThresholdBlocksWithoutHardBreach() public view {
        // No single hard breach, but the blended score crosses 80.
        ScoreInput memory s = ScoreInput({
            amount: 100,
            velocityCapPerTx: 100,
            dailySpent: 0,
            dailyCap: 100,
            balance: 1_000,
            highWater: 1_000,
            drawdownBps: 2_000,
            reputation: 20,
            minReputation: 10,
            killSwitched: false
        });
        (bool allowed, uint8 score, uint8 reason) = engine.scorePure(s);
        assertFalse(allowed);
        assertEq(score, 81);
        assertEq(reason, RiskCodes.SCORE_THRESHOLD);
    }
}

contract SentinelIntegrationTest is SentinelBase {
    function test_honestSpend_authorized() public {
        uint256 cpBefore = usdc.balanceOf(goodCp);
        vm.prank(honest);
        guard.execute(honest, goodCp, 25e6);
        assertEq(usdc.balanceOf(goodCp), cpBefore + 25e6);
        assertEq(guard.funded(honest), 1_000e6 - 25e6);
        (, uint256 dailySpent,,,) = engine.agentState(honest);
        assertEq(dailySpent, 25e6);
    }

    function test_compromised_velocityRejectedBeforeSettlement() public {
        // Within session scope (<=50) but over the per-tx velocity cap is impossible here,
        // so raise scope to show the ENGINE (not the scope) issues the NO.
        guard.registerSession(compromised, policyId, compromised, 100e6, NEVER);
        uint256 cpBefore = usdc.balanceOf(goodCp);
        vm.prank(compromised);
        vm.expectRevert(abi.encodeWithSelector(AgentGuard.SpendRejected.selector, RiskCodes.VELOCITY));
        guard.execute(compromised, goodCp, 60e6);
        assertEq(usdc.balanceOf(goodCp), cpBefore, "no settlement on reject");
    }

    function test_scopeExceeded_blockedAtGuard() public {
        vm.prank(honest);
        vm.expectRevert(AgentGuard.ScopeExceeded.selector);
        guard.execute(honest, goodCp, 60e6); // > 50e6 per-call scope
    }

    function test_dailyCapRejectedAndResets() public {
        // Tighten daily cap to make it bind quickly.
        PolicyRegistry.PolicyConfig memory cfg = registry.getConfig(policyId);
        cfg.dailyCapUSDC = 60e6;
        registry.update(policyId, cfg);

        vm.prank(honest);
        guard.execute(honest, goodCp, 40e6); // ok: 40 <= 60

        vm.prank(honest);
        vm.expectRevert(abi.encodeWithSelector(AgentGuard.SpendRejected.selector, RiskCodes.DAILY_CAP));
        guard.execute(honest, goodCp, 40e6); // 80 > 60

        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(honest);
        guard.execute(honest, goodCp, 40e6); // window reset -> ok
    }

    function test_drawdownHalt() public {
        // Wide caps so only drawdown binds; 50% drawdown limit on a $1000 balance.
        PolicyRegistry.PolicyConfig memory cfg = registry.getConfig(policyId);
        cfg.velocityCapPerTx = 500e6;
        cfg.dailyCapUSDC = 100_000e6;
        cfg.minCounterpartyReputation = 0;
        registry.update(policyId, cfg);
        guard.registerSession(honest, policyId, honest, 500e6, NEVER);

        vm.prank(honest);
        guard.execute(honest, goodCp, 400e6); // balance 1000 -> 600 (40% dd, ok)

        vm.prank(honest);
        vm.expectRevert(abi.encodeWithSelector(AgentGuard.SpendRejected.selector, RiskCodes.DRAWDOWN));
        guard.execute(honest, goodCp, 200e6); // would be 600 -> 400 = 60% dd > 50%
    }

    function test_denylistedCounterparty_blocked() public {
        vm.prank(denyAgent);
        vm.expectRevert(abi.encodeWithSelector(AgentGuard.SpendRejected.selector, RiskCodes.COUNTERPARTY));
        guard.execute(denyAgent, badCp, 10e6);
    }

    function test_lowReputationCounterparty_blocked() public {
        vm.prank(denyAgent);
        vm.expectRevert(abi.encodeWithSelector(AgentGuard.SpendRejected.selector, RiskCodes.COUNTERPARTY));
        guard.execute(denyAgent, lowCp, 10e6); // rep 10 < 30
    }

    function test_perPolicyKillSwitch_freezesChecks() public {
        registry.killSwitch(policyId, true);
        vm.prank(honest);
        vm.expectRevert(abi.encodeWithSelector(AgentGuard.SpendRejected.selector, RiskCodes.KILL_SWITCH));
        guard.execute(honest, goodCp, 10e6);
    }

    function test_floorFreeze_haltsEveryLane() public {
        guard.freeze();
        vm.prank(honest);
        vm.expectRevert(AgentGuard.FloorIsFrozen.selector);
        guard.execute(honest, goodCp, 10e6);

        guard.unfreeze();
        vm.prank(honest);
        guard.execute(honest, goodCp, 10e6); // back online
    }

    function test_sessionExpired_blocked() public {
        guard.registerSession(honest, policyId, honest, 50e6, uint64(block.timestamp + 100));
        vm.warp(block.timestamp + 101);
        vm.prank(honest);
        vm.expectRevert(AgentGuard.SessionExpired.selector);
        guard.execute(honest, goodCp, 10e6);
    }

    function test_onlySessionKeyCanSpend() public {
        vm.prank(makeAddr("notKey"));
        vm.expectRevert(AgentGuard.OnlySessionKey.selector);
        guard.execute(honest, goodCp, 10e6);
    }

    function test_checkSpend_onlyAuthorizedGuard() public {
        vm.prank(makeAddr("randomCaller"));
        vm.expectRevert(RiskEngine.NotAuthorizedGuard.selector);
        engine.checkSpend(policyId, honest, goodCp, 10e6);
    }

    function test_reentrancyOnExecute_blocked() public {
        // Stand up a guard whose USDC re-enters execute during payout.
        MockReentrantUSDC rusdc = new MockReentrantUSDC();
        AgentGuard rGuard = new AgentGuard(address(rusdc), address(engine));
        engine.setGuard(address(rGuard), true);
        rGuard.registerSession(honest, policyId, honest, 50e6, NEVER);

        rusdc.mint(address(this), 100e6);
        rusdc.approve(address(rGuard), 100e6);
        rGuard.fund(honest, 100e6);

        rusdc.arm(address(rGuard), honest, goodCp, 10e6);
        vm.prank(honest);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        rGuard.execute(honest, goodCp, 10e6);
    }
}

contract ERC8004ReaderTest is SentinelBase {
    function test_normalizesReputation() public view {
        (uint16 rep, bool live) = reader.reputationOf(goodCp);
        assertEq(rep, 80);
        assertTrue(live);
    }

    function test_gracefulFallbackWhenRegistryDown() public {
        repRegistry.setShouldRevert(true);
        (uint16 rep, bool live) = reader.reputationOf(goodCp);
        assertEq(rep, reader.defaultReputation());
        assertFalse(live);
    }

    function test_cacheServesLastGoodAfterOutage() public {
        reader.refresh(goodCp); // cache 80 while live
        repRegistry.setShouldRevert(true);
        (uint16 rep, bool live) = reader.reputationOf(goodCp);
        assertEq(rep, 80); // served from cache
        assertTrue(live);
    }
}

contract RiskScoreFuzzTest is SentinelBase {
    /// @dev Independent reference mirror of the scoring algorithm (guards against regressions
    ///      and documents the spec the Stylus kernel must also satisfy).
    function _ref(ScoreInput memory s) internal pure returns (bool allowed, uint8 score, uint8 reason) {
        if (s.killSwitched) return (false, 100, RiskCodes.KILL_SWITCH);
        if (s.amount > s.velocityCapPerTx) return (false, 100, RiskCodes.VELOCITY);
        if (s.dailySpent + s.amount > s.dailyCap) return (false, 100, RiskCodes.DAILY_CAP);
        uint256 nb = s.balance > s.amount ? s.balance - s.amount : 0;
        uint256 dd = (s.highWater == 0 || nb >= s.highWater) ? 0 : ((s.highWater - nb) * 10_000) / s.highWater;
        if (dd > s.drawdownBps) return (false, 100, RiskCodes.DRAWDOWN);
        if (s.reputation < s.minReputation) return (false, 100, RiskCodes.COUNTERPARTY);
        uint256 vel = s.velocityCapPerTx == 0 ? 100 : _min(100, (s.amount * 100) / s.velocityCapPerTx);
        uint256 day = s.dailyCap == 0 ? 100 : _min(100, ((s.dailySpent + s.amount) * 100) / s.dailyCap);
        uint256 dds = s.drawdownBps == 0 ? 0 : _min(100, (dd * 100) / s.drawdownBps);
        uint256 cp = s.reputation >= 100 ? 0 : 100 - s.reputation;
        uint256 c = (vel * 25 + day * 25 + dds * 30 + cp * 20) / 100;
        if (c >= RiskCodes.THRESHOLD) return (false, uint8(c), RiskCodes.SCORE_THRESHOLD);
        return (true, uint8(c), RiskCodes.OK);
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function testFuzz_scoreMatchesReference(
        uint256 amount,
        uint256 velCap,
        uint256 dailySpent,
        uint256 dailyCap,
        uint256 balance,
        uint16 drawdownBps,
        uint16 reputation,
        uint16 minRep
    ) public view {
        amount = bound(amount, 0, 1e24);
        velCap = bound(velCap, 1, 1e24);
        dailyCap = bound(dailyCap, 1, 1e24);
        dailySpent = bound(dailySpent, 0, 1e24);
        balance = bound(balance, 0, 1e24);
        drawdownBps = uint16(bound(drawdownBps, 0, 10_000));
        reputation = uint16(bound(reputation, 0, 100));
        minRep = uint16(bound(minRep, 0, 100));

        ScoreInput memory s = ScoreInput({
            amount: amount,
            velocityCapPerTx: velCap,
            dailySpent: dailySpent,
            dailyCap: dailyCap,
            balance: balance,
            highWater: balance, // high-water >= balance
            drawdownBps: drawdownBps,
            reputation: reputation,
            minReputation: minRep,
            killSwitched: false
        });

        (bool a1, uint8 s1, uint8 r1) = engine.scorePure(s);
        (bool a2, uint8 s2, uint8 r2) = _ref(s);
        assertEq(a1, a2);
        assertEq(s1, s2);
        assertEq(r1, r2);
        assertLe(s1, 100);
    }

    function testFuzz_moreSpendNeverLowersRisk(uint256 amount) public view {
        amount = bound(amount, 1, 40e6); // below the 50e6 cap so neither hard-breaches
        ScoreInput memory lo = ScoreInput({
            amount: amount,
            velocityCapPerTx: 50e6,
            dailySpent: 0,
            dailyCap: 1_000e6,
            balance: 1_000e6,
            highWater: 1_000e6,
            drawdownBps: 5_000,
            reputation: 80,
            minReputation: 30,
            killSwitched: false
        });
        ScoreInput memory hi = lo;
        hi.amount = amount + 1e6;

        (, uint8 sLo,) = engine.scorePure(lo);
        (, uint8 sHi,) = engine.scorePure(hi);
        assertGe(sHi, sLo, "more spend must not reduce the risk score");
    }

    function test_benchmark_scorePure_gas() public view {
        // Exercised under `forge test --gas-report` / `forge snapshot` for the
        // Stylus-vs-Solidity comparison published in the README + Proof panel.
        engine.scorePure(
            ScoreInput({
                amount: 25e6,
                velocityCapPerTx: 50e6,
                dailySpent: 100e6,
                dailyCap: 1_000e6,
                balance: 900e6,
                highWater: 1_000e6,
                drawdownBps: 5_000,
                reputation: 70,
                minReputation: 30,
                killSwitched: false
            })
        );
    }
}
