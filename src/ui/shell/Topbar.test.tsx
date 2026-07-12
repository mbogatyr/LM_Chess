import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { Topbar } from './Topbar'
import { I18nProvider } from '../app/i18n'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

function renderTopbar(connected: boolean) {
  return render(
    <I18nProvider>
      <Topbar connected={connected} />
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
