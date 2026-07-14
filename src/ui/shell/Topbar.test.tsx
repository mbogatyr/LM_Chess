import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Topbar } from './Topbar'
import { I18nProvider } from '../app/i18n'
import type { Screen } from '../app/appState'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

function renderTopbar(
  connected: boolean,
  screenName: Screen = 'onb-connect',
  onNavigate: (s: Screen) => void = () => {},
) {
  return render(
    <I18nProvider>
      <Topbar
        connected={connected}
        screen={screenName}
        onNavigate={onNavigate}
      />
    </I18nProvider>,
  )
}

test('shows the brand and the offline pill when disconnected', () => {
  renderTopbar(false)
  expect(screen.getByText('NeuroChess')).toBeInTheDocument()
  expect(screen.getByText('Не подключено')).toBeInTheDocument()
})

test('shows the connected pill when connected', () => {
  renderTopbar(true)
  expect(screen.getByText('Подключено')).toBeInTheDocument()
})

test('RU/EN toggle switches the visible language', async () => {
  renderTopbar(false)
  expect(screen.getByText('Не подключено')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'EN' }))
  expect(screen.getByText('Offline')).toBeInTheDocument()
})

test('hides the tabs during onboarding', () => {
  renderTopbar(false, 'onb-connect')
  expect(
    screen.queryByRole('button', { name: 'Партия' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'История' }),
  ).not.toBeInTheDocument()
})

test('shows the tabs on the game and history screens', () => {
  renderTopbar(true, 'game')
  expect(screen.getByRole('button', { name: 'Партия' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'История' })).toBeInTheDocument()
})

test('marks the active tab with aria-current', () => {
  renderTopbar(true, 'history')
  expect(screen.getByRole('button', { name: 'История' })).toHaveAttribute(
    'aria-current',
    'true',
  )
  expect(screen.getByRole('button', { name: 'Партия' })).toHaveAttribute(
    'aria-current',
    'false',
  )
})

test('clicking a tab calls onNavigate with the screen', async () => {
  const onNavigate = vi.fn()
  renderTopbar(true, 'game', onNavigate)
  await userEvent.click(screen.getByRole('button', { name: 'История' }))
  expect(onNavigate).toHaveBeenCalledWith('history')
})
