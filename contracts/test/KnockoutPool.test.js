// test/KnockoutPool.test.js
// Hardhat + ethers v6 + chai. Covers all 9 scenarios from the contract spec.

const { expect } = require("chai");
const { ethers } = require("hardhat");

const STAKE = ethers.parseEther("0.01");
const OUTCOMES = ["Brazil", "Draw", "Argentina"];

// Default pool params for tests: join deadline 60s in the future, dispute
// window 60s. The helpers below advance EVM time across these boundaries.
const DEFAULT_JOIN_DELTA = 60;
const DEFAULT_DISPUTE = 60;

async function createPool({
  poolContract,
  creator,
  matchName = "Brazil vs Argentina",
  outcomeLabels = OUTCOMES,
  stakeAmount = STAKE,
  disputeWindowSeconds = DEFAULT_DISPUTE,
  joinDeltaSeconds = DEFAULT_JOIN_DELTA,
}) {
  // Read the latest block's timestamp BEFORE we send the tx so the deadline
  // is strictly in the future relative to the block that will mine createPool.
  const latest = await ethers.provider.getBlock("latest");
  const joinDeadline = latest.timestamp + joinDeltaSeconds;
  const tx = await poolContract
    .connect(creator)
    .createPool(matchName, outcomeLabels, stakeAmount, joinDeadline, disputeWindowSeconds);
  const receipt = await tx.wait();
  const event = receipt.logs
    .map((l) => {
      try {
        return poolContract.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((p) => p && p.name === "PoolCreated");
  return { poolId: event.args.poolId, joinDeadline, disputeWindowSeconds };
}

async function join(poolContract, poolId, user, pick) {
  const tx = await poolContract.connect(user).joinPool(poolId, pick, { value: STAKE });
  await tx.wait();
}

async function lock(poolContract, poolId) {
  const tx = await poolContract.lockPool(poolId);
  await tx.wait();
}

async function propose(poolContract, poolId, proposer, result) {
  const tx = await poolContract.connect(proposer).proposeResult(poolId, result);
  await tx.wait();
}

async function dispute(poolContract, poolId, user, result) {
  const tx = await poolContract.connect(user).disputeResult(poolId, result);
  await tx.wait();
}

async function advance(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

/// Advance time past the join deadline. Use before lockPool.
async function crossJoinDeadline(joinDeadline) {
  const latest = await ethers.provider.getBlock("latest");
  const delta = joinDeadline - latest.timestamp + 1;
  if (delta > 0) await advance(delta);
}

/// Advance time past the dispute window. Use before finalize.
async function crossDisputeWindow(disputeWindowSeconds) {
  await advance(disputeWindowSeconds + 1);
}

describe("KnockoutPool", function () {
  let pool;
  let owner, alice, bob, carol, dave;

  beforeEach(async () => {
    [owner, alice, bob, carol, dave] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("KnockoutPool");
    pool = await Factory.deploy();
    await pool.waitForDeployment();
  });

  // 1. Happy path
  describe("1. Happy path (undisputed)", () => {
    it("creates, has 3 users join different picks, locks, proposes, finalizes, winners claim", async () => {
      const { poolId, joinDeadline, disputeWindowSeconds } = await createPool({
        poolContract: pool,
        creator: owner,
      });
      await join(pool, poolId, alice, 0);
      await join(pool, poolId, bob, 1);
      await join(pool, poolId, carol, 2);

      await crossJoinDeadline(joinDeadline);
      await lock(pool, poolId);
      await propose(pool, poolId, alice, 0);

      await crossDisputeWindow(disputeWindowSeconds);
      await pool.finalize(poolId);

      const p = await pool.getPool(poolId);
      expect(p.status).to.equal(3); // FINALIZED
      expect(p.finalResult).to.equal(0);

      const pot = STAKE * 3n;
      const winnerCount = 1n; // only alice picked 0
      const payout = pot / winnerCount;

      const aliceBalBefore = await ethers.provider.getBalance(alice.address);
      const claimTx = await pool.connect(alice).claimPayout(poolId);
      const claimReceipt = await claimTx.wait();
      const gasUsed = claimReceipt.gasUsed * claimReceipt.gasPrice;
      const aliceBalAfter = await ethers.provider.getBalance(alice.address);

      expect(aliceBalAfter + gasUsed - aliceBalBefore).to.equal(payout);

      await expect(pool.connect(bob).claimPayout(poolId)).to.be.revertedWith(
        "did not pick winner"
      );
      await expect(pool.connect(carol).claimPayout(poolId)).to.be.revertedWith(
        "did not pick winner"
      );
    });
  });

  // 2. Dispute path
  describe("2. Dispute path (majority vote)", () => {
    it("tallies majority and pays out the correct winner", async () => {
      const { poolId, joinDeadline, disputeWindowSeconds } = await createPool({
        poolContract: pool,
        creator: owner,
      });
      // alice=0, bob=1, carol=0, dave=1
      await join(pool, poolId, alice, 0);
      await join(pool, poolId, bob, 1);
      await join(pool, poolId, carol, 0);
      await join(pool, poolId, dave, 1);

      await crossJoinDeadline(joinDeadline);
      await lock(pool, poolId);
      // owner proposes 1
await propose(pool, poolId, alice, 1);

      // bob and dave dispute with 1 to match their picks
      await dispute(pool, poolId, bob, 1);
      await dispute(pool, poolId, dave, 1);

      await crossDisputeWindow(disputeWindowSeconds);
      await pool.finalize(poolId);

      const p = await pool.getPool(poolId);
      expect(p.status).to.equal(3); // FINALIZED
      // Tally: alice (proposer) votes 1, bob disputes with 1, dave disputes with 1.
      // Counts: 1 -> 3. Majority 1.
      expect(p.finalResult).to.equal(1);

      // winners are bob and dave (picked 1)
      const pot = STAKE * 4n;
      const winnerCount = 2n;
      const payout = pot / winnerCount;

      const bobBalBefore = await ethers.provider.getBalance(bob.address);
      const txB = await pool.connect(bob).claimPayout(poolId);
      const rB = await txB.wait();
      const gasB = rB.gasUsed * rB.gasPrice;
      expect(
        (await ethers.provider.getBalance(bob.address)) + gasB - bobBalBefore
      ).to.equal(payout);

      const daveBalBefore = await ethers.provider.getBalance(dave.address);
      const txD = await pool.connect(dave).claimPayout(poolId);
      const rD = await txD.wait();
      const gasD = rD.gasUsed * rD.gasPrice;
      expect(
        (await ethers.provider.getBalance(dave.address)) + gasD - daveBalBefore
      ).to.equal(payout);

      await expect(pool.connect(alice).claimPayout(poolId)).to.be.revertedWith(
        "did not pick winner"
      );
      await expect(pool.connect(carol).claimPayout(poolId)).to.be.revertedWith(
        "did not pick winner"
      );
    });
  });

  // 3. Tie vote -> CANCELLED -> all claimRefund
  describe("3. Tie vote -> CANCELLED -> refunds", () => {
    it("cancels the pool on a tie and lets everyone refund", async () => {
      const { poolId, joinDeadline, disputeWindowSeconds } = await createPool({
        poolContract: pool,
        creator: owner,
      });
      await join(pool, poolId, alice, 0);
      await join(pool, poolId, bob, 1);

      await crossJoinDeadline(joinDeadline);
      await lock(pool, poolId);
      // owner proposes 0
      await propose(pool, poolId, alice, 0);
      // bob disputes with 1 -> tie: 0 (owner) vs 1 (bob)
      await dispute(pool, poolId, bob, 1);

      await crossDisputeWindow(disputeWindowSeconds);
      await pool.finalize(poolId);

      const p = await pool.getPool(poolId);
      expect(p.status).to.equal(4); // CANCELLED

      const a1 = await ethers.provider.getBalance(alice.address);
      const txA = await pool.connect(alice).claimRefund(poolId);
      const rA = await txA.wait();
      const gasA = rA.gasUsed * rA.gasPrice;
      expect((await ethers.provider.getBalance(alice.address)) + gasA - a1).to.equal(
        STAKE
      );

      const b1 = await ethers.provider.getBalance(bob.address);
      const txB = await pool.connect(bob).claimRefund(poolId);
      const rB = await txB.wait();
      const gasB = rB.gasUsed * rB.gasPrice;
      expect((await ethers.provider.getBalance(bob.address)) + gasB - b1).to.equal(
        STAKE
      );
    });
  });

  // 4. Zero winners -> CANCELLED -> refunds
  describe("4. Zero winners -> CANCELLED -> refunds", () => {
    it("cancels when no one picked the chosen result", async () => {
      const { poolId, joinDeadline, disputeWindowSeconds } = await createPool({
        poolContract: pool,
        creator: owner,
      });
      // Everyone picks 1, but the proposal is 0
      await join(pool, poolId, alice, 1);
      await join(pool, poolId, bob, 1);

      await crossJoinDeadline(joinDeadline);
      await lock(pool, poolId);
      // Undisputed: owner proposes 0
      await propose(pool, poolId, alice, 0);

      await crossDisputeWindow(disputeWindowSeconds);
      await pool.finalize(poolId);

      const p = await pool.getPool(poolId);
      expect(p.status).to.equal(4); // CANCELLED
      expect(p.finalResult).to.equal(0);

      const a1 = await ethers.provider.getBalance(alice.address);
      const txA = await pool.connect(alice).claimRefund(poolId);
      const rA = await txA.wait();
      const gasA = rA.gasUsed * rA.gasPrice;
      expect((await ethers.provider.getBalance(alice.address)) + gasA - a1).to.equal(
        STAKE
      );

      const b1 = await ethers.provider.getBalance(bob.address);
      const txB = await pool.connect(bob).claimRefund(poolId);
      const rB = await txB.wait();
      const gasB = rB.gasUsed * rB.gasPrice;
      expect((await ethers.provider.getBalance(bob.address)) + gasB - b1).to.equal(
        STAKE
      );
    });
  });

  // 5. Cannot join after deadline
  describe("5. Cannot join after deadline", () => {
    it("reverts join after joinDeadline passes", async () => {
      const { poolId, joinDeadline } = await createPool({
        poolContract: pool,
        creator: owner,
        joinDeltaSeconds: 5,
      });
      await crossJoinDeadline(joinDeadline);
      await expect(
        pool.connect(alice).joinPool(poolId, 0, { value: STAKE })
      ).to.be.revertedWith("join deadline passed");
    });
  });

  // 6. Cannot join twice
  describe("6. Cannot join twice", () => {
    it("reverts when an address tries to join the same pool twice", async () => {
      const { poolId } = await createPool({ poolContract: pool, creator: owner });
      await join(pool, poolId, alice, 0);
      await expect(
        pool.connect(alice).joinPool(poolId, 0, { value: STAKE })
      ).to.be.revertedWith("already joined");
    });
  });

  // 7. Cannot claim twice
  describe("7. Cannot claim twice", () => {
    it("reverts a second claimPayout from the same winner", async () => {
      const { poolId, joinDeadline, disputeWindowSeconds } = await createPool({
        poolContract: pool,
        creator: owner,
      });
      await join(pool, poolId, alice, 0);
      await join(pool, poolId, bob, 1);
      await crossJoinDeadline(joinDeadline);
      await lock(pool, poolId);
      await propose(pool, poolId, alice, 0);
      await crossDisputeWindow(disputeWindowSeconds);
      await pool.finalize(poolId);

      await pool.connect(alice).claimPayout(poolId);
      await expect(pool.connect(alice).claimPayout(poolId)).to.be.revertedWith(
        "already claimed"
      );
    });
  });

  // 8. Cannot finalize before window closes
  describe("8. Cannot finalize before window closes", () => {
    it("reverts finalize while still in dispute window", async () => {
      const { poolId, joinDeadline } = await createPool({
        poolContract: pool,
        creator: owner,
      });
      await join(pool, poolId, alice, 0);
      await crossJoinDeadline(joinDeadline);
      await lock(pool, poolId);
      await propose(pool, poolId, alice, 0);

      // No additional time advance -> still inside the dispute window
      await expect(pool.finalize(poolId)).to.be.revertedWith(
        "dispute window still open"
      );
    });
  });

  // 9. Cannot dispute after window closes
  describe("9. Cannot dispute after window closes", () => {
    it("reverts dispute after disputeWindowSeconds has elapsed", async () => {
      const { poolId, joinDeadline, disputeWindowSeconds } = await createPool({
        poolContract: pool,
        creator: owner,
      });
      await join(pool, poolId, alice, 0);
      await crossJoinDeadline(joinDeadline);
      await lock(pool, poolId);
      await propose(pool, poolId, alice, 0);

      // pass the dispute window
      await crossDisputeWindow(disputeWindowSeconds);

      await expect(pool.connect(alice).disputeResult(poolId, 1)).to.be.revertedWith(
        "dispute window closed"
      );
    });
  });
});
