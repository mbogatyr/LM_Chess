import type { ReactNode } from 'react'
import { Topbar } from './Topbar'

export function AppShell({
  connected,
  children,
}: {
  connected: boolean
  children: ReactNode
}) {
  return (
    <div className="app">
      <div className="chrome">
        <div className="dots">
          <i />
          <i />
          <i />
        </div>
        <div className="url">neurochess.local — LM Studio · localhost:1234</div>
        <div style={{ width: 52 }} />
      </div>
      <Topbar connected={connected} />
      <div className="screens">
        <div className="screen">{children}</div>
      </div>
    </div>
  )
}
