# Knockout Pools

**Trustless group betting on sports matches.** Your stake goes into a smart
contract — not a person's wallet. The code enforces the rules: nobody can
move the money except by the rules written into the contract.

Built for the **BuildAnything "Spark" hackathon** and deployed to
**Monad testnet**.

---

## The problem

Group betting between friends normally means one person collects everyone's
money and is trusted to pay out fairly and on time. That person is a single
point of failure — they might be slow, they might make a mistake on the
result, or they might just not pay up. Knockout Pools removes that person
entirely: stakes sit in a smart contract, outcomes are proposed and disputed
by the group itself, and payouts are enforced by code.

## How it works

1. Anyone creates a pool: pick a sport and match, a stake (MON), a join
   deadline (kickoff), and a dispute window.
2. Friends join by staking the same amount and picking an outcome.
3. After kickoff, someone locks the pool. Joins close.
4. Anyone proposes a result. The app suggests the real result pulled from a
   live sports API, but a human always confirms before it's submitted
   on-chain — the API is advisory, never authoritative, so the contract
   never has to trust an external data feed.
5. A dispute window opens. Participants can dispute the proposed result.
6. After the window closes, anyone finalizes. If nobody disputed, the
   proposed result becomes final. If disputed, participant votes are
   tallied and the majority wins. Ties cancel the pool.
7. Winners claim their share of the pot. Losers get nothing. Cancelled
   pools refund everyone.

Supports 5 sports: football, cricket, Formula 1, and two more — see the
sports API integration for the current list.

---

## Architecture

```
┌──────────────────────────────────────────────┐
│  Frontend (React + Vite, port 8080)          │
│  ┌─────────┐ ┌──────────────┐ ┌───────────┐  │
│  │ Wallet  │ │  Read layer  │ │ Write     │  │
│  │(RainbowKit│ (React Query │ │ layer     │  │
│  │ + wagmi)│ │  → backend)  │ │ (wagmi →  │  │
│  └─────────┘ └──────┬───────┘ │ contract) │  │
│                     │         └─────┬─────┘  │
└─────────────────────┼───────────────┼────────┘
                      │               │
                ┌─────▼────┐   ┌─────▼──────┐
                │ Backend  │   │   Monad    │
                │ Express  │   │  Testnet   │
                │ port 3001│   │  Contract  │
                │ (cache + │   └─────▲──────┘
                │ sports   │         │
                │ API feed)│         │
                └─────▲────┘         │
                      │               │
                ┌─────┴───────────────┴──┐
                │  Event listener (ethers)│
                │  getLogs + polling       │
                └────────────────────────┘
```

**Reads** go frontend → backend `/api/pools` → in-memory cache (rebuilt from
chain events), plus a suggested-result feed pulled from a sports API.

**Writes** (join, propose, claim, etc.) go frontend → wallet signer →
Monad testnet contract directly.

**The backend is a fast read cache + sports-data helper only.** It never
holds keys, never signs, never writes to the chain, and never decides a
result on its own — every on-chain action requires a human-signed
transaction.

---

## Contract (`contracts/`)

**Network:** Monad Testnet (chain ID `10143`)
**Address:** `<fill in after deploying>`
**Explorer:** https://testnet.monadscan.com

Solidity ^0.8.20 (viaIR: true). State machine per pool:

```
OPEN → LOCKED → DISPUTE_WINDOW → FINALIZED
  ↓        ↓          ↓              ↓
  join    lock      propose       finalize
```

| Function | Who can call |
|---|---|
| `createPool` | Anyone |
| `joinPool` | Anyone (before deadline, with correct stake) |
| `lockPool` | Anyone (after deadline) |
| `proposeResult` | Anyone (when locked) |
| `disputeResult` | Participants only (within window) |
| `finalize` | Anyone (after window closes) |
| `claimPayout` | Winners only (nonReentrant) |
| `claimRefund` | Participants only, when cancelled (nonReentrant) |

**Security**: reentrancy guard + checks-effects-interactions on all MON
transfers. No owner, no upgrade path, no admin keys.

**Tests**: 9/9 passing (happy path, dispute, tie-cancel, zero-winners-cancel,
deadline edge cases, double-claim rejection).

---

## Backend (`backend/`)

Node.js + Express, zero database. The in-memory cache is derived purely
from chain event history; the sports-result feed is a thin polling layer
per supported sport.

