import { useConnection } from './ui/useConnection'
import { useAppState } from './ui/app/appState'
import { AppShell } from './ui/shell/AppShell'
import { OnboardingConnect } from './ui/onboarding/OnboardingConnect'
import { OnboardingModels } from './ui/onboarding/OnboardingModels'
import { GameScreen } from './ui/game/GameScreen'
import { HistoryScreen } from './ui/history/HistoryScreen'

export default function App() {
  const conn = useConnection()
  const { screen, setScreen, elo, boardStyle, pieceStyle } = useAppState()
  const connected =
    conn.state.phase === 'connected' || conn.state.phase === 'ready'

  return (
    <AppShell connected={connected} screen={screen} onNavigate={setScreen}>
      {screen === 'onb-connect' && (
        <OnboardingConnect
          conn={conn}
          onConnected={() => setScreen('onb-models')}
        />
      )}
      {/* The ELO step (onb-elo / OnboardingElo) is hidden — see
          docs/superpowers/specs/2026-08-11-hide-elo-step-design.md. The
          component stays in src/ui/onboarding; `elo` keeps its stored or
          default value and still flows into the prompts below. */}
      {screen === 'onb-models' && (
        <OnboardingModels conn={conn} onUse={() => setScreen('game')} />
      )}
      {/* The game stays mounted while History is on top, so switching tabs
          mid-game returns to the same position instead of a fresh board.
          Both screens are reachable only after a game has started (the
          topbar tabs appear on 'game' and 'history' only). */}
      {(screen === 'game' || screen === 'history') && (
        <GameScreen
          opponentName={conn.state.activeModel ?? 'Qwen2.5 14B'}
          elo={elo}
          boardStyle={boardStyle}
          pieceStyle={pieceStyle}
          baseUrl={conn.state.baseUrl}
          model={conn.state.activeModel ?? ''}
          hidden={screen !== 'game'}
        />
      )}
      {screen === 'history' && <HistoryScreen />}
    </AppShell>
  )
}
