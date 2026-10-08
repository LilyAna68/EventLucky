import { useState, useEffect } from 'react'
import { ArrowLeft, Clock, Users, Trophy, CheckCircle, AlertCircle, Share2 } from 'lucide-react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { toast } from 'sonner'
import { requireChain } from '@/onchain-facts'
import { usdcDecimalsFor, Amount } from '@/onchain-money'
import { EVENT_LUCKY_ABI } from '@/abi'
import { useLang } from '@/LanguageContext'
import LangSwitcher from '@/components/LangSwitcher'

const glass = {
  card: {
    background: 'rgba(255,255,255,0.64)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.68)',
    boxShadow: '0 8px 32px rgba(18,45,69,0.08), inset 0 1px 0 rgba(255,255,255,0.55)',
  } as React.CSSProperties,
  inner: {
    background: 'rgba(255,255,255,0.46)',
    border: '1px solid rgba(255,255,255,0.56)',
  } as React.CSSProperties,
}

const ARC_TESTNET_CHAIN_ID = 5042002
const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS ?? '') as `0x${string}`

interface EventViewProps {
  eventId: string
  onBack: () => void
}

function formatUsdc(raw: bigint, chainId: number): string {
  return Amount.fromRaw(raw, usdcDecimalsFor(chainId)).toFixed(2)
}

