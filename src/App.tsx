import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  ArrowLeft,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Check,
  Database,
  Edit3,
  GraduationCap,
  Home,
  Layers3,
  ListChecks,
  Play,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { parseQuestionsJson, jsonExample, normalizeQuestion } from './features/questions/validation'
import { ANSWER_KEYS, answersMatch, formatAnswers, getCorrectAnswers, getQuestionOptions } from './shared/answers'
import { loadQuestions, loadResults, saveQuestions, saveResults } from './storage/apiStorage'
import { useDatabaseState } from './storage/useDatabaseState'
import { demoQuestions } from './shared/demoQuestions'
import { emptyBySubject, SUBJECTS, subjectById } from './shared/subjects'
import type { AnswerKey, Question, Subject, TestResult } from './types'
import { createId } from './utils/id'
import { shuffle } from './utils/shuffle'

type View = 'home' | 'subjects' | 'add' | 'manage' | 'quiz' | 'kt' | 'stats'
type QuizMode = 'subject' | 'random' | 'kt'
type QuizScope = 'topic' | 'subject' | 'random'
type QuizSettings = {
  subject: Subject
  scope: QuizScope
  topic: string
  count: number | 'all'
  showExplanation: boolean
}
type KtSettings = Record<Subject, number>
type AnswerMap = Record<string, AnswerKey[] | undefined>

