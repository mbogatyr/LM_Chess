import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { HistoryScreen } from './HistoryScreen'
import { I18nProvider, useI18n } from '../app/i18n'
import type { ReactNode } from 'react'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

const wrap = (node: ReactNode) => <I18nProvider>{node}</I18nProvider>

function Harness() {
  const { setLang } = useI18n()
  return (
    <>
      <button onClick={() => setLang('en')}>to-en</button>
      <HistoryScreen />
    </>
  )
}

test('renders the four stat tiles with computed values', () => {
  render(wrap(<HistoryScreen />))
  expect(screen.getByText('Партий')).toBeInTheDocument()
  expect(screen.getByText('8')).toBeInTheDocument()
  expect(screen.getByText('63%')).toBeInTheDocument()
  expect(screen.getByText('+1')).toBeInTheDocument()
  const best = screen.getByText('Лучший ELO')
  expect(
    within(best.parentElement as HTMLElement).getByText('1350'),
  ).toBeInTheDocument()
})

test('renders one row per history entry plus the header', () => {
  render(wrap(<HistoryScreen />))
  expect(screen.getAllByRole('row')).toHaveLength(9)
})

test('result cells carry the res win/loss/draw classes', () => {
  const { container } = render(wrap(<HistoryScreen />))
  expect(container.querySelectorAll('.res.win')).toHaveLength(5)
  expect(container.querySelectorAll('.res.loss')).toHaveLength(2)
  expect(container.querySelectorAll('.res.draw')).toHaveLength(1)
})

test('language toggle swaps date and opening RU to EN', async () => {
  render(wrap(<Harness />))
  expect(screen.getByText('Итальянская партия')).toBeInTheDocument()
  await userEvent.click(screen.getByText('to-en'))
  expect(screen.getByText('Italian Game')).toBeInTheDocument()
  expect(screen.getByText('Jul 11')).toBeInTheDocument()
})