**Setup:**

```bash
cd backend
cp .env.example .env     # edit MONAD_TESTNET_RPC_URL, contract address, sports API key
npm install
npm start                # runs on port 3001
```

**Endpoints:**

| Route | Description |
|---|---|
| `GET /api/pools` | All pools (optional `?status=open`) |
| `GET /api/pools/:id` | Single pool detail |
| `GET /api/pools/:id/participants` | Participant addresses |
| `GET /api/pools/:id/suggested-result` | Live result from the sports API, for the propose-result UI to prefill (advisory only) |
| `GET /health` | Cache & block height |

**Event listener**:
- Startup: replays historical `getLogs` in chunks (tuned to Monad's RPC
  provider limits).
- Live: polls for new events, interval tuned for Monad's block time.
- Backoff: exponential backoff on rate limits with a graceful give-up
  (polling catches up).

---

## Frontend (`frontend/`)

React 19 + TanStack Router + TanStack React Query + Vite + Tailwind CSS.
Lovable-generated UI using Monad's brand colors and type system.

**Setup:**

```bash
cd frontend
cp .env.example .env     # VITE_MONAD_TESTNET_RPC_URL, VITE_CONTRACT_ADDRESS, VITE_BACKEND_URL
npm install
npm run dev              # runs on port 8080
```

**Wallet**: RainbowKit + wagmi, configured for Monad testnet. Standard
browser wallet connect flow — no custom seed handling, no insecure local
storage of key material.

**Data flow**: `usePools()` / `usePool(id)` hit the backend with polling.
The contract-write hooks (`useCreatePool`, `useJoinPool`, `useProposeResult`,
`useDispute`, `useFinalize`, `useClaimPayout`, `useClaimRefund`) call wagmi
write methods against the Monad testnet contract.

---

## Project layout

```
knockout-pools/
├── contracts/           # Hardhat + Solidity
│   ├── contracts/       # KnockoutPool.sol
│   ├── test/             # 9 passing tests
│   ├── scripts/         # deploy.js
│   └── hardhat.config.js
├── backend/             # Node.js + Express
│   └── src/
│       ├── server.js    # Express app + listener startup
│       ├── listener.js  # Event replay + polling
│       ├── cache.js     # In-memory pool state
│       ├── sports/       # Sports API adapters (football, cricket, F1, +2)
│       ├── routes/      # REST API
│       └── contract/    # Contract artifact (ABI + address)
├── frontend/            # React + Vite
│   └── src/
│       ├── components/  # UI (Lovable-generated, Monad brand system)
│       ├── hooks/       # useContract, useWallet
│       ├── lib/         # pools (data layer), format, utils
│       ├── routes/      # TanStack Router pages
│       └── contract/    # Contract artifact (ABI + address)
└── README.md
```

---

## Security note

This project is a **hackathon submission**, not a production financial
application.

- **Wallets**: RainbowKit-managed browser wallet connection — key material
  never touches this app's code or storage.
- **Contract**: no audit, no formal verification, no fuzzing. It passes
  unit tests and has basic reentrancy protection. A production deployment
  would need an external audit.
- **Timestamp**: relies on `block.timestamp` for deadlines. Validators can
  shift timestamps by seconds. Acceptable for testnet; mainnet should use
  larger windows.
- **Sports data**: the sports API feed is advisory only — it prefills a
  suggested result for convenience, but every result must be explicitly
  proposed and signed by a human, and can always be disputed by
  participants. The contract has no dependency on the API being correct,
  available, or trustworthy.

---

## Submitting to BuildAnything "Spark"

- **Name**: Knockout Pools
- **Problem**: Group betting between friends normally requires trusting one
  person to hold and fairly distribute the money.
- **Solution**: A permissionless smart contract state machine on Monad that
  holds stakes, lets the group itself propose/dispute results, and enforces
  payout by code — no admin, no custodian.
- **Category**: Monad Testnet
- **Contract address**: see above
- **Demo video**: create → join → lock → propose (with live sports
  suggestion) → dispute → finalize → claim, end to end
- **Post URL**: consider a share-card generator for a winning pool's payout
  as the social post itself

**Technologies used**: Solidity 0.8.20, Hardhat, wagmi + RainbowKit,
Node.js + Express, React 19, TanStack React Query, TanStack Router, Vite,
Tailwind CSS, GSAP, react-spring, motion, anime.js.
