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

#### Recommended Models

| Model | Use Case | Pull Command |
|-------|----------|-------------|
| `gemma3:4b` | General translation + analysis | `ollama pull gemma3:4b` |
| `gemma3:12b` | Higher quality translation | `ollama pull gemma3:12b` |
| `qwen2.5:7b` | Good multilingual support | `ollama pull qwen2.5:7b` |

#### TranslateGemma

For dedicated translation models, SRTora auto-detects Gemma family models and uses the appropriate prompt strategy (single user message, no system role).

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

## Cloud Providers

### OpenAI

1. Get an API key from [platform.openai.com](https://platform.openai.com/api-keys)
2. In SRTora, select **OpenAI** under Cloud providers
3. Enter your API key
4. Click **Test** to connect and discover models

Recommended models: `gpt-4o-mini`, `gpt-4o`

### Google Gemini

1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. In SRTora, select **Google Gemini** under Cloud providers
3. Enter your API key
4. Click **Test** to connect

SRTora uses Google's OpenAI-compatible endpoint at:
`https://generativelanguage.googleapis.com/v1beta/openai`

Recommended models: `gemini-2.0-flash`, `gemini-1.5-pro`

### Anthropic

Anthropic's API does not support CORS from browser applications. To use Anthropic models, you need a CORS proxy.

1. Set up a CORS proxy (e.g., Cloudflare Worker)
2. In SRTora, select **Anthropic** under Cloud providers
3. Enter your API key
4. Change the endpoint URL to your proxy address
5. Click **Test** to connect

Recommended models: `claude-sonnet-4-20250514`

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
