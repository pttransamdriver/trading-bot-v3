const { ethers } = require("hardhat");
require("dotenv").config();

// Token addresses and metadata - focusing on high-volume, high-volatility pairs
const TOKENS = {
  // Stablecoins - often have small price discrepancies between DEXes
  USDC: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    priority: 1 // Higher priority tokens will be checked first
  },
  USDT: {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
    priority: 1
  },
  DAI: {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    decimals: 18,
    priority: 1
  },
  // Major assets
  WETH: {
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    decimals: 18,
    priority: 2
  },
  WBTC: {
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    decimals: 8,
    priority: 2
  },
  // High volatility tokens - more likely to have price discrepancies
  LINK: {
    address: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    decimals: 18,
    priority: 3
  },
  UNI: {
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    decimals: 18,
    priority: 3
  },
  AAVE: {
    address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
    decimals: 18,
    priority: 3
  },
  MKR: {
    address: "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2",
    decimals: 18,
    priority: 3
  },
  SNX: {
    address: "0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F",
    decimals: 18,
    priority: 3
  }
};

// DEX routers with accurate Ethereum mainnet addresses
const DEX_ROUTERS = {
  // Major DEXes
  UniswapV3: "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3 Router
  UniswapV2: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2 Router
  Sushiswap: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F", // SushiSwap Router

  // Specialized DEXes
  Curve: "0x99a58482BD75caABb7cd5c5aCf0f1F4624a0402d", // Curve Router
  Balancer: "0xBA12222222228d8Ba445958a75a0704d566BF2C8", // Balancer Vault

  // Newer DEXes
  PancakeSwap: "0xEfF92A263d31888d860bD50809A8D171709b7b1c", // PancakeSwap Router (Ethereum)

  // 1inch aggregator can sometimes have better prices
  OneInch: "0x1111111254fb6c44bAC0beD2854e76F90643097d", // 1inch Router
};

const FEE_TIERS = [500, 3000, 10000];
const MAX_PRICE_IMPACT = 0.02;
const MAX_GAS_PRICE = ethers.parseUnits("100", "gwei");
const MIN_PROFIT_USD = ethers.parseUnits("100", 6);
const MIN_LIQUIDITY = ethers.parseUnits("10000", 6);

async function checkPoolLiquidity(tokenAddress, routerAddress) {
  try {
    // For Uniswap V3, we need to check the pool's liquidity
    // This is a simplified check - in production, you'd need to determine the pool address
    // based on the token pair and fee tier

    // Get WETH address for pairing
    const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

    // Use a factory contract to find the pool
    const factoryAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984"; // Uniswap V3 Factory
    const factory = new ethers.Contract(
      factoryAddress,
      ["function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"],
      ethers.provider
    );

    // Try to find a pool with common fee tiers
    for (const fee of [500, 3000, 10000]) {
      try {
        const poolAddress = await factory.getPool(tokenAddress, WETH, fee);

        if (poolAddress && poolAddress !== ethers.ZeroAddress) {
          // Pool exists, check its liquidity
          const pool = new ethers.Contract(
            poolAddress,
            ["function liquidity() external view returns (uint128)"],
            ethers.provider
          );

          const liquidity = await pool.liquidity();
          return Number(liquidity) > 0;
        }
      } catch {
        continue;
      }
    }

    return false;
  } catch {
    // If any error occurs, assume there's not enough liquidity
    return false;
  }
}

async function isGasPriceAcceptable() {
  const feeData = await ethers.provider.getFeeData();
  return Number(feeData.gasPrice) <= Number(MAX_GAS_PRICE);
}

function checkPriceImpact(price1, price2) {
  const impact = Math.abs(Number(price1) - Number(price2)) / Number(price1);
  return impact <= MAX_PRICE_IMPACT;
}

