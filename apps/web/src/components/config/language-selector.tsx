'use client'

import { useEffect } from 'react'
import { useTranslationStore } from '@/stores/translation-store'
import { SOURCE_LANGUAGES, TARGET_LANGUAGES } from '@/lib/languages'
import { isTranslateGemmaModel } from '@srtora/pipeline'
import { ArrowRight } from 'lucide-react'

export function LanguageSelector() {
  const { sourceLanguage, targetLanguage, setSourceLanguage, setTargetLanguage, file, selectedModel } =
    useTranslationStore()

  const isTranslateGemma = selectedModel ? isTranslateGemmaModel(selectedModel) : false

  // When a TranslateGemma model is selected, 'auto' is invalid — reset to English
  useEffect(() => {
    if (isTranslateGemma && sourceLanguage === 'auto') {
      setSourceLanguage('en')
    }
  }, [isTranslateGemma, sourceLanguage, setSourceLanguage])

  if (!file) return null

  // TranslateGemma cannot auto-detect — exclude that option
  const availableSourceLanguages = isTranslateGemma
    ? SOURCE_LANGUAGES.filter((l) => l.code !== 'auto')
    : SOURCE_LANGUAGES

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Source</label>
          <select
            value={sourceLanguage}
            onChange={(e) => setSourceLanguage(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {availableSourceLanguages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        <ArrowRight className="h-4 w-4 text-muted-foreground mt-5 shrink-0" />

        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Target</label>
          <select
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {TARGET_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isTranslateGemma && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          TranslateGemma requires an explicit source language — Auto-detect is not supported.
        </p>
      )}
    </div>
  )
}