const defaultQuestionForm: Omit<Question, 'id'> = {
  subject: 'databases',
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
  const [questions, setQuestions, questionsError] = useDatabaseState(
    loadQuestions,
    saveQuestions,
    demoQuestions,
    'Новые вопросы',
  )
  const [results, setResults, resultsError] = useDatabaseState<TestResult[]>(
    loadResults,
    saveResults,
    [],
    'Результаты тестов',
  )
  const [view, setView] = useState<View>('home')
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

  const counts = useMemo(
    () =>
      SUBJECTS.reduce(
        (acc, subject) => {
          acc[subject.id] = questions.filter((question) => question.subject === subject.id).length
          return acc
        },
        {} as Record<Subject, number>,
      ),
    [questions],
  )

  const navigate = (nextView: View, subject?: Subject) => {
    if (subject) setSelectedSubject(subject)
    setActiveQuiz(null)
    setView(nextView)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveResult = (mode: QuizMode, quizQuestions: Question[], answers: AnswerMap) => {
    const bySubject = emptyBySubject()
    let correctAnswers = 0

    quizQuestions.forEach((question) => {
      bySubject[question.subject].total += 1
      if (answersMatch(answers[question.id], getCorrectAnswers(question))) {
        bySubject[question.subject].correct += 1
        correctAnswers += 1
      }
    })

    const result: TestResult = {
      id: createId(),
      mode,
      date: new Date().toISOString(),
      totalQuestions: quizQuestions.length,
      correctAnswers,
      percentage: quizQuestions.length ? Math.round((correctAnswers / quizQuestions.length) * 100) : 0,
      bySubject,
    }

    setResults([result, ...results].slice(0, 50))
  }

  const startSubjectQuiz = (settings: QuizSettings) => {
    const pool = questions.filter((question) => {
      if (settings.scope === 'random') return true
      if (question.subject !== settings.subject) return false
      return settings.scope === 'subject' || question.topic === settings.topic
    })
    const limit = settings.count === 'all' ? pool.length : Math.min(settings.count, pool.length)
    setActiveQuiz({
      mode: settings.scope === 'random' ? 'random' : 'subject',
      questions: shuffle(pool).slice(0, limit),
      showExplanation: settings.showExplanation,
      index: 0,
      answers: {},
      checked: {},
      finished: false,
    })
  }

  const startKtQuiz = (settings: KtSettings) => {
    const picked = SUBJECTS.flatMap((subject) => {
      const pool = questions.filter((question) => question.subject === subject.id)
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

  const finishQuiz = () => {
    if (!activeQuiz || activeQuiz.finished) return
    saveResult(activeQuiz.mode, activeQuiz.questions, activeQuiz.answers)
    setActiveQuiz({ ...activeQuiz, finished: true })
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => navigate('home')}>
          <GraduationCap size={28} />
          <span>
            <strong>KT Prep</strong>
            <small>Trainer</small>
          </span>
        </button>
        <nav>
          <NavButton icon={<Home />} label="Главная" active={view === 'home'} onClick={() => navigate('home')} />
          <NavButton icon={<BookOpen />} label="Предметы" active={view === 'subjects'} onClick={() => navigate('subjects')} />
          <NavButton icon={<Plus />} label="Добавить" active={view === 'add'} onClick={() => navigate('add')} />
          <NavButton icon={<ListChecks />} label="Вопросы" active={view === 'manage'} onClick={() => navigate('manage')} />
          <NavButton icon={<Play />} label="Тест" active={view === 'quiz'} onClick={() => navigate('quiz')} />
          <NavButton icon={<Layers3 />} label="Реальный КТ" active={view === 'kt'} onClick={() => navigate('kt')} />
          <NavButton icon={<BarChart3 />} label="Статистика" active={view === 'stats'} onClick={() => navigate('stats')} />
        </nav>
      </aside>

      <section className="workspace">
        {(questionsError || resultsError) && (
          <div className="database-error" role="alert">
            <AlertTriangle aria-hidden="true" />
            <div>
              <strong>Ошибка базы данных</strong>
              <span>{questionsError || resultsError}</span>
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
            activeQuiz={activeQuiz?.mode === 'subject' || activeQuiz?.mode === 'random' ? activeQuiz : null}
            counts={counts}
            questions={questions}
            selectedSubject={selectedSubject}
            onSettingsSubject={setSelectedSubject}
            onStart={startSubjectQuiz}
            onAnswer={(id, answer) =>
              activeQuiz && setActiveQuiz({ ...activeQuiz, answers: { ...activeQuiz.answers, [id]: toggleAnswer(activeQuiz.answers[id], answer) } })
            }
            onCheck={(id) =>
              activeQuiz && setActiveQuiz({ ...activeQuiz, checked: { ...activeQuiz.checked, [id]: true } })
            }
            onMove={(index) => activeQuiz && setActiveQuiz({ ...activeQuiz, index })}
            onFinish={finishQuiz}
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
            onReset={() => setActiveQuiz(null)}
          />
        )}
        {view === 'stats' && <StatisticsPage results={results} onClear={() => setResults([])} />}
      </section>
    </main>
  )
}

function NavButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button className={`nav-button ${active ? 'active' : ''}`} type="button" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  )
}

function toggleAnswer(current: AnswerKey[] | undefined, answer: AnswerKey) {
  const selected = current ?? []

  if (selected.includes(answer)) {
    return selected.filter((item) => item !== answer)
  }

  return [...selected, answer].sort()
}

function HomePage({
  counts,
  totalQuestions,
  totalResults,
  onNavigate,
}: {
  counts: Record<Subject, number>
  totalQuestions: number
  totalResults: number
  onNavigate: (view: View, subject?: Subject) => void
}) {
  return (
    <>
      <header className="hero-panel">
        <div>
          <span className="eyebrow">Учебный тренажер</span>
          <h1>KT Prep Trainer</h1>
          <p>
            Готовься к КТ по четырем предметам: добавляй собственные вопросы, проходи короткие тесты
            и запускай режим полного экзамена.
          </p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => onNavigate('kt')}>
              <Layers3 size={18} /> Пройти реальный КТ
            </button>
            <button className="secondary-button" type="button" onClick={() => onNavigate('add')}>
              <Plus size={18} /> Добавить вопросы
            </button>
          </div>
        </div>
        <div className="hero-meter" aria-label="Сводка">
          <div>
            <strong>{totalQuestions}</strong>
            <span>вопросов</span>
          </div>
          <div>
            <strong>{totalResults}</strong>
            <span>попыток</span>
          </div>
        </div>
      </header>

      <section className="section-header">
        <div>
          <h2>Предметы</h2>
          <p>Выбери направление и начни тренировку.</p>
        </div>
        <button className="ghost-button" type="button" onClick={() => onNavigate('stats')}>
          <BarChart3 size={18} /> Статистика
        </button>
      </section>
      <SubjectGrid counts={counts} onNavigate={onNavigate} />
    </>
  )
}

function SubjectsPage({
  counts,
  onNavigate,
}: {
  counts: Record<Subject, number>
  onNavigate: (view: View, subject?: Subject) => void
}) {
  return (
    <>
      <PageTitle title="Предметы" text="Отдельные страницы-карточки для каждого блока подготовки." />
      <SubjectGrid counts={counts} onNavigate={onNavigate} />
    </>
  )
}

