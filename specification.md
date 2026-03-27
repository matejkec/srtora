# SRTora — Product & Technical Specification

Version: 1.0  
Status: Implementation-ready, opinionated specification  
Document type: Product + architecture specification  
Audience: Senior engineer / AI agent implementing the product

---

## 1. Purpose

SRTora is a local-first web application for high-quality subtitle translation. A user uploads an `.srt` or `.vtt` subtitle file, configures translation settings, runs an AI-assisted translation pipeline, and downloads a translated subtitle file in the original format.

The product is optimized for **natural subtitle localization**, not literal sentence conversion. It should preserve:

- speaker intent
- register and tone
- term consistency
- subtitle brevity / readability
- formatting and timing integrity
- grammatical agreement in target languages that require it (for example Croatian)

The application must work well in two main operating modes:

1. **Local-first mode** — preferred mode. Models run on the user machine through local inference servers such as Ollama or MLX-compatible servers.
2. **Cloud mode** — optional mode. The user may connect cloud model providers with ephemeral API keys entered per session.

This spec is intentionally opinionated. It should not be treated as a rigid contract where every sentence must be followed literally. Where implementation details change for a clearly better reason, the implementer may choose a superior alternative, but must preserve the product goals and architectural principles in this document.

---

## 2. Product principles

These principles are the highest-priority requirements and override lower-level implementation details.

### 2.1 Local-first
The app should feel native to a local workflow. A user should be able to run SRTora with minimal infrastructure, minimal cost, and minimal operational overhead.

### 2.2 Quality over gimmicks
The product should focus on subtitle translation quality, consistency, and reliability. It must avoid unnecessary AI complexity that increases latency or fragility without clear quality benefit.

### 2.3 Lightweight by design
The system should not require heavy infrastructure for the single-user / personal deployment case. Prefer:

- SQLite over server databases when feasible
- file-based or embedded storage over extra services
- in-process queues over Redis for local mode
- simple deployment targets

### 2.4 Progressive complexity
The app should be easy in default mode and powerful in advanced mode. Simple users should not be forced to understand model orchestration, retrieval, prompt design, or provider-specific quirks.

### 2.5 Deterministic, validated pipeline
The app must validate model outputs at every important step. It should never blindly trust LLM output. Invalid structured output must be retried, repaired, or surfaced cleanly.

### 2.6 Privacy-respecting
In local mode, subtitle contents must remain on the user's machine. In cloud mode, the app must clearly state that subtitle contents are sent to the chosen provider.

---

## 3. Product goals

### 3.1 Core goals
- Upload and translate `.srt` and `.vtt` subtitle files
- Preserve original subtitle structure exactly
- Support both local and cloud AI providers
- Produce translations that are subtitle-appropriate and natural
- Support context-aware translation, terminology memory, speaker memory, and targeted review
- Run well on Apple Silicon laptops, especially MacBook M-series devices

### 3.2 Quality goals
- Correctly preserve formatting tags and line breaks
- Avoid inconsistent translation of names, titles, places, and recurring terms
- Improve gender agreement in languages such as Croatian whenever context allows
- Avoid overlong target subtitles when source cues are short
- Preserve the exact number of subtitle entries

### 3.3 Operational goals
- Cheap to deploy
- No mandatory third-party infrastructure for the main local-first use case
- No heavy always-on background services required for local mode
- Reasonable performance on laptop-class hardware

---

## 4. Non-goals

The following are explicitly out of scope for the first serious implementation unless later added intentionally:

- user accounts
- team collaboration
- persistent cloud history
- batch translation of many files in one job
- human editing UI inside the app
- CLI-first product
- mobile-first product
- collaborative translation memory across users
- enterprise multi-tenant architecture
- microservices
- mandatory Redis, Kafka, Postgres, or vector databases

---

## 5. Hard requirements vs soft requirements

This document uses these terms intentionally:

