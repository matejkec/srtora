# Supported Models

## Overview

SRTora maintains a curated registry of **13 models** -- 9 cloud and 4 local -- each with an individually tuned execution profile. These profiles control how the pipeline interacts with the model: chunk sizing, context window usage, retry behavior, structured output method, prompt formatting, review depth, translation memory injection, and more. Every parameter is calibrated per model to maximize translation quality and reliability.

Models not found in the registry still work. They are treated as **experimental** and run with conservative provider-level defaults. This means any OpenAI-compatible, Google, Anthropic, or Ollama model can be used immediately, but registered models produce better results because their profiles are optimized for their specific capabilities and limitations.

The registry lives in `packages/adapters/src/model-registry/` and is the single source of truth for model metadata across the entire application.

---

## Cloud Models

These models are accessed via provider APIs and require an API key.

| Model | Provider | Category | Context | Max Output | Output Method | Description |
|---|---|---|---|---|---|---|
| gpt-5.4 | OpenAI | Premium | 272K | 32K | json-schema | Most capable OpenAI. Excellent reasoning and multilingual quality. |
| gpt-5.4-mini | OpenAI | Balanced | 1M | 32K | json-schema | Great value OpenAI. Large context window. |
| gemini-3.1-pro-preview | Google | Premium | 1M | 65K | json-schema | Best Gemini. Excellent reasoning and multilingual quality. |
| gemini-3-flash-preview | Google | Balanced | 1M | 65K | json-schema | Fast Gemini 3 model. Good balance of speed and quality. |
| gemini-3.1-flash-lite-preview | Google | Budget | 1M | 65K | json-schema | Budget Gemini for high-volume translation. |
| gemini-2.5-flash | Google | Balanced | 1M | 65K | json-schema | Stable production fallback. Proven and reliable. |
| claude-opus-4-6 | Anthropic | Premium | 1M | 128K | prompted | Most capable Claude. Best nuance and reasoning. |
| claude-sonnet-4-6 | Anthropic | Balanced | 1M | 64K | prompted | Best value Claude. Excellent quality with fast responses. |
| claude-haiku-4-5 | Anthropic | Budget | 200K | 64K | prompted | Fast and affordable Claude. |

---

## Local Models (Ollama)

These models run locally via Ollama and require no API key. They are matched against the registry using exact ID matching, Ollama family metadata, and regex patterns -- so variant names, quantization tags, and custom suffixes are handled automatically.

| Model | Category | Context | Max Output | Output Method | Prompt Style | Description |
|---|---|---|---|---|---|---|
| translategemma:4b | Local Translation | 8K | 4K | none | raw-completion | Lightweight translation model. Fast, purpose-built. |
| translategemma:12b | Local Translation | 8K | 4K | none | raw-completion | Higher quality translation. Better nuance than 4B. |
| gemma3:4b | Local Analysis | 128K | 8K | ollama-format | no-system-role | Lightweight local model for analysis. 140+ languages. |
| gemma3:12b | Local Analysis | 128K | 8K | ollama-format | no-system-role | Mid-size local model. Better reasoning than 4B. |

---

## Model Categories

### Cloud Categories

- **Premium** -- Highest quality, highest cost. Flagship models from each provider offering the best translation accuracy, nuance, and handling of complex or rare language pairs. Use for professional or critical translations where quality is paramount.

- **Balanced** -- Best balance of quality and speed. Strong translation quality at a fraction of the cost and latency of premium models. The default choice for most users and most translation tasks.

- **Budget** -- Affordable, fast, good enough for many use cases. Ideal for high-volume bulk translation, drafts, or simple language pairs where top-tier quality is not required.

### Local Categories

- **Local Translation** -- Purpose-built translation models (TranslateGemma). These handle only translation -- no analysis or review -- but are specifically trained for translation quality. They use a specialized pipeline path with raw completions and no JSON output.

- **Local Analysis** -- General-purpose local models capable of the full pipeline: analysis, translation, and review. Suitable for users who want to run the entire workflow locally without cloud API access.

---

## Execution Profiles

Every registered model carries an `ExecutionProfile` that controls how the pipeline communicates with it.

### Structured Output

