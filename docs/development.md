# Development Guide

## Setup

```bash
# Clone and install
git clone <repository-url>
cd srtora
pnpm install

# Build all packages (required before first dev run)
pnpm build

# Start dev server with hot reload
pnpm dev
```

## Monorepo Structure

The project uses pnpm workspaces with Turborepo for build orchestration.

### Build Order

Turborepo automatically builds packages in dependency order:

```
@srtora/types → @srtora/core, @srtora/adapters, @srtora/prompts → @srtora/pipeline → apps/web
```

### Package Scripts

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all packages |
| `pnpm dev` | Start dev server |
| `pnpm test` | Run all tests |
| `pnpm typecheck` | Type check all packages |
| `pnpm format` | Format with Prettier |

### Working on a Single Package

```bash
# Run tests for a specific package
cd packages/core
pnpm vitest run

# Watch mode
pnpm vitest
```

## Testing

Tests use **Vitest** and are located in `src/__tests__/` within each package.

### Test Locations

| Package | Tests | Description |
|---------|-------|-------------|
| `packages/core` | 114 | SRT/VTT parsing, assembly, chunking, token-budget chunking, validation, token estimation |
| `packages/adapters` | 245 | Model registry matching, JSON repair, output strategy, retry logic |
| `packages/prompts` | 15 | Prompt builders, strategies |
| `packages/pipeline` | 103 | Profile resolver, progress tracking, quality modes, memory injector |

### Writing Tests

Follow the existing pattern:

```typescript
import { describe, it, expect } from 'vitest'

describe('MyFeature', () => {
  it('does the expected thing', () => {
    const result = myFunction()
    expect(result).toBe(expected)
  })
})
```

### Test Fixtures

Subtitle test fixtures are in `packages/core/src/__tests__/fixtures/`:
- `basic.srt` / `basic.vtt` — Simple files for basic parsing tests
- `formatting-tags.srt` / `formatting-tags.vtt` — Files with formatting tags
- `edge-cases.vtt` — VTT with styles, regions, notes

## Adding a New Provider Adapter

1. Create a new adapter class implementing `LLMAdapter` in `packages/adapters/src/`
2. Implement `chat()`, `listModels()`, and `testConnection()`
3. Register it in `create-adapter.ts`
4. Add the provider type to `ProviderTypeSchema` in `packages/types/src/provider.ts`
5. Add a UI option in `apps/web/src/components/config/provider-selector.tsx`

## Adding a New Supported Model

1. Create or edit the appropriate profile file in `packages/adapters/src/model-registry/profiles/` (organized by provider: `openai.ts`, `google.ts`, `anthropic.ts`, `ollama.ts`)
2. Define a `ModelRegistryEntry` with all required fields: `id`, `displayName`, `provider`, `tier`, `category`, `contextWindow`, `maxOutputTokens`, `executionProfile`
3. For Ollama models, add `matchPatterns` (regex) and `ollamaFamily` for runtime discovery matching
4. The entry is automatically included in `registry-data.ts` and available through the public API
5. No other code changes needed — the matcher, profile resolver, UI model selector, and pipeline all pick up new entries automatically
6. Run `pnpm test` and `pnpm build` to verify

## Adding a New Prompt Strategy

1. Create a class implementing `PromptStrategy` in `packages/prompts/src/strategies/`
2. Implement `formatMessages(system, user)` to return `ChatMessage[]`
3. Add a new `PromptStyleId` value in `packages/types/src/model-registry.ts`
4. Register it in `packages/prompts/src/strategies/strategy-factory.ts`
5. Export from `packages/prompts/src/index.ts`

## Code Style

- **TypeScript strict mode** across all packages
- **Prettier** for formatting (no semicolons, single quotes, trailing commas)
- **`.js` extensions** in imports within non-web packages (required for ESM)
- **Zod schemas** for all domain types with co-located TypeScript type inference

## Key Patterns

### Zustand Store

State management uses a single Zustand store (`apps/web/src/stores/translation-store.ts`). Pipeline invocation uses a trigger-based pattern:

```typescript
// Translate button increments trigger
requestTranslation: () => set(s => ({ translationTrigger: s.translationTrigger + 1 }))

// Pipeline runner hook reacts to trigger changes
useEffect(() => { runPipeline() }, [translationTrigger])
```

### Error Handling

All pipeline errors use `PipelineException` from `@srtora/types`, which includes:
- Error code (typed enum)
- Human-readable message
- Recoverable flag (determines retry behavior)
- Optional suggestion text

### JSON Repair

LLM outputs are often imperfect JSON. The `parseJsonSafe()` function:
1. Tries direct `JSON.parse()`
2. On failure, runs `repairJson()` (strips markdown fences, fixes trailing commas, closes brackets)
3. Returns `{ data, repaired }` or `null` if unrepairable

### Model Registry

Each supported model has an execution profile that controls translation behavior. The profile resolver merges three layers:

```
Model Profile (base) × Quality Mode (scaling) × User Config (overrides)
```

For details, see [Supported Models](../docs/models.md).
