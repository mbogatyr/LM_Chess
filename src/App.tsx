import { useConnection } from './ui/useConnection'
import { useAppState } from './ui/app/appState'
import { AppShell } from './ui/shell/AppShell'
import { OnboardingConnect } from './ui/onboarding/OnboardingConnect'
import { OnboardingModels } from './ui/onboarding/OnboardingModels'
import { OnboardingElo } from './ui/onboarding/OnboardingElo'
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
      {screen === 'onb-models' && (
        <OnboardingModels conn={conn} onUse={() => setScreen('onb-elo')} />
      )}
      {screen === 'onb-elo' && (
        <OnboardingElo
          onBack={() => setScreen('onb-models')}
          onStart={() => setScreen('game')}
        />
      )}
      {screen === 'game' && (
        <GameScreen
          opponentName={conn.state.activeModel ?? 'Qwen2.5 14B'}
          elo={elo}
          boardStyle={boardStyle}
          pieceStyle={pieceStyle}
        />
      )}
      {screen === 'history' && <HistoryScreen />}
    </AppShell>
  )
}
