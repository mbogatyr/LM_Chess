import { useState } from 'react'
import { useI18n } from '../app/i18n'
import type { BoardStyle, PieceStyle } from '../app/appState'
import { Board } from './Board'
import { HintConsole } from './HintConsole'
import { PlayerStrip } from './PlayerStrip'
import { MoveList } from './MoveList'

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
  const [hintLevel, setHintLevel] = useState(0)
  const selectLevel = (lv: number) =>
    setHintLevel((cur) => (cur === lv ? 0 : lv))
  const cycleHint = () => setHintLevel((cur) => (cur % 3) + 1)

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
