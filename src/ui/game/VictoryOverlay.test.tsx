import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { VictoryOverlay } from './VictoryOverlay'
import { I18nProvider } from '../app/i18n'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

function renderOverlay() {
  const stop = vi.fn()
  const runFireworksFn = vi.fn<(canvas: HTMLCanvasElement) => () => void>(
    () => stop,
  )
  const playFanfareFn = vi.fn()
  const view = render(
    <I18nProvider>
      <VictoryOverlay
        runFireworksFn={runFireworksFn}
        playFanfareFn={playFanfareFn}
      />
    </I18nProvider>,
  )
  return { view, stop, runFireworksFn, playFanfareFn }
}

test('runs fireworks once on mount, over a canvas', () => {
  const { runFireworksFn } = renderOverlay()
  expect(runFireworksFn).toHaveBeenCalledTimes(1)
  expect(runFireworksFn.mock.calls[0][0]).toBeInstanceOf(HTMLCanvasElement)
})

test('plays the fanfare once when sound is on', () => {
  const { playFanfareFn } = renderOverlay()
  expect(playFanfareFn).toHaveBeenCalledTimes(1)
})

test('does not play the fanfare when muted', () => {
  localStorage.setItem('lmchess.sound', 'off')
  const { playFanfareFn } = renderOverlay()
  expect(playFanfareFn).not.toHaveBeenCalled()
})

test('the sound toggle flips and persists the preference', async () => {
  renderOverlay()
  await userEvent.click(screen.getByRole('button'))
  expect(localStorage.getItem('lmchess.sound')).toBe('off')
})

test('stops the animation on unmount', () => {
  const { view, stop } = renderOverlay()
  view.unmount()
  expect(stop).toHaveBeenCalledTimes(1)
})
