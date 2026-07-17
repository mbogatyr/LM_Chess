import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Lang = 'ru' | 'en'

// STRINGS: ported verbatim from docs/design-reference/gambit-local/app/data.js (I18N).
export const STRINGS = {
  ru: {
    subtitle: 'Шахматы против локальной модели',
    tab_game: 'Партия',
    tab_history: 'История',
    styleBtn: 'Оформление',
    connected: 'Подключено',
    offline: 'Не подключено',

    // onboarding
    step_connect: 'Подключение',
    step_model: 'Модель',
    step_confirm: 'Подтверждение',
    step_elo: 'Уровень',

    connect_h: 'Подключитесь к LM Studio',
    connect_p:
      'Запустите локальный сервер в LM Studio (вкладка Developer → Start Server). Соперник будет ходить прямо на вашей машине — без облака и без задержек.',
    connect_url: 'Адрес сервера',
    connect_check: 'Проверить соединение',
    connect_checking: 'Проверяем сервер…',
    connect_ok: 'Сервер отвечает — нашли модели',
    connect_next: 'Выбрать модель',
    connect_hint:
      'Обычно это http://localhost:1234. Порт виден в окне LM Studio.',

    model_h: 'Выберите модель',
    model_p:
      'Модели, найденные на сервере LM Studio. Сначала загрузите модель в память, затем выберите её соперником.',
    load: 'Загрузить',
    loading: 'Загрузка…',
    loaded: 'В памяти',
    use: 'Играть',
    model_ram: 'ОЗУ',
    model_ctx: 'Контекст',
    model_q: 'Квант',

    confirm_h: 'Готовы сыграть?',
    confirm_p:
      'Эта модель будет вашим соперником. Сила игры зависит от выбранного уровня ELO — его настроим на следующем шаге.',
    confirm_back: 'Другая модель',
    confirm_go: 'Выбрать уровень',
    confirm_specs: 'Загружена и готова',

    elo_h: 'Насколько сильный соперник?',
    elo_p: 'Двигайте ползунок. Модель будет играть примерно на этом рейтинге.',
    elo_start: 'Начать партию',
    elo_back: 'Назад',

    // game
    you: 'Вы',
    opp: 'Соперник',
    yourmove: 'Ваш ход',
    yoursub: 'Белые ходят',
    theirmove: 'Ход соперника',
    theirsub: 'Модель думает…',
    check: 'Шах!',
    checksub: 'Уведите короля из-под удара',
    hints_h: 'Подсказки',
    hint1_t: 'Фигура',
    hint1_s: 'какой ходить',
    hint2_t: 'Идея',
    hint2_s: 'тактика хода',
    hint3_t: 'Ход',
    hint3_s: 'куда именно',
    hint_empty: 'Застряли? Выберите уровень подсказки.',
    hint_off: 'Подсказка скрыта',
    moves_h: 'Ходы',
    resign: 'Сдаться',
    offerdraw: 'Ничья',
    newgame: 'Новая партия',
    turn_w: 'Ход белых',
    turn_b: 'Ход чёрных',
    st_check: 'шах',
    st_mate_w: 'Мат — победа белых',
    st_mate_b: 'Мат — победа чёрных',
    st_draw: 'Ничья',
    dr_stalemate: 'пат',
    dr_fifty: 'правило 50 ходов',
    dr_threefold: 'троекратное повторение',
    dr_material: 'недостаток материала',

    // style sheet
    style_h: 'Оформление доски',
    style_board: 'Доска',
    style_pieces: 'Фигуры',
    board_mono: 'Ночь',
    board_contrast: 'Контраст',
    board_accent: 'Акцент',
    pieces_neon: 'Неон',
    pieces_outline: 'Контур',
    pieces_flat: 'Плоские',
    done: 'Готово',

    // leaderboard
    lb_h: 'История матчей',
    lb_p: 'Каждая партия против локальной модели.',
    st_played: 'Партий',
    st_winrate: 'Побед',
    st_streak: 'Серия',
    st_best: 'Лучший ELO',
    col_date: 'Дата',
    col_opp: 'Соперник',
    col_elo: 'ELO',
    col_len: 'Ходов',
    col_res: 'Итог',
    col_open: 'Дебют',
    win: 'Победа',
    loss: 'Поражение',
    draw: 'Ничья',
  },
  en: {
    subtitle: 'Chess against a local model',
    tab_game: 'Game',
    tab_history: 'History',
    styleBtn: 'Appearance',
    connected: 'Connected',
    offline: 'Offline',

    step_connect: 'Connect',
    step_model: 'Model',
    step_confirm: 'Confirm',
    step_elo: 'Level',

    connect_h: 'Connect to LM Studio',
    connect_p:
      'Start the local server in LM Studio (Developer tab → Start Server). Your opponent runs right on your machine — no cloud, no latency.',
    connect_url: 'Server address',
    connect_check: 'Test connection',
    connect_checking: 'Reaching the server…',
    connect_ok: 'Server responded — models found',
    connect_next: 'Choose a model',
    connect_hint:
      'Usually http://localhost:1234. The port shows in the LM Studio window.',

    model_h: 'Choose a model',
    model_p:
      'Models found on the LM Studio server. Load one into memory first, then pick it as your opponent.',
    load: 'Load',
    loading: 'Loading…',
    loaded: 'In memory',
    use: 'Play',
    model_ram: 'RAM',
    model_ctx: 'Context',
    model_q: 'Quant',

    confirm_h: 'Ready to play?',
    confirm_p:
      "This model will be your opponent. Its strength follows the ELO level you set — that's the next step.",
    confirm_back: 'Another model',
    confirm_go: 'Choose level',
    confirm_specs: 'Loaded and ready',

    elo_h: 'How strong an opponent?',
    elo_p: 'Drag the slider. The model will play at roughly this rating.',
    elo_start: 'Start game',
    elo_back: 'Back',

    you: 'You',
    opp: 'Opponent',
    yourmove: 'Your move',
    yoursub: 'White to play',
    theirmove: "Opponent's move",
    theirsub: 'The model is thinking…',
    check: 'Check!',
    checksub: 'Move your king out of attack',
    hints_h: 'Hints',
    hint1_t: 'Piece',
    hint1_s: 'which to move',
    hint2_t: 'Idea',
    hint2_s: 'the tactic',
    hint3_t: 'Move',
    hint3_s: 'exactly where',
    hint_empty: 'Stuck? Pick a hint level.',
    hint_off: 'Hint hidden',
    moves_h: 'Moves',
    resign: 'Resign',
    offerdraw: 'Draw',
    newgame: 'New game',
    turn_w: 'White to move',
    turn_b: 'Black to move',
    st_check: 'check',
    st_mate_w: 'Checkmate — White wins',
    st_mate_b: 'Checkmate — Black wins',
    st_draw: 'Draw',
    dr_stalemate: 'stalemate',
    dr_fifty: 'fifty-move rule',
    dr_threefold: 'threefold repetition',
    dr_material: 'insufficient material',

    style_h: 'Board appearance',
    style_board: 'Board',
    style_pieces: 'Pieces',
    board_mono: 'Night',
    board_contrast: 'Contrast',
    board_accent: 'Accent',
    pieces_neon: 'Neon',
    pieces_outline: 'Outline',
    pieces_flat: 'Flat',
    done: 'Done',

    lb_h: 'Match history',
    lb_p: 'Every game against a local model.',
    st_played: 'Games',
    st_winrate: 'Win rate',
    st_streak: 'Streak',
    st_best: 'Best ELO',
    col_date: 'Date',
    col_opp: 'Opponent',
    col_elo: 'ELO',
    col_len: 'Moves',
    col_res: 'Result',
    col_open: 'Opening',
    win: 'Win',
    loss: 'Loss',
    draw: 'Draw',
  },
} as const

export type TKey = keyof (typeof STRINGS)['ru']

const STORAGE_KEY = 'nocturne-chess'

function readStore(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeLang(lang: Lang): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStore(), lang }))
}

type I18nValue = {
  lang: Lang
  setLang: (l: Lang) => void
  t: (k: TKey) => string
}
const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    readStore().lang === 'en' ? 'en' : 'ru',
  )
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    writeLang(l)
  }, [])
  const t = useCallback((key: TKey) => STRINGS[lang][key], [lang])
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