### MUST
A hard requirement. Implementation should comply unless there is a technical impossibility.

### SHOULD
A strong recommendation. The implementer may deviate if there is a clear, documented reason.

### MAY
Optional enhancement.

---

## 6. Primary user journeys

### 6.1 Simple local workflow
1. User opens the app.
2. User uploads an `.srt` or `.vtt` file.
3. User selects source language, target language, and local provider.
4. User selects a model or accepts the recommended default.
5. User clicks **Translate**.
6. App runs the pipeline locally, shows progress, and returns a translated file for download.

### 6.2 Advanced local workflow
1. User uploads file.
2. User opens **Advanced** settings.
3. User selects:
   - analysis model
   - translation model
   - review model (optional, usually off by default)
   - retrieval / glossary options
4. User translates.
5. App shows extracted translation context and progress.
6. User downloads result.

### 6.3 Cloud workflow
1. User uploads file.
2. User selects cloud provider.
3. User enters API key for current session only.
4. User translates.
5. App runs the same pipeline through cloud adapters and streams progress back.
6. User downloads result.

---

## 7. Product modes and presets

The UI and pipeline should support **presets** rather than forcing raw complexity.

### 7.1 Presets

#### Simple
- one model only
- no explicit analysis model selection
- default chunking
- no user-visible retrieval tuning
- best for casual users

#### Balanced
- one model or recommended split model pair
- analysis phase enabled
- targeted review enabled
- lightweight retrieval enabled if local memory exists

#### Quality
- analysis + translation split is preferred
- targeted review enabled
- glossary + translation memory retrieval enabled
- slower but higher quality

#### Advanced
- user may override:
  - analysis model
  - translation model
  - review model
  - chunk size
  - context window size
  - retrieval sources
  - provider-specific options

### 7.2 Recommendation
The default visible experience SHOULD be `Balanced`. `Advanced` should be available but collapsed behind an advanced section.

---

## 8. Supported file formats

### MUST support
- SRT (SubRip)
- VTT (WebVTT)

### MUST preserve
- numbering / cue order
- timestamps
- cue count
- cue boundaries
- line breaks within cue text
- inline formatting tags where present

### MUST NOT
- merge cues
- split cues
- drop cues
- alter cue timing

### MAY support later
- ASS / SSA
- TTML / IMSC

---

## 9. Supported providers

Provider support must be treated as **capability-driven**, not hardcoded into product logic.

### 9.1 Local providers

#### MUST support
- Ollama
- MLX-compatible local OpenAI-style server endpoint

Notes:
- The implementation SHOULD abstract MLX support as an OpenAI-compatible local endpoint where possible.
- It is acceptable to support `mlx_lm.server` indirectly through a compatible shim/server if that produces a cleaner architecture.

### 9.2 Cloud providers

#### SHOULD support
- OpenAI
- Google Gemini
- Anthropic (Anthropic requires CORS proxy (Cloudflare Worker in `proxy/`))

### 9.3 Capability registry
The system SHOULD maintain a provider/model capability registry with fields such as:

- provider id
- model id
- execution mode: local / cloud
- supports structured output well
- supports long context well
- recommended for analysis
- recommended for translation
- recommended for review
- supports streaming
- supports image input (future)
- notes / caveats

This registry may be partly static and partly discovered dynamically.

### 9.4 Model discovery

#### Local
- Models SHOULD be discovered dynamically from the local server when possible.
- If discovery fails, the app MAY allow a manual model id entry.

#### Cloud
- The app MAY provide recommended defaults.
- Hardcoding a fixed marketing list of models is discouraged.
- The implementation SHOULD allow manual model id entry or a remotely configurable catalog.

---

## 10. Architecture overview

SRTora should be implemented as a **modular monolith in a monorepo**, not as microservices.

### 10.1 Recommended repository shape