- **structuredOutputMethod** -- How JSON output is requested from the model.
  - `json-schema`: Native JSON schema enforcement via the API's `response_format` parameter. Used by OpenAI and Google models. Most reliable.
  - `ollama-format`: Ollama's native `format` field for JSON output. Used by Gemma 3 local models.
  - `prompted`: JSON structure is requested via prompt instructions and repaired on parse failure. Used by Anthropic models (which lack native JSON schema support). Works well because Claude follows JSON instructions reliably.
  - `none`: No JSON output. The model returns raw text. Used by TranslateGemma for its specialized translation-only workflow.

### Prompt Formatting

- **promptStyleId** -- Controls how prompts are structured.
  - `default`: Standard system + user message format. Used by most cloud models.
  - `no-system-role`: Merges system instructions into the user message. Used by models that do not support a separate system role (Gemma 3).
  - `raw-completion`: Per-cue completion style via `/v1/completions`. Used by TranslateGemma for its specialized translation-only workflow.

### Context and Chunk Sizing

- **contextUsageMultiplier** -- Scales the quality mode's context usage target. A value of `1.0` means standard chunking. Higher values allow larger chunks for models that handle them reliably. Lower values produce smaller, safer chunks for models that struggle with long inputs.

- **defaultLookbehind** / **defaultLookahead** -- Per-model context cue counts that control how many surrounding cues are included as context when translating a chunk. These are tuned per model to balance translation coherence against context window consumption.

  | Category | Lookbehind | Lookahead |
  |---|---|---|
  | Premium | 5 | 3 |
  | Balanced / Budget | 3 | 3 |
  | Local (small) | 2 | 1 |
  | gemma3:12b | 3 | 2 |

### Token Budgets

These fields give fine-grained control over how the adaptive chunk calculator sizes chunks per model. The pipeline uses token-budget-first chunking: instead of slicing by fixed cue count, it accumulates cues per chunk until the token budget is reached, producing variable-size chunks where short cues yield larger chunks and long cues yield smaller ones.

