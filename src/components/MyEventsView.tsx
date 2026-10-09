import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ArrowLeft, Trophy, Clock, CheckCircle, XCircle, Plus, Trash2, AlertTriangle, Shuffle, History } from 'lucide-react'
import { toast } from 'sonner'
import { useLang } from '@/LanguageContext'
import { EVENT_LUCKY_ABI } from '@/abi'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { useDrawFlow } from '@/hooks/useDrawFlow'

const ARC_TESTNET_CHAIN_ID = 5042002
const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS ?? '') as `0x${string}`

const glass = {
  card: {
    background: 'rgba(255,255,255,0.64)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.68)',
    boxShadow: '0 8px 32px rgba(18,45,69,0.08), inset 0 1px 0 rgba(255,255,255,0.55)',
  } as React.CSSProperties,
}

interface MyEventsViewProps {
  onBack: () => void
  onViewEvent: (id: string) => void
  onCreateEvent: () => void
  onHistory: () => void
}

function formatUsdc(raw: bigint) {
  return Amount.fromRaw(raw, usdcDecimalsFor(ARC_TESTNET_CHAIN_ID)).toFixed(2)
}

function formatTs(ts: bigint) {
  if (!ts) return '-'
  return new Date(Number(ts) * 1000).toLocaleDateString('vi-VN')
}

const DRAW_STEP_LABELS: Record<string, string> = {
  committing: '1/3 Đang gửi commit...',
  waiting_commit: '1/3 Đang xác nhận commit...',
  revealing: '2/3 Đang quay số...',
  waiting_reveal: '2/3 Đang xác nhận kết quả...',
  notifying: '3/3 Đang gửi email thông báo...',
  done: 'Hoàn thành!',
}

