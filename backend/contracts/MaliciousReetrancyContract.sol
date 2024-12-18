// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./SimpleDEX.sol";

contract MaliciousReentrancyContract {
    SimpleDEX public targetDEX;
    IERC20 public tokenA;
    IERC20 public tokenB;
    uint256 public attackCount;

    constructor(address _dex, address _tokenA, address _tokenB) {
        targetDEX = SimpleDEX(_dex);
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }

    // Nouvelle méthode pour approuver les tokens
    function approveTokensForDEX(address dexAddress, uint256 amountA, uint256 amountB) external {
        tokenA.approve(dexAddress, amountA);
        tokenB.approve(dexAddress, amountB);
    }

    function attackAddLiquidity(uint256 amountA, uint256 amountB) external {
        // Approuver les dépenses
        tokenA.approve(address(targetDEX), amountA);
        tokenB.approve(address(targetDEX), amountB);

        // Tenter d'ajouter de la liquidité et de rappeler la fonction
        targetDEX.addLiquidity(amountA, amountB);
        
        // Tenter de rappeler récursivement
        if (attackCount < 1) {
            attackCount++;
            targetDEX.addLiquidity(amountA, amountB);
        }
    }

    // Fallback qui rappelle addLiquidity si possible
    receive() external payable {
        if (attackCount < 1) {
            attackCount++;
            try targetDEX.addLiquidity(100, 100) {} catch {}
        }
    }
}