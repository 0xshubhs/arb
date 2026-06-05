// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PolicyRegistry} from "../src/PolicyRegistry.sol";
import {RiskEngine} from "../src/RiskEngine.sol";
import {AgentGuard} from "../src/AgentGuard.sol";
import {ERC8004Reader} from "../src/ERC8004Reader.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";
import {MockReputationRegistry} from "../test/mocks/MockReputationRegistry.sol";

/// @notice Deploys the SENTINEL Solidity stack (the standing fallback + benchmark baseline).
///         The Stylus kernel is deployed separately via `cargo stylus deploy`; record its
///         address as RISK_ENGINE_STYLUS and point AgentGuard at whichever engine you demo.
///
/// Env:
///   USDC                         (optional) real USDC; else a mock is deployed
///   ERC8004_REPUTATION_REGISTRY  (optional) live ERC-8004; else a mock is deployed
///
/// Usage:
///   forge script script/Deploy.s.sol --rpc-url $ARB_SEPOLIA_RPC --broadcast --verify
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);

        address usdc = vm.envOr("USDC", address(0));
        if (usdc == address(0)) {
            usdc = address(new MockERC20("USD Coin", "USDC", 6));
        }

        address repRegistry = vm.envOr("ERC8004_REPUTATION_REGISTRY", address(0));
        if (repRegistry == address(0)) {
            repRegistry = address(new MockReputationRegistry());
        }

        PolicyRegistry registry = new PolicyRegistry();
        ERC8004Reader reader = new ERC8004Reader(repRegistry);
        RiskEngine engine = new RiskEngine(address(registry), address(reader));
        AgentGuard guard = new AgentGuard(usdc, address(engine));
        engine.setGuard(address(guard), true);

        vm.stopBroadcast();

        console2.log("== SENTINEL deployed ==");
        console2.log("USDC               ", usdc);
        console2.log("ReputationRegistry ", repRegistry);
        console2.log("PolicyRegistry     ", address(registry));
        console2.log("ERC8004Reader      ", address(reader));
        console2.log("RiskEngine (sol)   ", address(engine));
        console2.log("AgentGuard         ", address(guard));
        console2.log("Set RISK_ENGINE_STYLUS after `cargo stylus deploy`.");
    }
}
