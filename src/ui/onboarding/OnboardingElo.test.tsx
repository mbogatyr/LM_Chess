import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { OnboardingElo } from './OnboardingElo'
import { I18nProvider } from '../app/i18n'
import { AppStateProvider } from '../app/appState'
import type { ReactNode } from 'react'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

const wrap = (node: ReactNode) => (
  <I18nProvider>
    <AppStateProvider>{node}</AppStateProvider>
  </I18nProvider>
)

test('shows the default ELO and its band title', () => {
  render(wrap(<OnboardingElo onBack={() => {}} onStart={() => {}} />))
  // '1000' also appears as a tick label in .elo-ticks, so scope to .elo-num.
  expect(screen.getByText('1000', { selector: '.elo-num' })).toBeInTheDocument()
  expect(screen.getByText('Уверенный')).toBeInTheDocument()
})

test('moving the slider updates the band', () => {
  render(wrap(<OnboardingElo onBack={() => {}} onStart={() => {}} />))
  const slider = screen.getByRole('slider')
  fireEventChange(slider, '1500')
  // '1500' also appears as a tick label in .elo-ticks, so scope to .elo-num.
  expect(screen.getByText('1500', { selector: '.elo-num' })).toBeInTheDocument()
  expect(screen.getByText('Кандидат')).toBeInTheDocument()
})

test('Back and Start call their handlers', async () => {
  const onBack = vi.fn()
  const onStart = vi.fn()
  render(wrap(<OnboardingElo onBack={onBack} onStart={onStart} />))
  await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
  await userEvent.click(screen.getByRole('button', { name: 'Начать партию' }))
  expect(onBack).toHaveBeenCalledTimes(1)
  expect(onStart).toHaveBeenCalledTimes(1)
})

// range inputs need a direct value change + input event
function fireEventChange(el: HTMLElement, value: string) {
  const input = el as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )!.set!
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
