# WS Quiz App — план разработки

Интерактивное приложение для практикумов курса. Ведущий показывает задачи «что выведет консоль», студенты отправляют ответы, сервер засчитывает баллы и строит таблицу рекордов в реальном времени.

---

## Три экрана

| Маршрут | Кто | Что видит |
|---|---|---|
| `/host` | Ведущий | Список задач, запуск/завершение, live-ответы, чаты со студентами, таблица рекордов, ручная корректировка оценок. Auth через env-токен. |
| `/present` | Аудитория (screen share) | Только задача с подсветкой кода + таймер-полоса + счётчик ответов. Управляется ведущим. Без авторизации. |
| `/join` | Студент | Никнейм → задача → поле ввода → результат раунда → таблица рекордов → чат с ведущим. |

---

## WS-события

### Student → Server
| Событие | Данные |
|---|---|
| `student_join` | `{ name, reconnectToken? }` |
| `submit_answer` | `{ questionId, answer }` |
| `chat_to_host` | `{ text }` |

### Host → Server
| Событие | Данные |
|---|---|
| `host_auth` | `{ token }` |
| `start_question` | `{ questionId, timeoutSec }` |
| `end_question` | `{ questionId }` — досрочное завершение |
| `override_score` | `{ studentId, correct }` |
| `chat_to_student` | `{ studentId, text }` |

### Server → Student
| Событие | Данные |
|---|---|
| `welcome` | `{ studentId, reconnectToken }` |
| `join_failed` | `{ reason }` — имя занято или сессия закрыта |
| `question_started` | `{ questionId, code, timeoutSec, startedAt }` |
| `answer_received` | — подтверждение приёма |
| `answer_rejected` | `{ reason }` — дубль или нет активного вопроса |
| `round_result` | `{ correct, correctAnswer, points, totalPoints }` |
| `leaderboard` | `{ scores[] }` |
| `chat_from_host` | `{ text }` |

### Server → Host
| Событие | Данные |
|---|---|
| `auth_success` | — |
| `auth_failed` | `{ reason }` |
| `student_joined` | `{ id, name }` |
| `student_answered` | `{ studentId }` — без содержимого ответа |
| `round_results` | все ответы + авто-оценки |
| `scoreboard_update` | текущий рейтинг |
| `chat_from_student` | `{ studentId, name, text }` |

> **Present view** получает отдельный broadcast: `question_started`, `timer_tick`, `answer_count`, `question_ended`. Подключается как отдельная роль (не студент и не ведущий).

---

## Reconnect

При разрыве соединения студент переподключается с сохранением очков:

1. Сервер выдаёт `reconnectToken` (случайный UUID) в событии `welcome` и хранит его в `GameSession` рядом с `studentId`.
2. Клиент сохраняет токен в `sessionStorage`.
3. При повторном `student_join` клиент отправляет `{ name, reconnectToken }`.
4. Сервер ищет токен: если находит — возвращает прежний `studentId` и очки; если нет — создаёт нового студента.
5. Если студент переподключился в момент активного вопроса — получает `question_started` повторно с актуальным `startedAt`.

---

## Стек

| Слой | Технология | Почему |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | Быстрый старт, знаком курсу. Нативный `WebSocket` API — без Socket.io. |
| Routing | React Router v6 | Три маршрута: `/host`, `/present`, `/join`. |
| Backend | Node.js + Express + `ws` | Express отдаёт статику + `/health`. `ws` — WebSocket поверх того же порта. |
| State | in-memory `Map` на сервере | Сессия одноразовая — БД не нужна. |
| Highlighting | highlight.js | Подсветка JS-кода в задачах. UMD-сборка с cdnjs. |
| Стили | CSS Modules + CSS-переменные | Без Tailwind, нет доп. build-шага. |
| Shared types | `../shared/types.ts` (workspace) | Типы WS-событий общие для клиента и сервера. |
| Монорепо | npm workspaces | `../server` + `client/` + `shared/` в одном репозитории. |
| Деплой | Railway / Render | Поддерживает постоянные WS-соединения. Free tier + env-переменные. |

---

## Dev-окружение

