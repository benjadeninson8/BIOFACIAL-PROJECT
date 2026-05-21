import { useState, useEffect, useRef } from 'react'
import { motion, useSpring, useMotionValue, useTransform } from 'framer-motion'

interface Props {
  value: number
  prefix?: string
  decimals?: number
  className?: string
}

/** Animated spring number counter — springs to new value on change */
export default function SpringCounter({ value, prefix = '$', decimals = 2, className = '' }: Props) {
  const motionVal = useMotionValue(value)
  const spring    = useSpring(motionVal, { stiffness: 180, damping: 22 })
  const display   = useTransform(spring, v => `${prefix}${v.toFixed(decimals)}`)
  const [text, setText] = useState(`${prefix}${value.toFixed(decimals)}`)
  const prevRef = useRef(value)

  useEffect(() => {
    if (prevRef.current !== value) {
      motionVal.set(value)
      prevRef.current = value
    }
  }, [value, motionVal])

  useEffect(() => {
    const unsub = display.on('change', v => setText(v))
    return unsub
  }, [display])

  return (
    <motion.span className={className}>
      {text}
    </motion.span>
  )
}
