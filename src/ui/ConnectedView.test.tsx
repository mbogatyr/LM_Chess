import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ConnectedView } from './ConnectedView'

test('shows the active model and base url', () => {
  render(
    <ConnectedView
      baseUrl="http://localhost:1234"
      activeModel="google/gemma-4-e4b"
      onChange={() => {}}
    />,
  )
  expect(screen.getByText('google/gemma-4-e4b')).toBeInTheDocument()
  expect(screen.getByText(/http:\/\/localhost:1234/)).toBeInTheDocument()
})

test('Change button calls onChange', async () => {
  const onChange = vi.fn()
  render(
    <ConnectedView
      baseUrl="http://localhost:1234"
      activeModel="m"
      onChange={onChange}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Change' }))
  expect(onChange).toHaveBeenCalledTimes(1)
})
