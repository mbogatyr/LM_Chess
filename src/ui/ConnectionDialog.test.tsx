import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ConnectionDialog } from './ConnectionDialog'
import type { ConnectionState } from './useConnection'

const base: ConnectionState = {
  baseUrl: 'http://localhost:1234',
  phase: 'idle',
  models: [],
  loadingModelId: null,
  activeModel: null,
  error: null,
}

test('renders the URL field pre-filled with the base url', () => {
  render(
    <ConnectionDialog
      state={base}
      onConnect={() => {}}
      onLoad={() => {}}
      onUse={() => {}}
    />,
  )
  expect(screen.getByLabelText('Server URL')).toHaveValue(
    'http://localhost:1234',
  )
})

test('Connect calls onConnect with the edited url', async () => {
  const onConnect = vi.fn()
  render(
    <ConnectionDialog
      state={base}
      onConnect={onConnect}
      onLoad={() => {}}
      onUse={() => {}}
    />,
  )
  const field = screen.getByLabelText('Server URL')
  await userEvent.clear(field)
  await userEvent.type(field, 'http://127.0.0.1:1234')
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  expect(onConnect).toHaveBeenCalledWith('http://127.0.0.1:1234')
})

test('shows an error message when state.error is set', () => {
  render(
    <ConnectionDialog
      state={{ ...base, phase: 'error', error: 'Cannot reach server' }}
      onConnect={() => {}}
      onLoad={() => {}}
      onUse={() => {}}
    />,
  )
  expect(screen.getByText('Cannot reach server')).toBeInTheDocument()
})

test('renders the model list once connected', () => {
  render(
    <ConnectionDialog
      state={{
        ...base,
        phase: 'connected',
        models: [{ id: 'a', type: 'llm', state: 'not-loaded' }],
      }}
      onConnect={() => {}}
      onLoad={() => {}}
      onUse={() => {}}
    />,
  )
  expect(screen.getByText('a')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Load' })).toBeInTheDocument()
})
