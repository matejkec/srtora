'use client'

import { useState } from 'react'
import { useTranslationStore } from '@/stores/translation-store'
import { createAdapter } from '@srtora/adapters'
import type { ProviderType, ProviderConfig, ExecutionMode } from '@srtora/types'
import { WifiOff, Loader2, Check, Shield, Cloud, Monitor, Info } from 'lucide-react'

interface ProviderOption {
  type: ProviderType
  label: string
  defaultUrl: string
  executionMode: ExecutionMode
  requiresApiKey: boolean
  /** Show an endpoint URL input for this provider */
  showUrlField: boolean
}

const LOCAL_PROVIDERS: ProviderOption[] = [
  { type: 'ollama', label: 'Ollama', defaultUrl: 'http://localhost:11434', executionMode: 'local', requiresApiKey: false, showUrlField: true },
  { type: 'openai-compatible', label: 'OpenAI-compatible (MLX)', defaultUrl: 'http://localhost:8080', executionMode: 'local', requiresApiKey: false, showUrlField: true },
]

const CLOUD_PROVIDERS: ProviderOption[] = [
  { type: 'openai', label: 'OpenAI', defaultUrl: 'https://api.openai.com', executionMode: 'cloud', requiresApiKey: true, showUrlField: false },
  { type: 'google', label: 'Google Gemini', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', executionMode: 'cloud', requiresApiKey: true, showUrlField: false },
  { type: 'anthropic', label: 'Anthropic', defaultUrl: 'http://localhost:8787', executionMode: 'cloud', requiresApiKey: true, showUrlField: false },
]

const DEFAULT_ANTHROPIC_PROXY_URL = process.env.NEXT_PUBLIC_ANTHROPIC_PROXY_URL ?? 'http://localhost:8787'

export function ProviderSelector() {
  const {
    file,
    provider,
    setProvider,
    apiKey,
    setApiKey,
    connectionStatus,
    connectionError,
    setConnectionStatus,
    setAvailableModels,
  } = useTranslationStore()
  const [customUrl, setCustomUrl] = useState('')
  const [proxyUrl, setProxyUrl] = useState(DEFAULT_ANTHROPIC_PROXY_URL)

  if (!file) return null

  const allProviders = [...LOCAL_PROVIDERS, ...CLOUD_PROVIDERS]

  const selectProvider = (p: ProviderOption) => {
    const baseUrl =
      p.type === 'anthropic' ? proxyUrl :
      p.showUrlField && customUrl ? customUrl :
      p.defaultUrl

    const config: ProviderConfig = {
      type: p.type,
      executionMode: p.executionMode,
      baseUrl,
      label: p.label,
    }
    setCustomUrl('')
    setProvider(config)
  }

  const selectedOption = allProviders.find((p) => p.type === provider?.type)
  const isCloud = provider?.executionMode === 'cloud'

  const testConnection = async () => {
    if (!provider) return
    setConnectionStatus('testing')

    try {
      const effectiveUrl =
        provider.type === 'anthropic' ? proxyUrl :
        selectedOption?.showUrlField && customUrl ? customUrl :
        provider.baseUrl

      const adapterConfig: ProviderConfig = {
        ...provider,
        baseUrl: effectiveUrl,
        apiKey: apiKey || undefined,
      }
      const adapter = createAdapter(adapterConfig)

      const result = await adapter.testConnection()
      if (!result.ok) {
        setConnectionStatus('error', result.error ?? 'Connection failed')
        return
      }

      const models = await adapter.listModels()
      setAvailableModels(models)
      setConnectionStatus('connected')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed'
      setConnectionStatus('error', message)
    }
  }

  return (
    <div className="space-y-3">
      <label className="text-xs font-medium text-muted-foreground block">Provider</label>

      {/* Local providers */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Monitor className="h-3 w-3" />
          Local
        </div>
        <div className="grid grid-cols-2 gap-2">
          {LOCAL_PROVIDERS.map((p) => (
            <button
              key={p.type}
              onClick={() => selectProvider(p)}
              className={`
                rounded-lg border p-3 text-left transition-colors
                ${
                  provider?.type === p.type
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground'
                }
              `}
            >
              <span className="text-sm font-medium">{p.label}</span>
              <span className="text-xs text-muted-foreground block mt-0.5">
                {p.defaultUrl}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Cloud providers */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Cloud className="h-3 w-3" />
          Cloud
        </div>
        <div className="grid grid-cols-3 gap-2">
          {CLOUD_PROVIDERS.map((p) => (
            <button
              key={p.type}
              onClick={() => selectProvider(p)}
              className={`
                rounded-lg border p-2.5 text-left transition-colors
                ${
                  provider?.type === p.type
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground'
                }
              `}
            >
              <span className="text-sm font-medium">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {provider && (
        <>
          {/* Privacy notice for cloud providers */}
          {isCloud && (
            <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
              <div className="flex items-start gap-2">
                <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Cloud provider selected</p>
                  <p className="mt-0.5 text-warning/80">
                    Subtitle content will be sent to {provider.label}. API key is session-only and not stored.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Anthropic proxy setup section */}
          {provider.type === 'anthropic' && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-2">
              <div className="flex items-start gap-2 text-muted-foreground">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">CORS proxy required</p>
                  <p className="mt-0.5">
                    Anthropic's API does not allow direct browser requests. A lightweight proxy forwards
                    your requests to the API.
                  </p>
                  <p className="mt-1.5">
                    Quick start:{' '}
                    <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                      npx @anthropic-ai/cors-proxy@latest
                    </code>
                  </p>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Proxy URL</label>
                <input
                  type="text"
                  placeholder={DEFAULT_ANTHROPIC_PROXY_URL}
                  value={proxyUrl}
                  onChange={(e) => setProxyUrl(e.target.value)}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          {/* API key input for cloud providers */}
          {selectedOption?.requiresApiKey && (
            <input
              type="password"
              placeholder={`${provider.label} API key`}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          )}

          {/* Endpoint URL — only for providers that need it (Ollama, openai-compatible) */}
          {selectedOption?.showUrlField && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={`Endpoint URL (default: ${selectedOption.defaultUrl})`}
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={testConnection}
                disabled={connectionStatus === 'testing'}
                className="rounded-md bg-secondary px-3 py-2 text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 transition-colors"
              >
                {connectionStatus === 'testing' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Test'
                )}
              </button>
            </div>
          )}

          {/* Test button for providers without URL field */}
          {!selectedOption?.showUrlField && (
            <button
              onClick={testConnection}
              disabled={connectionStatus === 'testing' || (selectedOption?.requiresApiKey && !apiKey)}
              className="w-full rounded-md bg-secondary px-3 py-2 text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 transition-colors"
            >
              {connectionStatus === 'testing' ? (
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              ) : (
                'Test Connection'
              )}
            </button>
          )}

          {connectionStatus === 'connected' && (
            <div className="flex items-center gap-2 text-success text-sm">
              <Check className="h-4 w-4" />
              Connected
            </div>
          )}
          {connectionStatus === 'error' && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <WifiOff className="h-4 w-4" />
              {connectionError || 'Connection failed'}
            </div>
          )}
        </>
      )}
    </div>
  )
}
