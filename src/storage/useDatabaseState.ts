import { useCallback, useEffect, useRef, useState } from 'react'

export const useDatabaseState = <T,>(
  loader: () => Promise<T>,
  saver: (value: T) => Promise<void>,
  initialValue: T,
  entityLabel: string,
) => {
  const [value, setValue] = useState<T>(initialValue)
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState('')
  const saveQueue = useRef(Promise.resolve())

  useEffect(() => {
    let active = true
    loader()
      .then((loaded) => {
        if (active) {
          setValue(loaded)
          setHydrated(true)
          setError('')
        }
      })
      .catch((loadError) => {
        console.error('Failed to load data', loadError)
        if (active) {
          setError(`Не удалось подключиться к базе данных. ${entityLabel} не будут сохранены.`)
        }
      })
    return () => {
      active = false
    }
  }, [entityLabel, loader])

  const updateValue = useCallback((nextValue: T) => {
    setValue(nextValue)

    if (!hydrated) {
      setError(`Не удалось подключиться к базе данных. ${entityLabel} не будут сохранены.`)
      return Promise.resolve(false)
    }

    const saveOperation = saveQueue.current
      .catch(() => undefined)
      .then(() => saver(nextValue))

    saveQueue.current = saveOperation

    return saveOperation
      .then(() => {
        setError('')
        return true
      })
      .catch((saveError) => {
        console.error('Failed to save data', saveError)
        setError(`Не удалось сохранить ${entityLabel.toLowerCase()}. Проверьте подключение к базе данных.`)
        return false
      })
  }, [entityLabel, hydrated, saver])

  return [value, updateValue, error] as const
}
