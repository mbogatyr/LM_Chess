import { useState } from 'react'
import { useI18n } from '../app/i18n'
import type { BoardStyle, PieceStyle } from '../app/appState'
import { Board } from './Board'
import { HintConsole } from './HintConsole'
import { PlayerStrip } from './PlayerStrip'
import { MoveList } from './MoveList'
import type { HintLevel } from './chessDemo'

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
  const [hintLevel, setHintLevel] = useState<HintLevel>(0)
  const selectLevel = (lv: HintLevel) =>
    setHintLevel((cur) => (cur === lv ? 0 : lv))
  const cycleHint = () =>
    setHintLevel((cur) => {
      // (cur % 3) + 1 always yields 1, 2, or 3 for cur in 0..3, so this
      // is provably a valid HintLevel despite the arithmetic being typed
      // as `number`.
      return ((cur % 3) + 1) as HintLevel
    })

  return (
    <div className="game">
      <div className="board-col">
        <PlayerStrip
          variant="opp"
          name={opponentName}
          sub={`${t('opp')} · ELO ${elo}`}
          clock="10:00"
        />
        <Board
          hintLevel={hintLevel}
          boardStyle={boardStyle}
          pieceStyle={pieceStyle}
        />
        <PlayerStrip
          variant="you"
          name={t('you')}
          sub={`ELO 1280 · ${t('yoursub')}`}
          clock="10:00"
          active
        />
      </div>

      <div className="side-col">
        <div className="status">
          <span className="turn-dot" />
          <span className="txt">
            <b>{t('yourmove')}</b>
            <small>{t('yoursub')}</small>
          </span>
        </div>
        <HintConsole
          level={hintLevel}
          onSelect={selectLevel}
          onRefresh={cycleHint}
        />
        <MoveList />
      </div>
    </div>
  )
}
