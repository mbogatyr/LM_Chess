import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { PromotionPicker } from './PromotionPicker'

test('renders four promotion choices in the given color', () => {
  const { container } = render(
    <PromotionPicker color="w" onChoose={() => {}} onCancel={() => {}} />,
  )
  expect(container.querySelectorAll('.promo-btn')).toHaveLength(4)
  expect(container.querySelectorAll('.piece.w')).toHaveLength(4)
})

test('clicking a choice calls onChoose with its piece letter', async () => {
  const onChoose = vi.fn()
  render(<PromotionPicker color="w" onChoose={onChoose} onCancel={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: 'r' }))
  expect(onChoose).toHaveBeenCalledWith('r')
})

test('Escape cancels', async () => {
  const onCancel = vi.fn()
  render(<PromotionPicker color="b" onChoose={() => {}} onCancel={onCancel} />)
  await userEvent.keyboard('{Escape}')
  expect(onCancel).toHaveBeenCalledTimes(1)
})
