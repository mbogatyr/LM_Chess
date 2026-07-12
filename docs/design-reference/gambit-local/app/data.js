/* i18n strings (RU / EN) + static app data. Plain globals, no build step. */

const I18N = {
  ru: {
    subtitle: "Шахматы против локальной модели",
    tab_game: "Партия",
    tab_history: "История",
    styleBtn: "Оформление",
    connected: "Подключено",
    offline: "Не подключено",

    // onboarding
    step_connect: "Подключение", step_model: "Модель", step_confirm: "Подтверждение", step_elo: "Уровень",

    connect_h: "Подключитесь к LM Studio",
    connect_p: "Запустите локальный сервер в LM Studio (вкладка Developer → Start Server). Соперник будет ходить прямо на вашей машине — без облака и без задержек.",
    connect_url: "Адрес сервера",
    connect_check: "Проверить соединение",
    connect_checking: "Проверяем сервер…",
    connect_ok: "Сервер отвечает — нашли модели",
    connect_next: "Выбрать модель",
    connect_hint: "Обычно это http://localhost:1234. Порт виден в окне LM Studio.",

    model_h: "Выберите модель",
    model_p: "Модели, найденные на сервере LM Studio. Сначала загрузите модель в память, затем выберите её соперником.",
    load: "Загрузить", loading: "Загрузка…", loaded: "В памяти", use: "Играть",
    model_ram: "ОЗУ", model_ctx: "Контекст", model_q: "Квант",

    confirm_h: "Готовы сыграть?",
    confirm_p: "Эта модель будет вашим соперником. Сила игры зависит от выбранного уровня ELO — его настроим на следующем шаге.",
    confirm_back: "Другая модель", confirm_go: "Выбрать уровень",
    confirm_specs: "Загружена и готова",

    elo_h: "Насколько сильный соперник?",
    elo_p: "Двигайте ползунок. Модель будет играть примерно на этом рейтинге.",
    elo_start: "Начать партию", elo_back: "Назад",

    // game
    you: "Вы", opp: "Соперник",
    yourmove: "Ваш ход", yoursub: "Белые ходят",
    theirmove: "Ход соперника", theirsub: "Модель думает…",
    check: "Шах!", checksub: "Уведите короля из-под удара",
    hints_h: "Подсказки",
    hint1_t: "Фигура", hint1_s: "какой ходить",
    hint2_t: "Идея", hint2_s: "тактика хода",
    hint3_t: "Ход", hint3_s: "куда именно",
    hint_empty: "Застряли? Выберите уровень подсказки.",
    hint_off: "Подсказка скрыта",
    moves_h: "Ходы", resign: "Сдаться", offerdraw: "Ничья",
    newgame: "Новая партия",

    // style sheet
    style_h: "Оформление доски",
    style_board: "Доска", style_pieces: "Фигуры",
    board_mono: "Ночь", board_contrast: "Контраст", board_accent: "Акцент",
    pieces_neon: "Неон", pieces_outline: "Контур", pieces_flat: "Плоские",
    done: "Готово",

    // leaderboard
    lb_h: "История матчей",
    lb_p: "Каждая партия против локальной модели.",
    st_played: "Партий", st_winrate: "Побед", st_streak: "Серия", st_best: "Лучший ELO",
    col_date: "Дата", col_opp: "Соперник", col_elo: "ELO", col_len: "Ходов", col_res: "Итог", col_open: "Дебют",
    win: "Победа", loss: "Поражение", draw: "Ничья",
  },
  en: {
    subtitle: "Chess against a local model",
    tab_game: "Game",
    tab_history: "History",
    styleBtn: "Appearance",
    connected: "Connected",
    offline: "Offline",

    step_connect: "Connect", step_model: "Model", step_confirm: "Confirm", step_elo: "Level",

    connect_h: "Connect to LM Studio",
    connect_p: "Start the local server in LM Studio (Developer tab → Start Server). Your opponent runs right on your machine — no cloud, no latency.",
    connect_url: "Server address",
    connect_check: "Test connection",
    connect_checking: "Reaching the server…",
    connect_ok: "Server responded — models found",
    connect_next: "Choose a model",
    connect_hint: "Usually http://localhost:1234. The port shows in the LM Studio window.",

    model_h: "Choose a model",
    model_p: "Models found on the LM Studio server. Load one into memory first, then pick it as your opponent.",
    load: "Load", loading: "Loading…", loaded: "In memory", use: "Play", 
    model_ram: "RAM", model_ctx: "Context", model_q: "Quant",

    confirm_h: "Ready to play?",
    confirm_p: "This model will be your opponent. Its strength follows the ELO level you set — that's the next step.",
    confirm_back: "Another model", confirm_go: "Choose level",
    confirm_specs: "Loaded and ready",

    elo_h: "How strong an opponent?",
    elo_p: "Drag the slider. The model will play at roughly this rating.",
    elo_start: "Start game", elo_back: "Back",

    you: "You", opp: "Opponent",
    yourmove: "Your move", yoursub: "White to play",
    theirmove: "Opponent's move", theirsub: "The model is thinking…",
    check: "Check!", checksub: "Move your king out of attack",
    hints_h: "Hints",
    hint1_t: "Piece", hint1_s: "which to move",
    hint2_t: "Idea", hint2_s: "the tactic",
    hint3_t: "Move", hint3_s: "exactly where",
    hint_empty: "Stuck? Pick a hint level.",
    hint_off: "Hint hidden",
    moves_h: "Moves", resign: "Resign", offerdraw: "Draw",
    newgame: "New game",

    style_h: "Board appearance",
    style_board: "Board", style_pieces: "Pieces",
    board_mono: "Night", board_contrast: "Contrast", board_accent: "Accent",
    pieces_neon: "Neon", pieces_outline: "Outline", pieces_flat: "Flat",
    done: "Done",

    lb_h: "Match history",
    lb_p: "Every game against a local model.",
    st_played: "Games", st_winrate: "Win rate", st_streak: "Streak", st_best: "Best ELO",
    col_date: "Date", col_opp: "Opponent", col_elo: "ELO", col_len: "Moves", col_res: "Result", col_open: "Opening",
    win: "Win", loss: "Loss", draw: "Draw",
  },
};

