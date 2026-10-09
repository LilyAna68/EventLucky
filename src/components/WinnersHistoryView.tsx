import { useState, useEffect } from 'react'
import { ArrowLeft, Trophy, ExternalLink } from 'lucide-react'
import { useLang } from '@/LanguageContext'

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001'
const EXPLORER = 'https://explorer.testnet.arc.io/tx/'

const glass = {
  card: {
    background: 'rgba(255,255,255,0.64)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.68)',
    boxShadow: '0 8px 32px rgba(18,45,69,0.08), inset 0 1px 0 rgba(255,255,255,0.55)',
  } as React.CSSProperties,
}

interface WinnerRecord {
  eventId: string
  eventName: string
  winningNumber: number
  winnerAddress: string
  winnerEmail: string
  amount: string
  claimUrl: string
  txHash: string
  notifiedAt: string
}

interface Props {
  onBack: () => void
}

function shortAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''
}

function shortEmail(email: string) {
  if (!email) return 'Chưa có email'
  const [name, domain] = email.split('@')
  return `${name.slice(0, 2)}***@${domain}`
}

export default function WinnersHistoryView({ onBack }: Props) {
  const { t } = useLang()
  const [history, setHistory] = useState<WinnerRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`${SERVER_URL}/winners-history`)
      .then(r => r.json())
      .then((data: { ok: boolean; history: WinnerRecord[] }) => {
        if (data.ok) setHistory(data.history.reverse())
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div
      className="relative min-h-dvh overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #f9f9fc 0%, #fffcf7 52%, #fbf7f2 100%)' }}
    >
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div style={{ position: 'absolute', top: '8%', left: '5%', width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,196,57,0.12) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      <div className="relative z-10 mx-auto max-w-md px-4 pb-10 pt-6">
        <header className="mb-6 flex items-center gap-3">
          <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5">
            <ArrowLeft size={18} style={{ color: 'var(--ink)' }} />
          </button>
          <h1 className="display flex-1 text-xl font-bold" style={{ color: 'var(--ink)' }}>
            {t('winnersHistory')}
          </h1>
        </header>

        {loading && (
          <div className="rounded-2xl p-6 text-center" style={glass.card}>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>⏳ {t('loading')}</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl p-6 text-center" style={glass.card}>
            <p className="text-sm" style={{ color: 'var(--danger)' }}>Không thể kết nối server. Vui lòng thử lại.</p>
          </div>
        )}

        {!loading && !error && history.length === 0 && (
          <div className="rounded-2xl p-8 text-center" style={glass.card}>
            <Trophy size={32} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
            <p className="font-semibold mb-1" style={{ color: 'var(--ink)' }}>Chưa có lịch sử</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Kết quả sẽ xuất hiện ở đây sau mỗi lần quay số.</p>
          </div>
        )}

        {!loading && !error && history.length > 0 && (
          <div className="space-y-3">
            {history.map((rec, i) => (
              <div key={i} className="rounded-2xl p-4" style={glass.card}>
                {/* event name + id */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{rec.eventName}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      Event #{rec.eventId} · {new Date(rec.notifiedAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                  <span
                    className="flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums"
                    style={{ background: 'rgba(255,196,57,0.18)', color: '#b07a00' }}
                  >
                    🎯 Số {rec.winningNumber}
                  </span>
                </div>

                {/* winner info */}
                <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'rgba(18,45,69,0.04)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>Ví thắng</span>
                    <span className="text-xs font-mono font-semibold" style={{ color: 'var(--ink)' }}>{shortAddr(rec.winnerAddress)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>Email</span>
                    <span className="text-xs" style={{ color: 'var(--ink)' }}>{shortEmail(rec.winnerEmail)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>Giải thưởng</span>
                    <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--success)' }}>{rec.amount} USDC</span>
                  </div>
                </div>

                {/* tx link */}
                {rec.txHash && (
                  <a
                    href={`${EXPLORER}${rec.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-1 text-xs"
                    style={{ color: 'var(--muted)' }}
                  >
                    <ExternalLink size={11} />
                    Xem kết quả onchain
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
