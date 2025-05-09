// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

// Interface for the lending pool that provides flash loans
interface ILendingPool {
    function flashLoanSimple(
        address receiver,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

contract FlashLoanArbitrage is Ownable {
    // Address of the lending pool that will provide the flash loan
    address public immutable LENDING_POOL;

    constructor(address lendingPoolAddress) {
        _transferOwnership(msg.sender);
        LENDING_POOL = lendingPoolAddress;
    }

    /*
     * @notice Callback function executed by the lending pool after we receive the flash loan
     * @param borrowedToken Address of the token we borrowed
     * @param borrowedAmount Amount of tokens borrowed
     * @param flashLoanFee Fee that needs to be paid back to the lending pool
     * @param initiator Address that initiated the flash loan (unused but required by interface)
     * @param arbitrageParams Encoded parameters for the arbitrage execution
     */
    function executeOperation(
        address borrowedToken,
        uint256 borrowedAmount,
        uint256 flashLoanFee,
        address initiator,
        bytes calldata arbitrageParams
    ) external returns (bool) {
        // Verify the caller is our lending pool
        require(msg.sender == LENDING_POOL, "Unauthorized caller");

        // Decode the parameters for our arbitrage trade
        (
            address firstDexRouter,
            address secondDexRouter,
            address tokenToBorrow,  // unused but needed for decoding
            address tokenToTradeFor,
            uint24 dexTradingFee,
            uint256 slippagePercentage
        ) = abi.decode(arbitrageParams, (address, address, address, address, uint24, uint256));

        // Step 1: Approve the first DEX to spend our borrowed tokens
        IERC20(borrowedToken).approve(firstDexRouter, borrowedAmount);

        // Step 2: Execute the first trade on DEX 1 (buying tokenToTradeFor)
        ISwapRouter(firstDexRouter).exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: borrowedToken,
                tokenOut: tokenToTradeFor,
                fee: dexTradingFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: borrowedAmount,
                amountOutMinimum: borrowedAmount * (100 - slippagePercentage) / 100, // Dynamic slippage protection
                sqrtPriceLimitX96: 0
            })
        );

        // Step 3: Calculate how many tokens we received from the first trade
        uint256 intermediateTokenBalance = IERC20(tokenToTradeFor).balanceOf(address(this));

        // Step 4: Approve the second DEX to spend our intermediate tokens
        IERC20(tokenToTradeFor).approve(secondDexRouter, intermediateTokenBalance);

        // Step 5: Execute the second trade on DEX 2 (selling back to original token)
        // Must receive at least enough to repay flash loan + fee
        ISwapRouter(secondDexRouter).exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenToTradeFor,
                tokenOut: borrowedToken,
                fee: dexTradingFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: intermediateTokenBalance,
                amountOutMinimum: borrowedAmount + flashLoanFee,
                sqrtPriceLimitX96: 0
            })
        );

        // Step 6: Approve the lending pool to retrieve the borrowed amount + fee
        uint256 totalRepaymentAmount = borrowedAmount + flashLoanFee;
        IERC20(borrowedToken).approve(LENDING_POOL, totalRepaymentAmount);

        return true;
    }

    /*
     * @notice Initiates the arbitrage operation using a flash loan
     * @param tokenAddress Token to borrow for the arbitrage
     * @param borrowAmount Amount of tokens to borrow
     * @param firstDexRouter Address of the first DEX router
     * @param secondDexRouter Address of the second DEX router
     * @param tokenToBorrow Initial token address (for parameter consistency)
     * @param tokenToTradeFor Token to trade the borrowed tokens for
     * @param dexTradingFee Trading fee tier on the DEXes
     */
    function executeArbitrage(
        address tokenAddress,
        uint256 borrowAmount,
        address firstDexRouter,
        address secondDexRouter,
        address tokenToBorrow,
        address tokenToTradeFor,
        uint24 dexTradingFee,
        uint256 slippagePercentage
    ) external onlyOwner {
        // Validate slippage parameter (must be between 0 and 10%)
        require(slippagePercentage <= 10, "Slippage too high");

        // Encode parameters for the flash loan callback
        bytes memory arbitrageParams = abi.encode(
            firstDexRouter,
            secondDexRouter,
            tokenToBorrow,
            tokenToTradeFor,
            dexTradingFee,
            slippagePercentage
        );

        // Request the flash loan from the lending pool
        ILendingPool(LENDING_POOL).flashLoanSimple(
            address(this),
            tokenAddress,
            borrowAmount,
            arbitrageParams,
            0
        );

        // After arbitrage execution, transfer any profit to the contract owner
        uint256 profitAmount = IERC20(tokenAddress).balanceOf(address(this));
        if (profitAmount > 0) {
            IERC20(tokenAddress).transfer(owner(), profitAmount);
        }
    }

    /**
     * @notice Emergency function to recover any tokens stuck in the contract
     * @param tokenAddress Address of the token to recover
     */
    function rescueTokens(address tokenAddress) external onlyOwner {
        uint256 tokenBalance = IERC20(tokenAddress).balanceOf(address(this));
        IERC20(tokenAddress).transfer(owner(), tokenBalance);
    }

    // Allow the contract to receive ETH
    receive() external payable {}
}
