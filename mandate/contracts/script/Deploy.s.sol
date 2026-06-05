// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PriceOracle} from "../src/PriceOracle.sol";
import {StockAMM} from "../src/StockAMM.sol";
import {MandateVault} from "../src/MandateVault.sol";
import {MandateVaultFactory} from "../src/MandateVaultFactory.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

/// @notice Deploys the full Mandate stack with in-repo mock tokens + seeded AMM pools, so the
///         rebalance path is self-contained and demo-deterministic. On a production deploy,
///         point `USDG`/stock addresses at the real Robinhood Chain faucet tokens instead and
///         skip the mock minting.
///
/// Usage:
///   forge script script/Deploy.s.sol --rpc-url $RH_RPC_URL --broadcast \
///     --verify --verifier blockscout --verifier-url $BLOCKSCOUT_URL/api
contract Deploy is Script {
    struct StockSpec {
        string name;
        string symbol;
        uint256 price1e8; // USDG per whole stock, 1e8-scaled
    }

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);

        StockSpec[5] memory stocks = [
            StockSpec("Tesla", "TSLA", 200e8),
            StockSpec("Amazon", "AMZN", 150e8),
            StockSpec("Palantir", "PLTR", 25e8),
            StockSpec("Netflix", "NFLX", 600e8),
            StockSpec("AMD", "AMD", 120e8)
        ];

        vm.startBroadcast(pk);

        MockERC20 usdg = new MockERC20("USD Global", "USDG", 6);
        PriceOracle oracle = new PriceOracle();
        StockAMM amm = new StockAMM(address(usdg));

        address[5] memory stockAddrs;
        for (uint256 i; i < stocks.length; ++i) {
            MockERC20 stock = new MockERC20(stocks[i].name, stocks[i].symbol, 18);
            stockAddrs[i] = address(stock);
            oracle.setMockPrice(address(stock), int256(stocks[i].price1e8));

            // Seed a deep pool at the oracle mid: 1,000,000 shares.
            uint256 stockReserve = 1_000_000e18;
            uint256 usdgReserve = (stocks[i].price1e8 / 1e8) * 1_000_000 * 1e6;
            usdg.mint(deployer, usdgReserve);
            stock.mint(deployer, stockReserve);
            usdg.approve(address(amm), usdgReserve);
            stock.approve(address(amm), stockReserve);
            amm.createPool(address(stock), usdgReserve, stockReserve);
        }

        MandateVault impl = new MandateVault();
        MandateVaultFactory factory =
            new MandateVaultFactory(address(impl), address(usdg), address(amm), address(oracle));

        vm.stopBroadcast();

        console2.log("== Mandate deployed ==");
        console2.log("USDG            ", address(usdg));
        console2.log("PriceOracle     ", address(oracle));
        console2.log("StockAMM        ", address(amm));
        console2.log("MandateVault impl", address(impl));
        console2.log("Factory         ", address(factory));
        for (uint256 i; i < stocks.length; ++i) {
            console2.log(stocks[i].symbol, stockAddrs[i]);
        }
    }
}
