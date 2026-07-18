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
import { selectMove } from '../../llm/selectMove'

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
  outcome: { over: boolean; reason: string | null },
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
  if (outcome.reason === 'timeout') {
    return { text: t('st_time_loss'), theirs: false }
  }
  if (outcome.reason === 'resignation') {
    return { text: t('st_resign_loss'), theirs: false }
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
  baseUrl,
  model,
  selectMoveFn,
}: {
  opponentName: string
  elo: number
  boardStyle: BoardStyle
  pieceStyle: PieceStyle
  baseUrl: string
  model: string
  selectMoveFn?: typeof selectMove
}) {
  const { t } = useI18n()
  const g = useGame({ baseUrl, model, elo, selectMoveFn, opponentName })
  const { state } = g
  const checkSquare = state.status.isCheck
    ? findKing(state.board, state.turn)
    : null
  const status = statusView(state, t, g.outcome)

  return (
    <div className="game">
      <div className="board-col">
        <PlayerStrip
          variant="opp"
          name={opponentName}
          sub={`${t('opp')} · ELO ${elo}`}
          clock={g.blackClock}
          active={state.turn === 'b' && !g.outcome.over}
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
          clock={g.whiteClock}
          active={state.turn === 'w' && !g.outcome.over}
        />
      </div>

      <div className="side-col">
        <div className={'status' + (status.theirs ? ' theirs' : '')}>
          <span className="turn-dot" />
          <span className="txt">
            <b>{status.text}</b>
            <small>
              {g.outcome.over
                ? ''
                : g.thinking
                  ? t('theirsub')
                  : status.theirs
                    ? t('theirmove')
                    : t('yourmove')}
            </small>
          </span>
        </div>
        {g.connectionError && (
          <div className="conn-error" role="alert">
            <span>{t('conn_lost')}</span>
            <button type="button" className="btn" onClick={g.retryModelTurn}>
              {t('retry_move')}
            </button>
          </div>
        )}
        {g.lastMoveFallback && !g.thinking && (
          <div className="fallback-note">{t('fallback_move')}</div>
        )}
        <HintConsole
          level={0}
          onSelect={() => {}}
          onRefresh={() => {}}
          disabled
        />
        <MoveList
          history={state.history}
          onNewGame={g.newGame}
          onResign={g.resign}
          gameOver={g.outcome.over}
        />
      </div>
    </div>
  )
}
