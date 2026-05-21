import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'

interface Props {
  trigger: boolean
}

export default function ConfettiBlast({ trigger }: Props) {
  const firedRef = useRef(false)

  useEffect(() => {
    if (!trigger || firedRef.current) return
    firedRef.current = true

    const colors = ['#2563eb', '#60a5fa', '#93c5fd', '#1d4ed8', '#dbeafe', '#ffffff']

    // First burst — center
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { x: 0.5, y: 0.55 },
      colors,
      zIndex: 9999,
      scalar: 1.1,
    })

    // Left side pop
    setTimeout(() => {
      confetti({
        particleCount: 60,
        angle: 60,
        spread: 70,
        origin: { x: 0, y: 0.6 },
        colors,
        zIndex: 9999,
      })
    }, 120)

    // Right side pop
    setTimeout(() => {
      confetti({
        particleCount: 60,
        angle: 120,
        spread: 70,
        origin: { x: 1, y: 0.6 },
        colors,
        zIndex: 9999,
      })
    }, 250)

    // Slow trickle
    setTimeout(() => {
      confetti({
        particleCount: 40,
        spread: 120,
        origin: { x: 0.5, y: 0.3 },
        colors,
        gravity: 0.6,
        scalar: 0.8,
        zIndex: 9999,
      })
    }, 500)

    return () => { firedRef.current = false }
  }, [trigger])

  return null
}
