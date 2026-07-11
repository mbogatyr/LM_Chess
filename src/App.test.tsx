import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import * as client from './llm/client'
import type { LMModel } from './llm/types'

const models: LMModel[] = [
  { id: 'google/gemma-4-e4b', type: 'vlm', state: 'loaded' },
]

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
})

test('connect then use switches to the connected view', async () => {
  vi.spyOn(client, 'listModels').mockResolvedValue(models)
  render(<App />)
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  const useButton = await screen.findByRole('button', { name: 'Use' })
  await userEvent.click(useButton)
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument(),
  )
  expect(screen.getByText('google/gemma-4-e4b')).toBeInTheDocument()
})
