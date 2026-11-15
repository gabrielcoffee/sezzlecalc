import { Delete } from 'lucide-react'
import { motion } from 'motion/react'
import { KEY_ROWS, type KeyDef } from './keys'

interface Props {
  onPress: (key: KeyDef) => void
  /** Key currently pressed from the physical keyboard, shown as held down. */
  activeKey: string | null
}

export function Keypad({ onPress, activeKey }: Props) {
  return (
    <div className="calc-tray" role="group" aria-label="Keypad">
      {KEY_ROWS.flat().map((key) => (
        <motion.button
          key={key.id}
          type="button"
          className={`key key-${key.variant}`}
          aria-label={key.aria}
          data-active={activeKey === key.id || undefined}
          onClick={() => onPress(key)}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 700, damping: 30 }}
        >
          <span className="key-cap">
            {key.id === 'backspace' ? (
              <Delete className="key-icon" aria-hidden="true" strokeWidth={1.75} />
            ) : (
              <span className="key-label" aria-hidden="true">
                {key.label}
              </span>
            )}
          </span>
        </motion.button>
      ))}
    </div>
  )
}
