/**
 * useDrawFlow: 1-button commit-then-reveal draw flow.
 *
 * Step 1: generateSecret → commitDraw(eventId, keccak256(secret))
 * Step 2: wait for commit tx → draw(eventId, secret)
 * Step 3: wait for draw tx → call backend /notify-winners
 */
import { useState, useRef, useEffect } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { keccak256, encodePacked, decodeEventLog } from 'viem'
import { EVENT_LUCKY_ABI } from '@/abi'

const ARC_TESTNET_CHAIN_ID = 5042002
const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS ?? '') as `0x${string}`
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001'

export type DrawStep =
  | 'idle'
  | 'committing'
  | 'waiting_commit'
  | 'revealing'
  | 'waiting_reveal'
  | 'notifying'
  | 'done'
  | 'error'

export interface DrawFlowState {
  step: DrawStep
  error: string | null
  winningNumber: number | null
  startDraw: (eventId: number) => void
}

function generateSecret(): `0x${string}` {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return ('0x' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`
}

export function useDrawFlow(
  onDone?: (eventId: number, winningNumber: number) => void
): DrawFlowState {
  const [step, setStep] = useState<DrawStep>('idle')
  const [error, setError] = useState<string | null>(null)
  const [winningNumber, setWinningNumber] = useState<number | null>(null)

  // Store pending draw params across async steps
  const pendingRef = useRef<{
    eventId: number
    secret: `0x${string}`
    secretHash: `0x${string}`
  } | null>(null)

  // Tx hashes
  const [commitHash, setCommitHash] = useState<`0x${string}` | undefined>()
  const [drawHash, setDrawHash] = useState<`0x${string}` | undefined>()

  const { writeContractAsync } = useWriteContract()

  // Wait for commit tx
  const { isSuccess: commitConfirmed } = useWaitForTransactionReceipt({
    hash: commitHash,
    chainId: ARC_TESTNET_CHAIN_ID,
  })

  // Wait for draw tx
  const { isSuccess: drawConfirmed, data: drawReceipt } = useWaitForTransactionReceipt({
    hash: drawHash,
    chainId: ARC_TESTNET_CHAIN_ID,
  })

  // Step 2: after commit confirmed → reveal
  useEffect(() => {
    if (!commitConfirmed || step !== 'waiting_commit' || !pendingRef.current) return
    const { eventId, secret } = pendingRef.current
    setStep('revealing')

    writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: EVENT_LUCKY_ABI,
      functionName: 'draw',
      args: [BigInt(eventId), secret],
      chainId: ARC_TESTNET_CHAIN_ID,
    })
      .then(hash => {
        setDrawHash(hash)
        setStep('waiting_reveal')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'draw failed')
        setStep('error')
      })
  }, [commitConfirmed, step, writeContractAsync])

  // Step 3: after draw confirmed → parse log + notify backend
  useEffect(() => {
    if (!drawConfirmed || step !== 'waiting_reveal' || !drawReceipt || !pendingRef.current) return
    const { eventId } = pendingRef.current
    setStep('notifying')

    void (async () => {
      try {
        // Parse DrawCompleted event from receipt logs
        let winNum = 0
        let winners: { address: string; amount: string }[] = []

        for (const log of drawReceipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: EVENT_LUCKY_ABI,
              eventName: 'DrawCompleted',
              topics: log.topics,
              data: log.data,
            })
            const args = decoded.args as {
              winningNumber: number
              winners: readonly `0x${string}`[]
              amounts: readonly bigint[]
            }
            winNum = Number(args.winningNumber)
            winners = Array.from(args.winners).map((addr, i) => ({
              address: addr,
              amount: (Number(args.amounts[i]) / 1_000_000).toFixed(2),
            }))
          } catch {
            // not DrawCompleted log, skip
          }
        }

        setWinningNumber(winNum)

        // Notify backend: sends emails + saves history
        const appUrl = window.location.origin
        await fetch(`${SERVER_URL}/notify-winners`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: String(eventId),
            winningNumber: winNum,
            winners,
            claimDeadline: new Date(Date.now() + 48 * 3600 * 1000).toLocaleString('vi-VN'),
            claimUrl: `${appUrl}/?event=${eventId}`,
            txHash: drawHash,
          }),
        })

        setStep('done')
        onDone?.(eventId, winNum)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'notify failed')
        setStep('error')
      }
    })()
  }, [drawConfirmed, step, drawReceipt, drawHash, onDone])

  function startDraw(eventId: number) {
    if (step !== 'idle' && step !== 'done' && step !== 'error') return
    const secret = generateSecret()
    const secretHash = keccak256(encodePacked(['bytes32'], [secret]))
    pendingRef.current = { eventId, secret, secretHash }
    setStep('committing')
    setError(null)
    setWinningNumber(null)
    setCommitHash(undefined)
    setDrawHash(undefined)

    writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: EVENT_LUCKY_ABI,
      functionName: 'commitDraw',
      args: [BigInt(eventId), secretHash],
      chainId: ARC_TESTNET_CHAIN_ID,
    })
      .then(hash => {
        setCommitHash(hash)
        setStep('waiting_commit')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'commit failed')
        setStep('error')
      })
  }

  return { step, error, winningNumber, startDraw }
}
