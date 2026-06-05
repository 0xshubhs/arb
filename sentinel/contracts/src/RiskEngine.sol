// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IRiskEngine} from "./interfaces/IRiskEngine.sol";
import {PolicyRegistry} from "./PolicyRegistry.sol";
import {ERC8004Reader} from "./ERC8004Reader.sol";
import {ScoreInput, RiskScoreLib, RiskCodes} from "./RiskTypes.sol";

/// @title RiskEngine (Solidity twin)
/// @notice The security core. Every agent spend must clear `checkSpend` before it settles;
///         anything that breaches the policy returns `allowed = false` and the caller reverts.
///         Functionally identical to the Stylus (Rust) kernel — this twin is the verified
///         standing fallback and the gas-benchmark baseline.
/// @dev    The compute-heavy scoring lives in {scorePure} (mirrored 1:1 by Stylus). `checkSpend`
///         wraps it with rolling-window state + registry/reputation reads. CEI + ReentrancyGuard.
contract RiskEngine is IRiskEngine, Ownable, ReentrancyGuard {
    using RiskScoreLib for ScoreInput;

    uint256 private constant DAY = 86_400;

    PolicyRegistry public immutable registry;
    ERC8004Reader public reader;

    struct AgentState {
        uint64 dailyAnchor; // start of the current rolling 24h window
        uint256 dailySpent; // spent in the current window
        uint256 balance; // current notional value
        uint256 highWater; // max notional value seen
        bool registered;
    }

    mapping(address agent => AgentState) public agentState;
    mapping(address guard => bool authorized) public isGuard;

    event GuardSet(address indexed guard, bool authorized);
    event AgentRegistered(address indexed agent, uint256 startBalance);
    event SpendChecked(
        uint256 indexed policyId, address indexed agent, address indexed to, uint256 amount, bool allowed, uint8 score, uint8 reasonCode
    );

    error NotAuthorizedGuard();
    error AgentNotRegistered();

    constructor(address registry_, address reader_) Ownable(msg.sender) {
        registry = PolicyRegistry(registry_);
        reader = ERC8004Reader(reader_);
    }

    // --- Admin ---

    function setGuard(address guard, bool authorized) external onlyOwner {
        isGuard[guard] = authorized;
        emit GuardSet(guard, authorized);
    }

    function setReader(address reader_) external onlyOwner {
        reader = ERC8004Reader(reader_);
    }

    /// @notice Register/fund an agent's notional balance (sets the drawdown high-water mark).
    function registerAgent(address agent, uint256 startBalance) external override {
        if (!isGuard[msg.sender] && msg.sender != owner()) revert NotAuthorizedGuard();
        AgentState storage st = agentState[agent];
        st.balance += startBalance;
        if (st.balance > st.highWater) st.highWater = st.balance;
        if (!st.registered) {
            st.registered = true;
            st.dailyAnchor = uint64(block.timestamp);
        }
        emit AgentRegistered(agent, startBalance);
    }

    // --- Pure scoring core (benchmarked against Stylus) ---

    /// @inheritdoc IRiskEngine
    function scorePure(ScoreInput calldata input)
        external
        pure
        override
        returns (bool allowed, uint8 score, uint8 reasonCode)
    {
        ScoreInput memory s = input;
        return s.score();
    }

    // --- Stateful pre-settlement check ---

    /// @inheritdoc IRiskEngine
    function checkSpend(uint256 policyId, address agent, address to, uint256 amount)
        external
        override
        nonReentrant
        returns (bool allowed, uint8 score, uint8 reasonCode)
    {
        if (!isGuard[msg.sender]) revert NotAuthorizedGuard();
        AgentState storage st = agentState[agent];
        if (!st.registered) revert AgentNotRegistered();

        // Roll the daily window if elapsed (effect, but idempotent & safe pre-scoring).
        uint256 windowSpent = st.dailySpent;
        if (block.timestamp >= uint256(st.dailyAnchor) + DAY) {
            windowSpent = 0;
        }

        PolicyRegistry.PolicyConfig memory cfg = registry.getConfig(policyId);

        // Counterparty reputation: local denylist forces 0, else the live ERC-8004 read.
        uint16 rep;
        if (registry.isDenied(policyId, to)) {
            rep = 0;
        } else {
            (rep,) = reader.reputationOf(to);
        }

        ScoreInput memory input = ScoreInput({
            amount: amount,
            velocityCapPerTx: cfg.velocityCapPerTx,
            dailySpent: windowSpent,
            dailyCap: cfg.dailyCapUSDC,
            balance: st.balance,
            highWater: st.highWater,
            drawdownBps: cfg.drawdownBps,
            reputation: rep,
            minReputation: cfg.minCounterpartyReputation,
            killSwitched: cfg.killSwitched
        });

        (allowed, score, reasonCode) = input.score();

        // Effects: only a permitted spend mutates state.
        if (allowed) {
            if (block.timestamp >= uint256(st.dailyAnchor) + DAY) {
                st.dailyAnchor = uint64(block.timestamp);
                st.dailySpent = 0;
            }
            st.dailySpent += amount;
            st.balance = st.balance > amount ? st.balance - amount : 0;
        }

        emit SpendChecked(policyId, agent, to, amount, allowed, score, reasonCode);
    }

    // --- Views ---

    function previewSpend(uint256 policyId, address agent, address to, uint256 amount)
        external
        view
        returns (bool allowed, uint8 score, uint8 reasonCode)
    {
        AgentState memory st = agentState[agent];
        uint256 windowSpent = block.timestamp >= uint256(st.dailyAnchor) + DAY ? 0 : st.dailySpent;
        PolicyRegistry.PolicyConfig memory cfg = registry.getConfig(policyId);
        uint16 rep;
        if (registry.isDenied(policyId, to)) {
            rep = 0;
        } else {
            (rep,) = reader.reputationOf(to);
        }
        ScoreInput memory input = ScoreInput({
            amount: amount,
            velocityCapPerTx: cfg.velocityCapPerTx,
            dailySpent: windowSpent,
            dailyCap: cfg.dailyCapUSDC,
            balance: st.balance,
            highWater: st.highWater,
            drawdownBps: cfg.drawdownBps,
            reputation: rep,
            minReputation: cfg.minCounterpartyReputation,
            killSwitched: cfg.killSwitched
        });
        return RiskScoreLib.score(input);
    }

    function drawdownBpsOf(address agent) external view returns (uint256) {
        AgentState memory st = agentState[agent];
        if (st.highWater == 0 || st.balance >= st.highWater) return 0;
        return ((st.highWater - st.balance) * 10_000) / st.highWater;
    }
}
