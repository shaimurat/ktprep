import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar'
import 'react-circular-progressbar/dist/styles.css'
import { useLocation, useNavigate } from 'react-router-dom'
import { ROUTE_PATHS, routeFromPathname, type AppRoute } from './app/routes'
import { AppLayout } from './layouts/AppLayout'
import { AdminPage } from './pages/admin/AdminPage'
import { AuthPage } from './pages/auth/AuthPage'
import { ProfilePage } from './pages/profile/ProfilePage'
import { LeaderboardPage } from './pages/leaderboard/LeaderboardPage'
import { HomePage } from './pages/home/HomePage'
import { SubjectsPage } from './pages/subjects/SubjectsPage'
import {
  ArrowLeft,
  AlertTriangle,
  Braces,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Database,
  Edit3,
  FileText,
  Languages,
  ListChecks,
  Play,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import {
  parseQuestionsJson,
  jsonExample,
  normalizeQuestion,
  pseudocodeJsonExample,
  tableJsonExample,
} from './pages/questions/utils/validation'
import { ANSWER_KEYS, formatAnswers, getCorrectAnswers, getQuestionOptions, scoreAnswers } from './utils/answers'
import { loadQuestions, loadResults, saveQuestions, submitResult } from './services/apiStorage'
import { getCurrentUser, logout, type AuthUser } from './services/auth'
import { useDatabaseState } from './hooks/useDatabaseState'
import { demoQuestions } from './models/demoQuestions'
import { emptyBySubject, SUBJECTS, subjectById } from './models/subjects'
import type { AnswerKey, Question, QuestionAttempt, Subject, TestResult } from './types'
import { createId } from './utils/id'
import { shuffle } from './utils/shuffle'

type QuizMode = 'subject' | 'random' | 'sliv' | 'kt' | 'kt-hard'
type QuizScope = 'topic' | 'subject' | 'random' | 'sliv'
type QuizSettings = {
  subject: Subject
  scope: QuizScope
  author: string
  topic: string
  count: number | 'all'
  showExplanation: boolean
  slivCounts?: Record<Subject, number>
  slivSubjects?: Record<Subject, boolean>
}
type HardQuizSettings = {
  topic?: string
  count: number | 'all'
  showExplanation: boolean
}
type KtSettings = Record<Subject, number>
type AnswerMap = Record<string, AnswerKey[] | undefined>
type Theme = 'light' | 'dark'

const ALGORITHMS_HARD_TOPIC_PREFIX = 'КТ Hard —'

const defaultQuestionForm: Omit<Question, 'id'> = {
  subject: 'databases',
  author: '',
  topic: 'Без темы',
  question: '',
  options: {},
  correctAnswers: ['A'],
  explanation: '',
}

const defaultKtSettings: KtSettings = {
  tgo: 10,
  english: 10,
  databases: 20,
  algorithms: 20,
}

function App() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => setUser(null))
  }, [])

  if (user === undefined) return <main className="auth-shell"><p>Загрузка…</p></main>
  if (!user) return <AuthPage onAuthenticated={setUser} />

  return <AuthenticatedApp user={user} onUserChange={setUser} onLogout={() => logout().finally(() => setUser(null))} />
}

