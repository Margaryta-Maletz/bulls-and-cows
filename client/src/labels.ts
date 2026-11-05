export const LABELS = {
  reconnecting:  'Переподключение...',
  gameTitle:     'Войти в игру',
  nickname:      'Никнейм',
  joinBtn:       'Войти',
  waiting:       'Ожидаем вопрос...',
  answerPrompt:  'Что выведет консоль?',
  submitBtn:     'Отправить',
  waitingResult: 'Ответ принят, ждём результатов...',
  correct:       'Верно!',
  incorrect:     'Неверно!',
  rightAnswer:   'Правильный ответ: ',
  totalPoints:   'Всего очков: ',
} as const;

export const CHAT = {
  placeholder: 'Сообщение...',
  sendBtn:     'Отправить',
} as const;

export const HOST = {
  reconnecting:    'Переподключение...',
  title:           'Ведущий',
  tokenHint:       'Токен ведущего',
  loginBtn:        'Войти',
  questionPrefix:  'Вопрос: ',
  answeredPrefix:  'Ответили: ',
  separator:       ' / ',
  endRound:        'Завершить раунд',
  panelTitle:      'Панель ведущего',
  studentsPrefix:  'Студентов в сессии: ',
  roundResults:    'Результаты раунда',
  resultCorrect:   ' — верно',
  resultWrong:     ' — неверно',
  addPoint:        '+1',
  removePoint:     '−1',
  startQuestion:   'Запустить вопрос',
  fileLabel:       'Файл: ',
} as const;
