import { type RefObject, useEffect, useState } from 'react'

interface Size {
  width: number
  height: number
}

export function useContainerSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState<Size>({ width: 550, height: 250 })

  useEffect(() => {
    if (!ref.current) return

    const updateSize = () => {
      if (ref.current) {
        const { width } = ref.current.getBoundingClientRect()
        // パディング分を引く
        setSize({ width: Math.max(300, width - 32), height: 250 })
      }
    }

    updateSize()

    const resizeObserver = new ResizeObserver(updateSize)
    resizeObserver.observe(ref.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [ref])

  return size
}
