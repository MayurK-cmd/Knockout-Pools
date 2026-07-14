import { useWriteContract, useReadContract } from "wagmi";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./pools.js";

export function useCreatePool() {
  const { writeContract, isPending, data } = useWriteContract();
  const create = (matchName, outcomeLabels, stakeAmount, joinDeadline, disputeWindowSeconds) => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "createPool",
      args: [matchName, outcomeLabels, BigInt(stakeAmount), BigInt(joinDeadline), BigInt(disputeWindowSeconds)],
    });
  };
  return { create, isPending, tx: data };
}

export function useJoinPool() {
  const { writeContract, isPending, data } = useWriteContract();
  const join = (poolId, pick, stakeAmount) => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "joinPool",
      args: [BigInt(poolId), pick],
      value: BigInt(stakeAmount),
    });
  };
  return { join, isPending, tx: data };
}

export function useLockPool() {
  const { writeContract, isPending, data } = useWriteContract();
  const lock = (poolId) => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "lockPool",
      args: [BigInt(poolId)],
    });
  };
  return { lock, isPending, tx: data };
}

export function useProposeResult() {
  const { writeContract, isPending, data } = useWriteContract();
  const propose = (poolId, result) => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "proposeResult",
      args: [BigInt(poolId), result],
    });
  };
  return { propose, isPending, tx: data };
}

export function useDisputeResult() {
  const { writeContract, isPending, data } = useWriteContract();
  const dispute = (poolId, yourResult) => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "disputeResult",
      args: [BigInt(poolId), yourResult],
    });
  };
  return { dispute, isPending, tx: data };
}

export function useFinalize() {
  const { writeContract, isPending, data } = useWriteContract();
  const finalize = (poolId) => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "finalize",
      args: [BigInt(poolId)],
    });
  };
  return { finalize, isPending, tx: data };
}

export function useClaimPayout() {
  const { writeContract, isPending, data } = useWriteContract();
  const claim = (poolId) => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "claimPayout",
      args: [BigInt(poolId)],
    });
  };
  return { claim, isPending, tx: data };
}

export function useClaimRefund() {
  const { writeContract, isPending, data } = useWriteContract();
  const refund = (poolId) => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "claimRefund",
      args: [BigInt(poolId)],
    });
  };
  return { refund, isPending, tx: data };
}

export function usePoolCount() {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "poolCount",
  });
}
