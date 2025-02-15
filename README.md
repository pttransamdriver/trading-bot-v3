# Flash Loan Arbitrage Monitor

An automated system for monitoring and executing flash loan arbitrage opportunities across multiple DEXs on Ethereum. The system continuously monitors price differences between various token pairs, executing trades when profitable opportunities are found.

## Features

- Real-time monitoring of token price differences across multiple DEXs
- Automated flash loan execution for profitable trades
- Built-in safety checks for:
  - Minimum profit threshold
  - Gas price limits
  - Price impact
  - Pool liquidity
  - Slippage protection
- Supports multiple DEXs:
  - Uniswap
  - Curve
  - Balancer
  - ShibaSwap
  - QuickSwap
  - PancakeSwap
- Monitors multiple token pairs including:
  - WETH
  - DAI
  - POL
  - ARB
  - WBTC
  - BNB
  - CRV

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- An Ethereum RPC URL (e.g., from Alchemy or Infura)
- A wallet private key with sufficient funds for gas

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd trading_bot
```

2. Install dependencies:
```bash
npm install
```

3. Create a .env file in the root directory with the following variables:
```
MAINNET_URL=your_ethereum_rpc_url
PRIVATE_KEY=your_wallet_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

## Configuration

The system uses two main configuration files:

1. `config/arbitrage.config.js` - Contains trading parameters like:
   - Minimum profit thresholds
   - Gas price limits
   - Safety parameters
   - Token addresses
   - DEX router addresses

2. `hardhat.config.js` - Network configuration and deployment settings

### Key Parameters

You can adjust these parameters in `monitor.js`:

- `MAX_PRICE_IMPACT`: Maximum allowable price impact (default: 2%)
- `MAX_GAS_PRICE`: Maximum gas price for transactions (default: 100 gwei)
- `MIN_PROFIT_USD`: Minimum profit required to execute a trade (default: $100)
- `MIN_LIQUIDITY`: Minimum pool liquidity required (default: $10,000)
- `FEE_TIERS`: Available fee tiers for DEX trades [500, 3000, 10000]

## Usage

1. Deploy the Flash Loan contract (if not already deployed):
```bash
npx hardhat run scripts/deploy.js --network mainnet
```

2. Update the Flash Loan contract address in `monitor.js`:
```javascript
const arbitrage = await ethers.getContractAt(
  "FlashLoanArbitrage",
  "YOUR_DEPLOYED_CONTRACT_ADDRESS",
  signer
);
```

3. Start the monitoring system:
```bash
npx hardhat run scripts/monitor.js --network mainnet
```

The system will continuously:
1. Monitor prices across different DEXs
2. Check for profitable arbitrage opportunities
3. Execute flash loan trades when profitable opportunities are found
4. Log all activities and transactions

## Safety Features

The monitor implements multiple safety checks:
- Verifies sufficient pool liquidity before trading
- Checks gas prices to avoid high-cost transactions
- Validates price impact to prevent significant slippage
- Ensures minimum profit threshold after gas costs
- Includes safety delays between operations

## Monitoring Output

The system provides real-time console output:
- Gas price warnings
- Discovered arbitrage opportunities
- Trade execution status
- Error messages and warnings
- Transaction hashes for executed trades


## Disclaimer

This software is for educational purposes only. Trading cryptocurrencies involves significant risk. Always test thoroughly on testnets before mainnet deployment.
