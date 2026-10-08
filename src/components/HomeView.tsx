import { Trophy, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { useAccount } from 'wagmi'
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
}

interface HomeViewProps {
  onCreateEvent: () => void
  onJoinEvent: (id: string) => void
  onMyEvents: () => void
}

export default function HomeView({ onCreateEvent, onJoinEvent, onMyEvents }: HomeViewProps) {
  const { isConnected } = useAccount()
  const [eventIdInput, setEventIdInput] = useState('')
  const { t } = useLang()

  const handleJoin = () => {
    const trimmed = eventIdInput.trim()
    if (trimmed) onJoinEvent(trimmed)
  }

  const steps = [t('step1'), t('step2'), t('step3'), t('step4')]

  return (
    <div
      className="relative min-h-dvh overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #f9f9fc 0%, #fffcf7 52%, #fbf7f2 100%)' }}
    >
      {/* background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div style={{ position: 'absolute', top: '8%', left: '5%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(133,177,237,0.22) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '6%', width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,205,131,0.20) 0%, transparent 70%)', filter: 'blur(58px)' }} />
      </div>

      <div className="relative z-10 mx-auto max-w-md px-4 pb-10 pt-6">
        {/* header */}
        <header className="mb-8 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy size={22} style={{ color: 'var(--accent)' }} />
            <span className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>{t('appName')}</span>
          </div>
          <div className="flex items-center gap-2">
            <LangSwitcher />
            <ConnectKitButton />
          </div>
        </header>

        {/* hero */}
        <div className="mb-8 text-center">
          <div
            className="mb-2 inline-block rounded-full px-3 py-1 text-xs font-semibold tracking-widest uppercase"
            style={{ background: 'rgba(18,45,69,0.07)', color: 'var(--muted)' }}
          >
            {t('network')}
          </div>
          <h1 className="display mb-2 text-3xl font-bold" style={{ color: 'var(--ink)' }}>
            {t('heroTitle')}
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {t('heroSub')}
          </p>
        </div>

        {/* join event */}
        <div className="mb-4 rounded-2xl p-5" style={glass.card}>
          <p className="mb-3 text-sm font-semibold" style={{ color: 'var(--ink-2)' }}>
            {t('joinEvent')}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={t('eventIdPlaceholder')}
              value={eventIdInput}
              onChange={e => setEventIdInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              className="flex-1 rounded-xl border-0 px-4 py-3 text-sm outline-none"
              style={{
                background: 'rgba(255,255,255,0.46)',
                border: '1px solid rgba(255,255,255,0.56)',
                color: 'var(--ink)',
              }}
            />
            <button
              onClick={handleJoin}
              className="flex items-center gap-1 rounded-xl px-4 py-3 text-sm font-semibold transition-colors"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              <Search size={15} />
              {t('view')}
            </button>
          </div>
        </div>

        {/* create event */}
        {isConnected && (
          <div className="flex gap-2">
            <button
              onClick={onCreateEvent}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-4 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              <Plus size={16} />
              {t('createNewEvent')}
            </button>
            <button
              onClick={onMyEvents}
              className="flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: 'rgba(18,45,69,0.10)', color: 'var(--ink)' }}
            >
              {t('myEvents')}
            </button>
          </div>
        )}

        {!isConnected && (
          <div
            className="rounded-2xl p-4 text-center text-sm"
            style={{ background: 'rgba(18,45,69,0.04)', color: 'var(--muted)' }}
          >
            {t('connectWalletToCreate')}
          </div>
        )}

        {/* how it works */}
        <div className="mt-8 rounded-2xl p-5" style={glass.card}>
          <p className="mb-4 text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('howItWorks')}</p>
          <div className="space-y-3">
            {steps.map((text, i) => (
              <div key={i} className="flex items-start gap-3">
                <span
                  className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: 'var(--accent)', color: 'white' }}
                >
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-2)' }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