async function isProfitableAfterGas(profit, tokenDecimals, tokenAddress) {
  // Get current gas price
  const feeData = await ethers.provider.getFeeData();

  // Flash loan arbitrage is gas-intensive, use a realistic estimate
  const gasEstimate = 500000; // Higher estimate for complex transactions

  // Calculate gas cost in ETH
  const gasCostWei = BigInt(feeData.gasPrice) * BigInt(gasEstimate);
  const gasCostEth = Number(ethers.formatEther(gasCostWei.toString()));

  // Get ETH price in USD
  const ethPrice = await getEthPrice();
  const ethPriceUSD = Number(ethPrice) / 10**8; // Chainlink returns price with 8 decimals

  // Calculate gas cost in USD
  const gasCostUSD = gasCostEth * ethPriceUSD;

  // Calculate flash loan fee (0.09% for Aave)
  const flashLoanFeePercentage = 0.0009;
  const flashLoanFee = Number(profit) * flashLoanFeePercentage;

  // Calculate DEX fees (0.3% per swap, and we do 2 swaps)
  const dexFeePercentage = 0.003;
  const dexFees = Number(profit) * dexFeePercentage * 2;

  // Calculate total fees
  const totalFees = flashLoanFee + dexFees;

  // Convert profit to USD
  let profitInUSD;
  if (tokenAddress === "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2") {
    // If token is WETH
    profitInUSD = (Number(profit) / (10 ** tokenDecimals)) * ethPriceUSD;
  } else {
    // For other tokens, we need to get their price in USD
    // This is simplified - in production, you'd use an oracle or price feed
    try {
      const tokenPriceUSD = await getTokenPrice(tokenAddress);
      profitInUSD = (Number(profit) / (10 ** tokenDecimals)) * tokenPriceUSD;
    } catch {
      // If we can't get the token price, use a conservative estimate
      profitInUSD = Number(profit) / (10 ** tokenDecimals);
    }
  }

  // Calculate net profit after all costs
  const netProfitUSD = profitInUSD - totalFees - gasCostUSD;

  // Add a safety margin (20%)
  const safetyMargin = 0.2;
  const safeNetProfitUSD = netProfitUSD * (1 - safetyMargin);

  console.log(`Potential profit: $${profitInUSD.toFixed(2)}, Gas cost: $${gasCostUSD.toFixed(2)}, Fees: $${totalFees.toFixed(2)}, Net: $${safeNetProfitUSD.toFixed(2)}`);

  // Check if profit exceeds minimum threshold (in USD)
  const minProfitUSD = Number(ethers.formatUnits(MIN_PROFIT_USD, 6)); // Convert from USDC decimals
  return safeNetProfitUSD > minProfitUSD;
}

// Helper function to get token price (simplified)
async function getTokenPrice(tokenAddress) {
  // In a real implementation, you would use an oracle or price feed
  // For now, we'll return a default value for common tokens
  const knownTokenPrices = {
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": await getEthPrice() / 10**8, // WETH
    "0x6B175474E89094C44Da98b954EedeAC495271d0F": 1.0, // DAI
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": 1.0, // USDC
    "0xdAC17F958D2ee523a2206206994597C13D831ec7": 1.0, // USDT
    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599": 30000, // WBTC (approximate)
  };

  return knownTokenPrices[tokenAddress] || 1.0; // Default to 1.0 if unknown
}

async function getEthPrice() {
  const chainlink = new ethers.Contract(
    "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    ["function latestAnswer() external view returns (int256)"],
    ethers.provider
  );
  return await chainlink.latestAnswer();
}

async function checkArbitrage(quoter, tokenIn, tokenOut, amount, decimals) {
  const opportunities = [];

  for (const [dex1Name, router1] of Object.entries(DEX_ROUTERS)) {
    for (const [dex2Name, router2] of Object.entries(DEX_ROUTERS)) {
      if (dex1Name === dex2Name) continue;

      const hasLiquidity = await Promise.all([
        checkPoolLiquidity(tokenIn, router1),
        checkPoolLiquidity(tokenOut, router2)
      ]);

      if (!hasLiquidity[0] || !hasLiquidity[1]) continue;

      for (const fee of FEE_TIERS) {
        try {
          // Get price from first DEX
          const quoterContract1 = new ethers.Contract(
            "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6", // Uniswap V3 Quoter
            ["function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)"],
            ethers.provider
          );

          // Get price from second DEX - use a different quoter if available
          const quoterContract2 = new ethers.Contract(
            "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6", // Uniswap V3 Quoter - ideally use a different quoter for different DEXes
            ["function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)"],
            ethers.provider
          );

          // Get quotes from both DEXes
          const price1 = await quoterContract1.callStatic.quoteExactInputSingle(
            tokenIn,
            tokenOut,
            fee,
            amount,
            0
          );

          const price2 = await quoterContract2.callStatic.quoteExactInputSingle(
            tokenIn,
            tokenOut,
            fee,
            amount,
            0
          );

          // Check if the price difference is significant enough
          const priceDiffPercentage = Math.abs(Number(price1) - Number(price2)) / Number(price1);
          if (priceDiffPercentage < 0.005) continue; // At least 0.5% price difference

          // Calculate the actual price difference for profit calculation
          const priceDiff = Number(price1) - Number(price2);

          if (priceDiff > 0 && await isProfitableAfterGas(priceDiff, decimals, tokenIn)) {
            opportunities.push({
              tokenIn,
              tokenOut,
              buyRouter: router1,
              sellRouter: router2,
              amount,
              profit: priceDiff,
              fee,
              dex1: dex1Name,
              dex2: dex2Name
            });
          }
        } catch (error) {
          continue;
        }
      }
    }
  }

  return opportunities;
}

