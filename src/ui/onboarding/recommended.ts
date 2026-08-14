import data from './recommendedModels.json'

// The curated rating of models tested in real games — see
// docs/superpowers/specs/2026-08-13-recommended-models-design.md for the
// measured numbers behind the ranks (kept out of the UI on purpose).
export type RecommendedModel = {
  rank: number
  ids: string[]
  name: string
  comment: { ru: string; en: string }
}

export const recommendedModels: RecommendedModel[] = [...data.models].sort(
  (a, b) => a.rank - b.rank,
)

// LM Studio appends ":N" to extra instances of the same model
// (e.g. "chesslm-0.01-llama-3.1-8b:2") — strip it before the exact match.
export function findRecommendation(
  modelId: string,
): RecommendedModel | undefined {
  const id = modelId.replace(/:\d+$/, '')
  return recommendedModels.find((m) => m.ids.includes(id))
}