export default function MyEventsView({ onBack, onViewEvent, onCreateEvent, onHistory }: MyEventsViewProps) {
  const { address } = useAccount()
  const { t } = useLang()
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [drawingId, setDrawingId] = useState<number | null>(null)

  // cancel flow
  const { writeContract, data: cancelTxHash, isPending: isCancelling } = useWriteContract()
  const { isLoading: isWaitingCancel, isSuccess: cancelDone } = useWaitForTransactionReceipt({ hash: cancelTxHash })

  const refetchRef = useRef<(() => void) | null>(null)

  // draw flow
  const { step: drawStep, error: drawError, winningNumber, startDraw } = useDrawFlow((eventId, winNum) => {
    toast.success(`🎉 Quay số xong! Số trúng: ${winNum}. Email đã gửi đến người thắng.`)
    setDrawingId(null)
    refetchRef.current?.()
  })

  // toast on cancel done
  useEffect(() => {
    if (cancelDone) {
      toast.success(t('cancelSuccess'))
      setConfirmId(null)
      refetchRef.current?.()
    }
  }, [cancelDone, t])

  // toast on draw error
  useEffect(() => {
    if (drawStep === 'error' && drawError) {
      toast.error(`Quay số thất bại: ${drawError}`)
      setDrawingId(null)
    }
  }, [drawStep, drawError])

  // read contract data
  const { data: nextId } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: EVENT_LUCKY_ABI,
    functionName: 'nextEventId',
    chainId: ARC_TESTNET_CHAIN_ID,
  })

  const total = nextId ? Number(nextId) : 0
  const contracts = Array.from({ length: total }, (_, i) => ({
    address: CONTRACT_ADDRESS,
    abi: EVENT_LUCKY_ABI,
    functionName: 'getEvent' as const,
    args: [BigInt(i)] as [bigint],
    chainId: ARC_TESTNET_CHAIN_ID,
  }))

  const { data: allEvents, isLoading, refetch: refetchEvents } = useReadContracts({
    contracts,
    query: { enabled: total > 0 },
  })
  // oxlint-disable-next-line react/refs
  useLayoutEffect(() => { refetchRef.current = () => { void refetchEvents() } }, [refetchEvents])

  const myEvents = allEvents
    ?.map((res, i) => ({ id: i, data: res.result }))
    .filter(({ data }) => {
      if (!data || !address) return false
      return (data[0] as string).toLowerCase() === address.toLowerCase()
    }) ?? []

  // oxlint-disable-next-line react/purity
  const now = Math.floor(Date.now() / 1000)

  const isDrawing = drawingId !== null && drawStep !== 'idle' && drawStep !== 'done' && drawStep !== 'error'

  return (
    <div
      className="relative min-h-dvh overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #f9f9fc 0%, #fffcf7 52%, #fbf7f2 100%)' }}
    >
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div style={{ position: 'absolute', top: '8%', right: '5%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(133,177,237,0.18) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      {/* Cancel confirm dialog */}
      {confirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(18,45,69,0.35)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-3xl p-6 space-y-4" style={glass.card}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0" style={{ background: 'rgba(186,43,76,0.10)' }}>
                <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--ink)' }}>{t('cancelEvent')}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Event ID: {confirmId}</p>
              </div>
            </div>
            <p className="text-sm" style={{ color: 'var(--ink)' }}>{t('cancelEventConfirm')}</p>
            <p className="text-xs rounded-xl px-3 py-2" style={{ background: 'rgba(18,45,69,0.06)', color: 'var(--muted)' }}>
              ⚠ {t('cancelEventNote')}
            </p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setConfirmId(null)} className="flex-1 rounded-2xl py-3 text-sm font-semibold" style={{ background: 'rgba(18,45,69,0.07)', color: 'var(--ink)' }}>
                {t('back')}
              </button>
              <button
                onClick={() => writeContract({ address: CONTRACT_ADDRESS, abi: EVENT_LUCKY_ABI, functionName: 'cancelEvent', args: [BigInt(confirmId)], chainId: ARC_TESTNET_CHAIN_ID })}
                disabled={isCancelling || isWaitingCancel}
                className="flex-1 rounded-2xl py-3 text-sm font-semibold disabled:opacity-60"
                style={{ background: 'var(--danger)', color: 'white' }}
              >
                {isCancelling || isWaitingCancel ? t('cancelling') : t('cancelEvent')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Draw progress overlay */}
      {isDrawing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(18,45,69,0.45)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-sm rounded-3xl p-8 text-center space-y-4" style={glass.card}>
            <div className="mx-auto h-14 w-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(18,45,69,0.08)' }}>
              <Shuffle size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <p className="font-bold text-lg" style={{ color: 'var(--ink)' }}>Đang quay số...</p>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                {DRAW_STEP_LABELS[drawStep] ?? drawStep}
              </p>
            </div>
            <div className="flex gap-1 justify-center">
              {['committing', 'waiting_commit', 'revealing', 'waiting_reveal', 'notifying'].map((s, i) => {
                const steps = ['committing', 'waiting_commit', 'revealing', 'waiting_reveal', 'notifying']
                const current = steps.indexOf(drawStep)
                const active = i <= current
                return (
                  <div key={s} className="h-1.5 flex-1 rounded-full transition-all" style={{ background: active ? 'var(--accent)' : 'rgba(18,45,69,0.12)' }} />
                )
              })}
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Event ID: {drawingId} · Vui lòng không đóng trang</p>
          </div>
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-md px-4 pb-10 pt-6">
        <header className="mb-6 flex items-center gap-3">
          <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5">
            <ArrowLeft size={18} style={{ color: 'var(--ink)' }} />
          </button>
          <h1 className="display flex-1 text-xl font-bold" style={{ color: 'var(--ink)' }}>{t('myEvents')}</h1>
          <button onClick={onHistory} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5" title="Lịch sử trúng thưởng">
            <History size={17} style={{ color: 'var(--muted)' }} />
          </button>
          <button onClick={onCreateEvent} className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: 'var(--accent)', color: 'white' }}>
            <Plus size={13} /> {t('createNewEvent')}
          </button>
        </header>

        {!address && (
          <div className="rounded-2xl p-6 text-center" style={glass.card}>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('connectWalletToCreate')}</p>
          </div>
        )}

        {address && isLoading && (
          <div className="rounded-2xl p-6 text-center" style={glass.card}>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>⏳ {t('loading')}</p>
          </div>
        )}

        {address && !isLoading && myEvents.length === 0 && (
          <div className="rounded-2xl p-8 text-center" style={glass.card}>
            <Trophy size={32} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
            <p className="font-semibold mb-1" style={{ color: 'var(--ink)' }}>{t('noEventsYet')}</p>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>{t('noEventsDesc')}</p>
            <button onClick={onCreateEvent} className="rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ background: 'var(--accent)', color: 'white' }}>
              {t('createNewEvent')}
            </button>
          </div>
        )}

        {myEvents.length > 0 && (
          <div className="space-y-3">
            {[...myEvents].reverse().map(({ id, data }) => {
              if (!data) return null
              const [, evName, , , regDeadline, prizes, drawn, drawnWinNum, , , totalPrize] = data as [
                string, string, number, number, bigint,
                { amount: bigint; rank: number }[],
                boolean, number, bigint, boolean, bigint, bigint
              ]

              const regOpen = now <= Number(regDeadline) && !drawn
              const pastDeadline = now > Number(regDeadline)
              const canDraw = pastDeadline && !drawn
              const canCancel = !drawn && regOpen
              const statusColor = drawn ? 'var(--success)' : regOpen ? 'var(--accent)' : 'var(--danger)'
              const statusBg = drawn ? 'rgba(26,128,71,0.10)' : regOpen ? 'rgba(18,45,69,0.07)' : 'rgba(186,43,76,0.09)'
              const statusLabel = drawn ? t('statusDrawn') : regOpen ? t('statusOpen') : t('statusClosed')
              const StatusIcon = drawn ? CheckCircle : regOpen ? Clock : XCircle

              return (
                <div key={id} className="rounded-2xl p-4" style={glass.card}>
                  {/* header */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate" style={{ color: 'var(--ink)' }}>{evName}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                        ID: {id} · {t('regDeadlineLabel')} {formatTs(regDeadline)}
                      </p>
                    </div>
                    <span className="flex-shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: statusBg, color: statusColor }}>
                      <StatusIcon size={11} /> {statusLabel}
                    </span>
                  </div>

                  {/* prize + result */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--accent)' }}>
                      {formatUsdc(totalPrize)} USDC
                    </span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {prizes.length} {t('prizes')}
                    </span>
                  </div>

                  {/* winning number if drawn */}
                  {drawn && (
                    <div className="mb-3 rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(26,128,71,0.07)' }}>
                      <CheckCircle size={13} style={{ color: 'var(--success)' }} />
                      <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>
                        Số trúng: {drawnWinNum}
                      </span>
                    </div>
                  )}

                  {/* actions */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => onViewEvent(String(id))}
                      className="rounded-xl px-3 py-1.5 text-xs font-semibold"
                      style={{ background: 'rgba(18,45,69,0.07)', color: 'var(--ink)' }}
                    >
                      {t('viewEvent')}
                    </button>

                    {canDraw && (
                      <button
                        onClick={() => { setDrawingId(id); startDraw(id) }}
                        disabled={isDrawing}
                        className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                        style={{ background: 'var(--accent)', color: 'white' }}
                      >
                        <Shuffle size={12} />
                        Quay số ngay
                      </button>
                    )}

                    {canCancel && (
                      <button
                        onClick={() => setConfirmId(id)}
                        className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold"
                        style={{ background: 'rgba(186,43,76,0.09)', color: 'var(--danger)' }}
                      >
                        <Trash2 size={12} /> {t('cancelEvent')}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* summary banner if just drawn */}
        {drawStep === 'done' && winningNumber !== null && (
          <div className="mt-4 rounded-2xl p-4 text-center" style={{ background: 'rgba(26,128,71,0.08)', border: '1px solid rgba(26,128,71,0.18)' }}>
            <p className="font-bold" style={{ color: 'var(--success)' }}>🎉 Số trúng thưởng: {winningNumber}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Email đã gửi đến người thắng trong vòng 120 phút.</p>
          </div>
        )}
      </div>
    </div>
  )
}
