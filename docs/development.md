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
| `packages/core` | 70 | SRT/VTT parsing, assembly, chunking, validation |
| `packages/adapters` | 17 | JSON repair, retry logic |
| `packages/prompts` | 15 | Prompt builders, strategies |
| `packages/pipeline` | 5 | Progress tracking |

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

## Adding a New Prompt Strategy

1. Create a class implementing `PromptStrategy` in `packages/prompts/src/strategies/`
2. Implement `formatMessages(system, user)` to return `ChatMessage[]`
3. Export from `packages/prompts/src/index.ts`
4. Add auto-detection logic in the orchestrator constructor (`packages/pipeline/src/orchestrator.ts`)

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
