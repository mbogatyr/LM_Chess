import type { ReactNode } from 'react'
import { Topbar } from './Topbar'
import type { Screen } from '../app/appState'

export function AppShell({
  connected,
  screen,
  onNavigate,
  children,
}: {
  connected: boolean
  screen: Screen
  onNavigate: (s: Screen) => void
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
      <Topbar connected={connected} screen={screen} onNavigate={onNavigate} />
      <div className="screens">
        <div className="screen">{children}</div>
      </div>
    </div>
  )
}