```text
/apps
  /web        -> Next.js frontend + thin server layer
  /worker     -> optional cloud job worker
/packages
  /core       -> subtitle parsing, normalization, validation, file IO
  /pipeline   -> orchestration logic for all phases
  /adapters   -> provider adapters
  /prompts    -> prompt builders and schemas
  /memory     -> retrieval, SQLite storage, import/export tools
  /evals      -> evaluation harness and regression fixtures
  /ui         -> shared UI components
  /types      -> shared TypeScript schemas
```

### 10.2 Deployment shape

#### Local mode
- frontend runs in browser
- browser talks directly to local inference servers on localhost
- pipeline orchestration runs mostly in browser-side app logic / web worker
- local memory is stored in app-managed files, preferably under a user-selected data directory

#### Cloud mode
- frontend calls app backend
- backend creates a translation job
- worker processes the job and streams progress
- output file is returned to the browser for immediate download

### 10.3 Why not microservices
Microservices are explicitly the wrong default here because the product:
- has a narrow domain
- is single-user / personal by default
- benefits from shared pipeline code
- does not need distributed organizational boundaries
- should stay cheap and deployable

---

## 11. Execution model

The application MUST support two execution paths that share the same pipeline core.

### 11.1 Local execution path

```text
Browser UI
  -> Browser-side pipeline coordinator
  -> Provider adapter
  -> localhost inference server (Ollama / MLX-compatible)
```

Characteristics:
- no app backend is required for core translation in local mode
- progress is computed locally
- no subtitle content leaves the machine unless the user selects a cloud provider

### 11.2 Cloud execution path

```text
Browser UI
  -> App backend
  -> Job runner / worker
  -> Cloud provider adapter
  -> Progress events back to browser
```

Characteristics:
- better for long-running cloud jobs
- hides API-provider differences from the browser
- allows streaming progress and central error handling

### 11.3 Shared pipeline core
The parse / analyze / translate / review / assemble logic SHOULD be shared across both execution paths.

---

## 12. Recommended technology stack

The following stack is recommended, but not absolutely mandatory if a clearly superior alternative is chosen.

### 12.1 Frontend
- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- component primitives such as shadcn/ui or equivalent
- Zod for schemas and validation
- TanStack Query for remote state when backend calls are used

### 12.2 Cloud backend
- Node.js
- Fastify or equivalent lightweight TypeScript-friendly API framework

### 12.3 Storage
- SQLite for local app data, memory, retrieval index metadata, and optional cloud-job metadata in small deployments
- SQLite FTS5 for keyword/full-text retrieval
- sqlite-vec MAY be added later for semantic retrieval

### 12.4 Local concurrency
- browser Web Worker for local long-running orchestration
- AbortController for cancellation

### 12.5 Testing
- Vitest for unit/integration tests
- Playwright for end-to-end tests
- golden test fixtures for subtitle round-trip safety

### 12.6 Observability
- structured logs
- optional OpenTelemetry in cloud mode
- lightweight local logs in dev and optional diagnostic export for users

---

## 13. User interface specification

The draft idea of a one-page app is correct, but the UI SHOULD be redesigned as a **two-column desktop workspace** rather than a long single-column form.

### 13.1 Layout

#### Left column: configuration
- header: app name and tagline
- file upload area
- source / target language selectors
- preset selector: Simple / Balanced / Quality / Advanced
- provider selector
- primary model selector
- advanced settings accordion
- translate action

#### Right column: execution and result
- live progress card
- pipeline phase indicator
- elapsed time
- ETA
- translation context panel
- warnings / errors
- result summary
- preview sample
- download actions

### 13.2 Required controls
- file upload drag-and-drop zone
- source language selector (with Auto-detect)
- target language selector
- provider selector
- model selector
- translate button
- cancel button while running
- download result button after completion
- reset / new translation button

