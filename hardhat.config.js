require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Ensure required environment variables are set
if (!process.env.MAINNET_URL) {
  throw new Error("Please set your MAINNET_URL in a .env file");
}

if (!process.env.PRIVATE_KEY) {
  throw new Error("Please set your PRIVATE_KEY in a .env file");
}

module.exports = {
  solidity: {
    version: "0.8.18",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    mainnet: {
      url: process.env.MAINNET_URL,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 1
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};