const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Blockchain DEX Testing Suite", function () {
  let owner, user1, user2, feeReceiver;
  let tokenA, tokenB, simpleDEX;

  // Utilitaire pour convertir les tokens avec des décimales
  const tokenConverter = (amount) => {
    return ethers.parseUnits(amount.toString(), 18);
  };

  beforeEach(async function () {
    // Déploiement des contrats avant chaque test
    [owner, user1, user2, feeReceiver] = await ethers.getSigners();

    // Déployer les tokens
    const MyTokenA = await ethers.getContractFactory("MyTokenA");
    const MyTokenB = await ethers.getContractFactory("MyTokenB");
    tokenA = await MyTokenA.deploy();
    tokenB = await MyTokenB.deploy();

    // Distribuer des tokens aux utilisateurs
    await tokenA.transfer(user1.address, tokenConverter(10000));
    await tokenB.transfer(user1.address, tokenConverter(10000));
    await tokenA.transfer(user2.address, tokenConverter(10000));
    await tokenB.transfer(user2.address, tokenConverter(10000));

    // Déployer le DEX
    const SimpleDEX = await ethers.getContractFactory("SimpleDEX");
    simpleDEX = await SimpleDEX.deploy(
      tokenA.getAddress(), 
      tokenB.getAddress(), 
      feeReceiver.address
    );
  });

  describe("Token Deployment Tests", function () {
    it("Should deploy tokens with correct initial supply", async function () {
      expect(await tokenA.totalSupply()).to.equal(tokenConverter(1000000));
      expect(await tokenB.totalSupply()).to.equal(tokenConverter(1000000));
    });

    it("Should distribute tokens to test users", async function () {
      expect(await tokenA.balanceOf(user1.address)).to.equal(tokenConverter(10000));
      expect(await tokenB.balanceOf(user1.address)).to.equal(tokenConverter(10000));
    });
  });

  describe("DEX Initialization Tests", function () {
    it("Should initialize DEX with correct tokens", async function () {
      expect(await simpleDEX.tokenA()).to.equal(await tokenA.getAddress());
      expect(await simpleDEX.tokenB()).to.equal(await tokenB.getAddress());
      expect(await simpleDEX.feeReceiver()).to.equal(feeReceiver.address);
    });
  });

  describe("Liquidity Management Tests", function () {
    beforeEach(async function () {
      // Approuver les dépenses de tokens pour le DEX
      await tokenA.connect(user1).approve(simpleDEX.getAddress(), tokenConverter(5000));
      await tokenB.connect(user1).approve(simpleDEX.getAddress(), tokenConverter(5000));
    });

    it("Should add initial liquidity", async function () {
      const amountA = tokenConverter(1000);
      const amountB = tokenConverter(1000);

      // Ajouter de la liquidité
      await simpleDEX.connect(user1).addLiquidity(amountA, amountB);

      // Vérifier les réserves
      expect(await simpleDEX.reserveA()).to.equal(amountA);
      expect(await simpleDEX.reserveB()).to.equal(amountB);
    });

    it("Should mint LP tokens proportionally", async function () {
      const amountA = tokenConverter(1000);
      const amountB = tokenConverter(1000);

      await simpleDEX.connect(user1).addLiquidity(amountA, amountB);

      // Vérifier l'émission de LP tokens
      const lpTokenBalance = await simpleDEX.balanceOf(user1.address);
      expect(lpTokenBalance).to.be.gt(0);
    });

    it("Should prevent adding liquidity with zero amounts", async function () {
      await expect(
        simpleDEX.connect(user1).addLiquidity(0, tokenConverter(1000))
      ).to.be.revertedWith("Invalid amounts");
    });

    it("Should remove liquidity correctly", async function () {
      // Ajouter de la liquidité initiale
      const amountA = tokenConverter(1000);
      const amountB = tokenConverter(1000);
      await tokenA.connect(user1).approve(simpleDEX.getAddress(), amountA);
      await tokenB.connect(user1).approve(simpleDEX.getAddress(), amountB);
      await simpleDEX.connect(user1).addLiquidity(amountA, amountB);

      // Obtenir le solde de LP tokens
      const lpTokenBalance = await simpleDEX.balanceOf(user1.address);

      // Approuver et retirer la liquidité
      await simpleDEX.connect(user1).approve(simpleDEX.getAddress(), lpTokenBalance);
      const removeTx = await simpleDEX.connect(user1).removeLiquidity(lpTokenBalance);

      // Vérifier les événements et les soldes
      await expect(removeTx)
        .to.emit(simpleDEX, "LiquidityRemoved")
        .withArgs(user1.address, amountA, amountB);
    });
  });

  describe("Swap Functionality Tests", function () {
    beforeEach(async function () {
      // Ajouter de la liquidité initiale
      const amountA = tokenConverter(5000);
      const amountB = tokenConverter(5000);
      await tokenA.connect(user1).approve(simpleDEX.getAddress(), amountA);
      await tokenB.connect(user1).approve(simpleDEX.getAddress(), amountB);
      await simpleDEX.connect(user1).addLiquidity(amountA, amountB);

      // Approuver les tokens pour l'échange
      await tokenA.connect(user2).approve(simpleDEX.getAddress(), tokenConverter(1000));
      await tokenB.connect(user2).approve(simpleDEX.getAddress(), tokenConverter(1000));
    });

    it("Should swap tokens with correct fee calculation", async function () {
      const swapAmount = tokenConverter(100);
      const tokenAAddress = await tokenA.getAddress();
      const tokenBAddress = await tokenB.getAddress();

      const initialBalanceA = await tokenA.balanceOf(user2.address);
      const initialFeeReceiverBalanceA = await tokenA.balanceOf(feeReceiver.address);

      // Échanger des tokens A contre des tokens B
      await simpleDEX.connect(user2).swap(tokenAAddress, tokenBAddress, swapAmount);

      const finalBalanceA = await tokenA.balanceOf(user2.address);
      const finalFeeReceiverBalanceA = await tokenA.balanceOf(feeReceiver.address);

      // Vérifier la taxe de 0.5%
      const expectedFee = swapAmount * 5n / 1000n;
      expect(finalFeeReceiverBalanceA - initialFeeReceiverBalanceA).to.equal(expectedFee);
    });

    it("Should prevent swapping the same token", async function () {
      const tokenAAddress = await tokenA.getAddress();
      await expect(
        simpleDEX.connect(user2).swap(tokenAAddress, tokenAAddress, tokenConverter(100))
      ).to.be.revertedWith("Cannot swap same token");
    });

    it("Should prevent swapping with invalid tokens", async function () {
      await expect(
        simpleDEX.connect(user2).swap(
          ethers.ZeroAddress, 
          await tokenA.getAddress(), 
          tokenConverter(100)
        )
      ).to.be.revertedWith("Invalid input token");
    });
  });

  /*describe("Reentrancy Protection Tests", function () {
    it("Should prevent reentrancy during addLiquidity", async function () {
        // Ajouter une première liquidité
        await simpleDEX.connect(user1).addLiquidity(
          tokenConverter(1000), 
          tokenConverter(1000)
        );
      
        // Créer un contrat malveillant simulé avec une fonction qui rappelle addLiquidity
        const MaliciousContract = await ethers.getContractFactory("MaliciousReentrancyContract");
        const maliciousContract = await MaliciousContract.deploy(
          simpleDEX.getAddress(), 
          tokenA.getAddress(), 
          tokenB.getAddress()
        );
      
        // Transférer des tokens au contrat malveillant
        await tokenA.transfer(maliciousContract.getAddress(), tokenConverter(2000));
        await tokenB.transfer(maliciousContract.getAddress(), tokenConverter(2000));
      
        // Approuver les tokens pour que le DEX puisse les transférer
        await maliciousContract.approveTokensForDEX(
          simpleDEX.getAddress(),
          tokenConverter(2000),
          tokenConverter(2000)
        );
      
        // Tenter l'attaque de réentrance
        await expect(
          maliciousContract.attackAddLiquidity(
            tokenConverter(100), 
            tokenConverter(100)
          )
        ).to.be.revertedWith("Reentrant call");
      });*/
      
  });
