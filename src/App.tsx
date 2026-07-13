import { useConnection } from './ui/useConnection'
import { useAppState } from './ui/app/appState'
import { AppShell } from './ui/shell/AppShell'
import { OnboardingConnect } from './ui/onboarding/OnboardingConnect'
import { OnboardingModels } from './ui/onboarding/OnboardingModels'
import { OnboardingElo } from './ui/onboarding/OnboardingElo'
import { GamePlaceholder } from './ui/game/GamePlaceholder'

export default function App() {
  const conn = useConnection()
  const { screen, setScreen } = useAppState()
  const connected =
    conn.state.phase === 'connected' || conn.state.phase === 'ready'

  return (
    <AppShell connected={connected}>
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
      {(screen === 'game' || screen === 'history') && <GamePlaceholder />}
    </AppShell>
  )
}