function SubjectGrid({
  counts,
  onNavigate,
}: {
  counts: Record<Subject, number>
  onNavigate: (view: View, subject?: Subject) => void
}) {
  return (
    <div className="subject-grid">
      {SUBJECTS.map((subject) => (
        <article className="card subject-card" key={subject.id} style={{ '--subject-color': subject.color } as CSSProperties}>
          <div className="subject-icon"><Database size={20} /></div>
          <h3>{subject.title}</h3>
          <p>{subject.description}</p>
          <strong>{counts[subject.id]} вопросов</strong>
          <div className="card-actions">
            <button className="primary-button" type="button" onClick={() => onNavigate('quiz', subject.id)}>
              <Play size={16} /> Пройти тест
            </button>
            <button className="secondary-button" type="button" onClick={() => onNavigate('add', subject.id)}>
              <Plus size={16} /> Добавить
            </button>
            <button className="ghost-button" type="button" onClick={() => onNavigate('manage', subject.id)}>
              <ListChecks size={16} /> Вопросы
            </button>
          </div>
        </article>
      ))}
    </div>
  )
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
      setForm({ ...defaultQuestionForm, subject: form.subject, topic: form.topic })
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
            <button className="ghost-button" type="button" onClick={() => setBulk(jsonExample)}>
              Вставить пример
            </button>
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
          <pre className="format-note">{jsonExample}</pre>
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
            <h3>{question.question}</h3>
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
  selectedSubject,
  onSettingsSubject,
  onStart,
  onAnswer,
  onCheck,
  onMove,
  onFinish,
  onReset,
}: {
  activeQuiz: ActiveQuiz | null
  counts: Record<Subject, number>
  questions: Question[]
  selectedSubject: Subject
  onSettingsSubject: (subject: Subject) => void
  onStart: (settings: QuizSettings) => void
  onAnswer: (id: string, answer: AnswerKey) => void
  onCheck: (id: string) => void
  onMove: (index: number) => void
  onFinish: () => void
  onReset: () => void
}) {
  const [count, setCount] = useState<QuizSettings['count']>(10)
  const [showExplanation, setShowExplanation] = useState(true)
  const [scope, setScope] = useState<QuizScope>('topic')
  const topics = getTopics(questions, selectedSubject)
  const [topic, setTopic] = useState('')
  const selectedTopic = topics.includes(topic) ? topic : (topics[0] ?? '')
  const poolCount = scope === 'random'
    ? questions.length
    : scope === 'subject'
      ? counts[selectedSubject]
      : questions.filter((question) => question.subject === selectedSubject && question.topic === selectedTopic).length

  if (activeQuiz) {
    return <QuizRunner quiz={activeQuiz} onAnswer={onAnswer} onCheck={onCheck} onMove={onMove} onFinish={onFinish} onReset={onReset} />
  }

  return (
    <>
      <PageTitle title="Тренировка" text="Выбери тему, предмет целиком или полный рандом по всей базе." />
      <section className="panel settings-panel">
        <div className="segmented quiz-modes">
          <button className={scope === 'topic' ? 'active' : ''} type="button" onClick={() => setScope('topic')}>По теме</button>
          <button className={scope === 'subject' ? 'active' : ''} type="button" onClick={() => setScope('subject')}>По предмету</button>
          <button className={scope === 'random' ? 'active' : ''} type="button" onClick={() => setScope('random')}>Полный рандом</button>
        </div>
        {scope !== 'random' && <SubjectSelect value={selectedSubject} onChange={onSettingsSubject} />}
        {scope === 'topic' && (
          <label>
            Тема
            <select value={selectedTopic} onChange={(event) => setTopic(event.target.value)}>
              {topics.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        )}
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
        <label className="toggle">
          <input type="checkbox" checked={showExplanation} onChange={(event) => setShowExplanation(event.target.checked)} />
          Показывать объяснение после проверки
        </label>
        <button
          className="primary-button"
          type="button"
          disabled={!poolCount}
          onClick={() => onStart({ subject: selectedSubject, scope, topic: selectedTopic, count, showExplanation })}
        >
          <Play size={18} /> Начать тест ({poolCount})
        </button>
      </section>
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
  onReset,
}: {
  activeQuiz: ActiveQuiz | null
  counts: Record<Subject, number>
  onStart: (settings: KtSettings) => void
  onAnswer: (id: string, answer: AnswerKey) => void
  onCheck: (id: string) => void
  onMove: (index: number) => void
  onFinish: () => void
  onReset: () => void
}) {
  const [settings, setSettings] = useState(defaultKtSettings)

  if (activeQuiz) {
    return <QuizRunner quiz={activeQuiz} onAnswer={onAnswer} onCheck={onCheck} onMove={onMove} onFinish={onFinish} onReset={onReset} />
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
  onReset,
}: {
  quiz: ActiveQuiz
  onAnswer: (id: string, answer: AnswerKey) => void
  onCheck: (id: string) => void
  onMove: (index: number) => void
  onFinish: () => void
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
  const isAnsweredCorrectly = answersMatch(selected, correctAnswers)
  const progress = Math.round(((quiz.index + 1) / quiz.questions.length) * 100)

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
      <section className="panel quiz-card">
        <h2>{question.question}</h2>
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
          <div className={isAnsweredCorrectly ? 'inline-feedback good' : 'inline-feedback bad'}>
            {isAnsweredCorrectly ? 'Верно.' : `Неверно. Правильные ответы: ${formatAnswers(correctAnswers)}.`}
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
            <button className="primary-button" type="button" onClick={onFinish}>
              Завершить тест
            </button>
          )}
        </div>
      </section>
    </>
  )
}

