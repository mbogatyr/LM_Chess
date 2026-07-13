import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { MoveList } from './MoveList'
import { I18nProvider } from '../app/i18n'
import type { ReactNode } from 'react'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

const wrap = (node: ReactNode) => <I18nProvider>{node}</I18nProvider>

test('shows the empty state and inert action buttons', () => {
  render(wrap(<MoveList />))
  expect(screen.getByText('Сделайте первый ход')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Сдаться' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Ничья' })).toBeDisabled()
})
