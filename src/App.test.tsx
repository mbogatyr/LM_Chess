import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { I18nProvider } from './ui/app/i18n'
import { AppStateProvider } from './ui/app/appState'
import * as client from './llm/client'
import type { LMModel } from './llm/types'

const models: LMModel[] = [
  { id: 'google/gemma-4-e4b', type: 'vlm', state: 'loaded' },
]

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

function renderApp() {
  return render(
    <I18nProvider>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </I18nProvider>,
  )
}

test('connect → choose model → ELO → game', async () => {
  vi.spyOn(client, 'listModels').mockResolvedValue(models)
  renderApp()
  // connect
  await userEvent.click(
    screen.getByRole('button', { name: 'Проверить соединение' }),
  )
  await userEvent.click(
    await screen.findByRole('button', { name: 'Выбрать модель' }),
  )
  // models → play the loaded model
  await userEvent.click(await screen.findByRole('button', { name: 'Играть' }))
  // ELO → start
  await userEvent.click(
    await screen.findByRole('button', { name: 'Начать партию' }),
  )
  // game placeholder
  await waitFor(() =>
    expect(screen.getByText('Модель думает…')).toBeInTheDocument(),
  )
})

test('topbar language toggle switches copy on the connect screen', async () => {
  renderApp()
  expect(
    screen.getByRole('heading', { name: 'Подключитесь к LM Studio' }),
  ).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'EN' }))
  expect(
    screen.getByRole('heading', { name: 'Connect to LM Studio' }),
  ).toBeInTheDocument()
})
