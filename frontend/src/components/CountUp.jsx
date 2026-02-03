import { useEffect, useRef, useState } from 'react'

export default function CountUp({ to = 0, duration = 700, format = (n) => n.toLocaleString() }) {
  const [val, setVal] = useState(0)
  const raf = useRef(null)
  const startRef = useRef(null)
  const fromRef = useRef(0)

  useEffect(() => {
    cancelAnimationFrame(raf.current)
    fromRef.current = 0
    startRef.current = null

    const animate = (t) => {
      if (startRef.current == null) startRef.current = t
      const progress = Math.min(1, (t - startRef.current) / duration)
      const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      const current = Math.round(fromRef.current + (to - fromRef.current) * eased)
      setVal(current)
      if (progress < 1) {
        raf.current = requestAnimationFrame(animate)
      }
    }
    raf.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf.current)
  }, [to, duration])

  return <span>{format(val)}</span>
}
