import { create } from 'zustand'
import type {
  ProviderConfig,
  ModelInfo,
  PipelinePhase,
  ProgressEvent,
  SessionMemory,
  TranslationResult,
  PipelineError,
  SubtitleFormat,
} from '@srtora/types'
import type { PresetId } from '@/lib/presets'
import { PRESETS } from '@/lib/presets'

interface FileState {
  filename: string
  content: string
  format: SubtitleFormat
  cueCount: number
  fileSize: number
}

interface TranslationStore {
  // File
  file: FileState | null
  setFile: (file: FileState) => void
  clearFile: () => void

  // Config
  sourceLanguage: string
  targetLanguage: string
  preset: PresetId
  provider: ProviderConfig | null
  selectedModel: string
  availableModels: ModelInfo[]
  apiKey: string
  enableAnalysis: boolean
  enableReview: boolean
  bilingualOutput: boolean
  chunkSize: number
  lookbehind: number
  lookahead: number
  tonePreference: string
  analysisModel: string
  reviewModel: string

  setSourceLanguage: (lang: string) => void
  setTargetLanguage: (lang: string) => void
  setPreset: (preset: PresetId) => void
  setProvider: (provider: ProviderConfig | null) => void
  setSelectedModel: (model: string) => void
  setAvailableModels: (models: ModelInfo[]) => void
  setApiKey: (key: string) => void
  setEnableAnalysis: (enabled: boolean) => void
  setEnableReview: (enabled: boolean) => void
  setBilingualOutput: (enabled: boolean) => void
  setChunkSize: (size: number) => void
  setLookbehind: (value: number) => void
  setLookahead: (value: number) => void
  setTonePreference: (tone: string) => void
  setAnalysisModel: (model: string) => void
  setReviewModel: (model: string) => void

  // Execution
  phase: PipelinePhase
  progress: ProgressEvent | null
  result: TranslationResult | null
  sessionMemory: SessionMemory | null
  error: PipelineError | null
  warnings: string[]

  // Trigger-based pipeline invocation
  translationTrigger: number
  cancelTrigger: number
  requestTranslation: () => void
  requestCancel: () => void

  startTranslation: () => void
  updateProgress: (event: ProgressEvent) => void
  setSessionMemory: (memory: SessionMemory) => void
  completeTranslation: (result: TranslationResult) => void
  failTranslation: (error: PipelineError) => void
  cancelTranslation: () => void
  resetSession: () => void

  // Connection
  connectionStatus: 'untested' | 'testing' | 'connected' | 'error'
  connectionError: string | null
  setConnectionStatus: (
    status: 'untested' | 'testing' | 'connected' | 'error',
    error?: string,
  ) => void
}

export const useTranslationStore = create<TranslationStore>((set) => ({
  // File
  file: null,
  setFile: (file) => set({ file }),
  clearFile: () => set({ file: null }),

  // Config defaults
  sourceLanguage: 'auto',
  targetLanguage: 'hr',
  preset: 'balanced',
  provider: null,
  selectedModel: '',
  availableModels: [],
  apiKey: '',
  enableAnalysis: true,
  enableReview: true,
  bilingualOutput: false,
  chunkSize: 15,
  lookbehind: 3,
  lookahead: 3,
  tonePreference: '',
  analysisModel: '',
  reviewModel: '',

  setSourceLanguage: (lang) => set({ sourceLanguage: lang }),
  setTargetLanguage: (lang) => set({ targetLanguage: lang }),
  setPreset: (presetId) => {
    const preset = PRESETS[presetId]
    set({
      preset: presetId,
      enableAnalysis: preset.enableAnalysis,
      enableReview: preset.enableReview,
      chunkSize: preset.chunkSize,
      lookbehind: preset.lookbehind,
      lookahead: preset.lookahead,
    })
  },
  setProvider: (provider) =>
    set({ provider, connectionStatus: 'untested', connectionError: null, availableModels: [], selectedModel: '', apiKey: '' }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setAvailableModels: (models) => set({ availableModels: models }),
  setApiKey: (key) => set({ apiKey: key }),
  setEnableAnalysis: (enabled) => set({ enableAnalysis: enabled }),
  setEnableReview: (enabled) => set({ enableReview: enabled }),
  setBilingualOutput: (enabled) => set({ bilingualOutput: enabled }),
  setChunkSize: (size) => set({ chunkSize: size }),
  setLookbehind: (value) => set({ lookbehind: value }),
  setLookahead: (value) => set({ lookahead: value }),
  setTonePreference: (tone) => set({ tonePreference: tone }),
  setAnalysisModel: (model) => set({ analysisModel: model }),
  setReviewModel: (model) => set({ reviewModel: model }),

  // Execution defaults
  phase: 'idle',
  progress: null,
  result: null,
  sessionMemory: null,
  error: null,
  warnings: [],

  // Trigger-based pipeline invocation
  translationTrigger: 0,
  cancelTrigger: 0,
  requestTranslation: () => set((state) => ({ translationTrigger: state.translationTrigger + 1 })),
  requestCancel: () => set((state) => ({ cancelTrigger: state.cancelTrigger + 1 })),

  startTranslation: () =>
    set({ phase: 'parsing', progress: null, result: null, error: null, warnings: [], sessionMemory: null }),
  updateProgress: (event) => set({ progress: event, phase: event.phase }),
  setSessionMemory: (memory) => set({ sessionMemory: memory }),
  completeTranslation: (result) =>
    set({
      phase: 'complete',
      result,
      warnings: result.warnings,
      sessionMemory: result.sessionMemory ?? null,
    }),
  failTranslation: (error) => set({ phase: 'error', error }),
  cancelTranslation: () => set({ phase: 'cancelled' }),
  resetSession: () =>
    set({
      phase: 'idle',
      progress: null,
      result: null,
      sessionMemory: null,
      error: null,
      warnings: [],
      file: null,
    }),

  // Connection
  connectionStatus: 'untested',
  connectionError: null,
  setConnectionStatus: (status, error) =>
    set({ connectionStatus: status, connectionError: error ?? null }),
}))
