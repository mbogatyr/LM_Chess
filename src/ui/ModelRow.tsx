import type { LMModel } from '../llm/types'

type ModelRowProps = {
  model: LMModel
  isLoading: boolean
  onLoad: (id: string) => void
  onUse: (id: string) => void
}

export function ModelRow({ model, isLoading, onLoad, onUse }: ModelRowProps) {
  const loaded = model.state === 'loaded'
  return (
    <li>
      <span>{model.id}</span>
      <span>{model.type}</span>
      <span>{loaded ? 'Loaded' : 'Not loaded'}</span>
      {!loaded && (
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onLoad(model.id)}
        >
          {isLoading ? 'Loading…' : 'Load'}
        </button>
      )}
      <button type="button" disabled={!loaded} onClick={() => onUse(model.id)}>
        Use
      </button>
    </li>
  )
}