**Запуск локально:**

```
# Терминал 1 — сервер (порт 3000)
cd server && npx tsx watch src/index.ts

# Терминал 2 — клиент (порт 5173)
cd client && npm run dev
```

**Vite proxy** (`../client/vite.config.ts`) — обязателен, иначе WS не работает в dev:

```ts
server: {
  proxy: {
    '/ws': { target: 'ws://localhost:3000', ws: true },
    '/health': 'http://localhost:3000',
  },
},
```

**Env-переменные:**

| Файл | Переменная | Значение |
|---|---|---|
| `server/.env` | `HOST_TOKEN` | секретный токен ведущего |
| `client/.env` | `VITE_WS_URL` | `''` в dev (proxy), URL в проде |

---

## Структура проекта

```
ws-quiz/
├── server/src/
│   ├── index.ts          # Express + ws.Server, один порт
│   ├── session.ts        # GameSession: вопросы, таймер, очки, reconnect-токены
│   ├── handlers.ts       # switch по типу WS-сообщения
│   ├── questions.ts      # загрузка задач из JSON
│   └── normalizer.ts     # нормализация ответов
│
├── client/src/
│   ├── App.tsx           # React Router: /host /present /join
│   ├── hooks/
│   │   ├── useSocket.ts  # WebSocket + reconnect (reconnectToken из sessionStorage)
│   │   └── useGame.ts    # useReducer для игрового состояния
│   ├── pages/
│   │   ├── HostPage.tsx
│   │   ├── PresentPage.tsx
│   │   └── JoinPage.tsx
│   └── components/
│       ├── CodeBlock.tsx  # highlight.js обёртка
│       ├── Timer.tsx      # считает от startedAt, не от локального старта
│       ├── Scoreboard.tsx
│       └── Chat.tsx       # рендерит текст через textContent (не innerHTML) — защита от XSS
│
├── shared/
│   └── types.ts          # WsMessage, Role, Question, Score
│
├── questions/
│   ├── week-09.json      # конвертировано из ПРАКТИКУМ-неделя-9.md
│   └── week-10.json      # конвертировано из ПРАКТИКУМ-неделя-10.md
│
├── scripts/
│   └── md-to-json.ts     # конвертер задач практикума (md → JSON)
│
└── package.json          # npm workspaces
```

---

## Нормализация ответов

Студенты пишут один и тот же ответ по-разному — нужна устойчивая автопроверка.

**Шаги (в порядке применения):**

```
.trim()  →  .toLowerCase()  →  схлопнуть пробелы  →  убрать пробелы вокруг , [ ] ( )
→  нормализовать числа: parseFloat("1.0") → "1"
→  нормализовать переносы строк: \r\n и \r → \n, убрать trailing \n
```

**Примеры:**

| Ввод студента | После нормализации |
|---|---|
| `[ 1,  2,  3 ]` | `[1,2,3]` |
| `"Alice"  4  "Bob"` | `"alice" 4 "bob"` |
| `True` / `TRUE` | `true` |
| `1.0` | `1` |
| `1\n2\n` | `1\n2` |

**Особые случаи:**

| Вывод | Как хранить в `answers` |
|---|---|
| Ничего не выводится | `""` (пустая строка) |
| `undefined` | `"undefined"` |
| Ошибка | `"typeerror: ..."` (lower, без стектрейса) |
| Многострочный | `"1\n2"` — экранированный `\n` в JSON |

**В JSON-файле задачи** — массив допустимых форм:

```json
{
  "id": "w09-01",
  "code": "console.log(1 + '2');",
  "answers": ["12", "'12'", "\"12\""]
}
```

После авторазбора ведущий видит все ответы студентов и может переключить оценку кнопкой — **гибрид автопроверки и ручной правки**.

---

## Таймер

Клиент рассчитывает оставшееся время от `startedAt` (UTC ms из события `question_started`), а не от момента получения события:

```ts
const elapsed = (Date.now() - startedAt) / 1000;
const remaining = Math.max(0, timeoutSec - elapsed);
```

Это устраняет clock skew между сервером и клиентом и корректно работает при reconnect.

