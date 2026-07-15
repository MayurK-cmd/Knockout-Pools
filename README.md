# Knockout Pools

**Trustless group betting on sports matches.** Your stake goes into a smart contract — not a person's wallet. The code enforces the rules: nobody can move the money except by the rules written into the contract.

Built for the **BuildAnything "Spark" hackathon** and deployed to **Monad testnet**.

---

## The problem

Group betting between friends normally means one person collects everyone's money and is trusted to pay out fairly and on time. That person is a single point of failure — they might be slow, they might make a mistake on the result, or they might just not pay up. Knockout Pools removes that person entirely: stakes sit in a smart contract, outcomes are proposed and disputed by the group itself, and payouts are enforced by code.

## How it works

1. Anyone creates a pool: pick a sport and match, a stake (MON), a join deadline (kickoff), and a dispute window.
2. Friends join by staking the same amount and picking an outcome.
3. After kickoff, the pool locks automatically. Joins close.
4. A participant proposes the result. The app prefills a suggested result, but a human always confirms before it's submitted on-chain.
5. A dispute window opens. Participants can dispute the proposed result.
6. After the window closes, anyone finalizes. Majority wins. Ties cancel the pool.
7. Winners claim their share of the pot. Cancelled pools refund everyone.

Supports 5 sports: football, cricket, Formula 1, basketball, tennis.

---

## Try it

```bash
# 1. Start the backend (reads from the contract on Monad testnet)
cd backend
cp .env.example .env
npm install
npm start

# 2. Start the frontend
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:8080`, connect your wallet (Monad testnet), and create or join a pool.

**Get testnet MON:** https://faucet.monad.xyz

---

## Architecture

```
Frontend (React + Vite, port 8080)
  ├── Wallet (RainbowKit + wagmi → Monad testnet)
  ├── Read layer (→ backend)
  └── Write layer (→ contract directly)

Backend (Express, port 3001)
  ├── Fast-sync from contract on startup
  ├── Live polling (8s interval) for new events
  ├── Name registry (persistent across restarts)
  └── Name registry (persistent across restarts)

Monad Testnet (chain ID 10143)
  └── KnockoutPool contract
      ├── Permissionless lock, finalize, dispute
      └── Reentrancy guard on all payouts
```

**Reads** go frontend → backend `/api/pools` → in-memory cache (fast-synced from contract).  
**Writes** (join, propose, claim, etc.) go frontend → wallet signer → Monad testnet contract directly.  
**The backend never holds keys, never signs transactions, and never decides a result.**

---

## Contract

**Network:** Monad Testnet (chain ID `10143`)
**Address:** [`0x2098FA95aEcf046790056ad19C2a1AE569e52c46`](https://testnet.monadvision.com/address/0x2098FA95aEcf046790056ad19C2a1AE569e52c46)
**Explorer:** [Monad Vision](https://testnet.monadvision.com)

| Function | Who can call |
|---|---|
| `createPool` | Anyone |
| `joinPool` | Anyone (before deadline, with correct stake) |
| `lockPool` | Anyone (after deadline) |
| `proposeResult` | Participants only (when locked) |
| `disputeResult` | Participants only (within window) |
| `finalize` | Anyone (after window closes) |
| `claimPayout` | Winners only (nonReentrant) |
| `claimRefund` | Participants only, when cancelled (nonReentrant) |

**Security:** reentrancy guard on all MON transfers. No owner, no upgrade path, no admin keys.

**Tests:** 9/9 passing.

---

## Backend endpoints

| Route | Description |
|---|---|
| `GET /api/pools` | All pools (optional `?status=open`) |
| `GET /api/pools/:id` | Single pool detail |
| `GET /api/pools/:id/participants` | Participant addresses |
| `POST /api/name` | Save display name for an address |
| `POST /api/names` | Bulk lookup names by addresses |
| `GET /api/name/:address` | Get name for an address |
| `GET /health` | Cache & block height |

---

## Features

- **Pool lifecycle**: Create → Join → Lock (auto) → Propose → Dispute → Finalize → Claim
- **Auto-lock**: Backend locks pools past their deadline using a permissionless signer
- **Fast-sync**: On startup, reads pool data directly from contract view functions (no log scanning)
- **Display names**: Names sync across browsers via the backend name registry
- **Share cards**: Download/copy/share finalized pool results as PNG images
- **Grain gradient**: Decorative animated grain texture on pool detail pages
- **Monad brand system**: Purple (#6E54FF), lavender (#DDD7FE), ink (#0E091C), Roboto Mono for numbers
- **5 sports**: Football, cricket, Formula 1, basketball, tennis

---

## Project layout

```
knockout-pools/
├── contracts/           # Hardhat + Solidity
│   ├── contracts/       # KnockoutPool.sol
│   ├── test/            # 9 passing tests
│   ├── scripts/         # deploy.js
│   └── hardhat.config.js
├── backend/             # Node.js + Express
│   └── src/
│       ├── server.js    # Express app + name registry
│       ├── listener.js  # Fast-sync + event polling
│       ├── cache.js     # In-memory pool state
│       ├── routes/      # REST API
│       └── contract/    # Contract artifact
├── frontend/            # React + Vite
│   └── src/
│       ├── components/  # Navbar, ShareCard, GrainGradient, etc.
│       ├── lib/         # pools (data layer), chain config, format utils
│       ├── routes/      # Landing, PoolList, CreatePool, PoolDetail, HowItWorks
│       └── contract/    # Contract artifact
└── README.md
```

---

## Technologies used

Solidity 0.8.20, Hardhat, ethers v6, wagmi + RainbowKit + viem, Node.js + Express, React 19, Vite, Tailwind CSS v4, shadcn/ui, GSAP, motion, react-spring, anime.js, html-to-image.

---

## Submission to BuildAnything "Spark"

- **Name**: Knockout Pools
- **Problem**: Group betting between friends requires trusting one person to hold and fairly distribute the money
- **Solution**: A permissionless smart contract state machine on Monad that holds stakes, lets participants propose/dispute results, and enforces payout by code — no admin, no custodian
- **Category**: Monad Testnet
- **Contract address**: [`0x2098FA95aEcf046790056ad19C2a1AE569e52c46`](https://testnet.monadvision.com/address/0x2098FA95aEcf046790056ad19C2a1AE569e52c46)
- **Demo video**: *link to video (max 3 min)*
- **Post URL**: *link to social media post*
