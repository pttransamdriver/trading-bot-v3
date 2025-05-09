// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockLendingPool
 * @dev Mock implementation of a lending pool for testing flash loans
 */
contract MockLendingPool {
    // Fee percentage for flash loans (0.09%)
    uint256 public constant FLASH_LOAN_FEE = 9; // 9 = 0.09%
    uint256 public constant FEE_PRECISION = 10000; // 10000 = 100%

    /**
     * @dev Executes a flash loan
     * @param receiver Address of the contract that will receive the flash loan
     * @param asset Address of the asset to be flash loaned
     * @param amount Amount of the asset to be flash loaned
     * @param params Arbitrary data to be passed to the receiver
     * @param referralCode Referral code (unused in mock)
     */
    function flashLoanSimple(
        address receiver,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external {
        // Calculate the fee
        uint256 fee = (amount * FLASH_LOAN_FEE) / FEE_PRECISION;
        
        // Transfer the requested amount to the receiver
        IERC20(asset).transfer(receiver, amount);
        
        // Call executeOperation on the receiver
        require(
            IFlashLoanReceiver(receiver).executeOperation(
                asset,
                amount,
                fee,
                msg.sender,
                params
            ),
            "Flash loan execution failed"
        );
        
        // Transfer the amount + fee back from the receiver
        IERC20(asset).transferFrom(receiver, address(this), amount + fee);
    }
}

/**
 * @title IFlashLoanReceiver
 * @dev Interface for the flash loan receiver
 */
interface IFlashLoanReceiver {
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}