---

## Фазы разработки

### Phase 1 — Фундамент (~3–4 ч)

#### 1.1 Монорепо + скелет проекта (~20 мин)
- [ ] `../package.json` в корне с `workspaces: ["server", "client", "shared"]`
- [ ] `../shared/package.json` + `shared/types.ts` — пустой файл с заглушками типов
- [ ] `../server/package.json` + `tsconfig.json` + зависимости (`express`, `ws`, `tsx`)
- [ ] `../client` — `npm create vite@latest` с React + TypeScript
- [ ] `.env.example` для сервера (`HOST_TOKEN=`)

#### 1.2 Shared types (~15 мин)
- [ ] `Role`: `"student" | "host" | "present"`
- [ ] `Question`: `{ id, code, answers[] }`
- [ ] `Score`: `{ studentId, name, points }`
- [ ] Все типы событий Student→Server, Host→Server, Server→Client (см. таблицы выше)
- [ ] Экспортировать из одного `index.ts`

#### 1.3 Express + WebSocket сервер (~20 мин)
- [ ] `server/src/index.ts`: Express слушает порт 3000
- [ ] `ws.Server({ server })` — WS поверх того же HTTP-сервера
- [ ] Маршрут `GET /health` возвращает `{ ok: true }`
- [ ] При WS `connect` — логировать в консоль, при `disconnect` — тоже
- [ ] Проверить: `curl localhost:3000/health` отвечает

#### 1.4 GameSession — структура данных (~25 мин)
- [ ] `server/src/session.ts`: класс `GameSession`
- [ ] `students: Map<studentId, { name, points, reconnectToken, ws }>`
- [ ] `activeQuestion: { id, startedAt, timeoutSec } | null`
- [ ] `answers: Map<studentId, { answer, correct }>` для текущего раунда
- [ ] Методы: `joinStudent`, `rejoinStudent`, `startQuestion`, `submitAnswer`, `endQuestion`

#### 1.5 WS-обработчики сервера (~30 мин)
- [ ] `server/src/handlers.ts`: `handleMessage(ws, raw, session)` — switch по `type`
- [ ] `student_join` → `welcome` (новый) или `join_failed` (имя занято)
- [ ] `student_join` с `reconnectToken` → восстановить очки
- [ ] `host_auth` → `auth_success` / `auth_failed`
- [ ] `start_question` → broadcast `question_started` всем студентам и present
- [ ] `submit_answer` → `answer_received` или `answer_rejected`

#### 1.6 Авто-scoring + normalizer (~20 мин)
- [ ] `server/src/normalizer.ts`: цепочка `.trim → .toLowerCase → пробелы → parseFloat`
- [ ] В `submitAnswer`: нормализовать ответ и сравнить с `question.answers`
- [ ] По окончании вопроса: начислить очки, отправить `round_result` студентам и `round_results` ведущему

#### 1.7 Конвертер задач (~20 мин)
- [ ] `scripts/md-to-json.ts`: читает `.md`, парсит блоки с кодом и ответами
- [ ] Сохраняет в `questions/week-XX.json` в формате `Question[]`
- [ ] Добавить минимум 3 вопроса вручную в `questions/week-09.json` для тестирования

#### 1.8 useSocket hook (~20 мин)
- [ ] `client/src/hooks/useSocket.ts`: `new WebSocket(url)`
- [ ] Отправлять/принимать JSON-сообщения
- [ ] При `close` — переподключаться через 2 с, передавать `reconnectToken` из `sessionStorage`
- [ ] Экспортировать `send(msg)` и `lastMessage`

#### 1.9 JoinPage (~30 мин)
- [ ] Шаг 1 — форма с полем «никнейм», отправка `student_join`
- [ ] Шаг 2 — «Ожидаем вопрос...» пока нет `question_started`
- [ ] Шаг 3 — поле ввода ответа + кнопка Submit → `submit_answer`
- [ ] Шаг 4 — показать `round_result` (правильно/нет, очки)
- [ ] Обработать `join_failed` — показать сообщение об ошибке

