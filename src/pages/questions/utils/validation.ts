import { SUBJECT_IDS } from '../../../models/subjects.js'
import { ANSWER_KEYS } from '../../../utils/answers.js'
import type { AnswerKey, Question, QuestionDiagram, QuestionGraphEdge, QuestionGraphNode, QuestionTable, QuestionTree, Subject } from '../../../types'
import { createId } from '../../../utils/id.js'

type RawQuestion = Partial<Omit<Question, 'id'>> & {
  id?: string
  correctAnswer?: AnswerKey | AnswerKey[]
  correctAnswers?: AnswerKey[]
}

export const jsonExample = `[
  {
    "subject": "databases",
    "author": "Рабат",
    "topic": "Ключи и связи",
    "question": "Что такое первичный ключ?",
    "options": {
      "A": "Поле, которое уникально идентифицирует запись",
      "B": "Поле для хранения только чисел",
      "C": "Любой внешний атрибут",
      "D": "Команда SQL",
      "E": "Индекс без ограничений уникальности",
      "F": "Временная таблица",
      "G": "Представление",
      "H": "Ограничение уникальности",
      "I": "Триггер"
    },
    "correctAnswers": ["A", "H"],
    "explanation": "Первичный ключ уникально идентифицирует каждую запись, а ограничение уникальности помогает не допускать повторов."
  }
]`

export const pseudocodeJsonExample = `[
  {
    "subject": "algorithms",
    "author": "Рабат",
    "topic": "Алгоритмы и сортировки",
    "question": "Какой алгоритм соответствует псевдокоду?\\n\\nBUILD_MAX_HEAP(A)\\nfor end = n - 1 down to 1\\n    swap(A[0], A[end])\\n    heapSize = heapSize - 1\\n    HEAPIFY(A, 0)",
    "options": {
      "A": "Heap Sort",
      "B": "Insertion Sort",
      "C": "Radix Sort",
      "D": "Bubble Sort"
    },
    "correctAnswers": ["A"],
    "explanation": "Сначала строится max-heap, затем максимальный элемент перемещается в конец массива."
  }
]`

export const tableJsonExample = `[
  {
    "subject": "databases",
    "topic": "Нормальные формы",
    "question": "Какая строка нарушает правило?",
    "table": {
      "headers": ["Студент", "Курс", "Группа"],
      "rows": [["Алия", "Базы данных", "IT-21"], ["Данияр", "Алгоритмы", "IT-22"]]
    },
    "options": { "A": "Первая", "B": "Вторая", "C": "Ни одна" },
    "correctAnswers": ["C"]
  }
]`

export const treeJsonExample = `[
  {
    "subject": "algorithms",
    "topic": "Деревья выражений",
    "question": "Вычислите выражение, представленное деревом:",
    "diagram": {
      "type": "tree",
      "root": {
        "value": "-",
        "left": { "value": "*", "left": { "value": "6" }, "right": { "value": "2" } },
        "right": { "value": "4" }
      }
    },
    "options": { "A": "4", "B": "8", "C": "10", "D": "12", "E": "16" },
    "correctAnswers": ["B"]
  }
]`

export const graphJsonExample = `[
  {
    "subject": "algorithms",
    "topic": "Графы",
    "question": "Какой путь ведёт из A в D?",
    "diagram": {
      "type": "graph",
      "directed": true,
      "nodes": [{ "id": "A" }, { "id": "B" }, { "id": "C" }, { "id": "D" }],
      "edges": [{ "from": "A", "to": "B", "label": "2" }, { "from": "B", "to": "D", "label": "3" }, { "from": "A", "to": "C", "label": "1" }]
    },
    "options": { "A": "A → B → D", "B": "A → D", "C": "B → C", "D": "C → A" },
    "correctAnswers": ["A"]
  }
]`

const isSubject = (value: unknown): value is Subject =>
  typeof value === 'string' && SUBJECT_IDS.includes(value as Subject)

