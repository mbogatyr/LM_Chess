import { useCallback, useReducer } from 'react'
import { listModels, loadModel } from '../llm/client'
import { LMModel, LMStudioError } from '../llm/types'

const STORAGE_KEY = 'lmchess.baseUrl'
const DEFAULT_URL = 'http://localhost:1234'

type Phase = 'idle' | 'connecting' | 'connected' | 'ready' | 'error'

export type ConnectionState = {
  baseUrl: string
  phase: Phase
  models: LMModel[]
  loadingModelId: string | null
  activeModel: string | null
  error: string | null
}

type Action =
  | { type: 'connect/start'; baseUrl: string }
  | { type: 'connect/ok'; models: LMModel[] }
  | { type: 'connect/fail'; error: string }
  | { type: 'load/start'; id: string }
  | { type: 'load/ok'; models: LMModel[] }
  | { type: 'load/fail'; error: string }
  | { type: 'use'; id: string }
  | { type: 'reset' }

function reducer(state: ConnectionState, action: Action): ConnectionState {
  switch (action.type) {
    case 'connect/start':
      return {
        ...state,
        baseUrl: action.baseUrl,
        phase: 'connecting',
        error: null,
      }
    case 'connect/ok':
      return {
        ...state,
        phase: 'connected',
        models: action.models,
        error: null,
      }
    case 'connect/fail':
      return { ...state, phase: 'error', error: action.error }
    case 'load/start':
      return { ...state, loadingModelId: action.id, error: null }
    case 'load/ok':
      return { ...state, loadingModelId: null, models: action.models }
    case 'load/fail':
      return { ...state, loadingModelId: null, error: action.error }
    case 'use':
      return { ...state, phase: 'ready', activeModel: action.id }
    case 'reset':
      return { ...state, phase: 'connected', activeModel: null }
  }
}

function initialState(): ConnectionState {
  return {
    baseUrl: localStorage.getItem(STORAGE_KEY) ?? DEFAULT_URL,
    phase: 'idle',
    models: [],
    loadingModelId: null,
    activeModel: null,
    error: null,
  }
}

function messageOf(error: unknown): string {
  return error instanceof LMStudioError || error instanceof Error
    ? error.message
    : 'Unexpected error'
}

export function useConnection() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  const connect = useCallback(async (url: string) => {
    dispatch({ type: 'connect/start', baseUrl: url })
    try {
      const models = await listModels(url)
      localStorage.setItem(STORAGE_KEY, url)
      dispatch({ type: 'connect/ok', models })
    } catch (error) {
      dispatch({ type: 'connect/fail', error: messageOf(error) })
    }
  }, [])

  const load = useCallback(
    async (id: string) => {
      dispatch({ type: 'load/start', id })
      try {
        await loadModel(state.baseUrl, id)
        const models = await listModels(state.baseUrl)
        dispatch({ type: 'load/ok', models })
      } catch (error) {
        dispatch({ type: 'load/fail', error: messageOf(error) })
      }
    },
    [state.baseUrl],
  )

  const use = useCallback((id: string) => dispatch({ type: 'use', id }), [])
  const reset = useCallback(() => dispatch({ type: 'reset' }), [])

  return { state, connect, load, use, reset }
}
