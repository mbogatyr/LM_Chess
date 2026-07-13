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

// HISTORY: ported verbatim from docs/design-reference/gambit-local/app/data.js (HISTORY).
export type HistoryEntry = {
  date: string
  edate: string
  opp: string
  elo: number
  len: number
  res: 'win' | 'loss' | 'draw'
  open: string
  eopen: string
}

export const HISTORY: HistoryEntry[] = [
  {
    date: '11 июл',
    edate: 'Jul 11',
    opp: 'Qwen2.5 14B',
    elo: 1350,
    len: 41,
    res: 'win',
    open: 'Итальянская партия',
    eopen: 'Italian Game',
  },
  {
    date: '10 июл',
    edate: 'Jul 10',
    opp: 'Llama 3.1 8B',
    elo: 1200,
    len: 58,
    res: 'loss',
    open: 'Сицилианская защита',
    eopen: 'Sicilian Defence',
  },
  {
    date: '9 июл',
    edate: 'Jul 9',
    opp: 'Qwen2.5 14B',
    elo: 1350,
    len: 33,
    res: 'win',
    open: 'Ферзевый гамбит',
    eopen: "Queen's Gambit",
  },
  {
    date: '8 июл',
    edate: 'Jul 8',
    opp: 'Mistral Nemo',
    elo: 1100,
    len: 27,
    res: 'win',
    open: 'Испанская партия',
    eopen: 'Ruy López',
  },
  {
    date: '7 июл',
    edate: 'Jul 7',
    opp: 'Phi-3.5 Mini',
    elo: 800,
    len: 22,
    res: 'win',
    open: 'Защита Каро-Канн',
    eopen: 'Caro-Kann',
  },
  {
    date: '6 июл',
    edate: 'Jul 6',
    opp: 'Qwen2.5 14B',
    elo: 1350,
    len: 64,
    res: 'draw',
    open: 'Английское начало',
    eopen: 'English Opening',
  },
  {
    date: '5 июл',
    edate: 'Jul 5',
    opp: 'DeepSeek R1 7B',
    elo: 950,
    len: 45,
    res: 'loss',
    open: 'Французская защита',
    eopen: 'French Defence',
  },
  {
    date: '4 июл',
    edate: 'Jul 4',
    opp: 'Llama 3.1 8B',
    elo: 1200,
    len: 38,
    res: 'win',
    open: 'Славянская защита',
    eopen: 'Slav Defence',
  },
]

export type HistoryStats = {
  played: number
  winRate: number
  streak: number
  best: number
}

// Mirrors the arithmetic in docs/design-reference/gambit-local/app/history.js.
export function historyStats(entries: HistoryEntry[]): HistoryStats {
  const played = entries.length
  const wins = entries.filter((e) => e.res === 'win').length
  const winRate = Math.round((wins / played) * 100)
  let streak = 0
  for (const e of entries) {
    if (e.res === 'win') streak++
    else break
  }
  const best = Math.max(...entries.map((e) => e.elo))
  return { played, winRate, streak, best }
}
