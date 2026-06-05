// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice All inputs the risk scorer needs, passed explicitly so the scoring math is a
///         pure function — identical in the Solidity twin and the Stylus (Rust) kernel.
struct ScoreInput {
    uint256 amount; // this spend (USDC, 6dp)
    uint256 velocityCapPerTx; // max single spend
    uint256 dailySpent; // already spent in the rolling 24h window
    uint256 dailyCap; // rolling-24h cap
    uint256 balance; // agent's current notional value
    uint256 highWater; // agent's high-water mark
    uint16 drawdownBps; // halt if drawdown from high-water exceeds this
    uint16 reputation; // counterparty reputation, normalized 0..100
    uint16 minReputation; // required counterparty reputation
    bool killSwitched; // policy kill switch
}

/// @notice Reason codes returned alongside every verdict (drive the UI reason chips).
library RiskCodes {
    uint8 internal constant OK = 0;
    uint8 internal constant VELOCITY = 1; // per-tx cap exceeded
    uint8 internal constant DAILY_CAP = 2; // rolling-24h cap exceeded
    uint8 internal constant DRAWDOWN = 3; // drawdown limit breached
    uint8 internal constant COUNTERPARTY = 4; // denylisted / sub-threshold reputation
    uint8 internal constant KILL_SWITCH = 5; // policy frozen
    uint8 internal constant SCORE_THRESHOLD = 6; // composite risk too high

    // Composite block threshold (score >= THRESHOLD => blocked).
    uint8 internal constant THRESHOLD = 80;

    // Factor weights (sum to 100) for the composite blend.
    uint256 internal constant W_VEL = 25;
    uint256 internal constant W_DAILY = 25;
    uint256 internal constant W_DD = 30;
    uint256 internal constant W_CP = 20;
}

/// @title RiskScoreLib
/// @notice The canonical, transparent risk score. Four explained factors blended into a
///         0–100 composite. This exact algorithm is mirrored by the Stylus (Rust) kernel;
///         the two must return identical `(allowed, score, reason)` for any input.
library RiskScoreLib {
    function score(ScoreInput memory s) internal pure returns (bool allowed, uint8 scoreOut, uint8 reason) {
        // --- Hard breaches (deterministic NO, score pinned to 100) ---
        if (s.killSwitched) return (false, 100, RiskCodes.KILL_SWITCH);
        if (s.amount > s.velocityCapPerTx) return (false, 100, RiskCodes.VELOCITY);
        if (s.dailySpent + s.amount > s.dailyCap) return (false, 100, RiskCodes.DAILY_CAP);

        uint256 newBalance = s.balance > s.amount ? s.balance - s.amount : 0;
        uint256 ddBps = _drawdownBps(s.highWater, newBalance);
        if (ddBps > s.drawdownBps) return (false, 100, RiskCodes.DRAWDOWN);

        if (s.reputation < s.minReputation) return (false, 100, RiskCodes.COUNTERPARTY);

        // --- Composite 0–100 blend of how close each factor is to its limit ---
        uint256 velScore = _pct(s.amount, s.velocityCapPerTx);
        uint256 dailyScore = _pct(s.dailySpent + s.amount, s.dailyCap);
        uint256 ddScore = s.drawdownBps == 0 ? 0 : _min(100, (ddBps * 100) / s.drawdownBps);
        uint256 cpScore = s.reputation >= 100 ? 0 : 100 - s.reputation;

        uint256 composite = (
            velScore * RiskCodes.W_VEL + dailyScore * RiskCodes.W_DAILY + ddScore * RiskCodes.W_DD
                + cpScore * RiskCodes.W_CP
        ) / 100;

        if (composite >= RiskCodes.THRESHOLD) return (false, uint8(composite), RiskCodes.SCORE_THRESHOLD);
        return (true, uint8(composite), RiskCodes.OK);
    }

    function _drawdownBps(uint256 highWater, uint256 newBalance) internal pure returns (uint256) {
        if (highWater == 0 || newBalance >= highWater) return 0;
        return ((highWater - newBalance) * 10_000) / highWater;
    }

    function _pct(uint256 num, uint256 den) internal pure returns (uint256) {
        if (den == 0) return 100;
        uint256 p = (num * 100) / den;
        return p > 100 ? 100 : p;
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
