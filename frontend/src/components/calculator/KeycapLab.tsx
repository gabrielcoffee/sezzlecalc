// Dev-only keycap test page: one keycap in three colours, at keypad size and
// large, resting and pressed. Served at /keycap-lab.html in dev; not built.
import { Keycap, type KeycapColor } from './Keycap'

const KEYS: { color: KeycapColor; label: string }[] = [
  { color: 'orange', label: 'C' },
  { color: 'gray', label: '7' },
  { color: 'cream', label: '+' },
]

function Row({ size, pressed }: { size: number; pressed?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 3, padding: 3, background: '#121110', borderRadius: 5 }}>
      {KEYS.map((k) => (
        <button key={k.color} type="button" className="kc-well" style={{ width: size, aspectRatio: '1 / 0.94' }}>
          <Keycap color={k.color} pressed={pressed}>
            <span style={size > 150 ? { fontSize: '3.4rem' } : undefined}>{k.label}</span>
          </Keycap>
        </button>
      ))}
    </div>
  )
}

export function KeycapLab() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        gap: 28,
        padding: 32,
        background: '#dddbcd', // the calculator shell, where the keys really sit
        fontFamily: 'var(--font-display)',
        color: '#3a3934',
      }}
    >
      <Row size={220} />
      <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
        <figure style={{ margin: 0, textAlign: 'center' }}>
          <Row size={88} />
          <figcaption style={{ fontSize: 11, marginTop: 8, letterSpacing: '0.12em' }}>RESTING</figcaption>
        </figure>
        <figure style={{ margin: 0, textAlign: 'center' }}>
          <Row size={88} pressed />
          <figcaption style={{ fontSize: 11, marginTop: 8, letterSpacing: '0.12em' }}>PRESSED</figcaption>
        </figure>
      </div>
    </main>
  )
}
