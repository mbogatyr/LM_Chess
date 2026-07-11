import { ConnectionDialog } from './ui/ConnectionDialog'
import { ConnectedView } from './ui/ConnectedView'
import { useConnection } from './ui/useConnection'

export default function App() {
  const { state, connect, load, use, reset } = useConnection()

  if (state.phase === 'ready' && state.activeModel) {
    return (
      <ConnectedView
        baseUrl={state.baseUrl}
        activeModel={state.activeModel}
        onChange={reset}
      />
    )
  }

  return (
    <ConnectionDialog
      state={state}
      onConnect={connect}
      onLoad={load}
      onUse={use}
    />
  )
}
