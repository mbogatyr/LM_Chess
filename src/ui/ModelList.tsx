import type { LMModel } from '../llm/types'
import { ModelRow } from './ModelRow'

type ModelListProps = {
  models: LMModel[]
  loadingModelId: string | null
  onLoad: (id: string) => void
  onUse: (id: string) => void
}

export function ModelList({
  models,
  loadingModelId,
  onLoad,
  onUse,
}: ModelListProps) {
  return (
    <ul>
      {models.map((model) => (
        <ModelRow
          key={model.id}
          model={model}
          isLoading={loadingModelId === model.id}
          onLoad={onLoad}
          onUse={onUse}
        />
      ))}
    </ul>
  )
}
