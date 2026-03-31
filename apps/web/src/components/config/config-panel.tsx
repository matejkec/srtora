'use client'

import { FileUploadZone } from './file-upload-zone'
import { LanguageSelector } from './language-selector'
import { PresetSelector } from './preset-selector'
import { ProviderSelector } from './provider-selector'
import { ModelSelector } from './model-selector'
import { AdvancedSettings } from './advanced-settings'
import { TranslateButton } from './translate-button'

export function ConfigPanel() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">SRTora</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Local-first subtitle translation
        </p>
      </div>

      {/* File Upload */}
      <FileUploadZone />

      {/* Language Selection */}
      <LanguageSelector />

      {/* Preset Selection */}
      <PresetSelector />

      {/* Provider Selection */}
      <ProviderSelector />

      {/* Model Selection */}
      <ModelSelector />

      {/* Advanced Settings */}
      <AdvancedSettings />

      {/* Translate Button */}
      <TranslateButton />
    </div>
  )
}
