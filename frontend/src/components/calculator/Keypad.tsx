import { blurIfPointer } from '@/lib/utils'
import { Keycap } from './Keycap'
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
        <button
          key={key.id}
          type="button"
          className="kc-well"
          aria-label={key.aria}
          onClick={(e) => {
            blurIfPointer(e)
            onPress(key)
          }}
        >
          <Keycap color={key.variant} pressed={activeKey === key.id}>
            <span aria-hidden="true" className={key.symbol ? `kc-symbol kc-symbol-${key.id}` : undefined}>
              {key.label}
            </span>
          </Keycap>
        </button>
      ))}
    </div>
  )
}
