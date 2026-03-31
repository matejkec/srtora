export type { LLMAdapter, ChatMessage, ChatRequest, ChatResponse } from './types.js'
export { OllamaAdapter } from './ollama-adapter.js'
export { OpenAICompatibleAdapter } from './openai-compatible-adapter.js'
export { createAdapter } from './create-adapter.js'
export { withRetry } from './retry.js'
export type { RetryOptions } from './retry.js'
export { repairJson, parseJsonSafe } from './json-repair.js'
export { buildTranslateGemmaPrompt } from './translate-gemma-prompt.js'

export {
  augmentPromptForJson,
  prepareRequest,
  prepareRequestForMethod,
  isStructuredOutputError,
} from './output-strategy.js'

// Model Registry — first-class supported model system
export {
  getRegistryEntry,
  resolveExecutionProfile,
  getModelCapabilities,
  listSupportedModels,
  listSupportedModelsGrouped,
  matchDetectedModels,
  getExperimentalProfile,
  EXPERIMENTAL_CAPABILITIES,
} from './model-registry/index.js'
export type { AnnotatedModel } from './model-registry/index.js'
