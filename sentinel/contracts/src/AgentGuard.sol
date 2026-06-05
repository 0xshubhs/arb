// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IRiskEngine} from "./interfaces/IRiskEngine.sol";

/// @title AgentGuard
/// @notice Where the hard NO lives. An agent's scoped session key routes every spend through
///         here; the guard enforces session scope (per-call cap, expiry) AND requires the spend
///         to clear `RiskEngine.checkSpend` BEFORE any USDC moves. A floor-wide freeze (the
///         physical KILL SWITCH) makes every lane revert instantly.
/// @dev    Models each agent's ERC-4337 smart account as a funded balance held here, so the
///         revert-before-settlement guarantee is fully on-chain and demoable.
contract AgentGuard is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    IRiskEngine public immutable engine;

    struct Session {
        uint256 policyId;
        address sessionKey; // the only key allowed to spend for this agent
        uint256 perCallCapUSDC; // hard scope: max per call
        uint64 expiry; // session key expiry
        bool active;
    }

    mapping(address agent => Session) public sessions;
    mapping(address agent => uint256 balance) public funded;

    /// @notice Floor-wide kill switch — freezes every agent lane at once.
    bool public frozen;

    event SessionRegistered(address indexed agent, uint256 indexed policyId, address sessionKey, uint256 cap, uint64 expiry);
    event SessionActiveSet(address indexed agent, bool active);
    event AgentFunded(address indexed agent, uint256 amount);
    event SpendExecuted(address indexed agent, address indexed to, uint256 amount, uint8 score);
    event FloorFrozen(bool frozen);

    error FloorIsFrozen();
    error NoSession();
    error OnlySessionKey();
    error SessionExpired();
    error ScopeExceeded();
    error InsufficientFunds();
    error SpendRejected(uint8 reasonCode);

    constructor(address usdc_, address engine_) Ownable(msg.sender) {
        usdc = IERC20(usdc_);
        engine = IRiskEngine(engine_);
    }

    // --- Admin / session management ---

    function registerSession(
        address agent,
        uint256 policyId,
        address sessionKey,
        uint256 perCallCapUSDC,
        uint64 expiry
    ) external onlyOwner {
        sessions[agent] =
            Session({policyId: policyId, sessionKey: sessionKey, perCallCapUSDC: perCallCapUSDC, expiry: expiry, active: true});
        emit SessionRegistered(agent, policyId, sessionKey, perCallCapUSDC, expiry);
    }

    function setSessionActive(address agent, bool active) external onlyOwner {
        sessions[agent].active = active;
        emit SessionActiveSet(agent, active);
    }

    /// @notice Fund an agent's bounded balance (also sets its risk-engine high-water mark).
    function fund(address agent, uint256 amount) external onlyOwner {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        funded[agent] += amount;
        engine.registerAgent(agent, amount);
        emit AgentFunded(agent, amount);
    }

    /// @notice The physical KILL SWITCH — freeze/unfreeze the entire floor.
    function freeze() external onlyOwner {
        frozen = true;
        emit FloorFrozen(true);
    }

    function unfreeze() external onlyOwner {
        frozen = false;
        emit FloorFrozen(false);
    }

    // --- The guarded spend path ---

    /// @notice Attempt a spend for `agent`. Reverts (before any USDC moves) if the floor is
    ///         frozen, the session scope is exceeded, or the risk engine says NO.
    function execute(address agent, address to, uint256 amount) external nonReentrant returns (uint8 score) {
        if (frozen) revert FloorIsFrozen();

        Session memory s = sessions[agent];
        if (!s.active || s.sessionKey == address(0)) revert NoSession();
        if (msg.sender != s.sessionKey) revert OnlySessionKey();
        if (block.timestamp > s.expiry) revert SessionExpired();
        if (amount > s.perCallCapUSDC) revert ScopeExceeded();
        if (amount > funded[agent]) revert InsufficientFunds();

        (bool allowed, uint8 sc, uint8 reason) = engine.checkSpend(s.policyId, agent, to, amount);
        if (!allowed) revert SpendRejected(reason); // <-- the hard NO, pre-settlement

        // Effects before interactions.
        funded[agent] -= amount;
        usdc.safeTransfer(to, amount);

        emit SpendExecuted(agent, to, amount, sc);
        return sc;
    }
}