#### 1.10 HostPage (минимальный) (~25 мин)
- [ ] Форма авторизации: ввести токен → `host_auth`
- [ ] После `auth_success`: выпадающий список задач из JSON + кнопка «Запустить»
- [ ] `start_question` с выбранным `questionId` и `timeoutSec`
- [ ] Счётчик «Ответили X / Y»
- [ ] Кнопка «Завершить раунд» → `end_question`

#### 1.11 Простой Scoreboard (~15 мин)
- [ ] `client/src/components/Scoreboard.tsx`: принимает `scores[]`, рендерит таблицу
- [ ] Обновляется при `leaderboard`-событии
- [ ] Показывается на JoinPage после `round_result`

#### 1.12 Vite proxy + dev-запуск (~10 мин)
- [ ] `../client/vite.config.ts`: proxy `/ws` → `ws://localhost:3000`, `/health` → `http://localhost:3000`
- [ ] Проверить сквозной тест: открыть `/join`, ввести никнейм, ведущий запускает вопрос, студент отвечает, видит результат

### Phase 2 — Полный игровой поток (~3–4 ч)

#### 2.1 Shared types: present-события (~10 мин)
- [x] Добавить `timer_tick { remaining: number }`, `answer_count { count: number }`, `question_ended { correctAnswer: string }` в `ServerToPresentMsg`
- [x] Убедиться что `question_started` уже содержит `timeoutSec` и `startedAt`

#### 2.2 Server: таймер и broadcast для Present (~20 мин)
- [x] В `session.ts`: запускать `setInterval` при `startQuestion`, рассылать `timer_tick` каждую секунду present-клиентам
- [x] В `handlers.ts`: при `submit_answer` — broadcast `answer_count` present-клиентам
- [x] При `endQuestion` — broadcast `question_ended` с правильным ответом

#### 2.3 Timer компонент (~15 мин)
- [x] `client/src/components/Timer.tsx`: принимает `startedAt` и `timeoutSec`
- [x] Вычисляет `remaining = Math.max(0, timeoutSec - (Date.now() - startedAt) / 1000)` на каждом тике
- [x] Рендерит прогресс-бар (`<progress value remaining max timeoutSec>`)

#### 2.4 PresentPage (~20 мин)
- [x] `client/src/pages/PresentPage.tsx`: подключается через `wsUrl('present')`
- [x] Показывает код вопроса при `question_started`
- [x] `<Timer startedAt timeoutSec>` — полоса убывает
- [x] Счётчик из `answer_count`
- [x] Финальный экран при `question_ended` с правильным ответом
- [x] Маршрут `/present` в `App.tsx`

#### 2.5 CodeBlock компонент (~15 мин)
- [x] `client/src/components/CodeBlock.tsx`: обёртка над highlight.js (UMD с cdnjs, пинить версию)
- [x] Применить в `PresentPage` и `JoinPage` вместо `<pre><code>`

#### 2.6 HostPage: список ответов + override_score (~20 мин)
- [x] После `round_results` показывать таблицу: студент | ответ | авто-оценка (✓/✗)
- [x] Кнопки `+` / `−` у каждого ответа → `{ type: 'override_score', studentId, correct: boolean }`

#### 2.7 Scoreboard: живое обновление (~10 мин)
- [x] `HostPage`: `scoreboard_update` обновляет таблицу в реальном времени
- [x] `JoinPage`: `leaderboard` приходит после раунда, таблица видна в фазе `result`
- [x] Убедиться что `Scoreboard` корректно ре-рендерится при смене `scores[]`

#### 2.8 Блокировка повторной отправки (~10 мин)
- [x] После `answer_received`: кнопка отправки и инпут `disabled`, фаза `'answered'`
- [x] При `answer_rejected`: форма остаётся активной, ошибка показывается, повторная отправка разрешена

#### 2.9 Error-события: join_failed, auth_failed (~10 мин)
- [x] `join_failed`: форма join остаётся открытой, имя не очищается
- [x] `auth_failed`: форма auth остаётся, поле токена очищается
- [x] Проверить что оба случая уже корректно обработаны