function AuthenticatedApp({ user, onLogout, onUserChange }: { user: AuthUser; onLogout: () => void; onUserChange: (user: AuthUser) => void }) {
  const location = useLocation()
  const routerNavigate = useNavigate()
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('kt-theme')
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [questions, setQuestions, questionsError] = useDatabaseState(
    loadQuestions,
    saveQuestions,
    demoQuestions,
    'Новые вопросы',
  )
  const [results, setResults] = useState<TestResult[]>([])
  const [resultsError, setResultsError] = useState('')
  const [quizError, setQuizError] = useState('')
  const [isFinishingQuiz, setIsFinishingQuiz] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<Subject>('tgo')
  const [activeQuiz, setActiveQuiz] = useState<{
    mode: QuizMode
    questions: Question[]
    showExplanation: boolean
    index: number
    answers: AnswerMap
    checked: Record<string, boolean>
    finished: boolean
  } | null>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    localStorage.setItem('kt-theme', theme)
  }, [theme])

  useEffect(() => {
    loadResults().then(setResults).catch(() => setResultsError('Не удалось загрузить результаты тестов.'))
  }, [])

  useEffect(() => {
    if (!routeFromPathname(location.pathname)) routerNavigate(ROUTE_PATHS.home, { replace: true })
  }, [location.pathname, routerNavigate])

  const view = routeFromPathname(location.pathname) ?? 'home'

  const mainQuestions = useMemo(() => questions.filter((question) => !isAlgorithmsHardQuestion(question)), [questions])
  const hardQuestions = useMemo(() => questions.filter(isAlgorithmsHardQuestion), [questions])

  const counts = useMemo(
    () =>
      SUBJECTS.reduce(
        (acc, subject) => {
          acc[subject.id] = mainQuestions.filter((question) => question.subject === subject.id).length
          return acc
        },
        {} as Record<Subject, number>,
      ),
    [mainQuestions],
  )

  const navigate = (nextView: AppRoute, subject?: Subject) => {
    if (subject) setSelectedSubject(subject)
    setActiveQuiz(null)
    routerNavigate(ROUTE_PATHS[nextView])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveResult = async (mode: QuizMode, quizQuestions: Question[], answers: AnswerMap) => {
    const bySubject = emptyBySubject()
    let correctAnswers = 0
    let score = 0
    let maxScore = 0

    const questionAttempts: QuestionAttempt[] = quizQuestions.map((question) => {
      const answerScore = scoreAnswers(answers[question.id], getCorrectAnswers(question))
      const correct = answerScore.exact
      bySubject[question.subject].total += 1
      score += answerScore.points
      maxScore += answerScore.maxPoints
      if (correct) {
        bySubject[question.subject].correct += 1
        correctAnswers += 1
      }
      return { questionId: question.id, subject: question.subject, topic: question.topic || 'Без темы', correct }
    })

    const result: TestResult = {
      id: createId(),
      mode,
      date: new Date().toISOString(),
      totalQuestions: quizQuestions.length,
      correctAnswers,
      score,
      maxScore,
      percentage: maxScore ? Math.round((score / maxScore) * 100) : 0,
      bySubject,
      questionAttempts,
    }

    const saved = await submitResult(result)
    setResults((current) => [saved.result, ...current].slice(0, 50))
    onUserChange({ ...user, attemptsRemaining: saved.attemptsRemaining })
  }

  const canStartQuiz = () => {
    if (user.role === 'admin' || user.attemptsRemaining > 0) return true
    setQuizError('Ваша попытка использована. Обратитесь к администратору, чтобы он открыл пересдачу.')
    return false
  }

  const startSubjectQuiz = (settings: QuizSettings) => {
    if (!canStartQuiz()) return
    setQuizError('')
    const pool = mainQuestions.filter((question) => {
      if (settings.scope === 'random') return true
      if (settings.scope === 'sliv') return isSlivQuestion(question)
      if (question.subject !== settings.subject) return false
      if (settings.scope === 'subject') return true
      return (settings.author === 'all' || question.author === settings.author) && question.topic === settings.topic
    })
    const quizQuestions = settings.scope === 'sliv'
      ? SUBJECTS.flatMap((subject) => {
        if (!settings.slivSubjects?.[subject.id]) return []
        const subjectPool = pool.filter((question) => question.subject === subject.id)
        const requested = settings.slivCounts?.[subject.id] ?? 0
        return shuffle(subjectPool).slice(0, Math.min(requested, subjectPool.length))
      })
      : shuffle(pool).slice(0, settings.count === 'all' ? pool.length : Math.min(settings.count, pool.length))
    setActiveQuiz({
      mode: settings.scope === 'random' ? 'random' : settings.scope === 'sliv' ? 'sliv' : 'subject',
      questions: quizQuestions,
      showExplanation: settings.showExplanation,
      index: 0,
      answers: {},
      checked: {},
      finished: false,
    })
  }

  const startHardQuiz = (settings: HardQuizSettings) => {
    if (!canStartQuiz()) return
    setQuizError('')
    const pool = hardQuestions.filter((question) => !settings.topic || question.topic === settings.topic)
    const limit = settings.count === 'all' ? pool.length : Math.min(settings.count, pool.length)

    setActiveQuiz({
      mode: 'kt-hard',
      questions: shuffle(pool).slice(0, limit),
      showExplanation: settings.showExplanation,
      index: 0,
      answers: {},
      checked: {},
      finished: false,
    })
  }

  const startKtQuiz = (settings: KtSettings) => {
    if (!canStartQuiz()) return
    setQuizError('')
    const picked = SUBJECTS.flatMap((subject) => {
      const pool = mainQuestions.filter((question) => question.subject === subject.id)
      return shuffle(pool).slice(0, Math.min(settings[subject.id], pool.length))
    })

    setActiveQuiz({
      mode: 'kt',
      questions: picked,
      showExplanation: false,
      index: 0,
      answers: {},
      checked: {},
      finished: false,
    })
  }

  const finishQuiz = async () => {
    if (!activeQuiz || activeQuiz.finished) return
    setIsFinishingQuiz(true)
    setQuizError('')
    try {
      await saveResult(activeQuiz.mode, activeQuiz.questions, activeQuiz.answers)
      setActiveQuiz({ ...activeQuiz, finished: true })
    } catch (error) {
      setQuizError(error instanceof Error ? error.message : 'Не удалось завершить тест.')
    } finally {
      setIsFinishingQuiz(false)
    }
  }

  if (activeQuiz?.finished) {
    return (
      <main className="result-page-shell">
        <QuizResult quiz={activeQuiz} onReset={() => setActiveQuiz(null)} />
      </main>
    )
  }

  return (
    <AppLayout
      activeRoute={view}
      theme={theme}
      onNavigate={navigate}
      onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      user={user}
      onLogout={onLogout}
    >
        {(questionsError || resultsError || quizError) && (
          <div className="database-error" role="alert">
            <AlertTriangle aria-hidden="true" />
            <div>
              <strong>Ошибка базы данных</strong>
              <span>{questionsError || resultsError || quizError}</span>
            </div>
          </div>
        )}
        {view === 'home' && (
          <HomePage
            counts={counts}
            onNavigate={navigate}
            totalQuestions={questions.length}
            totalResults={results.length}
          />
        )}
        {view === 'subjects' && <SubjectsPage counts={counts} onNavigate={navigate} />}
        {view === 'add' && (
          <AddQuestionsPage
            onAdd={(items) => setQuestions(mergeQuestionsWithTopics(questions, items))}
            selectedSubject={selectedSubject}
          />
        )}
        {view === 'manage' && (
          <ManageQuestionsPage
            questions={questions}
            selectedSubject={selectedSubject}
            onSubjectChange={setSelectedSubject}
            onDelete={(id) => setQuestions(questions.filter((question) => question.id !== id))}
            onClear={(subject) => setQuestions(questions.filter((question) => question.subject !== subject))}
            onUpdate={(updated) =>
              setQuestions(questions.map((question) => (question.id === updated.id ? updated : question)))
            }
          />
        )}
        {view === 'quiz' && (
          <SubjectQuizPage
            activeQuiz={activeQuiz?.mode === 'subject' || activeQuiz?.mode === 'random' || activeQuiz?.mode === 'sliv' || activeQuiz?.mode === 'kt-hard' ? activeQuiz : null}
            counts={counts}
            questions={mainQuestions}
            hardQuestions={hardQuestions}
            selectedSubject={selectedSubject}
            onSettingsSubject={setSelectedSubject}
            onStart={startSubjectQuiz}
            onHardStart={startHardQuiz}
            onAnswer={(id, answer) =>
              activeQuiz && setActiveQuiz({ ...activeQuiz, answers: { ...activeQuiz.answers, [id]: toggleAnswer(activeQuiz.answers[id], answer) } })
            }
            onCheck={(id) =>
              activeQuiz && setActiveQuiz({ ...activeQuiz, checked: { ...activeQuiz.checked, [id]: true } })
            }
            onMove={(index) => activeQuiz && setActiveQuiz({ ...activeQuiz, index })}
            onFinish={finishQuiz}
            isFinishing={isFinishingQuiz}
            onReset={() => setActiveQuiz(null)}
          />
        )}
        {view === 'kt' && (
          <KtModePage
            activeQuiz={activeQuiz?.mode === 'kt' ? activeQuiz : null}
            counts={counts}
            onStart={startKtQuiz}
            onAnswer={(id, answer) =>
              activeQuiz && setActiveQuiz({ ...activeQuiz, answers: { ...activeQuiz.answers, [id]: toggleAnswer(activeQuiz.answers[id], answer) } })
            }
            onCheck={(id) =>
              activeQuiz && setActiveQuiz({ ...activeQuiz, checked: { ...activeQuiz.checked, [id]: true } })
            }
            onMove={(index) => activeQuiz && setActiveQuiz({ ...activeQuiz, index })}
            onFinish={finishQuiz}
            isFinishing={isFinishingQuiz}
            onReset={() => setActiveQuiz(null)}
          />
        )}
        {view === 'stats' && <StatisticsPage results={results} />}
        {view === 'profile' && <ProfilePage user={user} onUserUpdate={onUserChange} />}
        {view === 'leaderboard' && <LeaderboardPage currentUser={user} />}
        {view === 'admin' && user.role === 'admin' && <AdminPage currentUser={user} />}
    </AppLayout>
  )
}

function toggleAnswer(current: AnswerKey[] | undefined, answer: AnswerKey) {
  const selected = current ?? []

  if (selected.includes(answer)) {
    return selected.filter((item) => item !== answer)
  }

  return [...selected, answer].sort()
}

