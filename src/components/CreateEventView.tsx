import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { erc20Abi } from 'viem'
import { toast } from 'sonner'
import { getUsdc, requireChain } from '@/onchain-facts'
import { parseAmount } from '@/onchain-money'
import { EVENT_LUCKY_ABI } from '@/abi'
import { useLang } from '@/LanguageContext'
import LangSwitcher from '@/components/LangSwitcher'
import type { PrizeTier } from '@/types'

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

interface CreateEventViewProps {
  onBack: () => void
  onCreated: (eventId: string) => void
}

export default function CreateEventView({ onBack, onCreated }: CreateEventViewProps) {
  const { address, chainId } = useAccount()
  const { t } = useLang()

  const [name, setName] = useState('')
  const [minNumber, setMinNumber] = useState('1')
  const [maxNumber, setMaxNumber] = useState('100')
  const [deadline, setDeadline] = useState('')
  const [prizes, setPrizes] = useState<PrizeTier[]>([
    { rank: 1, amount: '' },
  ])
  const [step, setStep] = useState<'form' | 'approving' | 'creating' | 'done'>('form')

  const usdcFact = getUsdc(ARC_TESTNET_CHAIN_ID)
  const chain = requireChain(ARC_TESTNET_CHAIN_ID)

  const totalPrize = prizes.reduce((sum, p) => {
    const n = parseFloat(p.amount) || 0
    return sum + n
  }, 0)

  // approve tx
  const { writeContract: approve, data: approveHash } = useWriteContract()
  const { isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })

  // createEvent tx
  const { writeContract: createEvent, data: createHash } = useWriteContract()
  const { isSuccess: createSuccess, data: createReceipt } = useWaitForTransactionReceipt({ hash: createHash })

  const addPrize = () => {
    if (prizes.length >= 5) return
    setPrizes(prev => [...prev, { rank: prev.length + 1, amount: '' }])
  }
  const removePrize = (idx: number) => {
    setPrizes(prev => prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, rank: i + 1 })))
  }
  const updatePrize = (idx: number, amount: string) => {
    setPrizes(prev => prev.map((p, i) => i === idx ? { ...p, amount } : p))
  }

  const validate = () => {
    if (!name.trim()) { toast.error(t('errNoName')); return false }
    if (!deadline) { toast.error(t('errNoDeadline')); return false }
    const dl = new Date(deadline).getTime()
    const now = Date.now()
    if (dl <= now + 60 * 60 * 1000) { toast.error(t('errDeadlinePast')); return false }
    if (dl > now + 30 * 24 * 60 * 60 * 1000) { toast.error(t('errDeadlineTooFar')); return false }
    if (parseInt(minNumber) >= parseInt(maxNumber)) { toast.error(t('errMinMax')); return false }
    if (prizes.some(p => !parseFloat(p.amount) || parseFloat(p.amount) <= 0)) { toast.error(t('errPrizeZero')); return false }
    if (!CONTRACT_ADDRESS) { toast.error(t('errNoContract')); return false }
    if (!usdcFact) { toast.error(t('errNoUsdc')); return false }
    return true
  }

  const handleSubmit = () => {
    if (!validate() || !address || !usdcFact) return
    if (chainId !== ARC_TESTNET_CHAIN_ID) {
      toast.error(`${t('errWrongChain')} ${chain.name}`)
      return
    }

    setStep('approving')
    const prizeAmountsRaw = prizes.map(p => parseAmount(ARC_TESTNET_CHAIN_ID, p.amount).raw)
    const totalRaw = prizeAmountsRaw.reduce((a, b) => a + b, 0n)

    try {
      approve({
        address: usdcFact.address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [CONTRACT_ADDRESS, totalRaw],
        chainId: ARC_TESTNET_CHAIN_ID,
      })
    } catch {
      toast.error(t('errApprove'))
      setStep('form')
    }
  }

  // Watch approve success then call createEvent
  useEffect(() => {
    if (approveSuccess && step === 'approving' && usdcFact) {
      setStep('creating')
      const prizeAmountsRaw = prizes.map(p => parseAmount(ARC_TESTNET_CHAIN_ID, p.amount).raw)
      const deadlineTs = BigInt(Math.floor(new Date(deadline).getTime() / 1000))
      createEvent({
        address: CONTRACT_ADDRESS,
        abi: EVENT_LUCKY_ABI,
        functionName: 'createEvent',
        args: [
          name.trim(),
          parseInt(minNumber),
          parseInt(maxNumber),
          deadlineTs,
          prizeAmountsRaw,
          500n,
        ],
        chainId: ARC_TESTNET_CHAIN_ID,
      })
    }
  }, [approveSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  // Watch createEvent success
  useEffect(() => {
    if (createSuccess && createReceipt && step === 'creating') {
      const log = createReceipt.logs[0]
      const eventId = log?.topics?.[1] ? BigInt(log.topics[1]).toString() : '0'
      setStep('done')
      toast.success('Event đã tạo thành công!')
      setTimeout(() => onCreated(eventId), 800)
    }
  }, [createSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  const rankLabel = (r: number) => {
    if (r === 1) return t('rankFirst')
    if (r === 2) return t('rankSecond')
    if (r === 3) return t('rankThird')
    return `${t('rankN')} ${r}`
  }

  const isSubmitting = step === 'approving' || step === 'creating'

  return (
    <div
      className="relative min-h-dvh overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #f9f9fc 0%, #fffcf7 52%, #fbf7f2 100%)' }}
    >
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div style={{ position: 'absolute', top: '5%', right: '8%', width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(133,177,237,0.18) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      <div className="relative z-10 mx-auto max-w-md px-4 pb-10 pt-6">
        <header className="mb-6 flex items-center gap-3">
          <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-black/5">
            <ArrowLeft size={18} style={{ color: 'var(--ink)' }} />
          </button>
          <h1 className="display flex-1 text-xl font-bold" style={{ color: 'var(--ink)' }}>{t('createEvent')}</h1>
          <LangSwitcher />
        </header>

        <div className="space-y-4">
          {/* basic info */}
          <div className="rounded-2xl p-5" style={glass.card}>
            <p className="mb-4 text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('basicInfo')}</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('eventName')}</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('eventNamePlaceholder')}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ ...glass.inner, color: 'var(--ink)' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('minNumber')}</label>
                  <input
                    type="number"
                    value={minNumber}
                    onChange={e => setMinNumber(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                    style={{ ...glass.inner, color: 'var(--ink)' }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('maxNumber')}</label>
                  <input
                    type="number"
                    value={maxNumber}
                    onChange={e => setMaxNumber(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                    style={{ ...glass.inner, color: 'var(--ink)' }}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('registrationDeadline')}</label>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ ...glass.inner, color: 'var(--ink)' }}
                />
                <p className="mt-1.5 text-xs" style={{ color: 'var(--muted)' }}>
                  {t('registrationDeadlineHint')}
                </p>
              </div>
            </div>
          </div>

          {/* prizes */}
          <div className="rounded-2xl p-5" style={glass.card}>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('prizes')}</p>
              {prizes.length < 5 && (
                <button
                  onClick={addPrize}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
                  style={{ background: 'rgba(18,45,69,0.07)', color: 'var(--ink)' }}
                >
                  <Plus size={12} /> {t('addPrize')}
                </button>
              )}
            </div>
            <div className="space-y-3">
              {prizes.map((p, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span
                    className="flex-shrink-0 w-20 rounded-lg px-2 py-1 text-center text-xs font-semibold"
                    style={{ background: 'var(--accent)', color: 'white' }}
                  >
                    {rankLabel(p.rank)}
                  </span>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={p.amount}
                      step="0.01"
                      placeholder="0.00"
                      onChange={e => updatePrize(idx, e.target.value)}
                      className="w-full rounded-xl px-4 py-3 pr-16 text-sm outline-none"
                      style={{ ...glass.inner, color: 'var(--ink)' }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--muted)' }}>USDC</span>
                  </div>
                  {prizes.length > 1 && (
                    <button onClick={() => removePrize(idx)} className="flex-shrink-0 rounded-lg p-2 hover:bg-red-50">
                      <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'rgba(18,45,69,0.04)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('totalToApprove')}</span>
              <span className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
                {totalPrize.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDC
              </span>
            </div>
          </div>

          {/* note about commit-reveal */}
          <div
            className="rounded-xl px-4 py-3 text-xs"
            style={{ background: 'rgba(133,177,237,0.12)', color: 'var(--ink-2)' }}
            dangerouslySetInnerHTML={{ __html: t('commitRevealNote') }}
          />

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !address}
            className="w-full rounded-2xl py-4 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {step === 'form' && t('btnCreate')}
            {step === 'approving' && t('btnApproving')}
            {step === 'creating' && t('btnCreating')}
            {step === 'done' && t('btnDone')}
          </button>

          {!address && (
            <p className="text-center text-xs" style={{ color: 'var(--muted)' }}>{t('connectWalletToCreateShort')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
