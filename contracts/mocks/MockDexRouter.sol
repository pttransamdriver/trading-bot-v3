// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockDexRouter
 * @dev Mock implementation of a DEX router for testing
 */
contract MockDexRouter {
    // Fee percentage for swaps (0.3%)
    uint256 public constant SWAP_FEE = 30; // 30 = 0.3%
    uint256 public constant FEE_PRECISION = 10000; // 10000 = 100%
    
    // Exchange rate multiplier (1.0 = equal exchange)
    uint256 public exchangeRateMultiplier = 10000; // 10000 = 1.0x
    
    /**
     * @dev Sets the exchange rate multiplier
     * @param multiplier New multiplier (10000 = 1.0x)
     */
    function setExchangeRateMultiplier(uint256 multiplier) external {
        exchangeRateMultiplier = multiplier;
    }
    
    /**
     * @dev Executes a swap with exact input amount
     * @param params Swap parameters
     * @return amountOut Amount of output tokens
     */
    function exactInputSingle(ExactInputSingleParams calldata params) external returns (uint256 amountOut) {
        // Transfer input tokens from sender
        IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        
        // Calculate output amount with exchange rate and fee
        uint256 amountWithoutFee = (params.amountIn * exchangeRateMultiplier) / 10000;
        amountOut = amountWithoutFee - ((amountWithoutFee * SWAP_FEE) / FEE_PRECISION);
        
        // Ensure minimum output amount is met
        require(amountOut >= params.amountOutMinimum, "Insufficient output amount");
        
        // Transfer output tokens to recipient
        IERC20(params.tokenOut).transfer(params.recipient, amountOut);
        
        return amountOut;
    }
}

/**
 * @title ExactInputSingleParams
 * @dev Struct for swap parameters
 */
struct ExactInputSingleParams {
    address tokenIn;
    address tokenOut;
    uint24 fee;
    address recipient;
    uint256 deadline;
    uint256 amountIn;
    uint256 amountOutMinimum;
    uint160 sqrtPriceLimitX96;
}
