const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FlashLoanArbitrage", function () {
  let flashLoanArbitrage;
  let owner;
  let addr1;
  let addr2;
  let mockLendingPool;
  let mockToken;
  let mockDexRouter;

  // Mock token addresses
  const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

  beforeEach(async function () {
    // Get signers
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy mock contracts
    const MockLendingPool = await ethers.getContractFactory("MockLendingPool");
    mockLendingPool = await MockLendingPool.deploy();

    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("Mock Token", "MTK", 18);

    const MockDexRouter = await ethers.getContractFactory("MockDexRouter");
    mockDexRouter = await MockDexRouter.deploy();

    // Deploy the FlashLoanArbitrage contract
    const FlashLoanArbitrage = await ethers.getContractFactory("FlashLoanArbitrage");
    flashLoanArbitrage = await FlashLoanArbitrage.deploy(await mockLendingPool.getAddress());
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await flashLoanArbitrage.owner()).to.equal(owner.address);
    });

    it("Should set the correct lending pool address", async function () {
      expect(await flashLoanArbitrage.LENDING_POOL()).to.equal(await mockLendingPool.getAddress());
    });
  });

  describe("executeArbitrage", function () {
    it("Should only allow owner to execute arbitrage", async function () {
      await expect(
        flashLoanArbitrage.connect(addr1).executeArbitrage(
          mockToken.getAddress(),
          ethers.parseEther("1"),
          mockDexRouter.getAddress(),
          mockDexRouter.getAddress(),
          mockToken.getAddress(),
          mockToken.getAddress(),
          3000,
          2 // 2% slippage
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should validate slippage parameter", async function () {
      await expect(
        flashLoanArbitrage.executeArbitrage(
          mockToken.getAddress(),
          ethers.parseEther("1"),
          mockDexRouter.getAddress(),
          mockDexRouter.getAddress(),
          mockToken.getAddress(),
          mockToken.getAddress(),
          3000,
          11 // 11% slippage (too high)
        )
      ).to.be.revertedWith("Slippage too high");
    });
  });

  describe("rescueTokens", function () {
    it("Should allow owner to rescue tokens", async function () {
      // First, send some tokens to the contract
      await mockToken.mint(flashLoanArbitrage.getAddress(), ethers.parseEther("10"));
      
      // Check initial balances
      const initialContractBalance = await mockToken.balanceOf(flashLoanArbitrage.getAddress());
      const initialOwnerBalance = await mockToken.balanceOf(owner.address);
      
      // Rescue tokens
      await flashLoanArbitrage.rescueTokens(mockToken.getAddress());
      
      // Check final balances
      const finalContractBalance = await mockToken.balanceOf(flashLoanArbitrage.getAddress());
      const finalOwnerBalance = await mockToken.balanceOf(owner.address);
      
      // Verify tokens were transferred
      expect(finalContractBalance).to.equal(0);
      expect(finalOwnerBalance).to.equal(initialOwnerBalance + initialContractBalance);
    });

    it("Should only allow owner to rescue tokens", async function () {
      await expect(
        flashLoanArbitrage.connect(addr1).rescueTokens(mockToken.getAddress())
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  // Additional tests would include:
  // 1. Testing the executeOperation function with mock flash loan callbacks
  // 2. Testing the full arbitrage flow with mock DEXes
  // 3. Testing edge cases and error conditions
});
