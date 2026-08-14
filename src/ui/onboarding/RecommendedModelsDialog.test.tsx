import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { RecommendedModelsDialog } from './RecommendedModelsDialog'
import { I18nProvider } from '../app/i18n'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

function renderDialog(onClose = vi.fn()) {
  render(
    <I18nProvider>
      <RecommendedModelsDialog onClose={onClose} />
    </I18nProvider>,
  )
  return onClose
}

test('renders the three models in rank order with RU comments by default', () => {
  renderDialog()
  const dialog = screen.getByRole('dialog')
  const rows = within(dialog).getAllByRole('listitem')
  expect(rows).toHaveLength(3)
  expect(rows[0]).toHaveTextContent('chessLM 0.01 (Llama 3.1 8B)')
  expect(rows[0]).toHaveTextContent('№1')
  expect(rows[0]).toHaveTextContent('дебютная теория')
  expect(rows[1]).toHaveTextContent('Qwen3.5 9B')
  expect(rows[2]).toHaveTextContent('Gemma 4 12B')
})

test('shows EN comments when the stored language is en', () => {
  localStorage.setItem('nocturne-chess', JSON.stringify({ lang: 'en' }))
  renderDialog()
  expect(screen.getByText(/opening theory/)).toBeInTheDocument()
})

test('Escape closes the dialog', async () => {
  const onClose = renderDialog()
  await userEvent.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('scrim click closes, card click does not', async () => {
  const onClose = renderDialog()
  await userEvent.click(screen.getByText('chessLM 0.01 (Llama 3.1 8B)'))
  expect(onClose).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('dialog'))
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('Close button closes the dialog', async () => {
  const onClose = renderDialog()
  await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
  expect(onClose).toHaveBeenCalledTimes(1)
})