async function main() {
  const [signer] = await ethers.getSigners();

  // Get the deployed contract address from environment variable
  const FLASH_LOAN_CONTRACT = process.env.FLASH_LOAN_CONTRACT;
  if (!FLASH_LOAN_CONTRACT) {
    throw new Error("FLASH_LOAN_CONTRACT address not found in environment variables");
  }

  const arbitrage = await ethers.getContractAt(
    "FlashLoanArbitrage",
    FLASH_LOAN_CONTRACT,
    signer
  );

  const quoter = await ethers.getContractAt(
    ["function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)"],
    "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"
  );

  console.log("Starting arbitrage monitor with safety checks...");

  while (true) {
    try {
      if (!await isGasPriceAcceptable()) {
        console.log("Gas price too high, waiting...");
        await new Promise(resolve => setTimeout(resolve, 12000));
        continue;
      }

      // Sort tokens by priority to check high-priority pairs first
      const sortedTokens = Object.entries(TOKENS).sort((a, b) => a[1].priority - b[1].priority);

      // Create prioritized pairs
      const tokenPairs = [];

      // First, add stablecoin pairs (priority 1 with priority 1)
      for (let i = 0; i < sortedTokens.length; i++) {
        const [token1Symbol, token1Data] = sortedTokens[i];
        if (token1Data.priority !== 1) continue;

        for (let j = i + 1; j < sortedTokens.length; j++) {
          const [token2Symbol, token2Data] = sortedTokens[j];
          if (token2Data.priority !== 1) continue;

          tokenPairs.push({
            token1Symbol, token1Data, token2Symbol, token2Data
          });
        }
      }

      // Then add stablecoins with major assets (priority 1 with priority 2)
      for (const [token1Symbol, token1Data] of sortedTokens.filter(t => t[1].priority === 1)) {
        for (const [token2Symbol, token2Data] of sortedTokens.filter(t => t[1].priority === 2)) {
          tokenPairs.push({
            token1Symbol, token1Data, token2Symbol, token2Data
          });
        }
      }

      // Then add major assets with high volatility tokens (priority 2 with priority 3)
      for (const [token1Symbol, token1Data] of sortedTokens.filter(t => t[1].priority === 2)) {
        for (const [token2Symbol, token2Data] of sortedTokens.filter(t => t[1].priority === 3)) {
          tokenPairs.push({
            token1Symbol, token1Data, token2Symbol, token2Data
          });
        }
      }

      // Process pairs in priority order
      for (const pair of tokenPairs) {
        const { token1Symbol, token1Data, token2Symbol, token2Data } = pair;

        // Use larger amounts for stablecoins, smaller for volatile tokens
        let amount;
        if (token1Data.priority === 1) {
          amount = ethers.parseUnits("10000", token1Data.decimals); // Larger amount for stablecoins
        } else if (token1Data.priority === 2) {
          amount = ethers.parseUnits("5", token1Data.decimals); // Medium amount for major assets
        } else {
          amount = ethers.parseUnits("100", token1Data.decimals); // Smaller amount for volatile tokens
        }

        console.log(`Checking ${token1Symbol} -> ${token2Symbol} pair...`);

        const opportunities = await checkArbitrage(
          quoter,
          token1Data.address,
          token2Data.address,
          amount,
          token1Data.decimals
        );

        for (const opp of opportunities) {
          console.log(`\nSafe opportunity found!`);
          console.log(`${token1Symbol} -> ${token2Symbol}`);
          console.log(`Route: ${opp.dex1} -> ${opp.dex2}`);
          console.log(`Profit: ${ethers.formatUnits(opp.profit, token1Data.decimals)} ${token1Symbol}`);

          try {
            // Calculate optimal slippage based on price difference
            // More profitable trades can afford higher slippage
            const priceDiffPercentage = Math.abs(Number(opp.profit) / Number(opp.amount)) * 100;
            // Cap slippage between 0.5% and 3%
            const slippagePercentage = Math.min(Math.max(priceDiffPercentage / 4, 0.5), 3);

            console.log(`Executing with slippage protection: ${slippagePercentage.toFixed(2)}%`);

            const tx = await arbitrage.executeArbitrage(
              opp.tokenIn,
              opp.amount,
              opp.buyRouter,
              opp.sellRouter,
              opp.tokenIn,
              opp.tokenOut,
              opp.fee,
              Math.floor(slippagePercentage), // Convert to integer percentage
              {
                gasLimit: 500000,
                maxFeePerGas: MAX_GAS_PRICE,
                maxPriorityFeePerGas: ethers.parseUnits("2", "gwei") // Add priority fee for faster inclusion
              }
            );

            console.log(`Transaction sent: ${tx.hash}`);
            await tx.wait();
            console.log("Trade executed successfully!");
          } catch (error) {
            console.error("Execution failed:", error.message);
          }
        }
      }

      console.log("Scanning next block...");
      await new Promise(resolve => setTimeout(resolve, 12000));

    } catch (error) {
      console.error("Error:", error);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Run the main function
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}