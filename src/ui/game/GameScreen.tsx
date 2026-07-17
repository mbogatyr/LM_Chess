import { useI18n, type TKey } from '../app/i18n'
import type { BoardStyle, PieceStyle } from '../app/appState'
import type { Color, GameState, Square, SquareName } from '../../engine/types'
import { sqName } from './chessDemo'
import { Board } from './Board'
import { HintConsole } from './HintConsole'
import { PlayerStrip } from './PlayerStrip'
import { MoveList } from './MoveList'
import { PromotionPicker } from './PromotionPicker'
import { useGame } from './useGame'

function findKing(board: Square[][], color: Color): SquareName | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p && p.color === color && p.type === 'k') return sqName(r, c)
    }
  }
  return null
}

function statusView(
  state: GameState,
  t: (k: TKey) => string,
): { text: string; theirs: boolean } {
  const s = state.status
  if (s.isCheckmate) {
    return {
      text: s.result === 'white' ? t('st_mate_w') : t('st_mate_b'),
      theirs: false,
    }
  }
  if (s.isDraw) {
    const reason =
      s.drawReason === 'stalemate'
        ? t('dr_stalemate')
        : s.drawReason === 'fifty-move'
          ? t('dr_fifty')
          : s.drawReason === 'threefold'
            ? t('dr_threefold')
            : t('dr_material')
    return { text: `${t('st_draw')} — ${reason}`, theirs: false }
  }
  const base = state.turn === 'w' ? t('turn_w') : t('turn_b')
  return {
    text: s.isCheck ? `${base} — ${t('st_check')}` : base,
    theirs: state.turn === 'b',
  }
}

export function GameScreen({
  opponentName,
  elo,
  boardStyle,
  pieceStyle,
}: {
  opponentName: string
  elo: number
  boardStyle: BoardStyle
  pieceStyle: PieceStyle
}) {
  const { t } = useI18n()
  const g = useGame()
  const { state } = g
  const checkSquare = state.status.isCheck
    ? findKing(state.board, state.turn)
    : null
  const status = statusView(state, t)

  return (
    <div className="game">
      <div className="board-col">
        <PlayerStrip
          variant="opp"
          name={opponentName}
          sub={`${t('opp')} · ELO ${elo}`}
          clock="10:00"
          active={state.turn === 'b'}
        />
        <div style={{ position: 'relative' }}>
          <Board
            board={state.board}
            selected={g.selected}
            legalTargets={g.legalTargets}
            lastMove={
              state.lastMove
                ? { from: state.lastMove.from, to: state.lastMove.to }
                : null
            }
            checkSquare={checkSquare}
            onSquareClick={g.onSquareClick}
            boardStyle={boardStyle}
            pieceStyle={pieceStyle}
          />
          {g.pendingPromotion && (
            <PromotionPicker
              color={state.turn}
              onChoose={g.choosePromotion}
              onCancel={g.cancelPromotion}
            />
          )}
        </div>
        <PlayerStrip
          variant="you"
          name={t('you')}
          sub={`ELO 1280 · ${t('yoursub')}`}
          clock="10:00"
          active={state.turn === 'w'}
        />
      </div>

      <div className="side-col">
        <div className={'status' + (status.theirs ? ' theirs' : '')}>
          <span className="turn-dot" />
          <span className="txt">
            <b>{status.text}</b>
            <small>
              {state.status.isGameOver
                ? ''
                : status.theirs
                  ? t('theirmove')
                  : t('yourmove')}
            </small>
          </span>
        </div>
        <HintConsole
          level={0}
          onSelect={() => {}}
          onRefresh={() => {}}
          disabled
        />
        <MoveList history={state.history} onNewGame={g.newGame} />
      </div>
    </div>
  )
}
