// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title KnockoutPool
/// @notice Trustless group betting pool for football matches (or any 3-outcome event).
/// State machine per pool:
///   OPEN -> LOCKED (after joinDeadline passes, anyone can call lockPool)
///   LOCKED -> DISPUTE_WINDOW (after someone calls proposeResult)
///   DISPUTE_WINDOW -> FINALIZED (if no dispute before window closes, anyone calls finalize)
///   DISPUTE_WINDOW -> FINALIZED or CANCELLED (if disputed, majority vote on finalize; tie -> CANCELLED)
///   Any state -> CANCELLED (if zero winners on finalize)
contract KnockoutPool {
    enum PoolStatus {
        OPEN,
        LOCKED,
        DISPUTE_WINDOW,
        FINALIZED,
        CANCELLED
    }

    struct Pool {
        address creator;
        string matchName;
        string[3] outcomeLabels;
        uint256 stakeAmount;            // in wei, fixed per pool
        uint256 joinDeadline;           // timestamp
        uint256 disputeWindowSeconds;   // configurable, default 600 for demo
        PoolStatus status;
        address[] participants;
        mapping(address => uint8) picks;       // 0, 1, or 2
        mapping(address => bool) hasJoined;
        uint8 proposedResult;
        address resultProposer;
        uint256 proposedAt;
        mapping(address => uint8) disputeVotes;
        mapping(address => bool) hasDisputed; // track who actually disputed
        bool disputed;
        uint8 finalResult;
        mapping(address => bool) claimed;
    }

    // Simple reentrancy guard
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status = _NOT_ENTERED;

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    Pool[] private pools;
    uint256 public poolCount;

    // ---------- Events ----------
    event PoolCreated(
        uint256 indexed poolId,
        address indexed creator,
        string matchName,
        uint256 stakeAmount,
        uint256 joinDeadline
    );
    event BetPlaced(uint256 indexed poolId, address indexed participant, uint8 pick);
    event PoolLocked(uint256 indexed poolId);
    event ResultProposed(uint256 indexed poolId, address indexed proposer, uint8 result);
    event ResultDisputed(uint256 indexed poolId, address indexed disputer, uint8 theirResult);
    event PoolFinalized(uint256 indexed poolId, uint8 finalResult);
    event PoolCancelled(uint256 indexed poolId);
    event PayoutClaimed(uint256 indexed poolId, address indexed participant, uint256 amount);
    event RefundClaimed(uint256 indexed poolId, address indexed participant, uint256 amount);

    // ---------- Pool lifecycle ----------
    /// @notice Create a new pool.
    function createPool(
        string memory matchName,
        string[3] memory outcomeLabels,
        uint256 stakeAmount,
        uint256 joinDeadline,
        uint256 disputeWindowSeconds
    ) external returns (uint256) {
        require(bytes(matchName).length > 0, "matchName required");
        require(stakeAmount > 0, "stake must be > 0");
        require(joinDeadline > block.timestamp, "joinDeadline must be in future");
        require(disputeWindowSeconds > 0, "disputeWindow must be > 0");

        pools.push();
        uint256 poolId = pools.length - 1;
        poolCount = pools.length;

        Pool storage p = pools[poolId];
        p.creator = msg.sender;
        p.matchName = matchName;
        p.outcomeLabels = outcomeLabels;
        p.stakeAmount = stakeAmount;
        p.joinDeadline = joinDeadline;
        p.disputeWindowSeconds = disputeWindowSeconds;
        p.status = PoolStatus.OPEN;

        emit PoolCreated(poolId, msg.sender, matchName, stakeAmount, joinDeadline);
        return poolId;
    }

    /// @notice Join a pool by staking exactly `stakeAmount` of ETH and submitting a pick.
    function joinPool(uint256 poolId, uint8 pick) external payable {
        require(poolId < pools.length, "invalid poolId");
        Pool storage p = pools[poolId];
        require(p.status == PoolStatus.OPEN, "pool not open");
        require(block.timestamp < p.joinDeadline, "join deadline passed");
        require(pick < 3, "invalid pick");
        require(!p.hasJoined[msg.sender], "already joined");
        require(msg.value == p.stakeAmount, "wrong stake");

        p.hasJoined[msg.sender] = true;
        p.picks[msg.sender] = pick;
        p.participants.push(msg.sender);

        emit BetPlaced(poolId, msg.sender, pick);
    }

    /// @notice Lock a pool once the join deadline has passed.
    function lockPool(uint256 poolId) external {
        require(poolId < pools.length, "invalid poolId");
        Pool storage p = pools[poolId];
        require(p.status == PoolStatus.OPEN, "pool not open");
        require(block.timestamp >= p.joinDeadline, "deadline not reached");

        p.status = PoolStatus.LOCKED;
        emit PoolLocked(poolId);
    }

    /// @notice Propose a match result. Permissionless once the pool is locked.
    function proposeResult(uint256 poolId, uint8 result) external {
        require(poolId < pools.length, "invalid poolId");
        Pool storage p = pools[poolId];
        require(p.status == PoolStatus.LOCKED, "pool not locked");
        require(result < 3, "invalid result");
        require(p.hasJoined[msg.sender], "only participants can propose");

        p.proposedResult = result;
        p.resultProposer = msg.sender;
        p.proposedAt = block.timestamp;
        p.status = PoolStatus.DISPUTE_WINDOW;

        emit ResultProposed(poolId, msg.sender, result);
    }

    /// @notice Dispute a proposed result during the dispute window.
    /// Caller must be a participant; their pick counts as their vote.
    function disputeResult(uint256 poolId, uint8 yourResult) external {
        require(poolId < pools.length, "invalid poolId");
        Pool storage p = pools[poolId];
        require(p.status == PoolStatus.DISPUTE_WINDOW, "not in dispute window");
        require(yourResult < 3, "invalid result");
        require(p.hasJoined[msg.sender], "not a participant");
        require(
            block.timestamp < p.proposedAt + p.disputeWindowSeconds,
            "dispute window closed"
        );

        p.disputeVotes[msg.sender] = yourResult;
        p.hasDisputed[msg.sender] = true;
        p.disputed = true;

        emit ResultDisputed(poolId, msg.sender, yourResult);
    }

    /// @notice Finalize a pool once the dispute window has closed.
    /// Tally majority vote if disputed; ties -> CANCELLED; zero winners -> CANCELLED.
    function finalize(uint256 poolId) external {
        require(poolId < pools.length, "invalid poolId");
        Pool storage p = pools[poolId];
        require(p.status == PoolStatus.DISPUTE_WINDOW, "not in dispute window");
        require(
            block.timestamp >= p.proposedAt + p.disputeWindowSeconds,
            "dispute window still open"
        );

        uint256 participantCount = p.participants.length;
        require(participantCount > 0, "no participants");

        uint8 chosenResult;
        if (!p.disputed) {
            // No dispute: proposer's result is final.
            chosenResult = p.proposedResult;
        } else {
            // Tally votes. Proposer's original proposal counts as their vote.
            // Only participants who explicitly disputed (hasDisputed == true)
            // are counted, in addition to the proposer.
            uint256[3] memory tally;
            tally[p.proposedResult] += 1;

            for (uint256 i = 0; i < participantCount; i++) {
                address part = p.participants[i];
                if (part == p.resultProposer) {
                    continue; // already counted as proposer
                }
                if (p.hasDisputed[part]) {
                    tally[p.disputeVotes[part]] += 1;
                }
            }

            // Find majority
            uint256 maxCount = 0;
            uint8 maxResult = 0;
            uint256 ties = 0;
            for (uint8 r = 0; r < 3; r++) {
                if (tally[r] > maxCount) {
                    maxCount = tally[r];
                    maxResult = r;
                    ties = 0;
                } else if (tally[r] == maxCount && maxCount > 0) {
                    ties += 1;
                }
            }

            if (maxCount == 0 || ties > 0) {
                // No votes or tie -> cancel.
                p.status = PoolStatus.CANCELLED;
                emit PoolCancelled(poolId);
                return;
            }
            chosenResult = maxResult;
        }

        // Check winner count
        uint256 winnerCount = 0;
        for (uint256 i = 0; i < participantCount; i++) {
            if (p.picks[p.participants[i]] == chosenResult) {
                winnerCount += 1;
            }
        }

        p.finalResult = chosenResult;

        if (winnerCount == 0) {
            p.status = PoolStatus.CANCELLED;
            emit PoolCancelled(poolId);
            return;
        }

        p.status = PoolStatus.FINALIZED;
        emit PoolFinalized(poolId, chosenResult);
    }

    /// @notice Claim a winner's share of the pot.
    function claimPayout(uint256 poolId) external nonReentrant {
        require(poolId < pools.length, "invalid poolId");
        Pool storage p = pools[poolId];
        require(p.status == PoolStatus.FINALIZED, "not finalized");
        require(p.hasJoined[msg.sender], "not a participant");
        require(p.picks[msg.sender] == p.finalResult, "did not pick winner");
        require(!p.claimed[msg.sender], "already claimed");

        uint256 participantCount = p.participants.length;
        uint256 winnerCount = 0;
        for (uint256 i = 0; i < participantCount; i++) {
            if (p.picks[p.participants[i]] == p.finalResult) {
                winnerCount += 1;
            }
        }
        require(winnerCount > 0, "no winners");

        uint256 totalPot = p.stakeAmount * participantCount;
        uint256 payout = totalPot / winnerCount;

        // Checks-effects-interactions: mark claimed BEFORE transfer.
        p.claimed[msg.sender] = true;

        (bool ok, ) = payable(msg.sender).call{value: payout}("");
        require(ok, "transfer failed");

        emit PayoutClaimed(poolId, msg.sender, payout);
    }

    /// @notice Claim a refund after the pool is cancelled.
    function claimRefund(uint256 poolId) external nonReentrant {
        require(poolId < pools.length, "invalid poolId");
        Pool storage p = pools[poolId];
        require(p.status == PoolStatus.CANCELLED, "not cancelled");
        require(p.hasJoined[msg.sender], "not a participant");
        require(!p.claimed[msg.sender], "already claimed");

        uint256 refund = p.stakeAmount;

        // Checks-effects-interactions: mark claimed BEFORE transfer.
        p.claimed[msg.sender] = true;

        (bool ok, ) = payable(msg.sender).call{value: refund}("");
        require(ok, "transfer failed");

        emit RefundClaimed(poolId, msg.sender, refund);
    }

    // ---------- Views ----------
    function getPool(uint256 poolId)
        external
        view
        returns (
            address creator,
            string memory matchName,
            string memory outcome0,
            string memory outcome1,
            string memory outcome2,
            uint256 stakeAmount,
            uint256 joinDeadline,
            uint256 disputeWindowSeconds,
            PoolStatus status,
            uint256 participantCount,
            uint8 proposedResult,
            address resultProposer,
            uint256 proposedAt,
            bool disputed,
            uint8 finalResult
        )
    {
        require(poolId < pools.length, "invalid poolId");
        Pool storage p = pools[poolId];
        return (
            p.creator,
            p.matchName,
            p.outcomeLabels[0],
            p.outcomeLabels[1],
            p.outcomeLabels[2],
            p.stakeAmount,
            p.joinDeadline,
            p.disputeWindowSeconds,
            p.status,
            p.participants.length,
            p.proposedResult,
            p.resultProposer,
            p.proposedAt,
            p.disputed,
            p.finalResult
        );
    }

    function getParticipantPick(uint256 poolId, address participant)
        external
        view
        returns (uint8 pick, bool hasJoined, bool claimed)
    {
        require(poolId < pools.length, "invalid poolId");
        Pool storage p = pools[poolId];
        return (p.picks[participant], p.hasJoined[participant], p.claimed[participant]);
    }

    function getParticipants(uint256 poolId) external view returns (address[] memory) {
        require(poolId < pools.length, "invalid poolId");
        return pools[poolId].participants;
    }
}