const isAnswer = (value: unknown): value is AnswerKey =>
  typeof value === 'string' && ANSWER_KEYS.includes(value as AnswerKey)

const normalizeCorrectAnswers = (item: RawQuestion) => {
  const raw = item.correctAnswers ?? item.correctAnswer
  const answers = Array.isArray(raw) ? raw : raw ? [raw] : []

  if (answers.some((answer) => !isAnswer(answer))) {
    return { answers: [], error: 'correctAnswers должен содержать только буквы от A до I.' }
  }

  return {
    answers: answers.filter((answer, index) => answers.indexOf(answer) === index),
    error: '',
  }
}

const normalizeTable = (value: unknown): { table?: QuestionTable; error?: string } => {
  if (value === undefined) return {}
  if (!value || typeof value !== 'object') return { error: 'table должна содержать headers и rows.' }

  const { headers, rows } = value as { headers?: unknown; rows?: unknown }
  if (!Array.isArray(headers) || !headers.length || headers.some((cell) => typeof cell !== 'string' || !cell.trim())) {
    return { error: 'table.headers должен быть непустым массивом строк.' }
  }
  if (!Array.isArray(rows) || !rows.length || rows.some((row) => !Array.isArray(row) || row.length !== headers.length || row.some((cell) => typeof cell !== 'string'))) {
    return { error: 'table.rows должен содержать строки с тем же числом текстовых ячеек, что и headers.' }
  }

  return { table: { headers: headers.map((cell) => cell.trim()), rows } as QuestionTable }
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const normalizeTree = (value: unknown, depth = 0): { tree?: QuestionTree; error?: string } => {
  if (depth > 12) return { error: 'diagram.tree не должен быть глубже 12 уровней.' }
  if (!isRecord(value) || typeof value.value !== 'string' || !value.value.trim()) {
    return { error: 'diagram.root и каждый его узел должны содержать непустое value.' }
  }

  const node: QuestionTree = { value: value.value.trim() }
  for (const side of ['left', 'right'] as const) {
    if (value[side] !== undefined) {
      const child = normalizeTree(value[side], depth + 1)
      if (child.error || !child.tree) return child
      node[side] = child.tree
    }
  }
  return { tree: node }
}

const normalizeGraph = (value: Record<string, unknown>): { diagram?: QuestionDiagram; error?: string } => {
  const { nodes, edges, directed } = value
  if (!Array.isArray(nodes) || !nodes.length || nodes.length > 20 || nodes.some((node) => !isRecord(node) || typeof node.id !== 'string' || !node.id.trim() || (node.label !== undefined && typeof node.label !== 'string'))) {
    return { error: 'diagram.nodes должен содержать от 1 до 20 вершин с непустым id.' }
  }
  if (!Array.isArray(edges) || edges.some((edge) => !isRecord(edge) || typeof edge.from !== 'string' || typeof edge.to !== 'string' || (edge.label !== undefined && typeof edge.label !== 'string'))) {
    return { error: 'diagram.edges должен быть массивом рёбер с from и to.' }
  }
  if (directed !== undefined && typeof directed !== 'boolean') return { error: 'diagram.directed должен быть true или false.' }

  const normalizedNodes = nodes.map((node) => ({ id: (node as Record<string, string>).id.trim(), label: (node as Record<string, string>).label?.trim() || undefined })) as QuestionGraphNode[]
  const ids = new Set(normalizedNodes.map((node) => node.id))
  if (ids.size !== normalizedNodes.length) return { error: 'diagram.nodes не должен содержать повторяющиеся id.' }

  const normalizedEdges = edges.map((edge) => ({ from: (edge as Record<string, string>).from.trim(), to: (edge as Record<string, string>).to.trim(), label: (edge as Record<string, string>).label?.trim() || undefined })) as QuestionGraphEdge[]
  if (normalizedEdges.some((edge) => !ids.has(edge.from) || !ids.has(edge.to))) return { error: 'Каждое ребро diagram.edges должно ссылаться на существующие вершины.' }

  return { diagram: { type: 'graph', nodes: normalizedNodes, edges: normalizedEdges, directed } }
}

export const normalizeDiagram = (value: unknown): { diagram?: QuestionDiagram; error?: string } => {
  if (value === undefined) return {}
  if (!isRecord(value) || (value.type !== 'tree' && value.type !== 'graph')) return { error: 'diagram.type должен быть tree или graph.' }
  if (value.type === 'graph') return normalizeGraph(value)

  const tree = normalizeTree(value.root)
  return tree.error || !tree.tree ? { error: tree.error } : { diagram: { type: 'tree', root: tree.tree } }
}

export const normalizeQuestion = (
  item: RawQuestion,
  index = 0,
): { question?: Question; error?: string } => {
  const label = `Вопрос ${index + 1}:`

  if (!isSubject(item.subject)) {
    return { error: `${label} неизвестный subject. Используйте tgo, english, databases или algorithms.` }
  }

  if (!item.question || typeof item.question !== 'string') {
    return { error: `${label} отсутствует question.` }
  }

  if (item.topic !== undefined && typeof item.topic !== 'string') {
    return { error: `${label} topic должен быть строкой.` }
  }

  if (item.author !== undefined && typeof item.author !== 'string') {
    return { error: `${label} author должен быть строкой.` }
  }

  const tableResult = normalizeTable(item.table)
  if (tableResult.error) return { error: `${label} ${tableResult.error}` }

  const diagramResult = normalizeDiagram(item.diagram)
  if (diagramResult.error) return { error: `${label} ${diagramResult.error}` }

  if (!item.options || typeof item.options !== 'object') {
    return { error: `${label} отсутствуют options.` }
  }

  const options: Question['options'] = {}
  const rawOptions = item.options as Record<string, unknown>

  for (const [key, value] of Object.entries(rawOptions)) {
    if (!isAnswer(key)) {
      return { error: `${label} options поддерживает только варианты от A до I.` }
    }

    if (typeof value !== 'string') {
      return { error: `${label} option ${key} должен быть строкой.` }
    }

    if (value.trim()) {
      options[key] = value.trim()
    }
  }

  if (Object.keys(options).length < 2) {
    return { error: `${label} options должен содержать минимум два непустых варианта от A до I.` }
  }

  const correctResult = normalizeCorrectAnswers(item)
  const correctAnswers = correctResult.answers

  if (correctResult.error) {
    return { error: `${label} ${correctResult.error}` }
  }

  if (!correctAnswers.length) {
    return { error: `${label} отсутствует correctAnswers или correctAnswer.` }
  }

  for (const answer of correctAnswers) {
    if (!options[answer]) {
      return { error: `${label} правильный ответ ${answer} отсутствует среди options.` }
    }
  }

  return {
    question: {
      id: item.id || createId(),
      subject: item.subject,
      author: item.author?.trim() || undefined,
      topic: item.topic?.trim() || 'Без темы',
      question: item.question.trim(),
      options,
      correctAnswers,
      explanation: item.explanation?.trim(),
      table: tableResult.table,
      diagram: diagramResult.diagram,
    },
  }
}

export const parseQuestionsJson = (value: string) => {
  let parsed: unknown

  try {
    parsed = JSON.parse(value)
  } catch {
    return { questions: [], error: 'Неверный формат JSON. Проверьте скобки, кавычки и запятые.' }
  }

  if (!Array.isArray(parsed)) {
    return { questions: [], error: 'JSON должен быть массивом вопросов: [ { ... } ].' }
  }

  const questions: Question[] = []

  for (let index = 0; index < parsed.length; index += 1) {
    const item = parsed[index]
    if (!item || typeof item !== 'object') {
      return { questions: [], error: `Вопрос ${index + 1}: должен быть объектом.` }
    }

    const result = normalizeQuestion(item as RawQuestion, index)
    if (result.error || !result.question) {
      return { questions: [], error: result.error }
    }
    questions.push(result.question)
  }

  return { questions, error: '' }
}
