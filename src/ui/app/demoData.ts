// ELO_BANDS: ported verbatim from docs/design-reference/gambit-local/app/data.js (ELO_BANDS).
export type EloBand = {
  max: number
  ru: [string, string]
  en: [string, string]
}

export const ELO_BANDS: EloBand[] = [
  {
    max: 650,
    ru: [
      'Новичок',
      'Только выучил, как ходят фигуры. Будет зевать всё подряд — идеально, чтобы почувствовать себя гроссмейстером.',
    ],
    en: [
      'Beginner',
      'Just learned how the pieces move. Will hang everything — perfect for feeling like a grandmaster.',
    ],
  },
  {
    max: 850,
    ru: [
      'Любитель',
      'Знает пару ловушек, но плана нет. Накажет грубый зевок, а тонкости пропустит.',
    ],
    en: [
      'Casual',
      'Knows a trap or two but has no plan. Punishes blunders, misses the subtle stuff.',
    ],
  },
  {
    max: 1050,
    ru: [
      'Уверенный',
      'Развивает фигуры, держит центр. Просто так фигуру уже не отдаст — придётся думать.',
    ],
    en: [
      'Steady',
      "Develops pieces, holds the centre. Won't just gift you material anymore — you'll have to think.",
    ],
  },
  {
    max: 1250,
    ru: [
      'Клубный игрок',
      'Видит короткую тактику и считает на пару ходов. Ошибётесь — тут же прилетит вилка.',
    ],
    en: [
      'Club player',
      'Spots short tactics, calculates a couple of moves. Slip up and a fork arrives instantly.',
    ],
  },
  {
    max: 1450,
    ru: [
      'Сильный',
      'Играет по плану, цепляется за слабости. Красивой атакой уже не отделаетесь.',
    ],
    en: [
      'Strong',
      "Plays with a plan, latches onto weaknesses. A flashy attack won't be enough.",
    ],
  },
  {
    max: 1600,
    ru: [
      'Кандидат',
      'Наказывает за каждую неточность и защищается цепко. Готовьтесь работать за доской.',
    ],
    en: [
      'Candidate',
      'Punishes every inaccuracy and defends stubbornly. Get ready to work at the board.',
    ],
  },
]

export function eloBand(v: number): EloBand {
  return ELO_BANDS.find((b) => v <= b.max) ?? ELO_BANDS[ELO_BANDS.length - 1]
}