#### 2.10 Загрузка задач: выбор файла (~15 мин)
- [x] `GET /questions` на сервере возвращает список JSON-файлов из папки `questions/`
- [x] `HostPage`: `<select>` для выбора файла перед запуском; при смене — перезагрузка задач

#### 2.11 Сквозной тест (~20 мин)
- [x] Ручной тест в 4 вкладках: host + 2 students + present
- [x] Сценарий: вход → запуск вопроса → ответы → завершение → override → таблица обновилась

### Phase 3 — Чат + UX (~4–6 ч)

#### 3.1 CSS: базовые стили (~30 мин)
- [x] Стили для `<form>`, `<button>`, `<input>`, `<select>` — единый look
- [x] `<pre><code>`: паддинги, `overflow-x: auto`, скролл длинного кода
- [x] `.scoreboard`: стили таблицы рекордов
- [x] Общий контейнер страниц: max-width, padding

#### 3.2 Timer: CSS transition (~15 мин)
- [x] Заменить `<progress>` на `<div>` с `width: X%` и `transition: width 0.5s linear`
- [x] Цвет по остатку: >50% зелёный, 20–50% жёлтый, <20% красный

#### 3.3 Chat компонент (~20 мин)
- [x] `client/src/components/Chat.tsx`: принимает `messages[]` + `onSend`
- [x] Рендер через JSX (React экранирует автоматически — нет XSS, нет `dangerouslySetInnerHTML`)
- [x] Автоскролл к последнему сообщению через `useRef`
- [x] `CodeBlock`: highlight.js из cdnjs — выполнено в Phase 2

#### 3.4 Chat: JoinPage интеграция (~20 мин)
- [x] Обработать `chat_from_host` → добавлять в список сообщений
- [x] Отправка `chat_to_host` через `<Chat>` компонент
- [x] Показывать в фазах `waiting`, `answered`, `result`

#### 3.5 Chat: HostPage интеграция (~30 мин)
- [x] Обработать `chat_from_student` → список по каждому студенту
- [x] Отправка `chat_to_student` с выбором получателя
- [x] Индикатор непрочитанных: счётчик новых сообщений

#### 3.6 Анимация +N очков у студента (~15 мин)
- [x] После `round_result` с `correct: true`: показать `+1` анимацией
- [ ] CSS `@keyframes`: fade-in → slide-up → fade-out (~2 с)
- [ ] Реализовать через `useState<boolean>` + `onAnimationEnd` → сброс

#### 3.7 Reconnect toast (~15 мин)
- [x] При переходе `closed → open` в `useSocket`: показать toast «Reconnected»
- [x] Toast: фиксированная позиция, появляется на 2 с затем исчезает
- [x] CSS: `position: fixed; bottom: 16px` + анимация появления

#### 3.8 Адаптив /join (~25 мин)
- [x] Input, button: `min-height: 44px` (touch target)
- [x] `<CodeBlock>`: `overflow-x: auto` для длинного кода
- [x] Проверить верстку на 375px через DevTools

#### 3.9 PresentPage UX (~15 мин)
- [x] Крупный шрифт кода для экрана аудитории (`font-size: 1.4rem+`)
- [x] Счётчик ответов: крупный, контрастный
- [x] Финальный экран: правильный ответ выделен акцентным цветом

#### 3.10 Сквозной тест Phase 3 (~20 мин)
- [x] Тест чата: студент → ведущий и ведущий → студент
- [x] Тест reconnect: закрыть/открыть вкладку студента, проверить toast
- [x] Тест адаптив: DevTools 375px на `/join`
- [x] Проверить анимации (`+1`, timer-bar, toast)

### Phase 4 — Деплой (~2–3 ч)

- [ ] `HOST_TOKEN` в env, защита `/host`
- [ ] `railway.toml` / `render.yaml` + build-команды
- [ ] `VITE_WS_URL` через `import.meta.env`
- [ ] Health-check endpoint `/health`
- [ ] README: как запустить локально + как деплоить

---

**Итого:** ~12–17 часов от нуля до деплоя.
Phase 1 и Phase 2 можно вести параллельно; Phase 3 и Phase 4 зависят от Phase 2.
