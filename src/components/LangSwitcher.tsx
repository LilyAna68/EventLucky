import { useLang } from '@/LanguageContext'

export default function LangSwitcher() {
  const { lang, setLang } = useLang()

  return (
    <div
      className="flex items-center rounded-full p-0.5 text-xs font-semibold"
      style={{ background: 'rgba(18,45,69,0.08)' }}
    >
      <button
        onClick={() => setLang('vi')}
        className="rounded-full px-3 py-1 transition-colors"
        style={{
          background: lang === 'vi' ? 'white' : 'transparent',
          color: lang === 'vi' ? 'var(--ink)' : 'var(--muted)',
          boxShadow: lang === 'vi' ? '0 1px 4px rgba(18,45,69,0.10)' : 'none',
        }}
      >
        VI
      </button>
      <button
        onClick={() => setLang('en')}
        className="rounded-full px-3 py-1 transition-colors"
        style={{
          background: lang === 'en' ? 'white' : 'transparent',
          color: lang === 'en' ? 'var(--ink)' : 'var(--muted)',
          boxShadow: lang === 'en' ? '0 1px 4px rgba(18,45,69,0.10)' : 'none',
        }}
      >
        EN
      </button>
    </div>
  )
}