### 13.3 Advanced controls
- analysis model selector
- translation model selector
- review model selector (optional)
- tone / register preference
- bilingual output toggle
- retrieval toggle
- glossary file import
- translation memory import
- chunk size preset
- context window preset
- endpoint URL override for local providers
- API key fields for cloud providers

### 13.4 Translation context panel
After phase 1, the app SHOULD show a collapsible panel containing extracted session context such as:
- speakers / characters
- confidence
- terminology list
- warnings / ambiguities

This panel is informative, not authoritative.

### 13.5 Errors
Errors MUST be actionable and clear, for example:
- local server not reachable
- model not installed
- invalid API key
- malformed subtitle file
- provider timed out
- structured output parse failed after retries

---

## 14. Translation pipeline

Translation is not a single call. It is a multi-phase pipeline.

### Phase 0 — Parse and normalize

#### Inputs
- uploaded subtitle file
- user settings
- optional glossary / memory data

#### Responsibilities
- detect file type
- parse cues
- validate file structure
- normalize internal representation
- preserve raw formatting metadata

#### Output
An internal subtitle document model.

### Phase 1 — Session analysis memory

Goal: build translation context before chunk translation begins.

#### Inputs
- full subtitle document or representative sample for very large files
- optional retrieval memories
- analysis model or fallback to translation model

#### Responsibilities
- detect recurring character names and aliases
- infer speaker entities where possible
- infer tone/register tendencies
- extract recurring terms and titles
- detect high-risk ambiguities
- record gender confidence only when justified

#### Output
A structured session memory object such as:

```json
{
  "speakers": [
    {
      "id": "speaker_ana",
      "label": "Ana",
      "gender": "female",
      "gender_confidence": 0.86,
      "register": "informal"
    }
  ],
  "terms": [
    {
      "source": "Captain",
      "target": "Kapetanica",
      "note": "Ana title"
    }
  ],
  "warnings": [
    "Several first-person lines have unresolved gender ambiguity."
  ]
}
```

#### Important rule
Speaker and gender inference MUST be treated as probabilistic. The app MUST store confidence and MUST allow `unknown`.

### Phase 2 — Chunked translation

Goal: translate in overlapping windows with precise structured prompts.

#### Responsibilities
- create overlapping chunks
- include context before and after
- include retrieved glossary and example memories
- include session memory
- produce validated structured JSON per chunk
- retry invalid chunks with repair strategy

#### Prompt style
Structured, direct, non-chatty prompts. The implementation SHOULD tailor prompt templates per model family.

#### Required guardrails
- preserve line ids
- preserve line breaks inside entries
- preserve formatting tags
- keep output concise
- do not translate context lines
- return only structured output

### Phase 3 — Targeted review

Goal: fix important defects without retranslating the entire file.

#### Responsibilities
- consistency review
- glossary consistency review
- gender agreement review when speaker confidence is sufficient
- proper noun continuity review
- subtitle length sanity review
- selective rewrite of flagged entries only

### Phase 4 — Assembly

#### Responsibilities
- merge final texts with original cue structure
- preserve numbering and timestamps
- build final SRT or VTT output
- optionally build bilingual output
- validate cue count and structure before download

---

## 15. Model orchestration

### 15.1 Default policy
The default product experience SHOULD use **one model** unless the selected preset recommends a split.

### 15.2 Two-model architecture
The application SHOULD support this split:

#### Analysis model
Used for:
- session analysis
- terminology extraction
- tone / register inference
- review pass
- ambiguity detection

#### Translation model
Used for:
- main chunk translation
- subtitle-style wording
- context-aware target generation

### 15.3 Optional third model
A separate review model MAY be added later, but SHOULD be off by default because it increases complexity, latency, and cost.

### 15.4 Selection policy
Recommended defaults:
- local quality mode: general small instruct model for analysis + TranslateGemma for translation
- local simple mode: translation model only
- cloud mode: a single strong multimodal/reasoning model MAY do all phases well

---

## 16. Prompting requirements

