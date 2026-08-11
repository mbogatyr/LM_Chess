import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'
import type { ReactNode } from 'react'
import { GameScreen } from './GameScreen'
import { I18nProvider } from '../app/i18n'
import { move } from '../../engine/game'
import type { selectMove } from '../../llm/selectMove'
import type { getHint, Hint } from '../../llm/hint'
import { loadGames } from '../history/gameHistory'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())
const wrap = (n: ReactNode) => <I18nProvider>{n}</I18nProvider>

const idleOpponent: typeof selectMove = () => new Promise(() => {})
function scriptedOpponent(blackMoves: string[]): typeof selectMove {
  let i = 0
  return async ({ state }) => {
    const san = blackMoves[i++]
    const next = move(state, san)!
    return { nextState: next, san: next.lastMove?.san ?? '', source: 'model' }
  }
}

const baseProps = {
  opponentName: 'gemma',
  elo: 1200,
  boardStyle: 'mono' as const,
  pieceStyle: 'neon' as const,
  baseUrl: 'http://x',
  model: 'm',
}
const click = (c: HTMLElement, sq: string) =>
  fireEvent.click(c.querySelector(`[data-sq="${sq}"]`) as HTMLElement)

test('shows players, frozen clocks and the white-to-move status', () => {
  const { container } = render(
    wrap(<GameScreen {...baseProps} selectMoveFn={idleOpponent} />),
  )
  expect(screen.getByText('gemma')).toBeInTheDocument()
  expect(screen.getByText('Вы')).toBeInTheDocument()
  expect(container.querySelectorAll('.clock')).toHaveLength(2)
  expect(container.querySelector('.status .txt b')!.textContent).toBe(
    'Ход белых',
  )
})

test('White moves, the model replies, and the move list updates', async () => {
  const { container } = render(
    wrap(<GameScreen {...baseProps} selectMoveFn={scriptedOpponent(['e5'])} />),
  )
  click(container, 'e2')
  click(container, 'e4')
  expect(screen.getByText('e4')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByText('e5')).toBeInTheDocument())
  await waitFor(() =>
    expect(container.querySelector('.status .txt b')!.textContent).toBe(
      'Ход белых',
    ),
  )
})

test('shows the "model is thinking" subtext on Black’s turn', async () => {
  const { container } = render(
    wrap(<GameScreen {...baseProps} selectMoveFn={idleOpponent} />),
  )
  click(container, 'e2')
  click(container, 'e4')
  await waitFor(() =>
    expect(container.querySelector('.status .txt small')!.textContent).toBe(
      'Модель думает…',
    ),
  )
})

test('Fool’s Mate: White plays, model plays Black to mate', async () => {
  const { container } = render(
    wrap(
      <GameScreen
        {...baseProps}
        selectMoveFn={scriptedOpponent(['e5', 'Qh4#'])}
      />,
    ),
  )
  click(container, 'f2')
  click(container, 'f3')
  await waitFor(() => expect(screen.getByText('e5')).toBeInTheDocument())
  click(container, 'g2')
  click(container, 'g4')
  await waitFor(() =>
    expect(container.querySelector('.status .txt b')!.textContent).toBe(
      'Мат — победа чёрных',
    ),
  )
})

const HINT_E4: Hint = {
  san: 'e4',
  from: 'e2',
  to: 'e4',
  pieceType: 'p',
  idea: 'Grab the centre.',
}
const hintReturning =
  (h: Hint): typeof getHint =>
  async () =>
    h

test('the hint panel is enabled on the human turn', () => {
  render(wrap(<GameScreen {...baseProps} selectMoveFn={idleOpponent} />))
  expect(screen.getByRole('button', { name: /Фигура/ })).toBeEnabled()
})

test('revealing L3 highlights the recommended move on the board', async () => {
  const { container } = render(
    wrap(
      <GameScreen
        {...baseProps}
        selectMoveFn={idleOpponent}
        getHintFn={hintReturning(HINT_E4)}
      />,
    ),
  )
  await userEvent.click(screen.getByRole('button', { name: /Ход/ }))
  await waitFor(() =>
    expect(
      container.querySelector('[data-sq="e2"]')!.classList.contains('hint1'),
    ).toBe(true),
  )
  expect(
    container
      .querySelector('[data-sq="e4"]')!
      .classList.contains('hint-target'),
  ).toBe(true)
})

test('both clocks start frozen at 10:00', () => {
  const { container } = render(
    wrap(<GameScreen {...baseProps} selectMoveFn={idleOpponent} />),
  )
  const clocks = container.querySelectorAll('.clock')
  expect(clocks).toHaveLength(2)
  expect([...clocks].map((c) => c.textContent)).toEqual(['10:00', '10:00'])
})

test('resigning shows the resignation status and records the game', async () => {
  const { container } = render(
    wrap(<GameScreen {...baseProps} selectMoveFn={idleOpponent} />),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Сдаться' }))
  await userEvent.click(screen.getByRole('button', { name: 'Точно?' }))
  expect(container.querySelector('.status .txt b')!.textContent).toBe(
    'Поражение — сдача',
  )
  expect(loadGames()).toHaveLength(1)
  expect(loadGames()[0].opponent).toBe('gemma')
})

test('neither player strip mentions ELO', () => {
  const { container } = render(
    wrap(<GameScreen {...baseProps} selectMoveFn={idleOpponent} />),
  )
  const subs = [...container.querySelectorAll('.who small')].map(
    (s) => s.textContent,
  )
  expect(subs).toEqual(['Соперник', 'Белые ходят'])
  expect(container.textContent).not.toMatch(/ELO/)
})
