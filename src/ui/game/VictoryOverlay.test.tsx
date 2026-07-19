import { render, screen } from '@testing-library/react'
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

test('plays the fanfare once on mount', () => {
  const { playFanfareFn } = renderOverlay()
  expect(playFanfareFn).toHaveBeenCalledTimes(1)
})

test('renders no interactive controls (no sound toggle)', () => {
  renderOverlay()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('stops the animation on unmount', () => {
  const { view, stop } = renderOverlay()
  view.unmount()
  expect(stop).toHaveBeenCalledTimes(1)
})