function AddQuestionsPage({
  selectedSubject,
  onAdd,
}: {
  selectedSubject: Subject
  onAdd: (questions: Question[]) => Promise<boolean>
}) {
  const [form, setForm] = useState({ ...defaultQuestionForm, subject: selectedSubject })
  const [bulk, setBulk] = useState(jsonExample)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const submitSingle = async () => {
    const result = normalizeQuestion(form)
    if (result.error || !result.question) {
      setMessage(result.error ?? 'Проверьте вопрос.')
      return
    }

    setSaving(true)
    setMessage('')
    const saved = await onAdd([{ ...result.question, id: createId() }])
    setSaving(false)
    if (saved) {
      setForm({ ...defaultQuestionForm, subject: form.subject, author: form.author, topic: form.topic })
      setMessage('Вопрос успешно сохранён в базе данных.')
    } else {
      setMessage('Не удалось сохранить вопрос в базе данных.')
    }
  }

  const checkJson = () => {
    const result = parseQuestionsJson(bulk)
    setMessage(result.error || `JSON корректный. Найдено вопросов: ${result.questions.length}.`)
  }

  const addBulk = async () => {
    const result = parseQuestionsJson(bulk)
    if (result.error) {
      setMessage(result.error)
      return
    }

    setSaving(true)
    setMessage('')
    const saved = await onAdd(result.questions)
    setSaving(false)
    setMessage(saved
      ? `Успешно сохранено вопросов: ${result.questions.length}.`
      : 'Не удалось сохранить вопросы в базе данных.')
  }

  return (
    <>
      <PageTitle title="Добавление вопросов" text="Добавляй по одному или вставляй JSON-массив из ChatGPT." />
      <div className="two-column">
        <section className="panel">
          <h2>Один вопрос</h2>
          <QuestionEditor value={form} onChange={(value) => setForm(value as Omit<Question, 'id'>)} />
          <button className="primary-button full" type="button" onClick={submitSingle} disabled={saving}>
            <Plus size={18} /> {saving ? 'Сохранение…' : 'Добавить вопрос'}
          </button>
        </section>

        <section className="panel">
          <div className="split-title">
            <h2>Массовое добавление</h2>
            <div className="example-actions">
              <button className="ghost-button" type="button" onClick={() => setBulk(jsonExample)}>
                Обычный пример
              </button>
              <button className="secondary-button" type="button" onClick={() => setBulk(pseudocodeJsonExample)}>
                Пример с псевдокодом
              </button>
              <button className="secondary-button" type="button" onClick={() => setBulk(tableJsonExample)}>
                Пример с таблицей
              </button>
            </div>
          </div>
          <div className="pseudocode-import-hint">
            <Braces size={20} />
            <div>
              <strong>Как добавить вопрос с псевдокодом</strong>
              <p>
                Запишите формулировку и код в поле <code>question</code>. Отделите код пустой строкой
                через <code>\n\n</code>, а каждую новую строку кода — через <code>\n</code>.
              </p>
            </div>
          </div>
          <div className="pseudocode-import-hint">
            <Braces size={20} />
            <div>
              <strong>Как добавить таблицу</strong>
              <p>
                Добавьте в вопрос <code>"table"</code> с <code>headers</code> и <code>rows</code>.
                Каждая строка в <code>rows</code> должна содержать столько же текстовых ячеек, сколько <code>headers</code>.
              </p>
            </div>
          </div>
          <div className="pseudocode-import-hint">
            <Braces size={20} />
            <div>
              <strong>Укажите автора курса</strong>
              <p>
                Добавьте поле <code>"author": "Рабат"</code> в каждый вопрос. Тогда в тренировке
                можно будет сначала выбрать автора, а затем его темы.
              </p>
            </div>
          </div>
          <textarea className="json-area" value={bulk} onChange={(event) => setBulk(event.target.value)} />
          <div className="button-row">
            <button className="secondary-button" type="button" onClick={checkJson}>
              <Check size={18} /> Проверить JSON
            </button>
            <button className="primary-button" type="button" onClick={addBulk} disabled={saving}>
              <Plus size={18} /> {saving ? 'Сохранение…' : 'Добавить все вопросы'}
            </button>
          </div>
          <details className="json-help">
            <summary>Посмотреть готовый JSON с псевдокодом и таблицей</summary>
            <pre className="format-note">{pseudocodeJsonExample}\n\n{tableJsonExample}</pre>
          </details>
        </section>
      </div>
      {message && <div className="toast">{message}</div>}
    </>
  )
}

