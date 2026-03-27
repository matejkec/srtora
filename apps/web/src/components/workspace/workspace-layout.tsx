'use client'

import { ConfigPanel } from '@/components/config/config-panel'
import { ExecutionPanel } from '@/components/execution/execution-panel'

export function WorkspaceLayout() {
  return (
    <div className="flex min-h-screen">
      {/* Left column: Configuration */}
      <aside className="w-[440px] shrink-0 border-r border-border overflow-y-auto h-screen sticky top-0">
        <ConfigPanel />
      </aside>

      {/* Right column: Execution & Results */}
      <main className="flex-1 overflow-y-auto min-h-screen">
        <ExecutionPanel />
      </main>
    </div>
  )
}
