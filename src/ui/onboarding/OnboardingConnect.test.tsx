import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { OnboardingConnect } from './OnboardingConnect'
import { I18nProvider } from '../app/i18n'
import { useConnection } from '../useConnection'
import * as client from '../../llm/client'
import type { LMModel } from '../../llm/types'
import { renderHook } from '@testing-library/react'

const models: LMModel[] = [
  { id: 'google/gemma-4-e4b', type: 'vlm', state: 'loaded' },
]

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

function setup() {
  const { result } = renderHook(() => useConnection())
  const onConnected = vi.fn()
  const view = render(
    <I18nProvider>
      <OnboardingConnect conn={result.current} onConnected={onConnected} />
    </I18nProvider>,
  )
  return { result, onConnected, view }
}

test('renders the connect card with the default URL', () => {
  setup()
  expect(
    screen.getByRole('heading', { name: 'Подключитесь к LM Studio' }),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Адрес сервера')).toHaveValue(
    'http://localhost:1234',
  )
})

test('successful connect shows the success pill and advances', async () => {
  vi.spyOn(client, 'listModels').mockResolvedValue(models)
  const { result, onConnected, view } = setup()
  await userEvent.click(
    screen.getByRole('button', { name: 'Проверить соединение' }),
  )
  // re-render with the updated hook state
  view.rerender(
    <I18nProvider>
      <OnboardingConnect conn={result.current} onConnected={onConnected} />
    </I18nProvider>,
  )
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Выбрать модель' }),
    ).toBeInTheDocument(),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Выбрать модель' }))
  expect(onConnected).toHaveBeenCalledTimes(1)
})
