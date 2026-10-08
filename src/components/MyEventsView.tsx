import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { ArrowLeft, Trophy, Clock, CheckCircle, XCircle, Plus } from 'lucide-react'
import { useLang } from '@/LanguageContext'
import { EVENT_LUCKY_ABI } from '@/abi'
import { Amount } from '@/onchain-money'
import { usdcDecimalsFor } from '@/onchain-money'

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
}

function formatUsdc(raw: bigint) {
  return Amount.fromRaw(raw, usdcDecimalsFor(ARC_TESTNET_CHAIN_ID)).toFixed(2)
}

function formatTs(ts: bigint) {
  if (!ts) return '-'
  return new Date(Number(ts) * 1000).toLocaleDateString()
}

export default function MyEventsView({ onBack, onViewEvent, onCreateEvent }: MyEventsViewProps) {
  const { address } = useAccount()
  const { t } = useLang()

  // Read total event count
  const { data: nextId } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: EVENT_LUCKY_ABI,
    functionName: 'nextEventId',
    chainId: ARC_TESTNET_CHAIN_ID,
  })

  const total = nextId ? Number(nextId) : 0

  // Read all events at once
  const contracts = Array.from({ length: total }, (_, i) => ({
    address: CONTRACT_ADDRESS,
    abi: EVENT_LUCKY_ABI,
    functionName: 'getEvent' as const,
    args: [BigInt(i)] as [bigint],
    chainId: ARC_TESTNET_CHAIN_ID,
  }))

  const { data: allEvents, isLoading } = useReadContracts({
    contracts,
    query: { enabled: total > 0 },
  })

  // Filter events where host === connected wallet
  const myEvents = allEvents
    ?.map((res, i) => ({ id: i, data: res.result }))
    .filter(({ data }) => {
      if (!data || !address) return false
      const host = data[0] as string
      return host.toLowerCase() === address.toLowerCase()
    }) ?? []

  // oxlint-disable-next-line react/purity
  const now = Math.floor(Date.now() / 1000)

  return (
    <div
      className="relative min-h-dvh overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #f9f9fc 0%, #fffcf7 52%, #fbf7f2 100%)' }}
    >
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div style={{ position: 'absolute', top: '8%', right: '5%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(133,177,237,0.18) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      <div className="relative z-10 mx-auto max-w-md px-4 pb-10 pt-6">
        <header className="mb-6 flex items-center gap-3">
          <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5">
            <ArrowLeft size={18} style={{ color: 'var(--ink)' }} />
          </button>
          <h1 className="display flex-1 text-xl font-bold" style={{ color: 'var(--ink)' }}>
            {t('myEvents')}
          </h1>
          <button
            onClick={onCreateEvent}
            className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
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
            <button
              onClick={onCreateEvent}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              {t('createNewEvent')}
            </button>
          </div>
        )}

        {myEvents.length > 0 && (
          <div className="space-y-3">
            {myEvents.reverse().map(({ id, data }) => {
              if (!data) return null
              const [, evName, , , regDeadline, prizes, drawn, , , , totalPrize] = data as [
                string, string, number, number, bigint,
                { amount: bigint; rank: number }[],
                boolean, number, bigint, boolean, bigint, bigint
              ]

              const regOpen = now <= Number(regDeadline) && !drawn
              const statusColor = drawn ? 'var(--success)' : regOpen ? 'var(--accent)' : 'var(--danger)'
              const statusBg = drawn ? 'rgba(26,128,71,0.10)' : regOpen ? 'rgba(18,45,69,0.07)' : 'rgba(186,43,76,0.09)'
              const statusLabel = drawn ? t('statusDrawn') : regOpen ? t('statusOpen') : t('statusClosed')
              const StatusIcon = drawn ? CheckCircle : regOpen ? Clock : XCircle

              return (
                <button
                  key={id}
                  onClick={() => onViewEvent(String(id))}
                  className="w-full rounded-2xl p-4 text-left transition-opacity hover:opacity-80"
                  style={glass.card}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate" style={{ color: 'var(--ink)' }}>{evName}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                        ID: {id} · {t('regDeadlineLabel')} {formatTs(regDeadline)}
                      </p>
                    </div>
                    <span
                      className="flex-shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{ background: statusBg, color: statusColor }}
                    >
                      <StatusIcon size={11} />
                      {statusLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--accent)' }}>
                      {formatUsdc(totalPrize)} USDC
                    </span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {prizes.length} {t('prizes')}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
