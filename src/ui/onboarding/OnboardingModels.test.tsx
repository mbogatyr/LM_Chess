import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { OnboardingModels } from './OnboardingModels'
import { I18nProvider } from '../app/i18n'
import type { useConnection } from '../useConnection'
import type { LMModel } from '../../llm/types'

type UseConnection = ReturnType<typeof useConnection>

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

const models: LMModel[] = [
  {
    id: 'not-loaded-model',
    type: 'llm',
    state: 'not-loaded',
    quantization: 'Q4_K_M',
  },
  { id: 'loaded-model', type: 'vlm', state: 'loaded' },
]

const modelsWithTested: LMModel[] = [
  ...models,
  {
    id: 'chesslm-0.01-llama-3.1-8b',
    type: 'llm',
    state: 'not-loaded',
    quantization: 'Q4_K_M',
  },
]

function conn(overrides = {}): UseConnection {
  return {
    state: { models, loadingModelId: null },
    load: vi.fn(),
    use: vi.fn(),
    ...overrides,
  } as unknown as UseConnection
}

test('not-loaded row shows Load, loaded row shows the tag and Play', () => {
  render(
    <I18nProvider>
      <OnboardingModels conn={conn()} onUse={() => {}} />
    </I18nProvider>,
  )
  expect(screen.getByText('not-loaded-model')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Загрузить' })).toBeEnabled()
  expect(screen.getByText('В памяти')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Играть' })).toBeInTheDocument()
})

test('Play uses the model then advances', async () => {
  const onUse = vi.fn()
  const c = conn()
  render(
    <I18nProvider>
      <OnboardingModels conn={c} onUse={onUse} />
    </I18nProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Играть' }))
  expect(c.use).toHaveBeenCalledWith('loaded-model')
  expect(onUse).toHaveBeenCalledTimes(1)
})

test('Load triggers the real load for that model', async () => {
  const c = conn()
  render(
    <I18nProvider>
      <OnboardingModels conn={c} onUse={() => {}} />
    </I18nProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Загрузить' }))
  expect(c.load).toHaveBeenCalledWith('not-loaded-model')
})

test('renders a load error as an alert', () => {
  const c = conn({ state: { models, loadingModelId: null, error: 'boom' } })
  render(
    <I18nProvider>
      <OnboardingModels conn={c} onUse={() => {}} />
    </I18nProvider>,
  )
  expect(screen.getByRole('alert')).toHaveTextContent('boom')
})

test('tested models get a star, others do not', () => {
  render(
    <I18nProvider>
      <OnboardingModels
        conn={conn({
          state: { models: modelsWithTested, loadingModelId: null },
        })}
        onUse={() => {}}
      />
    </I18nProvider>,
  )
  const testedRow = screen
    .getByText('chesslm-0.01-llama-3.1-8b')
    .closest('.model-row')
  const plainRow = screen.getByText('not-loaded-model').closest('.model-row')
  expect(testedRow?.querySelector('.model-star')).not.toBeNull()
  expect(plainRow?.querySelector('.model-star')).toBeNull()
})

test('Recommended models button opens and closes the dialog', async () => {
  render(
    <I18nProvider>
      <OnboardingModels conn={conn()} onUse={() => {}} />
    </I18nProvider>,
  )
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await userEvent.click(
    screen.getByRole('button', {
      name: 'Рекомендуемые модели',
    }),
  )
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
