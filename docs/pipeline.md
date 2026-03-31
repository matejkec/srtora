# Translation Pipeline

## Overview

SRTora uses a 5-phase translation pipeline that processes subtitle files through analysis, chunked translation, review, and assembly. Each phase produces validated structured output.

## Phase 0: Parse

**Input:** Raw subtitle file content + filename
**Output:** `SubtitleDocument` with cues, metadata, and format info

- Detects file format (SRT vs VTT) automatically
- Parses all cues with timestamps, text, and inline formatting tags
- Normalizes content (BOM removal, line ending normalization)
- Validates document structure

## Phase 1: Analyze (Optional)

**Input:** Sample of up to 50 cues from the document
**Output:** `SessionMemory` with speakers, terms, warnings, tone profile

- Samples cues evenly distributed across the document
- Sends to analysis model (or falls back to translation model)
- Extracts: speaker identities, gender (with confidence), register, terminology, tone
- Validated against `SessionMemorySchema` via Zod
- Gracefully degrades on failure — translation continues without memory

## Phase 2: Translate

**Input:** Chunks with target cues + context windows + session memory
**Output:** Translated text for each cue

### Chunking Strategy

Documents are split into overlapping chunks using **token-budget-first sizing**:

```
Chunk 1:  [context_before] [TARGET_CUES] [context_after]
Chunk 2:              [context_before] [TARGET_CUES] [context_after]
Chunk 3:                          [context_before] [TARGET_CUES] [context_after]
```

- **Token budget**: Each chunk accumulates cues until the per-chunk token budget is reached. This produces variable-size chunks — short cues (one-word subtitles) group into larger chunks, while long cues (dense dialogue) produce smaller chunks. The budget is derived from the model's context window, output limits, quality mode, and per-model tuning.
- **maxCueCount guardrail**: Safety limit of 100/200/300 cues per chunk (based on file size). Prevents pathologically large chunks even with huge token budgets.
- **Fixed fallback**: Models with `idealChunkTarget` set use fixed cue-count chunking instead.
- **lookbehind**: Number of already-translated cues shown as context (default: 3, tunable via quality mode and config)
- **lookahead**: Number of upcoming cues shown as context (default: 3, tunable via quality mode and config)
- Previous translations are included with context cues for continuity

### Translation Memory Injection

Session memory from the analysis phase is filtered before injection into translation prompts based on the model's `memoryInjection` profile field:

- **`full`** — Complete memory (speakers, terms, style notes). Used by most cloud models.
- **`terms-only`** — Only glossary/terminology entries (speakers stripped). Used by budget and local models to conserve context.
- **`none`** — No memory injected. Used by TranslateGemma (translation-only models).

The analysis phase still runs independently when enabled — `memoryInjection` only controls what gets passed into translation and review prompts.

### Prompt Structure

```
System: You are a professional subtitle translator...
        [Session memory: speakers, terms, tone]
        [Output rules: JSON format, tag preservation, etc.]

User:   --- CONTEXT (already translated) ---
        [1] Hello → Bok

        --- TRANSLATE ---
        [2] How are you?
        [3] I'm fine, thanks.

        --- CONTEXT (upcoming) ---
        [4] See you later.
```

### Structured Output

- Translation prompts include a JSON schema for enforcement
- Both Ollama (`format` field) and OpenAI-compatible (`response_format.json_schema`) are supported
- Output is validated: all target cues must have translations
- Missing translations fall back to source text with a warning

### Strategy Selection

The orchestrator selects the prompt strategy based on the model's execution profile:

- **DefaultStrategy** (`promptStyleId: 'default'`): Separate system + user messages (most models)
- **NoSystemRoleStrategy** (`promptStyleId: 'no-system-role'`): Single user message combining system context + user content (Gemma models and models that don't support the system role)
- **Raw completion** (`promptStyleId: 'raw-completion'`): Direct text completion without chat formatting (TranslateGemma)

Strategy selection is automatic — determined by the model's registry entry, not heuristic model name matching.

## Phase 3: Review (Optional)

**Input:** All translations + session memory + source cues
**Output:** Corrections for flagged issues

### Review Depth

The review phase is gated by the model's `reviewDepth` profile field:

- **`thorough`** — Full multi-pass review. Used by premium models (GPT-5.4, Gemini 3.1 Pro, Claude Opus).
- **`basic`** — Standard single-pass review. Used by balanced, budget, and local analysis models.
- **`none`** — Review phase is skipped entirely. Used by translation-only models (TranslateGemma).

When `enableReview` is `true` in the pipeline config but the model's `reviewDepth` is `none`, the review phase is still skipped.

### Automated Flagging

Before sending to the LLM, translations are automatically flagged for:

| Flag | Trigger |
|------|---------|
| `empty_translation` | Empty translation for non-empty source |
| `missing_tag` | Formatting tags present in source but missing in translation |
| `length_issue` | Translation >3x or <0.2x source length |
| `term_inconsistency` | Source contains a term but translation doesn't use the established translation |

### LLM Review

Only flagged cues are sent to the review model for correction. The review model returns specific corrections that are applied back to the translation map.

If review fails, the pipeline continues with the original translations.

## Phase 4: Assemble

**Input:** Final translations + original document
**Output:** Translated file content + optional bilingual content

- Merges chunk results into a complete translation map
- Substitutes translated text into the original document structure
- Preserves all timestamps, numbering, cue order
- Validates: same cue count, no empty translations, no extra cues
- Optionally generates bilingual output (source + target per cue)

## Retry and Error Handling

- Each chunk can be retried independently (default: 2 retries)
- Exponential backoff with jitter between retries
- Non-recoverable errors (auth, model not found) fail immediately
- Recoverable errors (server errors, rate limits) are retried
- Pipeline supports `AbortSignal` for cancellation at any point

### Profile-Driven Retry

Retry behavior is tuned per model:

- **Temperature escalation**: Tier 2 and Tier 3 retry temperatures come from the model's execution profile (not hardcoded)
- **Retry delay**: Local models use 200ms base delay (no rate limits); cloud models use 1000-2000ms
- **Max retries**: Determined by quality mode, overridable by the model profile and user config

## Progress Tracking

Progress is calculated using weighted phase percentages:

| Phase | Weight |
|-------|--------|
| Parsing | 0–2% |
| Analyzing | 2–15% |
| Translating | 15–85% |
| Reviewing | 85–95% |
| Assembling | 95–100% |

ETA is estimated using an exponential moving average of chunk processing times.
