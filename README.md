# SRTora

Local-first AI subtitle translation. Upload an `.srt` or `.vtt` file, translate it with a local or cloud LLM, and download the result — all from your browser.

## Features

- **SRT and VTT support** — auto-detects format, preserves timestamps, numbering, and inline formatting tags
- **5-phase translation pipeline** — Parse → Analyze → Translate → Review → Assemble
- **Local-first** — runs entirely in the browser with Ollama, MLX, or any OpenAI-compatible local server
- **Cloud providers** — optional support for OpenAI, Google Gemini, and Anthropic (session-scoped API keys, never persisted)
- **Context-aware chunking** — overlapping chunks with lookbehind/lookahead for translation continuity
- **Session memory** — extracts speakers, terminology, and tone from the document for consistent translations
- **Structured output** — JSON schema enforcement for reliable LLM responses with automatic repair
- **Adaptive chunk sizing** — token-budget-first chunking that sizes chunks based on model token budgets, producing variable-size chunks where short cues yield larger chunks and long cues yield smaller ones
- **Review phase** — automated flagging (empty translations, missing tags, length issues, term inconsistency) with LLM correction
- **Bilingual output** — optional side-by-side source + target subtitle file
- **Curated model registry** — 13 supported models with individually tuned execution profiles for chunk sizing, prompt strategy, output method, and retry behavior

## Quick Start

```bash
# Prerequisites: Node.js 18+, pnpm 9+, a running Ollama server

# Install dependencies
pnpm install

# Build all packages (required before first run)
pnpm build

# Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), upload a subtitle file, connect to your local Ollama instance, and translate.

### Setting Up Ollama

```bash
brew install ollama
ollama serve
ollama pull gemma3:4b   # or any supported model
```

See [docs/providers.md](docs/providers.md) for detailed setup instructions for all providers.

## Project Structure

```
srtora/
├── apps/
│   └── web/                  # Next.js 15 frontend
├── packages/
│   ├── types/                # Zod schemas + TypeScript types
│   ├── core/                 # SRT/VTT parsing, assembly, chunking, validation
│   ├── adapters/             # LLM provider adapters + model registry
│   ├── prompts/              # Prompt builders, strategies, JSON schemas
│   ├── pipeline/             # Pipeline orchestrator + progress tracking
│   └── ui/                   # Shared UI components
├── docs/                     # Architecture, pipeline, providers, development guides
├── turbo.json                # Turborepo build configuration
└── pnpm-workspace.yaml       # Workspace definition
```

### Package Dependency Graph

```
@srtora/types → @srtora/core, @srtora/adapters, @srtora/prompts → @srtora/pipeline → apps/web
```

## Development

```bash
pnpm build        # Build all packages
pnpm dev          # Start dev server with hot reload
pnpm test         # Run all tests
pnpm typecheck    # Type check all packages
pnpm format       # Format with Prettier
```

See [docs/development.md](docs/development.md) for the full development guide.

## Testing

418 tests across 4 packages using Vitest:

| Package | Tests | Coverage |
|---------|-------|----------|
| `@srtora/core` | 114 | SRT/VTT parsing, assembly, chunking, validation, token estimation, budget chunking |
| `@srtora/adapters` | 201 | Model registry, JSON repair, output strategy, retry logic |
| `@srtora/prompts` | 15 | Prompt builders, strategies |
| `@srtora/pipeline` | 88 | Profile resolver, progress tracking, quality modes, pipeline orchestration |

```bash
# Run all tests
pnpm test

# Run tests for a specific package
cd packages/core && pnpm vitest run

# Watch mode
cd packages/core && pnpm vitest
```

## Supported Providers

| Provider | Type | Endpoint | Supported Models |
|----------|------|----------|-----------------|
| Ollama | Local | `http://localhost:11434` | 4 models (qwen3, gemma3, mistral-small, llama3) |
| MLX Server | Local | `http://localhost:8080` | Experimental (conservative defaults) |
| LM Studio | Local | `http://localhost:1234` | Experimental (conservative defaults) |
| OpenAI | Cloud | `https://api.openai.com` | gpt-5.4, gpt-5.4-mini |
| Google Gemini | Cloud | `https://generativelanguage.googleapis.com/v1beta/openai` | gemini-3.1-pro-preview, gemini-3-flash-preview, gemini-3.1-flash-lite-preview, gemini-2.5-flash |
| Anthropic | Cloud | Requires CORS proxy | claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5 |

## Tech Stack

- **Framework:** Next.js 15 (App Router), React 19
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4
- **State:** Zustand
- **Validation:** Zod
- **Build:** Turborepo + pnpm workspaces
- **Testing:** Vitest

## Documentation

- [Architecture](docs/architecture.md) — system overview, package dependencies, data flow, design decisions
- [Translation Pipeline](docs/pipeline.md) — pipeline phases, chunking strategy, structured output, retry handling
- [Provider Setup](docs/providers.md) — setup guides for all supported providers
- [Supported Models](docs/models.md) — curated model list, execution profiles, adding models
- [Development Guide](docs/development.md) — dev setup, testing, adding adapters and strategies

## License

Private — all rights reserved.
