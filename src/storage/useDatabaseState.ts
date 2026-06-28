import { useEffect, useRef, useState } from 'react'

export const useDatabaseState = <T,>(
  loader: () => Promise<T>,
  saver: (value: T) => Promise<void>,
  initialValue: T,
) => {
  const [value, setValue] = useState<T>(initialValue)
  const [hydrated, setHydrated] = useState(false)
  const saveQueue = useRef(Promise.resolve())

  useEffect(() => {
    let active = true
    loader()
      .then((loaded) => {
        if (active) {
          setValue(loaded)
          setHydrated(true)
        }
      })
      .catch((error) => console.error('Failed to load data', error))
    return () => {
      active = false
    }
  }, [loader])

  useEffect(() => {
    if (hydrated) {
      saveQueue.current = saveQueue.current
        .catch(() => undefined)
        .then(() => saver(value))
        .catch((error) => console.error('Failed to save data', error))
    }
  }, [hydrated, saver, value])

  return [value, setValue] as const
}
