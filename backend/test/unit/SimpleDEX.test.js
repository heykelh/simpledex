const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Blockchain DEX Testing Suite", function () {
  let owner, user1, user2, feeReceiver;
  let tokenA, tokenB, simpleDEX;

  // Utility function to convert tokens with decimals
  const tokenConverter = (amount) => {
    return ethers.parseUnits(amount.toString(), 18);
  };

  beforeEach(async function () {
    // Deploy contracts before each test
    [owner, user1, user2, feeReceiver] = await ethers.getSigners();

    // Deploy tokens
    const MyTokenA = await ethers.getContractFactory("MyTokenA");
    const MyTokenB = await ethers.getContractFactory("MyTokenB");
    tokenA = await MyTokenA.deploy();
    tokenB = await MyTokenB.deploy();

    // Distribute tokens to users
    await tokenA.transfer(user1.address, tokenConverter(10000));
    await tokenB.transfer(user1.address, tokenConverter(10000));
    await tokenA.transfer(user2.address, tokenConverter(10000));
    await tokenB.transfer(user2.address, tokenConverter(10000));

    // Deploy DEX
    const SimpleDEX = await ethers.getContractFactory("SimpleDEX");
    simpleDEX = await SimpleDEX.deploy(
      tokenA.getAddress(),
      tokenB.getAddress(),
      feeReceiver.address
    );
  });

  describe("Token Deployment Tests", function () {
    // Test initial token supply
    it("Should deploy tokens with correct initial supply", async function () {
      expect(await tokenA.totalSupply()).to.equal(tokenConverter(1000000));
      expect(await tokenB.totalSupply()).to.equal(tokenConverter(1000000));
    });

    // Test token distribution
    it("Should distribute tokens to test users", async function () {
      expect(await tokenA.balanceOf(user1.address)).to.equal(tokenConverter(10000));
      expect(await tokenB.balanceOf(user1.address)).to.equal(tokenConverter(10000));
    });

    // Test owner balance
    it("Should maintain correct owner balance after distribution", async function () {
      const ownerBalanceA = await tokenA.balanceOf(owner.address);
      const ownerBalanceB = await tokenB.balanceOf(owner.address);
      expect(ownerBalanceA).to.equal(tokenConverter(980000)); // Initial - distributed
      expect(ownerBalanceB).to.equal(tokenConverter(980000));
    });

    // Test token transfer failures
    it("Should fail when transferring more than balance", async function () {
      const excessAmount = tokenConverter(2000000); // More than total supply
      await expect(
        tokenA.connect(user1).transfer(user2.address, excessAmount)
      ).to.be.reverted;
    });
  });

  describe("DEX Initialization Tests", function () {
    // Test token addresses
    it("Should initialize DEX with correct tokens", async function () {
      expect(await simpleDEX.tokenA()).to.equal(await tokenA.getAddress());
      expect(await simpleDEX.tokenB()).to.equal(await tokenB.getAddress());
      expect(await simpleDEX.feeReceiver()).to.equal(feeReceiver.address);
    });

    // Test initial reserves
    it("Should start with zero reserves", async function () {
      expect(await simpleDEX.reserveA()).to.equal(0);
      expect(await simpleDEX.reserveB()).to.equal(0);
    });

    // Test fee percentage
    it("Should have correct fee percentage", async function () {
      expect(await simpleDEX.FEE_PERCENT()).to.equal(5); // 0.5%
    });

    // Test invalid initialization
    it("Should fail with zero address fee receiver", async function () {
      const SimpleDEX = await ethers.getContractFactory("SimpleDEX");
      await expect(
        SimpleDEX.deploy(
          tokenA.getAddress(),
          tokenB.getAddress(),
          ethers.ZeroAddress
        )
      ).to.be.revertedWith("Invalid fee receiver");
    });

    // Test LP token metadata
    it("Should have correct LP token metadata", async function () {
      expect(await simpleDEX.name()).to.equal("LiquidityPoolToken");
      expect(await simpleDEX.symbol()).to.equal("LPT");
      expect(await simpleDEX.decimals()).to.equal(18);
    });
  });

  describe("Liquidity Management Tests", function () {
    beforeEach(async function () {
      // Approve tokens for DEX
      await tokenA.connect(user1).approve(simpleDEX.getAddress(), tokenConverter(5000));
      await tokenB.connect(user1).approve(simpleDEX.getAddress(), tokenConverter(5000));
    });

    // Test initial liquidity addition
    it("Should add initial liquidity", async function () {
      const amountA = tokenConverter(1000);
      const amountB = tokenConverter(1000);
      await simpleDEX.connect(user1).addLiquidity(amountA, amountB);
      expect(await simpleDEX.reserveA()).to.equal(amountA);
      expect(await simpleDEX.reserveB()).to.equal(amountB);
    });

    // Test LP token minting
    it("Should mint LP tokens proportionally", async function () {
      const amountA = tokenConverter(1000);
      const amountB = tokenConverter(1000);
      await simpleDEX.connect(user1).addLiquidity(amountA, amountB);
      const lpTokenBalance = await simpleDEX.balanceOf(user1.address);
      expect(lpTokenBalance).to.equal(tokenConverter(1000));
    });

    // Test liquidity addition validation
    it("Should prevent adding liquidity with zero amounts", async function () {
      await expect(
        simpleDEX.connect(user1).addLiquidity(0, tokenConverter(1000))
      ).to.be.revertedWith("Invalid amounts");
    });

    // Test liquidity removal
    it("Should remove liquidity correctly", async function () {
      const amountA = tokenConverter(1000);
      const amountB = tokenConverter(1000);
      await simpleDEX.connect(user1).addLiquidity(amountA, amountB);
      const lpTokenBalance = await simpleDEX.balanceOf(user1.address);
      
      await simpleDEX.connect(user1).approve(simpleDEX.getAddress(), lpTokenBalance);
      const initialBalanceA = await tokenA.balanceOf(user1.address);
      const initialBalanceB = await tokenB.balanceOf(user1.address);
      
      await simpleDEX.connect(user1).removeLiquidity(lpTokenBalance);
      
      expect(await tokenA.balanceOf(user1.address)).to.equal(initialBalanceA + amountA);
      expect(await tokenB.balanceOf(user1.address)).to.equal(initialBalanceB + amountB);
    });

    // Test multiple liquidity providers
    it("Should handle multiple liquidity providers correctly", async function () {
      await simpleDEX.connect(user1).addLiquidity(
        tokenConverter(1000),
        tokenConverter(1000)
      );

      await tokenA.connect(user2).approve(simpleDEX.getAddress(), tokenConverter(500));
      await tokenB.connect(user2).approve(simpleDEX.getAddress(), tokenConverter(500));
      await simpleDEX.connect(user2).addLiquidity(
        tokenConverter(500),
        tokenConverter(500)
      );

      const lpUser1 = await simpleDEX.balanceOf(user1.address);
      const lpUser2 = await simpleDEX.balanceOf(user2.address);
      expect(lpUser2).to.equal(lpUser1 / BigInt(2));
    });

    // Test insufficient allowance
    it("Should fail when adding liquidity with insufficient allowance", async function () {
      const amount = tokenConverter(6000); // More than approved
      await expect(
        simpleDEX.connect(user1).addLiquidity(amount, amount)
      ).to.be.reverted;
    });

    // Test removing more liquidity than owned
    it("Should fail when removing more liquidity than owned", async function () {
      await simpleDEX.connect(user1).addLiquidity(
        tokenConverter(1000),
        tokenConverter(1000)
      );
      const excessAmount = tokenConverter(2000);
      await expect(
        simpleDEX.connect(user1).removeLiquidity(excessAmount)
      ).to.be.reverted;
    });

    // Test removing zero liquidity
    it("Should fail when removing zero liquidity", async function () {
      await expect(
        simpleDEX.connect(user1).removeLiquidity(0)
      ).to.be.revertedWith("Invalid LP token amount");
    });

    // Test subsequent liquidity additions
    it("Should handle subsequent liquidity additions correctly", async function () {
      // First addition
      await simpleDEX.connect(user1).addLiquidity(
        tokenConverter(1000),
        tokenConverter(1000)
      );

      // Second addition
      await simpleDEX.connect(user1).addLiquidity(
        tokenConverter(500),
        tokenConverter(500)
      );

      expect(await simpleDEX.reserveA()).to.equal(tokenConverter(1500));
      expect(await simpleDEX.reserveB()).to.equal(tokenConverter(1500));
    });
  });

  describe("Swap Functionality Tests", function () {
    beforeEach(async function () {
      // Add initial liquidity
      await tokenA.connect(user1).approve(simpleDEX.getAddress(), tokenConverter(5000));
      await tokenB.connect(user1).approve(simpleDEX.getAddress(), tokenConverter(5000));
      await simpleDEX.connect(user1).addLiquidity(
        tokenConverter(5000),
        tokenConverter(5000)
      );

      // Approve tokens for swapping
      await tokenA.connect(user2).approve(simpleDEX.getAddress(), tokenConverter(1000));
      await tokenB.connect(user2).approve(simpleDEX.getAddress(), tokenConverter(1000));
    });

    // Test basic swap functionality
    it("Should swap tokens with correct fee calculation", async function () {
      const swapAmount = tokenConverter(100);
      const initialBalanceB = await tokenB.balanceOf(user2.address);
      const initialFeeReceiverBalanceA = await tokenA.balanceOf(feeReceiver.address);

      await simpleDEX.connect(user2).swap(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        swapAmount
      );

      const finalBalanceB = await tokenB.balanceOf(user2.address);
      const finalFeeReceiverBalanceA = await tokenA.balanceOf(feeReceiver.address);

      const feeAmount = (swapAmount * BigInt(5)) / BigInt(1000);
      expect(finalFeeReceiverBalanceA - initialFeeReceiverBalanceA).to.equal(feeAmount);
      expect(finalBalanceB > initialBalanceB).to.be.true;
    });

    // Test swap validation
    it("Should prevent swapping the same token", async function () {
      await expect(
        simpleDEX.connect(user2).swap(
          await tokenA.getAddress(),
          await tokenA.getAddress(),
          tokenConverter(100)
        )
      ).to.be.revertedWith("Cannot swap same token");
    });

    // Test invalid token swaps
    it("Should prevent swapping with invalid tokens", async function () {
      await expect(
        simpleDEX.connect(user2).swap(
          ethers.ZeroAddress,
          await tokenA.getAddress(),
          tokenConverter(100)
        )
      ).to.be.revertedWith("Invalid input token");
    });

    // Test swap amounts validation
    it("Should prevent swapping with zero amount", async function () {
      await expect(
        simpleDEX.connect(user2).swap(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          0
        )
      ).to.be.revertedWith("Invalid amount");
    });

    // Test bidirectional swaps
    it("Should allow swapping in both directions", async function () {
      const swapAmount = tokenConverter(100);
      
      // Swap A to B
      await simpleDEX.connect(user2).swap(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        swapAmount
      );

      // Swap B to A
      await simpleDEX.connect(user2).swap(
        await tokenB.getAddress(),
        await tokenA.getAddress(),
        swapAmount
      );

      // Verify reserves are different from initial state
      const reserveA = await simpleDEX.reserveA();
      const reserveB = await simpleDEX.reserveB();
      expect(reserveA).to.not.equal(tokenConverter(5000));
      expect(reserveB).to.not.equal(tokenConverter(5000));
    });

    // Test insufficient balance for swap
    it("Should fail when swapping with insufficient balance", async function () {
      const excessAmount = tokenConverter(20000); // More than user has
      await expect(
        simpleDEX.connect(user2).swap(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          excessAmount
        )
      ).to.be.reverted;
    });

    // Test swap impact on reserves
    it("Should update reserves correctly after swap", async function () {
      const swapAmount = tokenConverter(100);
      const initialReserveA = await simpleDEX.reserveA();
      const initialReserveB = await simpleDEX.reserveB();

      await simpleDEX.connect(user2).swap(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        swapAmount
      );

      const finalReserveA = await simpleDEX.reserveA();
      const finalReserveB = await simpleDEX.reserveB();

      expect(finalReserveA).to.be.gt(initialReserveA);
      expect(finalReserveB).to.be.lt(initialReserveB);
    });

    // Test exact fee calculation
    it("Should calculate and transfer exact fee amount", async function () {
      const swapAmount = tokenConverter(1000);
      const expectedFee = swapAmount.mul(5).div(1000); // 0.5%
      const initialFeeBalance = await tokenA.balanceOf(feeReceiver.address);

      await simpleDEX.connect(user2).swap(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        swapAmount
      );

      const finalFeeBalance = await tokenA.balanceOf(feeReceiver.address);
      expect(finalFeeBalance.sub(initialFeeBalance)).to.equal(expectedFee);
    });

    

    // Test LP token transfers
    it("Should handle LP token transfers correctly", async function () {
      // Add liquidity first
      await simpleDEX.connect(user1).addLiquidity(
        tokenConverter(1000),
        tokenConverter(1000)
      );

      const lpAmount = tokenConverter(500);
      await simpleDEX.connect(user1).transfer(user2.address, lpAmount);

      expect(await simpleDEX.balanceOf(user2.address)).to.equal(lpAmount);
    });
  });

  // Add ERC20 standard compliance tests
  describe("ERC20 Compliance Tests", function () {
    it("Should handle allowances correctly", async function () {
      const amount = tokenConverter(100);
      await simpleDEX.connect(user1).approve(user2.address, amount);
      expect(await simpleDEX.allowance(user1.address, user2.address))
        .to.equal(amount);
    });

    it("Should handle transferFrom correctly", async function () {
      // Add liquidity to get LP tokens
      await simpleDEX.connect(user1).addLiquidity(
        tokenConverter(1000),
        tokenConverter(1000)
      );

      const transferAmount = tokenConverter(100);
      await simpleDEX.connect(user1).approve(user2.address, transferAmount);
      await simpleDEX.connect(user2).transferFrom(
        user1.address,
        user2.address,
        transferAmount
      );

      expect(await simpleDEX.balanceOf(user2.address))
        .to.equal(transferAmount);
    });
  });

  describe("Edge Cases and Branch Coverage Tests", function () {
    beforeEach(async function () {
      await tokenA.connect(user1).approve(simpleDEX.getAddress(), tokenConverter(5000));
      await tokenB.connect(user1).approve(simpleDEX.getAddress(), tokenConverter(5000));
    });

    // Test initial liquidity edge cases
    it("Should handle first liquidity provider edge cases", async function () {
      // Test zero total supply scenario
      expect(await simpleDEX.totalSupply()).to.equal(0);
      
      await simpleDEX.connect(user1).addLiquidity(
        tokenConverter(100),
        tokenConverter(100)
      );

      // Verify sqrt calculation for initial LP tokens
      expect(await simpleDEX.totalSupply()).to.equal(tokenConverter(100));
    });

    // Test non-initial liquidity provider edge cases
    it("Should handle subsequent liquidity providers with imbalanced amounts", async function () {
      // First provider adds balanced liquidity
      await simpleDEX.connect(user1).addLiquidity(
        tokenConverter(1000),
        tokenConverter(1000)
      );

      // Second provider tries to add imbalanced liquidity
      await tokenA.connect(user2).approve(simpleDEX.getAddress(), tokenConverter(2000));
      await tokenB.connect(user2).approve(simpleDEX.getAddress(), tokenConverter(1000));
      
      await simpleDEX.connect(user2).addLiquidity(
        tokenConverter(2000),
        tokenConverter(1000)
      );

      // Should receive LP tokens based on the smaller ratio
      const lpUser2 = await simpleDEX.balanceOf(user2.address);
      expect(lpUser2).to.equal(tokenConverter(1000));
    });

    // Test swap edge cases
    it("Should handle minimum output amount edge cases", async function () {
      // Add initial liquidity
      await simpleDEX.connect(user1).addLiquidity(
        tokenConverter(1000),
        tokenConverter(1000)
      );

      // Very small swap amount
      const tinyAmount = tokenConverter("0.0001");
      await tokenA.connect(user2).approve(simpleDEX.getAddress(), tinyAmount);
      
      await simpleDEX.connect(user2).swap(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        tinyAmount
      );

      // Verify reserves changed
      expect(await simpleDEX.reserveA()).to.not.equal(tokenConverter(1000));
    });

    // Test liquidity removal edge cases
    it("Should handle complete liquidity removal", async function () {
      // Add liquidity
      await simpleDEX.connect(user1).addLiquidity(
        tokenConverter(1000),
        tokenConverter(1000)
      );

      const lpBalance = await simpleDEX.balanceOf(user1.address);
      await simpleDEX.connect(user1).approve(simpleDEX.getAddress(), lpBalance);
      
      // Remove all liquidity
      await simpleDEX.connect(user1).removeLiquidity(lpBalance);

      // Verify reserves are zero
      expect(await simpleDEX.reserveA()).to.equal(0);
      expect(await simpleDEX.reserveB()).to.equal(0);
      expect(await simpleDEX.totalSupply()).to.equal(0);
    });

    // Test reentrance protection
    it("Should prevent reentrancy in liquidity operations", async function () {
      // Add initial liquidity
      await simpleDEX.connect(user1).addLiquidity(
        tokenConverter(1000),
        tokenConverter(1000)
      );

      const lpBalance = await simpleDEX.balanceOf(user1.address);
      await simpleDEX.connect(user1).approve(simpleDEX.getAddress(), lpBalance);

      // Try to add liquidity while removing liquidity (should fail)
      await expect(
        Promise.all([
          simpleDEX.connect(user1).removeLiquidity(lpBalance),
          simpleDEX.connect(user1).addLiquidity(
            tokenConverter(500),
            tokenConverter(500)
          )
        ])
      ).to.be.reverted;
    });

   

    // Test token approval edge cases
    it("Should handle token approval edge cases", async function () {
      // Try to add liquidity with insufficient approval
      await tokenA.connect(user1).approve(simpleDEX.getAddress(), tokenConverter(500));
      await tokenB.connect(user1).approve(simpleDEX.getAddress(), tokenConverter(1000));
      
      await expect(
        simpleDEX.connect(user1).addLiquidity(
          tokenConverter(1000),
          tokenConverter(1000)
        )
      ).to.be.reverted;
    });
  });

  describe("Additional Swap Edge Cases", function () {
    beforeEach(async function () {
      // Add initial liquidity
      await tokenA.connect(user1).approve(simpleDEX.getAddress(), tokenConverter(5000));
      await tokenB.connect(user1).approve(simpleDEX.getAddress(), tokenConverter(5000));
      await simpleDEX.connect(user1).addLiquidity(
        tokenConverter(5000),
        tokenConverter(5000)
      );
    });

    it("Should fail when swapping with invalid output token", async function () {
      await expect(
        simpleDEX.connect(user2).swap(
          await tokenA.getAddress(),
          ethers.ZeroAddress,
          tokenConverter(100)
        )
      ).to.be.revertedWith("Invalid output token");
    });

    it("Should fail when swapping with insufficient reserves", async function () {
      // Try to swap more than available in reserves
      const hugeAmount = tokenConverter(6000);
      await tokenA.connect(user2).approve(simpleDEX.getAddress(), hugeAmount);
      
      await expect(
        simpleDEX.connect(user2).swap(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          hugeAmount
        )
      ).to.be.reverted;
    });
  });

  describe("Additional Liquidity Edge Cases", function () {
    beforeEach(async function () {
      await tokenA.connect(user1).approve(simpleDEX.getAddress(), tokenConverter(5000));
      await tokenB.connect(user1).approve(simpleDEX.getAddress(), tokenConverter(5000));
    });

    it("Should fail when adding liquidity with insufficient token B balance", async function () {
      const amount = tokenConverter(11000); // More than user has
      await expect(
        simpleDEX.connect(user1).addLiquidity(
          tokenConverter(1000),
          amount
        )
      ).to.be.reverted;
    });

    it("Should fail when adding liquidity with insufficient token A balance", async function () {
      const amount = tokenConverter(11000); // More than user has
      await expect(
        simpleDEX.connect(user1).addLiquidity(
          amount,
          tokenConverter(1000)
        )
      ).to.be.reverted;
    });

    it("Should handle minimum liquidity check", async function () {
      // Try to add very small liquidity
      const tinyAmount = tokenConverter("0.000000000000000001");
      await expect(
        simpleDEX.connect(user1).addLiquidity(
          tinyAmount,
          tinyAmount
        )
      ).to.be.reverted;
    });
  });

  describe("Additional Edge Cases", function () {
    it("Should fail when removing liquidity with insufficient allowance", async function () {
      await simpleDEX.connect(user1).addLiquidity(
        tokenConverter(1000),
        tokenConverter(1000)
      );
      const lpBalance = await simpleDEX.balanceOf(user1.address);
      
      // Try to remove liquidity without approval
      await expect(
        simpleDEX.connect(user1).removeLiquidity(lpBalance)
      ).to.be.reverted;
    });

    it("Should handle zero transfers correctly", async function () {
      await expect(
        simpleDEX.connect(user1).transfer(user2.address, 0)
      ).to.be.reverted;
    });

    it("Should fail when transferring to zero address", async function () {
      await simpleDEX.connect(user1).addLiquidity(
        tokenConverter(1000),
        tokenConverter(1000)
      );
      
      await expect(
        simpleDEX.connect(user1).transfer(
          ethers.ZeroAddress,
          tokenConverter(100)
        )
      ).to.be.reverted;
    });
  });
});
