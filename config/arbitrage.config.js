module.exports = {
  // Network settings
  NETWORK: {
    CHAIN_ID: 1, // Ethereum mainnet
    RPC_URL: process.env.ALCHEMY_URL,
    BLOCK_TIME: 12, // seconds
  },

  // Trading parameters
  TRADING: {
    MIN_PROFIT_USD: 100, // Minimum profit in USD to execute trade
    MAX_LOAN_AMOUNT_USD: 1000000, // Maximum flash loan size in USD
    MIN_PRICE_DIFFERENCE: 0.2, // Minimum price difference percentage
    SLIPPAGE_TOLERANCE: 0.2, // Maximum allowed slippage percentage
    MAX_PRICE_IMPACT: 10.0, // Maximum allowable price impact percentage
  },

  // Gas settings
  GAS: {
    MAX_GAS_PRICE: 50, // Max gas price in GWEI
    GAS_LIMIT: 500000, // Gas limit for arbitrage transaction
    PRIORITY_FEE: 1.5, // Priority fee in GWEI
  },

  // Protocol fees
  FEES: {
    AAVE_FLASH_LOAN_FEE: 0.09, // Aave flash loan fee percentage
    AVERAGE_DEX_FEE: 0.3, // Average DEX fee percentage
    SAFETY_MARGIN: 0.1, // Additional safety margin percentage
  },

  // Safety settings
  SAFETY: {
    MAX_RETRIES: 3, // Maximum number of retry attempts
    RETRY_DELAY: 1000, // Delay between retries in milliseconds
    MIN_LIQUIDITY_USD: 100000, // Minimum pool liquidity in USD
    MAX_TX_COUNT_PER_BLOCK: 3, // Maximum transactions per block to avoid congestion
  },

  // Monitoring settings
  MONITORING: {
    PRICE_CHECK_INTERVAL: 30000, // Check prices every 30 seconds
    LOG_LEVEL: 'info', // Logging level (debug, info, warn, error)
    SAVE_FAILED_TRANSACTIONS: true, // Save failed transaction data for analysis
  },

  // Token addresses (Ethereum mainnet)
  TOKENS: {
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  },
}