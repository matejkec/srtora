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

Documents are split into overlapping chunks:

```
Chunk 1:  [context_before] [TARGET_CUES] [context_after]
Chunk 2:              [context_before] [TARGET_CUES] [context_after]
Chunk 3:                          [context_before] [TARGET_CUES] [context_after]
```

- **chunkSize**: Number of target cues per chunk (default: 15)
- **lookbehind**: Number of already-translated cues shown as context (default: 3)
- **lookahead**: Number of upcoming cues shown as context (default: 3)
- Previous translations are included with context cues for continuity

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

The orchestrator auto-detects which prompt strategy to use:

- **DefaultStrategy**: Separate system + user messages (most models)
- **GemmaStrategy**: Single user message combining both (TranslateGemma, Gemma models)

Detection is based on the model name containing "gemma".

## Phase 3: Review (Optional)

**Input:** All translations + session memory + source cues
**Output:** Corrections for flagged issues

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