function ManageQuestionsPage({
  questions,
  selectedSubject,
  onSubjectChange,
  onDelete,
  onClear,
  onUpdate,
}: {
  questions: Question[]
  selectedSubject: Subject
  onSubjectChange: (subject: Subject) => void
  onDelete: (id: string) => void
  onClear: (subject: Subject) => void
  onUpdate: (question: Question) => void
}) {
  const [query, setQuery] = useState('')
  const [topic, setTopic] = useState('all')
  const [editing, setEditing] = useState<Question | null>(null)
  const topics = getTopics(questions, selectedSubject)
  const visible = questions.filter(
    (question) =>
      question.subject === selectedSubject &&
      (topic === 'all' || question.topic === topic) &&
      question.question.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <>
      <PageTitle title="Просмотр вопросов" text="Фильтруй, редактируй и чисти базу по предметам." />
      <div className="toolbar">
        <SubjectSelect
          value={selectedSubject}
          onChange={(subject) => {
            onSubjectChange(subject)
            setTopic('all')
          }}
        />
        <label>
          Тема
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            <option value="all">Все темы</option>
            {topics.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="search">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по тексту" />
        </label>
        <button className="danger-button" type="button" onClick={() => onClear(selectedSubject)}>
          <Trash2 size={18} /> Очистить предмет
        </button>
      </div>
      <div className="question-list">
        {visible.map((question) => (
          <article className="card question-card" key={question.id}>
            <div className="badge-row">
              <span className="badge">{subjectById(question.subject).title}</span>
              <span className="badge topic-badge">{question.topic}</span>
            </div>
            <QuestionPrompt text={question.question} table={question.table} level="h3" />
            <div className="answers-grid">
              {getQuestionOptions(question).map((answer) => (
                <div className={getCorrectAnswers(question).includes(answer) ? 'answer correct' : 'answer'} key={answer}>
                  <strong>{answer}</strong> {question.options[answer]}
                </div>
              ))}
            </div>
            {question.explanation && <p className="muted">{question.explanation}</p>}
            <div className="card-actions">
              <button className="secondary-button" type="button" onClick={() => setEditing(question)}>
                <Edit3 size={16} /> Редактировать
              </button>
              <button className="danger-button" type="button" onClick={() => onDelete(question.id)}>
                <Trash2 size={16} /> Удалить
              </button>
            </div>
          </article>
        ))}
        {!visible.length && <EmptyState text="В этом предмете пока нет подходящих вопросов." />}
      </div>
      {editing && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Редактировать вопрос</h2>
            <QuestionEditor value={editing} onChange={(value) => setEditing({ ...value, id: editing.id })} />
            <div className="button-row">
              <button className="ghost-button" type="button" onClick={() => setEditing(null)}>
                Отмена
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  const result = normalizeQuestion(editing)
                  if (result.question) {
                    onUpdate({ ...result.question, id: editing.id })
                    setEditing(null)
                  }
                }}
              >
                <Check size={18} /> Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function SubjectQuizPage({
  activeQuiz,
  counts,
  questions,
  hardQuestions,
  selectedSubject,
  onSettingsSubject,
  onStart,
  onHardStart,
  onAnswer,
  onCheck,
  onMove,
  onFinish,
  isFinishing,
  onReset,
}: {
  activeQuiz: ActiveQuiz | null
  counts: Record<Subject, number>
  questions: Question[]
  hardQuestions: Question[]
  selectedSubject: Subject
  onSettingsSubject: (subject: Subject) => void
  onStart: (settings: QuizSettings) => void
  onHardStart: (settings: HardQuizSettings) => void
  onAnswer: (id: string, answer: AnswerKey) => void
  onCheck: (id: string) => void
  onMove: (index: number) => void
  onFinish: () => void
  isFinishing: boolean
  onReset: () => void
}) {
  const [count, setCount] = useState<QuizSettings['count']>(10)
  const [showExplanation, setShowExplanation] = useState(true)
  const [scope, setScope] = useState<QuizScope>('topic')
  const [slivCounts, setSlivCounts] = useState<Record<Subject, number>>({ ...defaultKtSettings })
  const [slivSubjects, setSlivSubjects] = useState<Record<Subject, boolean>>({
    tgo: true,
    english: true,
    databases: true,
    algorithms: true,
  })
  const authors = getAuthors(questions, selectedSubject)
  const [author, setAuthor] = useState('all')
  const topics = getTopics(questions, selectedSubject, author)
  const [topic, setTopic] = useState('')
  const [hardTopic, setHardTopic] = useState('')
  const [isHardTopicSelectOpen, setIsHardTopicSelectOpen] = useState(false)
  const hardTopics = getTopics(hardQuestions, 'algorithms')
  const selectedTopic = topics.includes(topic) ? topic : (topics[0] ?? '')
  const selectedHardTopic = hardTopics.includes(hardTopic) ? hardTopic : (hardTopics[0] ?? '')
  const hardCount = hardQuestions.length
  const hardTopicCount = selectedHardTopic
    ? hardQuestions.filter((question) => question.topic === selectedHardTopic).length
    : 0
  const slivAvailable = SUBJECTS.reduce((available, subject) => {
    available[subject.id] = questions.filter(
      (question) => question.subject === subject.id && isSlivQuestion(question),
    ).length
    return available
  }, {} as Record<Subject, number>)
  const allSlivSubjectsSelected = SUBJECTS.every((subject) => slivSubjects[subject.id])
  const selectedSlivCount = SUBJECTS.reduce((total, subject) => {
    if (!slivSubjects[subject.id]) return total
    return total + Math.min(slivCounts[subject.id], slivAvailable[subject.id])
  }, 0)
  const poolCount = scope === 'random'
    ? questions.length
    : scope === 'sliv'
      ? selectedSlivCount
    : scope === 'subject'
      ? counts[selectedSubject]
      : questions.filter(
        (question) => question.subject === selectedSubject &&
          (author === 'all' || question.author === author) &&
          question.topic === selectedTopic,
      ).length

  if (activeQuiz) {
    return <QuizRunner quiz={activeQuiz} onAnswer={onAnswer} onCheck={onCheck} onMove={onMove} onFinish={onFinish} onReset={onReset} isFinishing={isFinishing} />
  }

  return (
    <>
      <PageTitle title="Тренировка" text="Выбери тему, предмет, сливы или полный рандом по всей базе." />
      <section className="panel settings-panel">
        <div className="segmented quiz-modes">
          <button className={scope === 'topic' ? 'active' : ''} type="button" onClick={() => setScope('topic')}>По теме</button>
          <button className={scope === 'subject' ? 'active' : ''} type="button" onClick={() => setScope('subject')}>По предмету</button>
          <button className={scope === 'sliv' ? 'active' : ''} type="button" onClick={() => setScope('sliv')}>Сливы</button>
          <button className={scope === 'random' ? 'active' : ''} type="button" onClick={() => setScope('random')}>Полный рандом</button>
        </div>
        {scope !== 'random' && scope !== 'sliv' && (
          <SubjectSelect
            value={selectedSubject}
            onChange={(subject) => {
              onSettingsSubject(subject)
              setAuthor('all')
              setTopic('')
            }}
          />
        )}
        {scope === 'topic' && (
          <>
            <label>
              Автор
              <select
                value={author}
                onChange={(event) => {
                  setAuthor(event.target.value)
                  setTopic('')
                }}
              >
                <option value="all">Все авторы</option>
                {authors.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Тема
              <select value={selectedTopic} onChange={(event) => setTopic(event.target.value)}>
                {topics.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </>
        )}
        {scope === 'sliv' && (
          <div className="sliv-settings">
            <label className="toggle">
              <input
                type="checkbox"
                checked={allSlivSubjectsSelected}
                onChange={(event) => setSlivSubjects({
                  tgo: event.target.checked,
                  english: event.target.checked,
                  databases: event.target.checked,
                  algorithms: event.target.checked,
                })}
              />
              Все предметы
            </label>
            {SUBJECTS.map((subject) => (
              <label className="number-field sliv-subject-field" key={subject.id}>
                <span>
                  <input
                    type="checkbox"
                    checked={slivSubjects[subject.id]}
                    onChange={(event) => setSlivSubjects({ ...slivSubjects, [subject.id]: event.target.checked })}
                  />
                  {subject.title}
                </span>
                <input
                  min="0"
                  max={slivAvailable[subject.id]}
                  type="number"
                  disabled={!slivSubjects[subject.id]}
                  value={slivCounts[subject.id]}
                  onChange={(event) => setSlivCounts({
                    ...slivCounts,
                    [subject.id]: Math.max(0, Number(event.target.value)),
                  })}
                />
                <small>доступно: {slivAvailable[subject.id]}</small>
              </label>
            ))}
          </div>
        )}
        {scope !== 'sliv' && (
          <div className="segmented">
            {[5, 10, 20].map((value) => (
              <button className={count === value ? 'active' : ''} type="button" key={value} onClick={() => setCount(value)}>
                {value}
              </button>
            ))}
            <button className={count === 'all' ? 'active' : ''} type="button" onClick={() => setCount('all')}>
              Все
            </button>
          </div>
        )}
        <label className="toggle">
          <input type="checkbox" checked={showExplanation} onChange={(event) => setShowExplanation(event.target.checked)} />
          Показывать объяснение после проверки
        </label>
        <button
          className="primary-button"
          type="button"
          disabled={!poolCount}
          onClick={() => onStart({
            subject: selectedSubject,
            scope,
            author,
            topic: selectedTopic,
            count,
            showExplanation,
            slivCounts,
            slivSubjects,
          })}
        >
          <Play size={18} /> Начать тест ({poolCount})
        </button>
      </section>
      {selectedSubject === 'algorithms' && scope !== 'sliv' && (
        <section className="panel settings-panel hard-panel">
          <div className="hard-panel-header">
            <span className="badge hard-badge">КТ Hard</span>
            <div>
              <h2>КТ — сложная подготовка</h2>
              <p>170 сложных вопросов по всей спецификации КТ</p>
            </div>
            <strong>{hardCount} вопросов</strong>
          </div>
          <div className="button-row">
            <button
              className="primary-button"
              type="button"
              disabled={!hardCount}
              onClick={() => onHardStart({ count: 30, showExplanation })}
            >
              <Play size={18} /> Случайные 30
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={!hardCount}
              onClick={() => onHardStart({ count: 'all', showExplanation })}
            >
              <ListChecks size={18} /> Пройти все
            </button>
            <button
              className="ghost-button"
              type="button"
              disabled={!hardTopics.length}
              onClick={() => setIsHardTopicSelectOpen(!isHardTopicSelectOpen)}
            >
              <ChevronDown size={18} /> Выбрать тему
            </button>
          </div>
          {isHardTopicSelectOpen && (
            <div className="hard-topic-picker">
              <label>
                Тема КТ Hard
                <select value={selectedHardTopic} onChange={(event) => setHardTopic(event.target.value)}>
                  <optgroup label="КТ Hard">
                    {hardTopics.map((item) => (
                      <option key={item} value={item}>{formatHardTopic(item)}</option>
                    ))}
                  </optgroup>
                </select>
              </label>
              <button
                className="primary-button"
                type="button"
                disabled={!hardTopicCount}
                onClick={() => onHardStart({ topic: selectedHardTopic, count: 'all', showExplanation })}
              >
                <Play size={18} /> Начать тему ({hardTopicCount})
              </button>
            </div>
          )}
        </section>
      )}
    </>
  )
}

type ActiveQuiz = {
  mode: QuizMode
  questions: Question[]
  showExplanation: boolean
  index: number
  answers: AnswerMap
  checked: Record<string, boolean>
  finished: boolean
}

function KtModePage({
  activeQuiz,
  counts,
  onStart,
  onAnswer,
  onCheck,
  onMove,
  onFinish,
  isFinishing,
  onReset,
}: {
  activeQuiz: ActiveQuiz | null
  counts: Record<Subject, number>
  onStart: (settings: KtSettings) => void
  onAnswer: (id: string, answer: AnswerKey) => void
  onCheck: (id: string) => void
  onMove: (index: number) => void
  onFinish: () => void
  isFinishing: boolean
  onReset: () => void
}) {
  const [settings, setSettings] = useState(defaultKtSettings)

  if (activeQuiz) {
    return <QuizRunner quiz={activeQuiz} onAnswer={onAnswer} onCheck={onCheck} onMove={onMove} onFinish={onFinish} onReset={onReset} isFinishing={isFinishing} />
  }

  return (
    <>
      <PageTitle title="Реальный КТ" text="Собери экзамен из всех четырех предметов с нужным количеством вопросов." />
      <section className="panel kt-settings">
        {SUBJECTS.map((subject) => (
          <label className="number-field" key={subject.id}>
            <span>{subject.title}</span>
            <input
              min="0"
              type="number"
              value={settings[subject.id]}
              onChange={(event) =>
                setSettings({ ...settings, [subject.id]: Math.max(0, Number(event.target.value)) })
              }
            />
            <small>доступно: {counts[subject.id]}</small>
          </label>
        ))}
        <button className="primary-button" type="button" onClick={() => onStart(settings)}>
          <Play size={18} /> Начать реальный КТ
        </button>
      </section>
    </>
  )
}

function QuizRunner({
  quiz,
  onAnswer,
  onCheck,
  onMove,
  onFinish,
  isFinishing,
  onReset,
}: {
  quiz: ActiveQuiz
  onAnswer: (id: string, answer: AnswerKey) => void
  onCheck: (id: string) => void
  onMove: (index: number) => void
  onFinish: () => void
  isFinishing: boolean
  onReset: () => void
}) {
  if (!quiz.questions.length) {
    return (
      <EmptyState text="Для этого режима пока нет вопросов. Добавьте вопросы и попробуйте снова." />
    )
  }

  if (quiz.finished) {
    return <QuizResult quiz={quiz} onReset={onReset} />
  }

  const question = quiz.questions[quiz.index]
  const selected = quiz.answers[question.id] ?? []
  const isChecked = Boolean(quiz.checked[question.id])
  const correctAnswers = getCorrectAnswers(question)
  const answerScore = scoreAnswers(selected, correctAnswers)
  const progress = Math.round(((quiz.index + 1) / quiz.questions.length) * 100)
  const unansweredCount = quiz.questions.filter((item) => !quiz.answers[item.id]?.length).length

  const finishEarly = () => {
    const unansweredMessage = unansweredCount
      ? ` Без ответа останется: ${unansweredCount}. За них будет начислено 0 баллов.`
      : ''

    if (window.confirm(`Завершить тест досрочно?${unansweredMessage}`)) onFinish()
  }

  return (
    <>
      <div className="quiz-topbar">
        <button className="ghost-button" type="button" onClick={onReset}>
          <ArrowLeft size={18} /> К настройкам
        </button>
        <span>{quiz.index + 1} / {quiz.questions.length}</span>
        <span>{subjectById(question.subject).title} · {question.topic}</span>
      </div>
      <div className="progress"><span style={{ width: `${progress}%` }} /></div>
      <div className="quiz-runner-layout">
        <section className="panel quiz-card">
          <QuestionPrompt text={question.question} table={question.table} level="h2" />
          <p className="muted quiz-hint">Можно выбрать несколько вариантов ответа.</p>
          <div className="option-list">
            {getQuestionOptions(question).map((answer) => (
              <button
                className={`option-button ${selected.includes(answer) ? 'selected' : ''}`}
                type="button"
                key={answer}
                disabled={isChecked}
                onClick={() => onAnswer(question.id, answer)}
              >
                <strong>{answer}</strong>
                <span>{question.options[answer]}</span>
              </button>
            ))}
          </div>
          {isChecked && (
            <div className={answerScore.points ? 'inline-feedback good' : 'inline-feedback bad'}>
              {answerScore.exact ? 'Верно.' : answerScore.points ? 'Ответ учтён частично.' : 'Ответ не зачтён.'} Баллы: {answerScore.points}/{answerScore.maxPoints}. Правильно выбрано: {answerScore.correctCount}, лишних: {answerScore.incorrectCount}, пропущено: {answerScore.missedCount}. Правильные ответы: {formatAnswers(correctAnswers)}.
              {quiz.showExplanation && question.explanation && ` ${question.explanation}`}
            </div>
          )}
          <div className="button-row spread">
            <button className="secondary-button" type="button" disabled={quiz.index === 0} onClick={() => onMove(quiz.index - 1)}>
              Назад
            </button>
            {!isChecked ? (
              <button className="primary-button" type="button" disabled={!selected.length} onClick={() => onCheck(question.id)}>
                <Check size={18} /> Проверить
              </button>
            ) : quiz.index < quiz.questions.length - 1 ? (
              <button className="primary-button" type="button" onClick={() => onMove(quiz.index + 1)}>
                Далее
              </button>
            ) : (
              <button className="primary-button" type="button" onClick={onFinish} disabled={isFinishing}>
                {isFinishing ? 'Сохранение…' : 'Завершить тест'}
              </button>
            )}
          </div>
        </section>
        <aside className="question-navigator" aria-label="Навигация по вопросам">
          <h3>Вопросы</h3>
          <div className="question-number-grid">
            {quiz.questions.map((item, index) => {
              const isCurrent = index === quiz.index
              const isAnswered = Boolean(quiz.answers[item.id]?.length)
              const itemIsChecked = Boolean(quiz.checked[item.id])
              const stateClass = itemIsChecked ? 'is-checked' : isAnswered ? 'is-answered' : ''

              return (
                <button
                  className={`question-number ${stateClass} ${isCurrent ? 'is-current' : ''}`}
                  type="button"
                  key={item.id}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`Перейти к вопросу ${index + 1}${isAnswered ? ', есть ответ' : ''}`}
                  onClick={() => onMove(index)}
                >
                  {index + 1}
                </button>
              )
            })}
          </div>
          <div className="question-navigator-legend">
            <span><i className="legend-current" /> Текущий</span>
            <span><i className="legend-answered" /> Есть ответ</span>
          </div>
          <div className="finish-early-block">
            {unansweredCount > 0 && <small>Без ответа: {unansweredCount}</small>}
            <button className="danger-button full" type="button" disabled={isFinishing} onClick={finishEarly}>
              <XCircle size={18} /> {isFinishing ? 'Сохранение…' : 'Завершить досрочно'}
            </button>
          </div>
        </aside>
      </div>
    </>
  )
}

function QuizResult({ quiz, onReset }: { quiz: ActiveQuiz; onReset: () => void }) {
  const [subjectFilter, setSubjectFilter] = useState<Subject | 'all'>('all')
  const [sortMode, setSortMode] = useState<'errors' | 'order'>('errors')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const bySubject = emptyBySubject()
  let correct = 0
  let score = 0
  let maxScore = 0

  quiz.questions.forEach((question) => {
    const answerScore = scoreAnswers(quiz.answers[question.id], getCorrectAnswers(question))
    bySubject[question.subject].total += 1
    score += answerScore.points
    maxScore += answerScore.maxPoints
    if (answerScore.exact) {
      bySubject[question.subject].correct += 1
      correct += 1
    }
  })

  const percentage = maxScore ? Math.round((score / maxScore) * 100) : 0
  const incorrect = quiz.questions.length - correct
  const visibleQuestions = quiz.questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => subjectFilter === 'all' || question.subject === subjectFilter)
    .sort((a, b) => {
      if (sortMode === 'order') return a.index - b.index
      const aScore = scoreAnswers(quiz.answers[a.question.id], getCorrectAnswers(a.question))
      const bScore = scoreAnswers(quiz.answers[b.question.id], getCorrectAnswers(b.question))
      return aScore.points - bScore.points || a.index - b.index
    })
  const resultMessage = percentage >= 85
    ? 'Отличная работа! Ты уверенно справился с тестом.'
    : percentage >= 60
      ? `Хорошая работа! Ты справился лучше, чем ${percentage}% участников.`
      : 'Хорошее начало. Разбери ошибки и попробуй ещё раз.'

  return (
    <div className="result-page">
      <header className="result-header">
        <button className="result-brand" type="button" onClick={onReset}>
          <span className="result-brand-mark">K</span>
          <strong>KT PREP TRAINER</strong>
        </button>
        <div className="result-date">
          <CalendarDays size={20} />
          <span>Дата теста: {new Date().toLocaleString('ru-RU', { dateStyle: 'long', timeStyle: 'short' })}</span>
        </div>
      </header>

      <section className="result-surface">
        <div className="result-summary-layout">
          <div className="result-intro">
            <h1>Результат</h1>
            <p>{resultMessage}</p>
            <div className="result-subject-cards">
              {SUBJECTS.map((subject) => (
                <article className="result-subject-card" key={subject.id} style={{ '--subject-color': subject.color } as CSSProperties}>
                  <SubjectResultIcon subject={subject.id} />
                  <div>
                    <span>{subject.title}</span>
                    <strong>{bySubject[subject.id].correct}/{bySubject[subject.id].total}</strong>
                    <small>вопросов</small>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <article className="result-score-card">
            <div className="result-ring">
              <CircularProgressbar
                value={percentage}
                text={`${percentage}%`}
                styles={buildStyles({
                  pathColor: 'var(--primary)',
                  trailColor: 'var(--progress-track)',
                  textColor: 'var(--text)',
                  strokeLinecap: 'butt',
                })}
              />
              <span>баллов</span>
            </div>
            <div className="result-score-copy">
              <strong>{score} <small>из {maxScore}</small></strong>
              <span>баллов</span>
              <div className="result-score-stats">
                <div>
                  <span>Правильно</span>
                  <strong className="score-good">{correct}</strong>
                  <CheckCircle2 />
                </div>
                <div>
                  <span>Ошибок</span>
                  <strong className="score-bad">{incorrect}</strong>
                  <XCircle />
                </div>
              </div>
            </div>
          </article>
        </div>

        <div className="result-details-layout">
          <section className="result-review-card">
            <div className="result-review-header">
              <h2>Ошибки и объяснения</h2>
              <div className="result-filters">
                <label>
                  <span className="sr-only">Фильтр по предмету</span>
                  <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value as Subject | 'all')}>
                    <option value="all">Все предметы</option>
                    {SUBJECTS.map((subject) => <option key={subject.id} value={subject.id}>{subject.title}</option>)}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Сортировка</span>
                  <select value={sortMode} onChange={(event) => setSortMode(event.target.value as 'errors' | 'order')}>
                    <option value="errors">Сначала ошибки</option>
                    <option value="order">По порядку</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="result-question-list">
              {visibleQuestions.map(({ question }) => {
                const answerScore = scoreAnswers(quiz.answers[question.id], getCorrectAnswers(question))
                const isCorrect = answerScore.exact
                const isExpanded = Boolean(expanded[question.id])
                return (
                  <article className={`result-question ${isCorrect ? 'is-correct' : 'is-wrong'}`} key={question.id}>
                    <div className="result-status-icon">{isCorrect ? <Check /> : <X />}</div>
                    <div className="result-question-content">
                      <div className="badge-row">
                        <span className="badge">{subjectById(question.subject).title}</span>
                        <span className="badge topic-badge">{question.topic}</span>
                      </div>
                      <QuestionPrompt text={question.question} table={question.table} level="h3" />
                      <p className="result-answer-line">
                        Ваш ответ: <b className={isCorrect ? 'answer-good' : 'answer-bad'}>{formatAnswers(quiz.answers[question.id]) || '—'}</b>
                        <span>•</span>
                        <b className={answerScore.points ? 'answer-good' : 'answer-bad'}>{answerScore.points}/{answerScore.maxPoints} баллов</b>
                        <span>•</span>
                        Верно выбрано: {answerScore.correctCount}, лишних: {answerScore.incorrectCount}, пропущено: {answerScore.missedCount}
                        <span>•</span>
                        Правильный ответ: <b className="answer-good">{formatAnswers(getCorrectAnswers(question))}</b>
                      </p>
                      {question.explanation && (isExpanded || !isCorrect) && <p className="result-explanation">{question.explanation}</p>}
                    </div>
                    <button
                      className="result-detail-button"
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpanded({ ...expanded, [question.id]: !isExpanded })}
                    >
                      {isExpanded ? 'Скрыть' : 'Подробнее'} <ChevronDown size={16} />
                    </button>
                  </article>
                )
              })}
              {!visibleQuestions.length && <EmptyState text="По выбранному предмету вопросов нет." />}
            </div>
          </section>

          <aside className="result-by-subject">
            <h2>Результаты по темам</h2>
            <div className="result-subject-list">
              {SUBJECTS.map((subject) => {
                const item = bySubject[subject.id]
                const subjectPercentage = item.total ? Math.round((item.correct / item.total) * 100) : 0
                return (
                  <div className="result-subject-row" key={subject.id} style={{ '--subject-color': subject.color } as CSSProperties}>
                    <SubjectResultIcon subject={subject.id} />
                    <div>
                      <span>{subject.title}</span>
                      <strong>{item.correct} из {item.total}</strong>
                      <div className="subject-progress"><span style={{ width: `${subjectPercentage}%` }} /></div>
                    </div>
                    <small>{subjectPercentage}%</small>
                  </div>
                )
              })}
            </div>
          </aside>
        </div>

        <footer className="result-footer">
          <button className="primary-button result-new-test" type="button" onClick={onReset}>
            <RotateCcw size={18} /> Новый тест
          </button>
        </footer>
      </section>
    </div>
  )
}

function SubjectResultIcon({ subject }: { subject: Subject }) {
  const icon = subject === 'tgo'
    ? <FileText />
    : subject === 'english'
      ? <Languages />
      : subject === 'databases'
        ? <Database />
        : <Braces />

  return <span className="result-subject-icon">{icon}</span>
}

function QuestionPrompt({ text, table, level }: { text: string; table?: Question['table']; level: 'h2' | 'h3' }) {
  const { prompt, code } = splitQuestionCode(text)
  const title = level === 'h2' ? <h2>{prompt}</h2> : <h3>{prompt}</h3>

  return (
    <div className="question-prompt">
      {title}
      {table && <QuestionTable table={table} />}
      {code && <PseudocodeBlock code={code} />}
    </div>
  )
}

function QuestionTable({ table }: { table: NonNullable<Question['table']> }) {
  return (
    <div className="question-table-wrap">
      <table className="question-table">
        <thead><tr>{table.headers.map((header, index) => <th key={`${index}-${header}`}>{header}</th>)}</tr></thead>
        <tbody>{table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

function PseudocodeBlock({ code }: { code: string }) {
  const lines = code.split('\n')

  return (
    <div className="pseudocode" aria-label="Псевдокод">
      <div className="pseudocode-toolbar">
        <span className="pseudocode-dots" aria-hidden="true"><i /><i /><i /></span>
        <span>Псевдокод</span>
      </div>
      <pre>
        <code>
          {lines.map((line, index) => (
            <span className="pseudocode-line" key={`${index}-${line}`}>
              <span className="pseudocode-line-number" aria-hidden="true">{index + 1}</span>
              <span>{highlightPseudocode(line)}</span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}

function splitQuestionCode(text: string) {
  const fenced = text.match(/^(.*?)```(?:\w+)?\s*\n?([\s\S]*?)```\s*$/)
  if (fenced) {
    return { prompt: fenced[1].trim(), code: fenced[2].trim() }
  }

  const blankLineIndex = text.search(/\n\s*\n/)
  if (blankLineIndex >= 0) {
    const prompt = text.slice(0, blankLineIndex).trim()
    const candidate = text.slice(blankLineIndex).trim()
    if (looksLikePseudocode(candidate)) return { prompt, code: candidate }
  }

  const questionEnd = text.indexOf('?')
  if (questionEnd >= 0) {
    const candidate = text.slice(questionEnd + 1).trim()
    if (looksLikePseudocode(candidate)) {
      return {
        prompt: text.slice(0, questionEnd + 1).trim(),
        code: normalizeInlinePseudocode(candidate),
      }
    }
  }

  return { prompt: text, code: '' }
}

function looksLikePseudocode(value: string) {
  return /\b(for|while|if|else|return|swap|heapify|build[_\s-]*max[_\s-]*heap|quicksort|partition|merge|function)\b/i.test(value)
}

function normalizeInlinePseudocode(value: string) {
  if (value.includes('\n')) return value

  return value
    .replace(/\s+(?=(?:for|while|if|else|return|swap|heapSize|HEAPIFY|BUILD_|QUICKSORT|PARTITION|MERGE)\b)/g, '\n')
    .trim()
}

function highlightPseudocode(line: string) {
  const parts = line.split(/(\b(?:for|to|down|while|if|then|else|return|and|or|not|function)\b|\b\d+\b)/gi)
  return parts.map((part, index) => {
    if (/^(for|to|down|while|if|then|else|return|and|or|not|function)$/i.test(part)) {
      return <b className="code-keyword" key={`${index}-${part}`}>{part}</b>
    }
    if (/^\d+$/.test(part)) {
      return <b className="code-number" key={`${index}-${part}`}>{part}</b>
    }
    return part
  })
}

function StatisticsPage({ results }: { results: TestResult[] }) {
  const average = results.length ? Math.round(results.reduce((sum, result) => sum + result.percentage, 0) / results.length) : 0
  const best = results.length ? Math.max(...results.map((result) => result.percentage)) : 0
  const totalAnswered = results.reduce((sum, result) => sum + result.totalQuestions, 0)
  const subjectStats = SUBJECTS.map((subject) => {
    const totals = results.reduce(
      (acc, result) => {
        acc.total += result.bySubject[subject.id]?.total ?? 0
        acc.correct += result.bySubject[subject.id]?.correct ?? 0
        return acc
      },
      { total: 0, correct: 0 },
    )
    return { ...subject, ...totals, percent: totals.total ? Math.round((totals.correct / totals.total) * 100) : 0 }
  })
  const topicStats = Object.values(results.flatMap((result) => result.questionAttempts ?? []).reduce<Record<string, { topic: string; total: number; correct: number }>>((acc, attempt) => {
    const key = `${attempt.subject}:${attempt.topic}`
    const current = acc[key] ?? { topic: attempt.topic, total: 0, correct: 0 }
    current.total += 1
    current.correct += Number(attempt.correct)
    acc[key] = current
    return acc
  }, {}))
    .map((topic) => ({ ...topic, percent: Math.round((topic.correct / topic.total) * 100) }))
    .sort((a, b) => a.percent - b.percent || b.total - a.total)
    .slice(0, 4)
  const trend = [...results].reverse().slice(-10)

  return (
    <section className="analytics-page">
      <div className="analytics-heading">
        <div><p className="eyebrow">Мой прогресс</p><h1>Аналитика</h1><p>Смотри динамику, закрепляй сильные темы и повторяй слабые.</p></div>
      </div>
      <section className="analytics-kpis">
        <Metric title="Пройдено тестов" value={String(results.length)} />
        <Metric title="Средний результат" value={`${average}%`} />
        <Metric title="Лучший результат" value={`${best}%`} />
        <Metric title="Решено вопросов" value={String(totalAnswered)} />
      </section>
      <section className="analytics-main-grid">
        <article className="analytics-surface trend-card">
          <div className="analytics-card-heading"><div><h2>Динамика результатов</h2><p>Последние {trend.length || 0} попыток</p></div><strong>{trend.length ? `${trend.at(-1)?.percentage}%` : '—'}</strong></div>
          {trend.length ? <ProgressLine results={trend} /> : <EmptyState text="Пройди первый тест — здесь появится график." />}
        </article>
        <article className="analytics-surface">
          <div className="analytics-card-heading"><div><h2>Слабые темы</h2><p>Начни повторение с них</p></div></div>
          <div className="weak-topic-list">
            {topicStats.map((topic) => <div className="weak-topic" key={topic.topic}><div><strong>{topic.topic}</strong><span>{topic.correct} из {topic.total} правильных</span></div><b>{topic.percent}%</b></div>)}
            {!topicStats.length && <EmptyState text="После новых попыток здесь появятся темы." />}
          </div>
        </article>
      </section>
      <section className="analytics-surface subject-performance">
        <div className="analytics-card-heading"><div><h2>Результаты по предметам</h2><p>Процент верных ответов за всё время</p></div></div>
        <div className="subject-performance-list">
          {subjectStats.map((subject) => <div className="subject-performance-row" key={subject.id}><span className="subject-dot" style={{ background: subject.color }} /><strong>{subject.title}</strong><div className="subject-bar"><span style={{ width: `${subject.percent}%`, background: subject.color }} /></div><b>{subject.percent}%</b><small>{subject.total} вопросов</small></div>)}
        </div>
      </section>
      <section className="analytics-surface">
        <div className="analytics-card-heading"><div><h2>Последние попытки</h2><p>История твоих тестов</p></div></div>
        <div className="history analytics-history">
          {results.slice(0, 10).map((result) => <div className="history-row" key={result.id}><strong>{formatResultMode(result.mode)}</strong><span>{new Date(result.date).toLocaleString('ru-RU')}</span><span>{result.score ?? result.correctAnswers}/{result.maxScore ?? result.totalQuestions} {result.score === undefined ? 'правильных' : 'баллов'}</span><b>{result.percentage}%</b></div>)}
          {!results.length && <EmptyState text="История пока пустая." />}
        </div>
      </section>
    </section>
  )
}

function ProgressLine({ results }: { results: TestResult[] }) {
  const points = results.map((result, index) => {
    const x = results.length === 1 ? 50 : (index / (results.length - 1)) * 100
    const y = 100 - result.percentage
    return `${x},${y}`
  }).join(' ')
  return <div className="progress-line" aria-label="График динамики результатов"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img"><line x1="0" y1="25" x2="100" y2="25" /><line x1="0" y1="50" x2="100" y2="50" /><line x1="0" y1="75" x2="100" y2="75" /><polyline points={points} /></svg><div className="progress-line-labels"><span>{new Date(results[0].date).toLocaleDateString('ru-RU')}</span><span>{new Date(results.at(-1)?.date ?? '').toLocaleDateString('ru-RU')}</span></div></div>
}

function QuestionEditor({
  value,
  onChange,
}: {
  value: Omit<Question, 'id'> | Question
  onChange: (value: Omit<Question, 'id'> | Question) => void
}) {
  const update = (patch: Partial<Omit<Question, 'id'>>) => onChange({ ...value, ...patch })
  const correctAnswers = getCorrectAnswers(value as Question)
  const toggleCorrectAnswer = (answer: AnswerKey) => {
    const next = correctAnswers.includes(answer)
      ? correctAnswers.filter((item) => item !== answer)
      : [...correctAnswers, answer].sort()

    update({ correctAnswers: next })
  }

  return (
    <div className="form-grid">
      <SubjectSelect value={value.subject} onChange={(subject) => update({ subject })} />
      <label>
        Автор
        <input
          value={value.author ?? ''}
          onChange={(event) => update({ author: event.target.value })}
          placeholder="Например: Рабат"
        />
      </label>
      <label>
        Тема
        <input
          value={value.topic}
          onChange={(event) => update({ topic: event.target.value })}
          placeholder="Например: Ключи и связи"
        />
      </label>
      <label>
        Текст вопроса
        <textarea value={value.question} onChange={(event) => update({ question: event.target.value })} />
      </label>
      {ANSWER_KEYS.map((answer) => (
        <label key={answer}>
          Вариант {answer}
          <input
            value={value.options[answer] ?? ''}
            onChange={(event) => update({ options: { ...value.options, [answer]: event.target.value } })}
          />
        </label>
      ))}
      <fieldset className="correct-answer-grid">
        <legend>Правильные ответы</legend>
        {ANSWER_KEYS.map((answer) => (
          <label className="checkbox-pill" key={answer}>
            <input
              type="checkbox"
              checked={correctAnswers.includes(answer)}
              onChange={() => toggleCorrectAnswer(answer)}
            />
            {answer}
          </label>
        ))}
      </fieldset>
      <label>
        Объяснение
        <textarea value={value.explanation ?? ''} onChange={(event) => update({ explanation: event.target.value })} />
      </label>
    </div>
  )
}

function SubjectSelect({ value, onChange }: { value: Subject; onChange: (value: Subject) => void }) {
  return (
    <label>
      Предмет
      <select value={value} onChange={(event) => onChange(event.target.value as Subject)}>
        {SUBJECTS.map((subject) => (
          <option key={subject.id} value={subject.id}>{subject.title}</option>
        ))}
      </select>
    </label>
  )
}

function getAuthors(questions: Question[], subject: Subject) {
  return [...new Set(
    questions
      .filter((question) => question.subject === subject)
      .map((question) => question.author?.trim())
      .filter((author): author is string => Boolean(author)),
  )].sort((left, right) => left.localeCompare(right, 'ru'))
}

function getTopics(questions: Question[], subject: Subject, author = 'all') {
  return [...new Set(
    questions
      .filter((question) => question.subject === subject && (author === 'all' || question.author === author))
      .map((question) => question.topic?.trim() || 'Без темы'),
  )].sort((left, right) => left.localeCompare(right, 'ru'))
}

function isAlgorithmsHardQuestion(question: Question) {
  return question.subject === 'algorithms' && question.topic.trim().startsWith(ALGORITHMS_HARD_TOPIC_PREFIX)
}

function isSlivQuestion(question: Question) {
  return question.topic.trim().toLocaleLowerCase('ru') === 'sliv'
}

function formatHardTopic(topic: string) {
  return topic.trim().replace(ALGORITHMS_HARD_TOPIC_PREFIX, '').trim()
}

function formatResultMode(mode: QuizMode) {
  if (mode === 'kt') return 'Реальный КТ'
  if (mode === 'kt-hard') return 'КТ Hard'
  if (mode === 'sliv') return 'Сливы'
  if (mode === 'random') return 'Полный рандом'
  return 'Тренировка'
}

function mergeQuestionsWithTopics(existing: Question[], incoming: Question[]) {
  const topicNames = new Map<string, string>()

  existing.forEach((question) => {
    topicNames.set(`${question.subject}:${question.topic.toLocaleLowerCase('ru')}`, question.topic)
  })

  const normalized = incoming.map((question) => {
    const key = `${question.subject}:${question.topic.toLocaleLowerCase('ru')}`
    const topic = topicNames.get(key) ?? question.topic
    topicNames.set(key, topic)
    return { ...question, topic }
  })

  return [...normalized, ...existing]
}

function PageTitle({ title, text }: { title: string; text: string }) {
  return (
    <header className="page-title">
      <span className="eyebrow">KT Prep Trainer</span>
      <h1>{title}</h1>
      <p>{text}</p>
    </header>
  )
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <article className="metric-card">
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>
}

export default App