### 16.1 General requirements
Prompts MUST:
- be deterministic and structured
- specify output schema explicitly
- contain only relevant retrieval context
- avoid large irrelevant context dumps

### 16.2 TranslateGemma-specific requirement
TranslateGemma-compatible prompts MUST place instructions in the user turn and SHOULD use a single structured message format. The implementation MUST NOT rely on a separate `system` role for Gemma-style models.

### 16.3 Structured output requirement
Every analysis / translation / review phase SHOULD request JSON that is validated against a schema.

### 16.4 Repair policy
If model output is invalid JSON or structurally inconsistent:
1. attempt one lightweight repair parse
2. if repair fails, retry with a stricter prompt
3. if retries fail, fail the affected chunk cleanly and surface an actionable error

---

## 17. Context windows and chunking

### 17.1 Chunking goals
Chunking must balance:
- enough context for continuity
- small enough prompts for stable structured output
- acceptable latency on local small models

### 17.2 Recommended chunk sizes
Defaults SHOULD be configurable but sensible.

Suggested defaults:
- 8 to 20 subtitle cues per chunk
- 2 to 5 cues of lookbehind
- 2 to 5 cues of lookahead

### 17.3 Overlap strategy
Chunks SHOULD overlap so that local context is not lost between chunk boundaries.

### 17.4 Review targeting
Only cues flagged by review rules SHOULD be rewritten in review phase.

---

## 18. Retrieval, glossary, and translation memory

The app SHOULD support a lightweight retrieval layer that improves translation quality without introducing heavy infrastructure.

### 18.1 Retrieval goals
- improve term consistency
- improve repeated phrase translation
- improve subtitle naturalness
- improve speaker and register continuity

### 18.2 Storage requirements
Retrieval data MUST be lightweight and local-first.

#### Recommended default
- SQLite database
- FTS5 for lexical retrieval
- optional sqlite-vec for semantic retrieval later

### 18.3 Memory types

#### Termbase
Small curated glossary of terms.

#### Translation memory
Aligned source-target example pairs, ideally subtitle-style.

#### Character/show memory
Character names, likely gender, title translations, recurring preferences.

#### Corrections memory
Accepted corrections from previous runs.

### 18.4 Retrieval strategy
Version 1 SHOULD use:
- FTS5 lexical retrieval
- metadata filtering by language, show/project, and reviewed flag
- top 3 to 5 results only

Version 2 MAY add:
- embeddings
- sqlite-vec
- reranking

### 18.5 Retrieval injection policy
The prompt should include only:
- relevant glossary terms
- a small number of similar examples
- relevant speaker metadata

It MUST NOT dump large raw documents into the prompt.

---

## 19. Local data model

A practical local SQLite schema SHOULD include at least:

### `examples`
- id
- src_text
- tgt_text
- src_norm
- tgt_norm
- source_lang
- target_lang
- project
- speaker
- speaker_gender
- register
- reviewed
- quality_score
- meta_json
- created_at

### `terms`
- id
- source_term
- target_term
- scope
- note
- priority
- created_at

### `characters`
- id
- project
- character_name
- aliases_json
- gender
- gender_confidence
- register
- notes
- created_at

### `corrections`
- id
- source_text
- old_target_text
- corrected_target_text
- reason
- scope
- created_at

### `examples_fts`
FTS5 virtual table for lexical retrieval.

---

## 20. Internal domain model

### 20.1 Subtitle cue
```ts
interface SubtitleCue {
  id: number
  startMs: number
  endMs: number
  rawText: string
  textLines: string[]
  inlineTags: string[]
  format: 'srt' | 'vtt'
}
```

### 20.2 Session memory
```ts
interface SessionMemory {
  speakers: SpeakerMemory[]
  terms: TermEntry[]
  warnings: string[]
  retrievalSummary?: RetrievalSummary
}
```

