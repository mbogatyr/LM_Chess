import { render, screen } from '@testing-library/react'
import { I18nProvider } from '../app/i18n'
import { Steps } from './Steps'

function renderSteps(active: 1 | 2) {
  return render(
    <I18nProvider>
      <Steps active={active} />
    </I18nProvider>,
  )
}

test('renders two dots and the 1/2 caption on the first step', () => {
  const { container } = renderSteps(1)
  expect(container.querySelectorAll('.onb-steps i')).toHaveLength(2)
  expect(screen.getByText(/Подключение\s*·\s*1\/2/)).toBeInTheDocument()
})

test('renders the 2/2 caption on the model step', () => {
  renderSteps(2)
  expect(screen.getByText(/Модель\s*·\s*2\/2/)).toBeInTheDocument()
})
