import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { translations } from '@/i18n'
import type { Lang, TranslationKey } from '@/i18n'

interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LangCtx | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const stored = localStorage.getItem('el_lang')
    return stored === 'en' ? 'en' : 'vi'
  })

  const handleSetLang = (l: Lang) => {
    setLang(l)
    localStorage.setItem('el_lang', l)
  }

  const t = (key: TranslationKey): string => translations[lang][key]

  return (
    <LanguageContext.Provider value={{ lang, setLang: handleSetLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used inside LanguageProvider')
  return ctx
}
