# Provider Setup

## Local Providers

### Ollama

[Ollama](https://ollama.com/) is the recommended local provider. It runs LLM models on your machine.

#### Setup

```bash
# Install Ollama (macOS)
brew install ollama

# Start the server
ollama serve
```

The server runs on `http://localhost:11434` by default.

#### Supported Models

SRTora has tuned execution profiles for these Ollama models:

| Model | Category | Pull Command |
|-------|----------|-------------|
| `translategemma:4b` | Local Translation | `ollama pull translategemma:4b` |
| `translategemma:12b` | Local Translation | `ollama pull translategemma:12b` |
| `gemma3:4b` | Local Analysis | `ollama pull gemma3:4b` |
| `gemma3:12b` | Local Analysis | `ollama pull gemma3:12b` |

Other Ollama models will work with experimental (conservative) defaults. For the full list with execution profile details, see [Supported Models](models.md).

#### TranslateGemma

TranslateGemma is a purpose-built translation model available in 4B and 12B variants. SRTora automatically detects it via the model registry and uses the appropriate raw completion prompt strategy.

```bash
# Lighter variant — good for most translation tasks
ollama pull translategemma:4b

# Larger variant — higher quality for complex content
ollama pull translategemma:12b
```

Note: TranslateGemma requires an explicit source language — auto-detect is not supported. Analysis and review phases are automatically disabled.

### MLX / OpenAI-Compatible Servers

Any server that implements the OpenAI-compatible API can be used:

- `POST /v1/chat/completions` — chat completion
- `GET /v1/models` — model listing

#### MLX Server

```bash
# Install mlx-lm
pip install mlx-lm

# Start the server
mlx_lm.server --model mlx-community/gemma-2-2b-it-4bit --port 8080
```

#### LM Studio

1. Download [LM Studio](https://lmstudio.ai/)
2. Download a model
3. Start the local server (Settings → Local Server)
4. Connect SRTora to `http://localhost:1234`

#### Registry Matching

When using an OpenAI-compatible provider, SRTora attempts to match the reported model name against its model registry. If a match is found (e.g., running a `gemma3` variant via MLX), the corresponding execution profile is applied automatically. Unrecognized models fall back to conservative experimental defaults.

## Cloud Providers

### OpenAI

1. Get an API key from [platform.openai.com](https://platform.openai.com/api-keys)
2. In SRTora, select **OpenAI** under Cloud providers
3. Enter your API key
4. Click **Test** to connect and discover models

Supported models: `gpt-5.4` (premium), `gpt-5.4-mini` (balanced)

### Google Gemini

1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. In SRTora, select **Google Gemini** under Cloud providers
3. Enter your API key
4. Click **Test** to connect

SRTora uses Google's OpenAI-compatible endpoint at:
`https://generativelanguage.googleapis.com/v1beta/openai`

Supported models: `gemini-3.1-pro-preview` (premium), `gemini-3-flash-preview` (balanced), `gemini-3.1-flash-lite-preview` (budget), `gemini-2.5-flash` (balanced, stable fallback)

### Anthropic

Anthropic's API does not support CORS from browser applications. SRTora provides a dedicated proxy setup section when Anthropic is selected.

#### Quick Start

1. Run a local CORS proxy:
   ```bash
   npx @anthropic-ai/cors-proxy@latest
   ```
2. In SRTora, select **Anthropic** under Cloud providers
3. Enter your API key
4. The proxy URL defaults to `http://localhost:8787` — change if needed
5. Click **Test Connection**

Alternatively, deploy a Cloudflare Worker proxy for persistent use.

Supported models: `claude-opus-4-6` (premium), `claude-sonnet-4-6` (balanced), `claude-haiku-4-5` (budget)

## Connection Testing

SRTora provides a **Test** button for each provider that:

1. Validates the endpoint is reachable
2. Tests authentication (for cloud providers)
3. Discovers available models
4. Populates the model selector

If the connection fails, the error message indicates the issue:
- **Connection refused** — Server not running
- **HTTP 401** — Invalid API key
- **HTTP 404** — Wrong endpoint URL
- **Timeout** — Server unreachable or too slow

## Security Notes

- Cloud API keys are **session-scoped** — they exist only in browser memory
- Keys are **never logged** or persisted to disk
- When a cloud provider is selected, a privacy notice warns that subtitle content will be sent to the provider
- In local mode, all data stays on your machine
