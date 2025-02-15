const { ethers } = require("hardhat");
require("dotenv").config();

// Token addresses and metadata
const TOKENS = {
  WETH: {
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    decimals: 18
  },
  DAI: {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    decimals: 18
  },
  POL: {
    address: "0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6",
    decimals: 18
  },
  ARB: {
    address: "0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1",
    decimals: 18
  },
  WBTC: {
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    decimals: 8
  },
  BNB: {
    address: "0xB8c77482e45F1F44dE1745F52C74426C631bDD52",
    decimals: 18
  },
  CRV: {
    address: "0xD533a949740bb3306d119CC777fa900bA034cd52",
    decimals: 18
  }
};

const DEX_ROUTERS = {
  Uniswap: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  Curve: "0x99a58482BD75caABb7cd5c5aCf0f1F4624a0402d",
  Balancer: "0x3E66B66Fd1d0b02fDa6C811Da9E0547970DB2f21",
  ShibaSwap: "0x115934131916C8b277DD010Ee02de363c09d037c",
  QuickSwap: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
  PancakeSwap: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
};

const FEE_TIERS = [500, 3000, 10000];
const MAX_PRICE_IMPACT = 0.02;
const MAX_GAS_PRICE = ethers.parseUnits("100", "gwei");
const MIN_PROFIT_USD = ethers.parseUnits("100", 6);
const MIN_LIQUIDITY = ethers.parseUnits("10000", 6);

async function checkPoolLiquidity(token, router) {
  try {
    const pool = new ethers.Contract(router, [
      "function getReserves() external view returns (uint112, uint112)"
    ], ethers.provider);
    const [reserve0, reserve1] = await pool.getReserves();
    return Number(reserve0) >= Number(MIN_LIQUIDITY) && Number(reserve1) >= Number(MIN_LIQUIDITY);
  } catch {
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

async function isProfitableAfterGas(profit, tokenDecimals) {
  const feeData = await ethers.provider.getFeeData();
  const gasEstimate = 300000;
  const gasCost = Number(feeData.gasPrice) * gasEstimate;
  
  let profitInUSD;
  if (tokenDecimals === 18) {
    const ethPrice = await getEthPrice();
    profitInUSD = Number(profit) * Number(ethPrice) / (10 ** 18);
  } else {
    profitInUSD = Number(profit);
  }

  return profitInUSD > (Number(MIN_PROFIT_USD) + gasCost * 2);
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
          const price1 = await quoter.callStatic.quoteExactInputSingle(
            tokenIn,
            tokenOut,
            fee,
            amount,
            0
          );

          const price2 = await quoter.callStatic.quoteExactInputSingle(
            tokenIn,
            tokenOut,
            fee,
            amount,
            0
          );

          if (!checkPriceImpact(price1, price2)) continue;

          const priceDiff = Number(price1) - Number(price2);
          
          if (priceDiff > 0 && await isProfitableAfterGas(priceDiff, decimals)) {
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

      for (const [token1Symbol, token1Data] of Object.entries(TOKENS)) {
        for (const [token2Symbol, token2Data] of Object.entries(TOKENS)) {
          if (token1Data.address === token2Data.address) continue;
          
          const amount = ethers.parseUnits("1000", token1Data.decimals);
          
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
              const tx = await arbitrage.executeArbitrage(
                opp.tokenIn,
                opp.amount,
                opp.buyRouter,
                opp.sellRouter,
                opp.tokenIn,
                opp.tokenOut,
                opp.fee,
                { 
                  gasLimit: 500000,
                  maxFeePerGas: MAX_GAS_PRICE
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