function QuizResult({ quiz, onReset }: { quiz: ActiveQuiz; onReset: () => void }) {
  const mistakes = quiz.questions.filter((question) => !answersMatch(quiz.answers[question.id], getCorrectAnswers(question)))
  const bySubject = emptyBySubject()
  let correct = 0

  quiz.questions.forEach((question) => {
    bySubject[question.subject].total += 1
    if (answersMatch(quiz.answers[question.id], getCorrectAnswers(question))) {
      bySubject[question.subject].correct += 1
      correct += 1
    }
  })

  const percentage = Math.round((correct / quiz.questions.length) * 100)

  return (
    <>
      <PageTitle title="Результат" text={`${correct} из ${quiz.questions.length} правильных ответов. Процент: ${percentage}%.`} />
      <section className="stats-grid">
        {SUBJECTS.map((subject) => (
          <article className="metric-card" key={subject.id}>
            <span>{subject.title}</span>
            <strong>{bySubject[subject.id].correct}/{bySubject[subject.id].total}</strong>
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>Ошибки и объяснения</h2>
        {mistakes.map((question) => (
          <div className="mistake" key={question.id}>
            <div className="badge-row">
              <span className="badge">{subjectById(question.subject).title}</span>
              <span className="badge topic-badge">{question.topic}</span>
            </div>
            <h3>{question.question}</h3>
            <p>Ваш ответ: {formatAnswers(quiz.answers[question.id])} · Правильные ответы: {formatAnswers(getCorrectAnswers(question))}</p>
            {question.explanation && <p className="muted">{question.explanation}</p>}
          </div>
        ))}
        {!mistakes.length && <EmptyState text="Ошибок нет. Отличный проход." />}
        <button className="primary-button" type="button" onClick={onReset}>
          Новый тест
        </button>
      </section>
    </>
  )
}

function StatisticsPage({ results, onClear }: { results: TestResult[]; onClear: () => void }) {
  const average = results.length ? Math.round(results.reduce((sum, result) => sum + result.percentage, 0) / results.length) : 0
  const best = results.length ? Math.max(...results.map((result) => result.percentage)) : 0

  return (
    <>
      <PageTitle title="Статистика" text="Прогресс хранится в общей базе данных." />
      <section className="stats-grid">
        <Metric title="Тестов пройдено" value={String(results.length)} />
        <Metric title="Средний процент" value={`${average}%`} />
        <Metric title="Лучший результат" value={`${best}%`} />
      </section>
      <section className="subject-grid compact">
        {SUBJECTS.map((subject) => {
          const totals = results.reduce(
            (acc, result) => {
              acc.total += result.bySubject[subject.id]?.total ?? 0
              acc.correct += result.bySubject[subject.id]?.correct ?? 0
              return acc
            },
            { total: 0, correct: 0 },
          )
          const percent = totals.total ? Math.round((totals.correct / totals.total) * 100) : 0
          return <Metric key={subject.id} title={subject.title} value={`${percent}%`} />
        })}
      </section>
      <section className="panel">
        <div className="split-title">
          <h2>Последние попытки</h2>
          <button className="danger-button" type="button" onClick={onClear}>Очистить</button>
        </div>
        <div className="history">
          {results.slice(0, 10).map((result) => (
            <div className="history-row" key={result.id}>
              <strong>{result.mode === 'kt' ? 'Реальный КТ' : result.mode === 'random' ? 'Полный рандом' : 'Тренировка'}</strong>
              <span>{new Date(result.date).toLocaleString('ru-RU')}</span>
              <span>{result.correctAnswers}/{result.totalQuestions}</span>
              <b>{result.percentage}%</b>
            </div>
          ))}
          {!results.length && <EmptyState text="История пока пустая." />}
        </div>
      </section>
    </>
  )
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

function getTopics(questions: Question[], subject: Subject) {
  return [...new Set(
    questions
      .filter((question) => question.subject === subject)
      .map((question) => question.topic?.trim() || 'Без темы'),
  )].sort((left, right) => left.localeCompare(right, 'ru'))
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
