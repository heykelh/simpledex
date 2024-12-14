const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SimpleDEX", function () {
  let owner, user1, user2, feeReceiver;
  let tokenA, tokenB, simpleDEX;

  // Helper function to mint tokens for users
  async function mintTokens(token, recipient, amount) {
    // Assuming the token has a mint function - adjust if your tokens are different
    await token.mint(recipient.address, amount);
  }

  // Helper function to approve tokens
  async function approveTokens(token, spender, amount, sender) {
    await token.connect(sender).approve(spender, amount);
  }

  beforeEach(async function () {
    // Get signers
    [owner, user1, user2, feeReceiver] = await ethers.getSigners();

    // Deploy mock ERC20 tokens
    const MockToken = await ethers.getContractFactory("MockERC20");
    tokenA = await MockToken.deploy("Token A", "TKNA", 18);
    tokenB = await MockToken.deploy("Token B", "TKNB", 18);

    // Deploy SimpleDEX
    const SimpleDEX = await ethers.getContractFactory("SimpleDEX");
    simpleDEX = await SimpleDEX.deploy(
      await tokenA.getAddress(), 
      await tokenB.getAddress(), 
      feeReceiver.address
    );

    // Mint tokens to users
    const mintAmount = ethers.parseEther("1000");
    await mintTokens(tokenA, user1, mintAmount);
    await mintTokens(tokenB, user1, mintAmount);
    await mintTokens(tokenA, user2, mintAmount);
    await mintTokens(tokenB, user2, mintAmount);
  });

  describe("Deployment", function () {
    it("Should set the correct tokens and fee receiver", async function () {
      expect(await simpleDEX.tokenA()).to.equal(await tokenA.getAddress());
      expect(await simpleDEX.tokenB()).to.equal(await tokenB.getAddress());
      expect(await simpleDEX.feeReceiver()).to.equal(feeReceiver.address);
    });
  });

  describe("Add Liquidity", function () {
    it("Should allow adding initial liquidity", async function () {
      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("100");

      // Approve tokens
      await approveTokens(tokenA, await simpleDEX.getAddress(), amountA, user1);
      await approveTokens(tokenB, await simpleDEX.getAddress(), amountB, user1);

      // Add liquidity
      await expect(simpleDEX.connect(user1).addLiquidity(amountA, amountB))
        .to.emit(simpleDEX, "LiquidityAdded")
        .withArgs(user1.address, amountA, amountB, ethers.parseEther("100"));

      expect(await simpleDEX.reserveA()).to.equal(amountA);
      expect(await simpleDEX.reserveB()).to.equal(amountB);
    });

    it("Should allow adding liquidity after initial deposit", async function () {
      // First liquidity provision
      const amountA1 = ethers.parseEther("100");
      const amountB1 = ethers.parseEther("100");
      await approveTokens(tokenA, await simpleDEX.getAddress(), amountA1, user1);
      await approveTokens(tokenB, await simpleDEX.getAddress(), amountB1, user1);
      await simpleDEX.connect(user1).addLiquidity(amountA1, amountB1);

      // Second liquidity provision
      const amountA2 = ethers.parseEther("50");
      const amountB2 = ethers.parseEther("50");
      await approveTokens(tokenA, await simpleDEX.getAddress(), amountA2, user2);
      await approveTokens(tokenB, await simpleDEX.getAddress(), amountB2, user2);
      
      await expect(simpleDEX.connect(user2).addLiquidity(amountA2, amountB2))
        .to.emit(simpleDEX, "LiquidityAdded");

      expect(await simpleDEX.reserveA()).to.equal(amountA1 + amountA2);
      expect(await simpleDEX.reserveB()).to.equal(amountB1 + amountB2);
    });

    it("Should revert if amounts are zero", async function () {
      await expect(simpleDEX.connect(user1).addLiquidity(0, 0))
        .to.be.revertedWith("Invalid amounts");
    });
  });

  describe("Remove Liquidity", function () {
    beforeEach(async function () {
      // Add initial liquidity
      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("100");
      await approveTokens(tokenA, await simpleDEX.getAddress(), amountA, user1);
      await approveTokens(tokenB, await simpleDEX.getAddress(), amountB, user1);
      await simpleDEX.connect(user1).addLiquidity(amountA, amountB);
    });

    it("Should allow removing liquidity", async function () {
      const lpTokenBalance = await simpleDEX.balanceOf(user1.address);
      
      // Approve LP tokens for burning
      await simpleDEX.connect(user1).approve(await simpleDEX.getAddress(), lpTokenBalance);

      // Remove liquidity
      await expect(simpleDEX.connect(user1).removeLiquidity(lpTokenBalance))
        .to.emit(simpleDEX, "LiquidityRemoved");

      // Check reserves are reset
      expect(await simpleDEX.reserveA()).to.equal(0);
      expect(await simpleDEX.reserveB()).to.equal(0);
    });

    it("Should revert if LP token amount is zero", async function () {
      await expect(simpleDEX.connect(user1).removeLiquidity(0))
        .to.be.revertedWith("Invalid LP token amount");
    });
  });

  describe("Swap", function () {
    beforeEach(async function () {
      // Add initial liquidity
      const amountA = ethers.parseEther("1000");
      const amountB = ethers.parseEther("1000");
      await approveTokens(tokenA, await simpleDEX.getAddress(), amountA, user1);
      await approveTokens(tokenB, await simpleDEX.getAddress(), amountB, user1);
      await simpleDEX.connect(user1).addLiquidity(amountA, amountB);
    });

    it("Should allow swapping tokens", async function () {
      const swapAmount = ethers.parseEther("100");
      
      // Approve input token
      await approveTokens(tokenA, await simpleDEX.getAddress(), swapAmount, user2);

      // Perform swap
      await expect(
        simpleDEX.connect(user2).swap(
          await tokenA.getAddress(), 
          await tokenB.getAddress(), 
          swapAmount
        )
      ).to.emit(simpleDEX, "Swapped");
    });

    it("Should apply fee during swap", async function () {
      const swapAmount = ethers.parseEther("100");
      
      // Approve input token
      await approveTokens(tokenA, await simpleDEX.getAddress(), swapAmount, user2);

      // Initial fee receiver balance
      const initialFeeBalance = await tokenA.balanceOf(feeReceiver.address);

      // Perform swap
      await simpleDEX.connect(user2).swap(
        await tokenA.getAddress(), 
        await tokenB.getAddress(), 
        swapAmount
      );

      // Check fee was collected (0.5% of swap amount)
      const expectedFee = swapAmount * 5n / 1000n;
      const newFeeBalance = await tokenA.balanceOf(feeReceiver.address);
      expect(newFeeBalance - initialFeeBalance).to.equal(expectedFee);
    });

    it("Should revert swap with invalid input parameters", async function () {
      const swapAmount = ethers.parseEther("100");
      
      // Invalid input token
      await expect(
        simpleDEX.connect(user2).swap(
          ethers.ZeroAddress, 
          await tokenB.getAddress(), 
          swapAmount
        )
      ).to.be.revertedWith("Invalid input token");

      // Invalid output token
      await expect(
        simpleDEX.connect(user2).swap(
          await tokenA.getAddress(), 
          ethers.ZeroAddress, 
          swapAmount
        )
      ).to.be.revertedWith("Invalid output token");

      // Swap same token
      await expect(
        simpleDEX.connect(user2).swap(
          await tokenA.getAddress(), 
          await tokenA.getAddress(), 
          swapAmount
        )
      ).to.be.revertedWith("Cannot swap same token");

      // Zero amount
      await expect(
        simpleDEX.connect(user2).swap(
          await tokenA.getAddress(), 
          await tokenB.getAddress(), 
          0
        )
      ).to.be.revertedWith("Invalid amount");
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should prevent reentrancy attacks", async function () {
      // Note: This would require a malicious contract with a fallback function
      // that attempts to call the DEX again during a transaction
      // For demonstration, we'd need to deploy a mock reentrancy contract
    });
  });
});

// Mock ERC20 Token Contract for Testing
/*const MockERC20 = `
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol, uint8 decimals) ERC20(name, symbol) {
        // Optional: Set custom decimals if needed
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}*/
//`;