- **safeInputBudget** -- Pre-calculated safe input token budget (in tokens). When set, replaces the default `contextWindow * contextUsageTarget` calculation. Useful for models where the context window is misleadingly large (e.g., GPT-5.4's 272K context warrants an explicit budget to ensure headroom). Set to `null` to derive automatically.
- **idealChunkTarget** -- Target cue count for best quality. When set, the orchestrator uses fixed cue-count chunking instead of token-budget chunking. Set to `null` to let the token-budget calculator determine variable chunk sizes.
- **hardChunkCeiling** -- Absolute maximum cue count per chunk, regardless of what the adaptive calculator computes. Applied on top of the dynamic max (100/200/300 based on file size). Set to `null` to use only the dynamic max.
- **outputStabilityThreshold** -- Fraction of `maxCompletionTokens` the pipeline actually uses (0.1--1.0, default 0.85). Models that degrade at high output length should use lower values.

### Output Limits

- **maxCompletionTokens** -- Hard ceiling for `max_tokens` in API requests. Set per model to stay within the model's actual output capacity. Cloud models typically use 8K--16K; local models use 4K. Set to `null` to omit from the request (uses server default).

### Temperature and Retries

- **temperature** -- Base temperature for translation requests. Set to `null` to use the model's server-side default.
- **retryTemperatureTier2** -- Temperature used for the second progressive retry tier (default: `0.3`).
- **retryTemperatureTier3** -- Temperature used for the third progressive retry tier (default: `0.5`).
- **retryBaseDelayMs** -- Base delay in milliseconds between retries. Low for local models (`200ms`, no rate limits), higher for rate-limited cloud APIs (`1000--2000ms`).

### Review Depth

- **reviewDepth** -- Controls how thorough the post-translation quality review phase is.
  - `thorough`: Full multi-pass review. Used by premium models.
  - `basic`: Standard single-pass review. Used by balanced, budget, and local analysis models.
  - `none`: Review phase skipped entirely. Used by TranslateGemma (translation-only models).

### Translation Memory Injection

- **memoryInjection** -- Controls how translation memory entries are included in prompts.
  - `full`: Complete TM context (terms, previous translations, style notes). Used by most cloud models.
  - `terms-only`: Only glossary/terminology entries. Used by budget models (Haiku) and smaller local models (Gemma) to conserve context window.
  - `none`: No TM injection. Used by TranslateGemma (handles only raw translation).

### Capability Flags

- **canAnalyze** -- Whether the model supports the analysis phase (pre-translation document analysis). Most models can, but TranslateGemma cannot.
- **canReview** -- Whether the model supports the review phase (post-translation quality review). Same constraints as `canAnalyze`.
- **translationOnly** -- When `true`, the model is dedicated to translation and cannot perform analysis or review. The pipeline skips those phases entirely.

### Prompt Behavior

- **needsJsonReminder** -- Whether to add explicit JSON formatting instructions in prompts. Enabled for models that benefit from reinforcement (Anthropic prompted mode, Gemma, experimental models).
- **supportsSystemRole** -- Whether the model supports separate system messages. When `false`, system content is merged into the user message via the `no-system-role` prompt style.

---

## Cross-Provider Matching

MLX models served via an `openai-compatible` provider are matched against Ollama registry entries using regex patterns. When a match is found, the model inherits the Ollama entry's execution profile with one automatic override: `ollama-format` is replaced with `prompted`, since the OpenAI-compatible API does not support Ollama's native `format` field.

This means users running quantized models through tools like LM Studio or llama.cpp's OpenAI-compatible server get tuned profiles without any manual configuration.

---

## Experimental Models

Any model not found in the registry is automatically treated as **experimental**. The system resolves a conservative fallback profile based on the provider type:

| Provider | Output Method | Context Multiplier | Max Completion | Retry Delay | JSON Reminder |
|---|---|---|---|---|---|
| OpenAI | json-schema | 0.8 | 4K | 1000ms | No |
| Google | prompted | 0.8 | 4K | 1500ms | Yes |
| Anthropic | prompted | 0.8 | 4K | 2000ms | Yes |
| Ollama | ollama-format | 0.6 | 4K | 200ms | Yes |
| OpenAI-compatible | prompted | 0.6 | 4K | 500ms | Yes |

Conservative capability defaults are also applied when the registry has no context window or output token data for the model:

| Provider | Default Context Window | Default Max Output |
|---|---|---|
| OpenAI | 128K | 16K |
| Google | 1M | 8K |
| Anthropic | 200K | 8K |
| Ollama | 4K | 2K |
| OpenAI-compatible | 4K | 2K |

Experimental models have all features enabled (analysis, review, translation), but quality may vary because the profile is not tuned for the model's specific behavior. For best results, add a proper registry entry.

---

## Adding a New Model

To add a new supported model to the registry:

1. **Create or edit the appropriate profile file** in `packages/adapters/src/model-registry/profiles/`. Each provider has its own file: `openai.ts`, `google.ts`, `anthropic.ts`, `ollama.ts`.

2. **Define a `ModelRegistryEntry`** with all required fields. Use the `profile()` helper to build the execution profile with sensible defaults.

3. **Add the entry to the profiles array export** (e.g., `OPENAI_MODELS`, `OLLAMA_MODELS`).

4. **The entry is automatically included** in `registry-data.ts` via the existing imports, and becomes available through the public API (`getRegistryEntry`, `resolveExecutionProfile`, `listSupportedModels`, etc.).

5. **No other code changes are needed.** The matcher, profile resolver, and UI model selectors all pick up new entries automatically.

### Minimal Example

```typescript
// In packages/adapters/src/model-registry/profiles/ollama.ts

['my-model:7b', {
  id: 'my-model:7b',
  displayName: 'My Model 7B',
  provider: 'ollama',
  tier: 'supported',
  category: 'local-analysis',
  description: 'Brief description of the model and its strengths.',
  contextWindow: 32_768,
  maxOutputTokens: 8_192,
  ollamaFamily: 'my-model',
  matchPatterns: ['^my[\\-_]?model[:\\-_]7b'],
  executionProfile: profile({
    structuredOutputMethod: 'ollama-format',
    promptStyleId: 'default',
    contextUsageMultiplier: 0.8,
    maxCompletionTokens: 4_096,
    retryBaseDelayMs: 200,
    defaultLookbehind: 2,
    defaultLookahead: 1,
    reviewDepth: 'basic',
    memoryInjection: 'terms-only',
  }),
}],
```

For Ollama models, include `ollamaFamily` and `matchPatterns` so that variant names (e.g., `my-model:7b-instruct-q4_0`) are matched correctly. Cloud models do not need these fields because their IDs are deterministic.
