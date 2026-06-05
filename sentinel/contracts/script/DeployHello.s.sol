// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {HelloArbitrum} from "../src/HelloArbitrum.sol";

/// @notice Day-1 eligibility de-risk: deploy + verify a trivial contract on Arbitrum Sepolia.
///   forge script script/DeployHello.s.sol --rpc-url $ARB_SEPOLIA_RPC --broadcast --verify
contract DeployHello is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);
        HelloArbitrum hello = new HelloArbitrum();
        vm.stopBroadcast();
        console2.log("HelloArbitrum", address(hello));
    }
}
