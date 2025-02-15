const hre = require("hardhat");

async function main() {
  const POOL_ADDRESS = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
  
  const FlashLoanArbitrage = await hre.ethers.getContractFactory("FlashLoanArbitrage");
  const flashLoanArbitrage = await FlashLoanArbitrage.deploy(POOL_ADDRESS, {
    gasLimit: 3000000
  });

  console.log(`FlashLoanArbitrage deploying to ${flashLoanArbitrage.target}`);
  await flashLoanArbitrage.waitForDeployment();
  console.log("Deployment confirmed");

  // Wait for several block confirmations
  const receipt = await flashLoanArbitrage.deploymentTransaction().wait(5);
  console.log(`Deployed and confirmed at block ${receipt.blockNumber}`);

  try {
    await hre.run("verify:verify", {
      address: flashLoanArbitrage.target,
      constructorArguments: [POOL_ADDRESS],
    });
  } catch (error) {
    console.error("Verification error:", error);
  }
}

main().catch(console.error);