// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract SimpleDEX is ERC20 {
    IERC20 public tokenA;
    IERC20 public tokenB;
    
    uint256 public reserveA;
    uint256 public reserveB;
    
    address public feeReceiver;
    uint256 public constant FEE_PERCENT = 5; // 0.5%
    
    // Ajout d'un état de verrouillage pour prévenir la réentrance
    bool private locked;

    event LiquidityAdded(address indexed provider, uint256 amountA, uint256 amountB, uint256 lpTokens);
    event LiquidityRemoved(address indexed provider, uint256 amountA, uint256 amountB);
    event Swapped(address indexed sender, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);

    // Modificateur personnalisé pour prévenir la réentrance
    modifier noReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    constructor(
        IERC20 _tokenA, 
        IERC20 _tokenB, 
        address _feeReceiver
    ) ERC20("LiquidityPoolToken", "LPT") {
        require(_feeReceiver != address(0), "Invalid fee receiver");
        tokenA = _tokenA;
        tokenB = _tokenB;
        feeReceiver = _feeReceiver;
    }

    function addLiquidity(
        uint256 amountA, 
        uint256 amountB
    ) external noReentrant returns (uint256 lpTokens) {
        require(amountA > 0 && amountB > 0, "Invalid amounts");

        // Transfert des tokens
        require(
            tokenA.transferFrom(msg.sender, address(this), amountA) &&
            tokenB.transferFrom(msg.sender, address(this), amountB), 
            "Token transfer failed"
        );

        // Calcul des LP tokens
        if (totalSupply() == 0) {
            lpTokens = sqrt(amountA * amountB);
        } else {
            uint256 lpTokenA = (amountA * totalSupply()) / reserveA;
            uint256 lpTokenB = (amountB * totalSupply()) / reserveB;
            lpTokens = lpTokenA < lpTokenB ? lpTokenA : lpTokenB;
        }

        // Mise à jour des réserves
        reserveA += amountA;
        reserveB += amountB;

        // Mint LP tokens
        _mint(msg.sender, lpTokens);

        emit LiquidityAdded(msg.sender, amountA, amountB, lpTokens);
        return lpTokens;
    }

    function removeLiquidity(
        uint256 lpTokenAmount
    ) external noReentrant returns (uint256 amountA, uint256 amountB) {
        require(lpTokenAmount > 0, "Invalid LP token amount");

        // Calcul des montants à retirer
        amountA = (lpTokenAmount * reserveA) / totalSupply();
        amountB = (lpTokenAmount * reserveB) / totalSupply();

        // Brûler les LP tokens
        _burn(msg.sender, lpTokenAmount);

        // Réduire les réserves
        reserveA -= amountA;
        reserveB -= amountB;

        // Transférer les tokens
        require(
            tokenA.transfer(msg.sender, amountA) &&
            tokenB.transfer(msg.sender, amountB),
            "Token transfer failed"
        );

        emit LiquidityRemoved(msg.sender, amountA, amountB);
    }

    function swap(
        address tokenIn, 
        address tokenOut, 
        uint256 amountIn
    ) external noReentrant returns (uint256 amountOut) {
        require(
            tokenIn == address(tokenA) || tokenIn == address(tokenB), 
            "Invalid input token"
        );
        require(
            tokenOut == address(tokenA) || tokenOut == address(tokenB), 
            "Invalid output token"
        );
        require(tokenIn != tokenOut, "Cannot swap same token");
        require(amountIn > 0, "Invalid amount");

        IERC20 inputToken = IERC20(tokenIn);
        IERC20 outputToken = IERC20(tokenOut);

        // Calculer la taxe
        uint256 feeAmount = (amountIn * FEE_PERCENT) / 1000;
        uint256 amountAfterFee = amountIn - feeAmount;

        // Transfert du token d'entrée
        require(
            inputToken.transferFrom(msg.sender, address(this), amountIn),
            "Input transfer failed"
        );

        // Transférer la taxe
        require(
            inputToken.transfer(feeReceiver, feeAmount),
            "Fee transfer failed"
        );

        // Calcul de l'échange selon x*y=k (formule de l'automate)
        if (tokenIn == address(tokenA)) {
            amountOut = (reserveB * amountAfterFee) / (reserveA + amountAfterFee);
            reserveA += amountAfterFee;
            reserveB -= amountOut;
        } else {
            amountOut = (reserveA * amountAfterFee) / (reserveB + amountAfterFee);
            reserveB += amountAfterFee;
            reserveA -= amountOut;
        }

        // Transférer le token de sortie
        require(
            outputToken.transfer(msg.sender, amountOut),
            "Output transfer failed"
        );

        emit Swapped(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
        return amountOut;
    }

    // Fonction racine carrée pour le calcul initial des LP tokens
    function sqrt(uint256 y) private pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}