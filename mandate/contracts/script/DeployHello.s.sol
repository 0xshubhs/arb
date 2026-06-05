// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {HelloRobinhood} from "../src/HelloRobinhood.sol";

/// @notice Day-1 eligibility de-risk: deploy + verify a trivial contract on Robinhood Chain.
///   forge script script/DeployHello.s.sol --rpc-url $RH_RPC_URL --broadcast \
///     --verify --verifier blockscout --verifier-url $BLOCKSCOUT_URL/api
contract DeployHello is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);
        HelloRobinhood hello = new HelloRobinhood();
        vm.stopBroadcast();
        console2.log("HelloRobinhood", address(hello));
    }
}
