const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("SwapModule", (m) => {
  // Déployer les tokens personnalisés
  const tokenA = m.contract("MyTokenA", [], { 
    id: "TokenAContract" 
  });
  
  const tokenB = m.contract("MyTokenB", [], { 
    id: "TokenBContract" 
  });
  
  // Définir un fee receiver (par exemple, le premier compte)
  const feeReceiver = m.getAccount(0);

  // Déployer le swap en passant les tokens et le fee receiver
  const swap = m.contract("SimpleDEX", [
    tokenA,  // adresse du token A
    tokenB,  // adresse du token B
    feeReceiver  // adresse qui recevra les frais
  ], {
    id: "SwapDEXContract"
  });

  return { tokenA, tokenB, swap };
});