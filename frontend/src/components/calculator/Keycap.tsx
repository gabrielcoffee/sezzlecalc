// One keycap definition for every key. Geometry and lighting are fixed here;
// the three colours come only from CSS variables (see keycap.css).
//
// Layers, back to front, all lit from the top:
//   well (the button)  dark recessed cell, inset shadow strongest at the top
//   contact shadow     short soft shadow where the cap sits in the well
//   body               superellipse side wall in the shade colour
//   face               same shape, raised, radial gradient: light upper centre
//   rim                light top edge, dark bottom edge (the bevel)
//   noise              faint feTurbulence grain over the face
//   legend             printed label, thin, 1px shadow
import { useId, type ReactNode } from 'react'
import './keycap.css'

/** Superellipse |x/rx|^n + |y/ry|^n = 1 as an SVG path. */
export function superellipse(cx: number, cy: number, rx: number, ry: number, n = 5, steps = 72): string {
  const points: string[] = []
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2
    const c = Math.cos(t)
    const s = Math.sin(t)
    const x = cx + rx * Math.sign(c) * Math.abs(c) ** (2 / n)
    const y = cy + ry * Math.sign(s) * Math.abs(s) ** (2 / n)
    points.push(`${x.toFixed(2)} ${y.toFixed(2)}`)
  }
  return `M${points.join('L')}Z`
}

// Geometry in a 100×100 box. The face sits higher than the body, so a band
// of the darker side wall shows at the bottom, as on a sculpted keycap.
const CONTACT = superellipse(50, 56, 42, 41)
const BODY = superellipse(50, 51, 44, 44)
const FACE = superellipse(50, 47.5, 41.5, 40.5)

export type KeycapColor = 'orange' | 'gray' | 'cream'

interface Props {
  color: KeycapColor
  children: ReactNode
  pressed?: boolean
}

/** The visual keycap; render it inside a <button className="kc-well">. */
export function Keycap({ color, children, pressed }: Props) {
  const id = useId()
  const faceGrad = `${id}face`
  const wallGrad = `${id}wall`
  const edgeGrad = `${id}edge`
  const rimGrad = `${id}rim`
  const blur = `${id}blur`
  const grain = `${id}grain`
  const clip = `${id}clip`

  return (
    <span className={`kc kc-${color}`} data-pressed={pressed || undefined}>
      <svg className="kc-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          {/* Broad, wide, soft: a gently domed face, not a spotlit sphere. */}
          <radialGradient
            id={faceGrad}
            cx="0.5"
            cy="0.18"
            r="0.95"
            gradientTransform="translate(0.5 0.18) scale(1.35 1) translate(-0.5 -0.18)"
          >
            <stop offset="0" style={{ stopColor: 'var(--kc-highlight)' }} />
            <stop offset="0.42" style={{ stopColor: 'var(--kc-base)' }} />
            <stop offset="0.8" style={{ stopColor: 'var(--kc-base)' }} />
            <stop offset="1" style={{ stopColor: 'var(--kc-shade)' }} />
          </radialGradient>
          {/* Face falls off towards the sides and bottom: the cap's curvature. */}
          <radialGradient id={edgeGrad} cx="0.5" cy="0.38" r="0.62">
            <stop offset="0.55" stopColor="#000" stopOpacity="0" />
            <stop offset="0.85" stopColor="#000" stopOpacity="0.1" />
            <stop offset="1" stopColor="#000" stopOpacity="0.24" />
          </radialGradient>
          {/* Side wall: catches some light just under the face, falls into shade at the foot. */}
          <linearGradient id={wallGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.55" stopColor="#fff" stopOpacity="0.14" />
            <stop offset="0.85" stopColor="#000" stopOpacity="0.05" />
            <stop offset="1" stopColor="#000" stopOpacity="0.38" />
          </linearGradient>
          <linearGradient id={rimGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
            <stop offset="0.22" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.7" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.4" />
          </linearGradient>
          <filter id={blur} x="-10%" y="-10%" width="120%" height="130%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
          <filter id={grain} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <clipPath id={clip}>
            <path d={FACE} />
          </clipPath>
        </defs>

        <path className="kc-contact" d={CONTACT} filter={`url(#${blur})`} />
        <g className="kc-cap">
          <path className="kc-body" d={BODY} />
          <path d={BODY} fill={`url(#${wallGrad})`} />
          <path d={FACE} fill={`url(#${faceGrad})`} />
          <path d={FACE} fill={`url(#${edgeGrad})`} />
          <path d={FACE} fill="none" stroke={`url(#${rimGrad})`} strokeWidth="1.4" />
          <rect className="kc-grain" width="100" height="100" filter={`url(#${grain})`} clipPath={`url(#${clip})`} />
        </g>
      </svg>
      <span className="kc-legend">{children}</span>
    </span>
  )
}