export default function EventView({ eventId, onBack }: EventViewProps) {
  const { address, chainId } = useAccount()
  const { t, lang } = useLang()
  const [chosenNumber, setChosenNumber] = useState('')
  const [email, setEmail] = useState('')
  const [registering, setRegistering] = useState(false)

  const chain = requireChain(ARC_TESTNET_CHAIN_ID)
  const eventIdBig = BigInt(eventId)

  const formatTs = (ts: bigint): string => {
    if (!ts) return '-'
    return new Date(Number(ts) * 1000).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')
  }

  // read event data
  const { data: evData, refetch: refetchEvent, isLoading: evLoading, isError: evError, error: evErrObj } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: EVENT_LUCKY_ABI,
    functionName: 'getEvent',
    args: [eventIdBig],
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { retry: 3, retryDelay: 2000 },
  })

  // check if player already registered
  const { data: alreadyRegistered } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: EVENT_LUCKY_ABI,
    functionName: 'hasRegistered',
    args: [eventIdBig, address ?? '0x0000000000000000000000000000000000000000'],
    chainId: ARC_TESTNET_CHAIN_ID,
  })

  // check winner amount
  const { data: myWinnerAmount, refetch: refetchWinner } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: EVENT_LUCKY_ABI,
    functionName: 'winnerAmount',
    args: [eventIdBig, address ?? '0x0000000000000000000000000000000000000000'],
    chainId: ARC_TESTNET_CHAIN_ID,
  })

  // write: register
  const { writeContract: doRegister, data: regHash } = useWriteContract()
  const { isSuccess: regSuccess, isLoading: regConfirming } = useWaitForTransactionReceipt({ hash: regHash })

  // write: claim
  const { writeContract: doClaim, data: claimHash } = useWriteContract()
  const { isSuccess: claimSuccess, isLoading: claimConfirming } = useWaitForTransactionReceipt({ hash: claimHash })

  useEffect(() => {
    if (regSuccess && registering) {
      setRegistering(false)
      toast.success(t('toastRegOk'))
      void refetchEvent()
    }
  }, [regSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (claimSuccess) {
      toast.success(t('toastClaimOk'))
      void refetchEvent()
      void refetchWinner()
    }
  }, [claimSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  if (evError || (!evData && !evLoading)) {
    return (
      <div className="relative min-h-dvh flex items-center justify-center" style={{ background: 'var(--bg-gradient)' }}>
        <div className="rounded-2xl p-6 text-center mx-4" style={{ background: 'rgba(255,255,255,0.8)', maxWidth: 360 }}>
          <div className="mb-3 text-3xl">⚠️</div>
          <p className="font-semibold mb-2" style={{ color: 'var(--ink)' }}>
            {t('errLoadEvent')}
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
            Event ID: {eventId}
            {evErrObj && <><br />{String(evErrObj.message).slice(0, 120)}</>}
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => { void refetchEvent() }}
              className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              {t('retry')}
            </button>
            <button
              onClick={onBack}
              className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ background: 'rgba(18,45,69,0.08)', color: 'var(--ink)' }}
            >
              {t('back')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!evData && evLoading) {
    return (
      <div className="relative min-h-dvh flex items-center justify-center" style={{ background: 'var(--bg-gradient)' }}>
        <div className="text-center">
          <div className="mb-3 text-3xl">⏳</div>
          <p style={{ color: 'var(--muted)' }}>{t('loading')}</p>
          <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>Event ID: {eventId}</p>
        </div>
      </div>
    )
  }

  if (!evData) return null

  const [host, evName, minNum, maxNum, regDeadline, revealDeadline, maxRegs, drawn, winningNumber, claimDeadline, totalPrize, regCount, exists] = evData

  if (!exists) {
    return (
      <div className="relative min-h-dvh flex items-center justify-center" style={{ background: 'var(--bg-gradient)' }}>
        <div className="rounded-2xl p-6 text-center" style={glass.card}>
          <AlertCircle size={32} className="mx-auto mb-3" style={{ color: 'var(--danger)' }} />
          <p className="font-semibold" style={{ color: 'var(--ink)' }}>{t('eventNotFound')}</p>
          <button onClick={onBack} className="mt-4 text-sm underline" style={{ color: 'var(--muted)' }}>{t('goBack')}</button>
        </div>
      </div>
    )
  }

  // oxlint-disable-next-line react/purity
  const now = Math.floor(Date.now() / 1000)
  const isHost = address?.toLowerCase() === host.toLowerCase()
  const regOpen = now <= Number(regDeadline) && !drawn
  const canDraw = now > Number(regDeadline) && !drawn && isHost
  const canClaim = drawn && myWinnerAmount !== undefined && myWinnerAmount > 0n && now <= Number(claimDeadline)

  const handleRegister = async () => {
    if (!address || !chosenNumber) return
    if (chainId !== ARC_TESTNET_CHAIN_ID) { toast.error(`${t('toastWrongChain')} ${chain.name}`); return }
    const num = parseInt(chosenNumber)
    if (num < Number(minNum) || num > Number(maxNum)) {
      toast.error(`${t('toastNumOutOfRange')} ${minNum} ${t('toastNumOutOfRangeTo')} ${maxNum}`)
      return
    }
    if (!email.trim()) { toast.error(t('toastEnterNumber')); return }

    setRegistering(true)
    try {
      await fetch('/api/register-player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, playerAddress: address, email: email.trim(), chosenNumber: num }),
      })
    } catch { /* non-blocking */ }

    doRegister({
      address: CONTRACT_ADDRESS,
      abi: EVENT_LUCKY_ABI,
      functionName: 'register',
      args: [eventIdBig, num],
      chainId: ARC_TESTNET_CHAIN_ID,
    })
  }

  const handleClaim = () => {
    if (!address) return
    doClaim({
      address: CONTRACT_ADDRESS,
      abi: EVENT_LUCKY_ABI,
      functionName: 'claim',
      args: [eventIdBig],
      chainId: ARC_TESTNET_CHAIN_ID,
    })
  }

  const shareUrl = `${window.location.origin}?event=${eventId}`
  const handleShare = () => {
    void navigator.clipboard.writeText(shareUrl)
    toast.success(t('toastCopied'))
  }

  return (
    <div
      className="relative min-h-dvh overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #f9f9fc 0%, #fffcf7 52%, #fbf7f2 100%)' }}
    >
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div style={{ position: 'absolute', top: '5%', left: '5%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(133,177,237,0.20) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '6%', width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,205,131,0.18) 0%, transparent 70%)', filter: 'blur(58px)' }} />
      </div>

      <div className="relative z-10 mx-auto max-w-md px-4 pb-10 pt-6">
        <header className="mb-6 flex items-center gap-3">
          <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5">
            <ArrowLeft size={18} style={{ color: 'var(--ink)' }} />
          </button>
          <h1 className="display flex-1 truncate text-xl font-bold" style={{ color: 'var(--ink)' }}>{evName}</h1>
          <LangSwitcher />
          <button onClick={handleShare} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5">
            <Share2 size={16} style={{ color: 'var(--muted)' }} />
          </button>
        </header>

        {/* hero prize card */}
        <div
          className="mb-4 rounded-2xl p-5 text-center"
          style={{ ...glass.card, borderTop: '3px solid var(--accent)' }}
        >
          <Trophy size={28} className="mx-auto mb-2" style={{ color: 'var(--accent)' }} />
          <div className="display mb-1 text-3xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
            {formatUsdc(totalPrize, ARC_TESTNET_CHAIN_ID)} USDC
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('totalPrize')}</p>

          <div className="mt-3 flex justify-center gap-4 text-xs" style={{ color: 'var(--muted)' }}>
            <span className="flex items-center gap-1">
              <span className="mono">1 – {maxNum.toString()}</span> {t('rangeLabel')}
            </span>
            <span className="flex items-center gap-1">
              <Users size={12} /> {regCount.toString()} / {maxRegs.toString()}
            </span>
          </div>

          {drawn && (
            <div className="mt-3 rounded-xl py-2 text-sm font-bold" style={{ background: 'rgba(18,45,69,0.06)', color: 'var(--ink)' }}>
              {t('winningNumber')} <span className="mono text-lg">{winningNumber.toString()}</span>
            </div>
          )}
        </div>

        {/* status row */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3" style={glass.card}>
            <p className="mb-1 text-xs" style={{ color: 'var(--muted)' }}>{t('regDeadlineLabel')}</p>
            <div className="flex items-center gap-1">
              <Clock size={12} style={{ color: regOpen ? 'var(--success)' : 'var(--danger)' }} />
              <p className="text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>{formatTs(regDeadline)}</p>
            </div>
          </div>
          <div className="rounded-xl p-3" style={glass.card}>
            <p className="mb-1 text-xs" style={{ color: 'var(--muted)' }}>{t('statusLabel')}</p>
            <span
              className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{
                background: drawn ? 'rgba(26,128,71,0.12)' : regOpen ? 'rgba(18,45,69,0.07)' : 'rgba(186,43,76,0.10)',
                color: drawn ? 'var(--success)' : regOpen ? 'var(--accent)' : 'var(--danger)',
              }}
            >
              {drawn ? t('statusDrawn') : regOpen ? t('statusOpen') : t('statusClosed')}
            </span>
          </div>
        </div>

        {/* can claim */}
        {canClaim && (
          <div className="mb-4 rounded-2xl p-5" style={{ ...glass.card, borderTop: '3px solid var(--success)' }}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={20} style={{ color: 'var(--success)' }} />
              <p className="font-semibold" style={{ color: 'var(--ink)' }}>{t('youWon')}</p>
            </div>
            <p className="text-2xl font-bold mb-3 tabular-nums" style={{ color: 'var(--success)' }}>
              +{formatUsdc(myWinnerAmount ?? 0n, ARC_TESTNET_CHAIN_ID)} USDC
            </p>
            <button
              onClick={handleClaim}
              disabled={claimConfirming}
              className="w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
              style={{ background: 'var(--success)', color: 'white' }}
            >
              {claimConfirming ? t('claimProcessing') : t('claimBtn')}
            </button>
            <p className="mt-2 text-xs text-center" style={{ color: 'var(--muted)' }}>
              {t('claimExpiry')} {formatTs(claimDeadline)}
            </p>
          </div>
        )}

        {/* register form */}
        {regOpen && !alreadyRegistered && address && (
          <div className="mb-4 rounded-2xl p-5" style={glass.card}>
            <p className="mb-4 text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('registerTitle')}</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
                  {t('chooseNumber')} ({minNum.toString()} – {maxNum.toString()})
                </label>
                <input
                  type="number"
                  value={chosenNumber}
                  min={Number(minNum)}
                  max={Number(maxNum)}
                  onChange={e => setChosenNumber(e.target.value)}
                  placeholder={`${minNum} – ${maxNum}`}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ ...glass.inner, color: 'var(--ink)' }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
                  {t('emailLabel')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ ...glass.inner, color: 'var(--ink)' }}
                />
              </div>
              <button
                onClick={() => { void handleRegister() }}
                disabled={registering || regConfirming || !chosenNumber}
                className="w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                {registering || regConfirming ? t('btnRegistering') : t('btnRegister')}
              </button>
            </div>
          </div>
        )}

        {alreadyRegistered && !drawn && (
          <div
            className="mb-4 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm"
            style={{ background: 'rgba(26,128,71,0.08)', color: 'var(--success)' }}
          >
            <CheckCircle size={16} />
            {t('alreadyRegistered')}
          </div>
        )}

        {!address && regOpen && (
          <div className="mb-4 rounded-2xl p-4 text-center text-sm" style={{ background: 'rgba(18,45,69,0.04)', color: 'var(--muted)' }}>
            {t('connectToJoin')}
          </div>
        )}

        {/* host panel */}
        {isHost && (
          <HostPanel
            eventId={eventId}
            canDraw={canDraw}
            drawn={drawn}
            revealDeadline={revealDeadline}
            regDeadline={regDeadline}
            claimDeadline={claimDeadline}
            onRefresh={() => { void refetchEvent(); void refetchWinner() }}
          />
        )}

        {/* explorer link */}
        <div className="mt-4 text-center">
          <a
            href={`${chain.explorerBase}/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline"
            style={{ color: 'var(--muted)' }}
          >
            {t('viewOnExplorer')}
          </a>
        </div>
      </div>
    </div>
  )
}

// ---- Host Panel ----
interface HostPanelProps {
  eventId: string
  canDraw: boolean
  drawn: boolean
  revealDeadline: bigint
  regDeadline: bigint
  claimDeadline: bigint
  onRefresh: () => void
}

function HostPanel({ eventId, canDraw, drawn, revealDeadline, regDeadline, claimDeadline, onRefresh }: HostPanelProps) {
  const { chainId } = useAccount()
  const { t, lang } = useLang()
  const [secret, setSecret] = useState('')
  const [committedSecret, setCommittedSecret] = useState('')
  const [committing, setCommitting] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const chain = requireChain(ARC_TESTNET_CHAIN_ID)
  const eventIdBig = BigInt(eventId)
  // oxlint-disable-next-line react/purity
  const now = Math.floor(Date.now() / 1000)

  const { writeContract: doCommit, data: commitHash } = useWriteContract()
  const { isSuccess: commitSuccess } = useWaitForTransactionReceipt({ hash: commitHash })

  const { writeContract: doDraw, data: drawHash } = useWriteContract()
  const { isSuccess: drawSuccess } = useWaitForTransactionReceipt({ hash: drawHash })

  const { writeContract: doReclaim, data: reclaimHash } = useWriteContract()
  const { isSuccess: reclaimSuccess } = useWaitForTransactionReceipt({ hash: reclaimHash })

  const formatReveal = (ts: bigint) =>
    new Date(Number(ts) * 1000).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')

  useEffect(() => {
    if (commitSuccess && committing) {
      setCommitting(false)
      setCommittedSecret(secret)
      toast.success(t('toastCommitOk'))
      onRefresh()
    }
  }, [commitSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (drawSuccess && drawing) {
      setDrawing(false)
      toast.success(t('toastDrawOk'))
      onRefresh()
    }
  }, [drawSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (reclaimSuccess) {
      toast.success(t('toastReclaimOk'))
      onRefresh()
    }
  }, [reclaimSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCommit = async () => {
    if (!secret.trim()) { toast.error(t('errNoSecret')); return }
    if (chainId !== ARC_TESTNET_CHAIN_ID) { toast.error(`${t('toastWrongChain')} ${chain.name}`); return }
    const { keccak256, toBytes, pad } = await import('viem')
    const secretBytes = pad(toBytes(secret.trim()), { size: 32 })
    const secretHash = keccak256(secretBytes)
    setCommitting(true)
    doCommit({
      address: CONTRACT_ADDRESS,
      abi: EVENT_LUCKY_ABI,
      functionName: 'commitDraw',
      args: [eventIdBig, secretHash],
      chainId: ARC_TESTNET_CHAIN_ID,
    })
  }

  const handleDraw = async () => {
    if (!committedSecret) { toast.error(t('errNoCommittedSecret')); return }
    if (chainId !== ARC_TESTNET_CHAIN_ID) { toast.error(`${t('toastWrongChain')} ${chain.name}`); return }
    const { toBytes, pad } = await import('viem')
    const secretHex: `0x${string}` = `0x${Buffer.from(pad(toBytes(committedSecret.trim()), { size: 32 })).toString('hex')}`
    setDrawing(true)
    doDraw({
      address: CONTRACT_ADDRESS,
      abi: EVENT_LUCKY_ABI,
      functionName: 'draw',
      args: [eventIdBig, secretHex],
      chainId: ARC_TESTNET_CHAIN_ID,
    })
  }

  const handleReclaim = () => {
    if (chainId !== ARC_TESTNET_CHAIN_ID) { toast.error(`${t('toastWrongChain')} ${chain.name}`); return }
    doReclaim({
      address: CONTRACT_ADDRESS,
      abi: EVENT_LUCKY_ABI,
      functionName: 'reclaimUnclaimed',
      args: [eventIdBig],
      chainId: ARC_TESTNET_CHAIN_ID,
    })
  }

  const glass = {
    card: {
      background: 'rgba(255,255,255,0.64)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      border: '1px solid rgba(255,255,255,0.68)',
      boxShadow: '0 8px 32px rgba(18,45,69,0.08), inset 0 1px 0 rgba(255,255,255,0.55)',
    } as React.CSSProperties,
    inner: {
      background: 'rgba(255,255,255,0.46)',
      border: '1px solid rgba(255,255,255,0.56)',
    } as React.CSSProperties,
  }

  const canReclaim = drawn && now > Number(claimDeadline)

  return (
    <div className="rounded-2xl p-5" style={{ ...glass.card, borderTop: '3px solid rgba(18,45,69,0.3)' }}>
      <p className="mb-4 text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('hostControls')}</p>

      {!drawn && (
        <div className="space-y-3">
          {/* commit */}
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
              {t('secretLabel')}
            </label>
            <input
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder={t('secretPlaceholder')}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none mb-2"
              style={{ ...glass.inner, color: 'var(--ink)' }}
            />
            <button
              onClick={() => { void handleCommit() }}
              disabled={committing || now > Number(regDeadline)}
              className="w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
              style={{ background: 'rgba(18,45,69,0.85)', color: 'white' }}
            >
              {committing ? t('btnCommitting') : t('btnCommit')}
            </button>
          </div>

          {/* reveal/draw */}
          {canDraw && (
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
                {t('revealSecretLabel')}
              </label>
              <input
                value={committedSecret}
                onChange={e => setCommittedSecret(e.target.value)}
                placeholder={t('revealSecretPlaceholder')}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none mb-2"
                style={{ ...glass.inner, color: 'var(--ink)' }}
              />
              <button
                onClick={() => { void handleDraw() }}
                disabled={drawing}
                className="w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                {drawing ? t('btnDrawing') : t('btnDraw')}
              </button>
            </div>
          )}

          {revealDeadline > 0n && (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {t('revealDeadlineLabel')} {formatReveal(revealDeadline)}
            </p>
          )}
        </div>
      )}

      {canReclaim && (
        <button
          onClick={handleReclaim}
          className="w-full rounded-xl py-2.5 text-sm font-semibold"
          style={{ background: 'rgba(186,43,76,0.9)', color: 'white' }}
        >
          {t('btnReclaim')}
        </button>
      )}

      {drawn && !canReclaim && (
        <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
          {t('canReclaimAfter')} {formatReveal(claimDeadline)}
        </p>
      )}
    </div>
  )
}
