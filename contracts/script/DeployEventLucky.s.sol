// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {EventLucky} from "../EventLucky.sol";

/// Deploy EventLucky directly (no CREATE2 factory needed).
/// Usage:
///   forge script contracts/script/DeployEventLucky.s.sol \
///     --rpc-url https://rpc.testnet.arc.io \
///     --private-key YOUR_PRIVATE_KEY \
///     --broadcast
///
/// USDC on Arc Testnet: 0x3600000000000000000000000000000000000000
contract DeployEventLucky is Script {
    // USDC on Arc Testnet
    address constant USDC = 0x3600000000000000000000000000000000000000;

    function run() external {
        vm.startBroadcast();
        EventLucky lucky = new EventLucky(USDC);
        vm.stopBroadcast();

        console.log("EventLucky deployed at:", address(lucky));
        console.log("USDC address used:     ", USDC);
    }
}
