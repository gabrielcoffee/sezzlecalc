import { motion } from 'motion/react'
import type { useCalculator } from '@/hooks/use-calculator'
import { Display } from './Display'
import { Keypad } from './Keypad'
import './calculator.css'

interface Props {
  calc: ReturnType<typeof useCalculator>
  activeKey: string | null
  onPress: Parameters<typeof Keypad>[0]['onPress']
}

/** The calculator body: display, nameplate and keypad. Styling lives in calculator.css. */
export function Calculator({ calc, activeKey, onPress }: Props) {
  return (
    <motion.section
      className="calc-body"
      aria-label="SZLCALC 903 calculator"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 160, damping: 22 }}
    >
      <div className="calc-ridges" aria-hidden="true" />
      <Display view={calc.view} rejections={calc.rejections} flashes={calc.flashes} />
      <div className="nameplate" aria-hidden="true">
        <span>SZLCALC</span> <strong>903</strong>
      </div>
      <Keypad onPress={onPress} activeKey={activeKey} />
    </motion.section>
  )
}