/* LM Studio models (as they'd appear from the server) */
const MODELS = [
  { id: "qwen2.5-14b-instruct",   name: "Qwen2.5 14B Instruct",   ram: "9.1 GB", ctx: "32K", q: "Q4_K_M", loaded: false },
  { id: "llama-3.1-8b-instruct",  name: "Llama 3.1 8B Instruct",  ram: "5.4 GB", ctx: "128K", q: "Q5_K_M", loaded: false },
  { id: "mistral-nemo-12b",       name: "Mistral Nemo 12B",       ram: "7.6 GB", ctx: "128K", q: "Q4_K_M", loaded: false },
  { id: "phi-3.5-mini-instruct",  name: "Phi-3.5 Mini Instruct",  ram: "2.4 GB", ctx: "128K", q: "Q6_K",   loaded: false },
  { id: "deepseek-r1-distill-7b", name: "DeepSeek R1 Distill 7B", ram: "4.8 GB", ctx: "64K",  q: "Q4_K_M", loaded: false },
];

/* ELO comments — friendly, with character. Keyed by upper bound. */
const ELO_BANDS = [
  { max: 650,  ru: ["Новичок", "Только выучил, как ходят фигуры. Будет зевать всё подряд — идеально, чтобы почувствовать себя гроссмейстером."],
                en: ["Beginner", "Just learned how the pieces move. Will hang everything — perfect for feeling like a grandmaster."] },
  { max: 850,  ru: ["Любитель", "Знает пару ловушек, но плана нет. Накажет грубый зевок, а тонкости пропустит."],
                en: ["Casual", "Knows a trap or two but has no plan. Punishes blunders, misses the subtle stuff."] },
  { max: 1050, ru: ["Уверенный", "Развивает фигуры, держит центр. Просто так фигуру уже не отдаст — придётся думать."],
                en: ["Steady", "Develops pieces, holds the centre. Won't just gift you material anymore — you'll have to think."] },
  { max: 1250, ru: ["Клубный игрок", "Видит короткую тактику и считает на пару ходов. Ошибётесь — тут же прилетит вилка."],
                en: ["Club player", "Spots short tactics, calculates a couple of moves. Slip up and a fork arrives instantly."] },
  { max: 1450, ru: ["Сильный", "Играет по плану, цепляется за слабости. Красивой атакой уже не отделаетесь."],
                en: ["Strong", "Plays with a plan, latches onto weaknesses. A flashy attack won't be enough."] },
  { max: 1600, ru: ["Кандидат", "Наказывает за каждую неточность и защищается цепко. Готовьтесь работать за доской."],
                en: ["Candidate", "Punishes every inaccuracy and defends stubbornly. Get ready to work at the board."] },
];
function eloBand(v) { return ELO_BANDS.find(b => v <= b.max) || ELO_BANDS[ELO_BANDS.length - 1]; }

/* Match history */
const HISTORY = [
  { date: "11 июл",  edate: "Jul 11", opp: "Qwen2.5 14B",   elo: 1350, len: 41, res: "win",  open: "Итальянская партия",  eopen: "Italian Game" },
  { date: "10 июл",  edate: "Jul 10", opp: "Llama 3.1 8B",  elo: 1200, len: 58, res: "loss", open: "Сицилианская защита", eopen: "Sicilian Defence" },
  { date: "9 июл",   edate: "Jul 9",  opp: "Qwen2.5 14B",   elo: 1350, len: 33, res: "win",  open: "Ферзевый гамбит",     eopen: "Queen's Gambit" },
  { date: "8 июл",   edate: "Jul 8",  opp: "Mistral Nemo",  elo: 1100, len: 27, res: "win",  open: "Испанская партия",    eopen: "Ruy López" },
  { date: "7 июл",   edate: "Jul 7",  opp: "Phi-3.5 Mini",  elo: 800,  len: 22, res: "win",  open: "Защита Каро-Канн",    eopen: "Caro-Kann" },
  { date: "6 июл",   edate: "Jul 6",  opp: "Qwen2.5 14B",   elo: 1350, len: 64, res: "draw", open: "Английское начало",   eopen: "English Opening" },
  { date: "5 июл",   edate: "Jul 5",  opp: "DeepSeek R1 7B", elo: 950, len: 45, res: "loss", open: "Французская защита",  eopen: "French Defence" },
  { date: "4 июл",   edate: "Jul 4",  opp: "Llama 3.1 8B",  elo: 1200, len: 38, res: "win",  open: "Славянская защита",   eopen: "Slav Defence" },
];
