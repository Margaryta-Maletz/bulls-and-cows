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

- [ ] `PresentPage` (`/present`): задача + таймер-полоса (от `startedAt`)
- [ ] Загрузка задач из `week-09/10.json`
- [ ] `normalizer.ts`: полная цепочка включая числа, многострочность, undefined
- [ ] `HostPage`: список всех ответов после раунда
- [ ] Кнопка `override_score` у каждого ответа
- [ ] `Scoreboard`: живое обновление при изменении очков
- [ ] Блокировка повторной отправки (`answer_rejected` + UI-блокировка)
- [ ] Error-события: `join_failed`, `answer_rejected`, `auth_failed`

### Phase 3 — Чат + UX (~4–6 ч)

- [ ] `Chat` компонент: рендер через `textContent`, не `innerHTML`
- [ ] `HostPage`: список чатов, индикатор непрочитанных
- [ ] `CodeBlock`: highlight.js из cdnjs (пинить версию)
- [ ] `Timer`: CSS-анимация полосы
- [ ] Анимация +N очков у студента
- [ ] Обработка разрыва соединения (reconnect + toast)
- [ ] Адаптив: `/join` работает на телефоне

### Phase 4 — Деплой (~2–3 ч)

- [ ] `HOST_TOKEN` в env, защита `/host`
- [ ] `railway.toml` / `render.yaml` + build-команды
- [ ] `VITE_WS_URL` через `import.meta.env`
- [ ] Health-check endpoint `/health`
- [ ] README: как запустить локально + как деплоить

---

**Итого:** ~12–17 часов от нуля до деплоя.
Phase 1 и Phase 2 можно вести параллельно; Phase 3 и Phase 4 зависят от Phase 2.
