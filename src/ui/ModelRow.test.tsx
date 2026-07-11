import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ModelRow } from './ModelRow'
import type { LMModel } from '../llm/types'

const notLoaded: LMModel = { id: 'a', type: 'llm', state: 'not-loaded' }
const loaded: LMModel = { id: 'b', type: 'vlm', state: 'loaded' }

test('not-loaded model: Load enabled, Use disabled', () => {
  render(
    <ModelRow
      model={notLoaded}
      isLoading={false}
      onLoad={() => {}}
      onUse={() => {}}
    />,
  )
  expect(screen.getByText('Not loaded')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Load' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Use' })).toBeDisabled()
})

test('loaded model: Use enabled, no Load button', () => {
  render(
    <ModelRow
      model={loaded}
      isLoading={false}
      onLoad={() => {}}
      onUse={() => {}}
    />,
  )
  expect(screen.getByText('Loaded')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Use' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Load' })).toBeNull()
})

test('Load button shows Loading… and is disabled while loading', () => {
  render(
    <ModelRow model={notLoaded} isLoading onLoad={() => {}} onUse={() => {}} />,
  )
  expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled()
})

test('clicking Load and Use calls the handlers with the id', async () => {
  const onLoad = vi.fn()
  const onUse = vi.fn()
  const { rerender } = render(
    <ModelRow
      model={notLoaded}
      isLoading={false}
      onLoad={onLoad}
      onUse={onUse}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Load' }))
  expect(onLoad).toHaveBeenCalledWith('a')
  rerender(
    <ModelRow model={loaded} isLoading={false} onLoad={onLoad} onUse={onUse} />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Use' }))
  expect(onUse).toHaveBeenCalledWith('b')
})
