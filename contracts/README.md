# Knockout Pools — Smart Contract

**KnockoutPool.sol** — trustless group betting pool for football matches (or any 3-outcome event).

## Network

| | |
|---|---|
| **Chain** | Monad Testnet |
| **Chain ID** | `10143` |
| **Contract address** | [`0xEe39002BF9783DB5dac224Df968D0e3c5CE39a2B`](https://testnet.monadscan.com/address/0xEe39002BF9783DB5dac224Df968D0e3c5CE39a2B) |
| **Explorer** | [Monadscan](https://testnet.monadscan.com) |
| **RPC** | `https://testnet-rpc.monad.xyz` |

## Contract

Solidity ^0.8.20 (viaIR: true). State machine per pool:

```
OPEN → LOCKED → DISPUTE_WINDOW → FINALIZED
  ↓        ↓          ↓              ↓
  join    lock      propose       finalize
```

## Setup

```bash
cd contracts
cp .env.example .env     # edit MONAD_TESTNET_RPC_URL and PRIVATE_KEY
npm install
```

## Commands

| Command | Description |
|---|---|
| `npm run compile` | Compile Solidity |
| `npm test` | Run the 9-test suite |
| `npm run deploy:monadTestnet` | Deploy to Monad testnet |
| `npm run deploy:localhost` | Deploy to local Hardhat node |

## Deploy output

The deploy script writes a JSON artifact containing the address, ABI, and chain info to:
- `backend/src/contract/KnockoutPool.json`
- `frontend/src/contract/KnockoutPool.json`

## Tests

9 tests covering: happy path (undisputed), dispute majority vote, tie → cancel, zero-winners → cancel, deadline edge cases, double-claim rejection.
