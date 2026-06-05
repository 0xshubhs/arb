// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IGuardExec {
    function execute(address agent, address to, uint256 amount) external returns (uint8);
}

/// @notice Malicious USDC whose `transfer` re-enters `AgentGuard.execute` — used to prove the
///         `nonReentrant` guard blocks reentrancy on the spend path.
contract MockReentrantUSDC is ERC20 {
    address public guard;
    address public attackAgent;
    address public attackTo;
    uint256 public attackAmount;
    bool public armed;

    constructor() ERC20("Reentrant USDC", "rUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(address guard_, address agent_, address to_, uint256 amount_) external {
        guard = guard_;
        attackAgent = agent_;
        attackTo = to_;
        attackAmount = amount_;
        armed = true;
    }

    /// @dev `execute` pays out via `transfer`; re-enter here. `transferFrom` (funding) is untouched.
    function transfer(address to, uint256 amount) public override returns (bool) {
        if (armed) {
            armed = false;
            IGuardExec(guard).execute(attackAgent, attackTo, attackAmount); // should revert: reentrancy
        }
        return super.transfer(to, amount);
    }
}
