import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { I18nProvider } from '../app/i18n'
import { appendGame, type GameRecord } from './gameHistory'
import { HistoryScreen } from './HistoryScreen'

const rec = (over: Partial<GameRecord> = {}): GameRecord => ({
  id: crypto.randomUUID(),
  endedAt: Date.UTC(2026, 6, 18),
  opponent: 'Test Bot',
  elo: 1200,
  plies: 40,
  result: 'win',
  reason: 'checkmate',
  ...over,
})

const renderHistory = () =>
  render(
    <I18nProvider>
      <HistoryScreen />
    </I18nProvider>,
  )

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

test('shows an empty state when no games are stored', () => {
  renderHistory()
  expect(screen.getByText(/Пока нет партий/)).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

test('renders stored games without an opening column', () => {
  appendGame(rec({ opponent: 'Test Bot', elo: 1350, plies: 41 }))
  renderHistory()
  const table = screen.getByRole('table')
  expect(within(table).getByText('Test Bot')).toBeInTheDocument()
  expect(within(table).getByText('1350')).toBeInTheDocument()
  // full-move count = ceil(41 / 2) = 21
  expect(within(table).getByText('21')).toBeInTheDocument()
  // opening column header must be gone
  expect(screen.queryByText('Дебют')).not.toBeInTheDocument()
})
