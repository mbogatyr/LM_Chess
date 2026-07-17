import { useEffect } from 'react'
import type { Color, PromotionPiece } from '../../engine/types'
import { Piece } from './Piece'

const CHOICES: PromotionPiece[] = ['q', 'r', 'b', 'n']

export function PromotionPicker({
  color,
  onChoose,
  onCancel,
}: {
  color: Color
  onChoose: (p: PromotionPiece) => void
  onCancel: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="promo" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="promo-row" onClick={(e) => e.stopPropagation()}>
        {CHOICES.map((p) => (
          <button
            key={p}
            type="button"
            className="promo-btn"
            aria-label={p}
            onClick={() => onChoose(p)}
          >
            <Piece color={color} type={p} />
          </button>
        ))}
      </div>
    </div>
  )
}
