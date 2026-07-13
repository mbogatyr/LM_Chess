import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { PlayerStrip } from './PlayerStrip'

test('renders name, subtitle and clock', () => {
  const { container, getByText } = render(
    <PlayerStrip
      variant="opp"
      name="gemma"
      sub="Соперник · ELO 1000"
      clock="10:00"
    />,
  )
  expect(getByText('gemma')).toBeInTheDocument()
  expect(getByText('Соперник · ELO 1000')).toBeInTheDocument()
  const clock = container.querySelector('.clock')!
  expect(clock.textContent).toBe('10:00')
  expect(clock.classList.contains('active')).toBe(false)
})

test('active adds the active class to the clock', () => {
  const { container } = render(
    <PlayerStrip variant="you" name="Вы" sub="x" clock="10:00" active />,
  )
  expect(container.querySelector('.clock.active')).not.toBeNull()
})