### 20.3 Chunk translation result
```ts
interface ChunkTranslationResult {
  chunkId: string
  items: Array<{ id: number; text: string }>
  warnings?: string[]
  repairCount: number
}
```

---

## 21. API design

### 21.1 Principle
The API should be minimal, typed, and stable. Local mode SHOULD bypass the app backend when feasible.

### 21.2 Suggested endpoints for cloud mode

#### `POST /api/jobs`
Create translation job.

#### `GET /api/jobs/:id/events`
SSE endpoint for progress events.

#### `GET /api/jobs/:id/result`
Download translated file.

#### `GET /api/providers`
Return provider capability metadata.

#### `POST /api/local/test-connection` (optional)
Used only to validate local endpoint settings from the browser if proxied through backend in some deployments.

### 21.3 Progress event model
Progress events SHOULD include:
- phase
- step
- percent
- elapsedMs
- etaMs
- warning count
- chunk index / total

---

## 22. Local provider integration

### 22.1 Ollama
The app SHOULD support:
- model discovery where available
- chat/completions-style requests
- structured output enforcement when possible
- timeouts and retries

### 22.2 MLX-compatible servers
The app SHOULD support an OpenAI-compatible endpoint contract for MLX-based local servers where feasible.

### 22.3 Connection handling
The UI MUST provide:
- connection test
- clear unreachable-server errors
- model-not-installed guidance
- documentation snippet for setup

---

## 23. Cloud provider integration

### 23.1 Keys
Cloud API keys MUST be session-scoped in the product UX. The app SHOULD avoid permanent storage by default.

### 23.2 Security
- do not log API keys
- scrub keys from diagnostic logs
- use secure transport
- clearly indicate that subtitle data is sent to the cloud provider

### 23.3 Timeouts and retries
Provider adapters SHOULD implement provider-specific retry and backoff policies for transient errors.

---

## 24. Bilingual output

If enabled, bilingual output MUST:
- preserve original cue structure
- include original source text plus translation on separate lines inside each cue
- preserve formatting tags from the original source segment

This is a display/output mode only. It MUST NOT change pipeline internals.

---

## 25. Quality rules

The final output MUST satisfy these checks:

- same number of cues as input
- same cue order as input
- same timestamps as input
- same numbering or implicit cue sequence
- preserved inline formatting tags
- preserved line breaks unless the user explicitly opts into controlled line reflow later
- no empty translated cue unless source cue is empty / non-translatable

The output SHOULD also satisfy:
- term consistency
- subtitle brevity
- idiomatic target language
- register continuity
- gender agreement where confidence is sufficient

---

## 26. Error handling strategy

### 26.1 Error classes
The implementation SHOULD separate:
- user input errors
- provider connectivity errors
- provider auth errors
- provider capacity / rate errors
- invalid model output errors
- internal pipeline errors
- local filesystem errors

### 26.2 Recovery strategy
Where possible:
- retry a failed chunk, not whole job
- retry parsing/repair once before full failure
- preserve partial progress state while a job is running

### 26.3 Final failure behavior
If the job fails, the app MUST provide:
- clear reason
- recommended next action
- retry button
- optional diagnostic export in advanced mode

---

## 27. Performance targets

These are targets, not absolute guarantees.

### 27.1 Local mode targets
- app remains responsive during translation
- progress updates continue while work is running
- small to medium subtitle files should complete without browser freezing

### 27.2 Memory targets
The implementation SHOULD avoid loading unnecessary large artifacts into memory. Parsing, chunking, retrieval, and output generation should be linear and bounded.

### 27.3 Model orchestration efficiency
- do not over-query the model
- do not run review over every cue if only a few are risky
- do not retrieve dozens of memory examples per chunk

---

## 28. Observability and diagnostics

### 28.1 Local mode
Provide lightweight diagnostics:
- pipeline phase logs
- chunk retry counts
- validation failures
- provider latency summaries

### 28.2 Cloud mode
Support structured logs and traces.

