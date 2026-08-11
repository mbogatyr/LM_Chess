import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { I18nProvider } from './ui/app/i18n'
import { AppStateProvider } from './ui/app/appState'
import * as client from './llm/client'
import * as selectMoveModule from './llm/selectMove'
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

test('connect → choose model → game', async () => {
  vi.spyOn(client, 'listModels').mockResolvedValue(models)
  renderApp()
  // connect (auto-advances to model selection on success)
  await userEvent.click(
    screen.getByRole('button', { name: 'Проверить соединение' }),
  )
  // models → play the loaded model: lands directly on the game screen
  await userEvent.click(await screen.findByRole('button', { name: 'Играть' }))
  expect(await screen.findByText('Ваш ход')).toBeInTheDocument()
  expect(screen.getByText('google/gemma-4-e4b')).toBeInTheDocument()
  expect(document.querySelector('.game .board')).not.toBeNull()
  // the ELO step never appears
  expect(screen.queryByText('Начать партию')).not.toBeInTheDocument()
})

test('the game survives a round trip to History and back', async () => {
  vi.spyOn(client, 'listModels').mockResolvedValue(models)
  // the model never answers, so the position stays White-to-move
  vi.spyOn(selectMoveModule, 'selectMove').mockImplementation(
    () => new Promise(() => {}),
  )
  const { container } = renderApp()
  await userEvent.click(
    screen.getByRole('button', { name: 'Проверить соединение' }),
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Играть' }))
  const click = (sq: string) =>
    fireEvent.click(container.querySelector(`[data-sq="${sq}"]`) as HTMLElement)
  click('e2')
  click('e4')
  expect(screen.getByText('e4')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'История' }))
  expect(screen.getByRole('heading', { name: 'История матчей' })).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Партия' }))

  // the played move is still on the board — the game was not restarted
  expect(screen.getByText('e4')).toBeInTheDocument()
  expect(container.querySelector('[data-sq="e4"] .piece')).not.toBeNull()
  expect(container.querySelector('[data-sq="e2"] .piece')).toBeNull()
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
