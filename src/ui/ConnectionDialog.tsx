import { useState } from 'react'
import type { ConnectionState } from './useConnection'
import { ModelList } from './ModelList'

type ConnectionDialogProps = {
  state: ConnectionState
  onConnect: (url: string) => void
  onLoad: (id: string) => void
  onUse: (id: string) => void
}

export function ConnectionDialog({
  state,
  onConnect,
  onLoad,
  onUse,
}: ConnectionDialogProps) {
  const [url, setUrl] = useState(state.baseUrl)
  return (
    <div>
      <h1>Connect to LM Studio</h1>
      <label>
        Server URL
        <input
          type="text"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={state.phase === 'connecting'}
        onClick={() => onConnect(url)}
      >
        Connect
      </button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.models.length > 0 && (
        <ModelList
          models={state.models}
          loadingModelId={state.loadingModelId}
          onLoad={onLoad}
          onUse={onUse}
        />
      )}
    </div>
  )
}
