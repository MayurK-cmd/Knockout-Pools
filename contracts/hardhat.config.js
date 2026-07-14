require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { MONAD_TESTNET_RPC_URL, PRIVATE_KEY } = process.env;

const monadAccounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    // Local Hardhat node (run `npx hardhat node`)
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // Monad testnet — RPC + signer come from .env
    monadTestnet: {
      url: MONAD_TESTNET_RPC_URL || "https://testnet-rpc.monad.xyz/",
      accounts: monadAccounts,
      chainId: 10143,
    },
  },
};