### 28.3 User-facing diagnostics
An optional **Export diagnostics** action MAY produce a JSON file with:
- redacted settings
- provider info
- phase timings
- warnings
- failed chunk ids

It MUST exclude subtitle contents unless the user explicitly includes them.

---

## 29. Testing strategy

### 29.1 Unit tests
Must cover:
- SRT parsing
- VTT parsing
- round-trip assembly
- formatting tag preservation
- chunk building
- schema validation
- glossary matching
- retrieval ranking rules

### 29.2 Integration tests
Must cover:
- provider adapter request/response normalization
- structured output validation
- retry logic
- local connection handling

### 29.3 End-to-end tests
Must cover:
- upload -> translate -> download flow
- local mode UX
- cloud mode UX
- advanced two-model flow

### 29.4 Golden files
The repository SHOULD contain golden subtitle fixtures to test:
- cue count preservation
- tags preservation
- bilingual output
- Croatian gender-sensitive examples

### 29.5 Quality evals
The project SHOULD have a small evaluation harness that scores:
- glossary consistency
- name continuity
- length ratio sanity
- gender-sensitive regression cases
- manually curated reference sets for high-value language pairs

---

## 30. Security and privacy

### 30.1 Local mode
- subtitle text stays local unless the user explicitly chooses a cloud provider
- local memory DB stays on disk only in the chosen app data directory

### 30.2 Cloud mode
- subtitle text is sent to the selected provider
- API keys are session-scoped by default
- keys are never written to logs

### 30.3 Browser security
The app SHOULD validate and sanitize imported files and should not execute subtitle content as HTML outside safe display contexts.

---

## 31. Deployment recommendations

### 31.1 Personal / local deployment
Recommended:
- run Next.js app locally
- local mode uses browser -> localhost provider directly
- SQLite data stored locally
- no separate worker needed if cloud mode is not used

### 31.2 Cheap hosted deployment
Recommended:
- web app on Vercel / Railway / Fly.io / equivalent
- optional lightweight Node worker process for cloud jobs
- SQLite for low-scale job metadata and app config

### 31.3 Infrastructure constraints
This product SHOULD NOT require Redis for v1.
If queueing is needed, prefer:
- in-process queue for single-node deployment
- SQLite-backed job state
- lightweight worker loop

---

## 32. Data import and corpus preparation support

The application SHOULD eventually support importing:
- glossary files (CSV / JSONL)
- translation memory example files (JSONL / CSV)
- aligned subtitle pairs converted to JSONL

The first implementation MAY keep imports as command-line preparation scripts outside the web UI.

---

## 33. Roadmap recommendation

### Phase 1
- upload/parse/assemble
- local provider support
- one-model translation
- progress UI
- validated JSON chunk output

### Phase 2
- analysis phase
- translation context panel
- targeted review pass
- bilingual output

### Phase 3
- local SQLite memory
- glossary import
- translation memory import
- FTS retrieval

### Phase 4
- cloud providers
- cloud job worker
- SSE progress

### Phase 5
- semantic retrieval
- evaluation harness
- correction memory
- advanced diagnostics

---

## 34. Open decisions intentionally left flexible

The implementer MAY choose a better alternative for these details:
- exact frontend component library
- exact cloud worker framework
- exact local endpoint compatibility layer for MLX
- exact chunk-size defaults
- exact retrieval scoring formula
- exact prompt wording per model family

These are soft decisions as long as the product principles and hard requirements are preserved.

---

## 35. Summary of the intended final product

SRTora should feel like a **professional subtitle translation workstation**:
- simple for casual use
- powerful in advanced mode
- local-first
- lightweight to run
- serious about subtitle quality
- robust against model errors
- extensible without becoming infrastructural overkill

The best implementation is not the most complex one. It is the one that delivers high-quality subtitle translation with clean architecture, low operating cost, and a strong user experience.
