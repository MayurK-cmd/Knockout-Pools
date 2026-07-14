// scripts/deploy.js
// Deploys KnockoutPool, logs the address, and writes address+ABI to:
//   ../../backend/src/contract/KnockoutPool.json
//   ../../frontend/src/contract/KnockoutPool.json
// (creates the directories if they don't exist)

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const { ethers, network } = hre;

  console.log(`\nDeploying KnockoutPool to network: ${network.name}`);

  const KnockoutPool = await ethers.getContractFactory("KnockoutPool");
  const contract = await KnockoutPool.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const abi = KnockoutPool.interface.formatJson(); // string

  console.log(`\nKnockoutPool deployed to: ${address}`);
  console.log(`Transaction hash: ${contract.deploymentTransaction().hash}`);

  // Build the artifact blob to write
  const artifact = {
    address,
    network: network.name,
    chainId: network.config?.chainId ?? null,
    abi: JSON.parse(abi),
  };

  // Write to backend and frontend at the relative paths the project spec specifies
  const targets = [
    path.resolve(__dirname, "../../backend/src/contract/KnockoutPool.json"),
    path.resolve(__dirname, "../../frontend/src/contract/KnockoutPool.json"),
  ];

  for (const target of targets) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(artifact, null, 2));
    console.log(`Wrote artifact: ${target}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
