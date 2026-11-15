// Skeuomorphic icons drawn as SVG with gradients, matching the calculator's
// cream plastic, brushed metal and orange display. Gradient ids come from
// useId so several copies can coexist on a page.
import { useId, type SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base = (props: IconProps): IconProps => ({
  viewBox: '0 0 32 32',
  width: 24,
  height: 24,
  'aria-hidden': true,
  focusable: false,
  ...props,
})

/** Paper tape roll, the history of a printing calculator. */
export function TapeRollIcon(props: IconProps) {
  const id = useId()
  return (
    <svg {...base(props)}>
      <defs>
        <linearGradient id={`${id}roll`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#e9e4d2" />
          <stop offset="1" stopColor="#b3ab92" />
        </linearGradient>
        <linearGradient id={`${id}tape`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9d3be" />
          <stop offset="0.25" stopColor="#fbf9f1" />
          <stop offset="1" stopColor="#efebdc" />
        </linearGradient>
        <radialGradient id={`${id}core`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#5b5446" />
          <stop offset="1" stopColor="#9b937c" />
        </radialGradient>
      </defs>
      {/* hanging tape with a torn edge */}
      <path
        d="M9 10h15v17.5l-1.9-1.4-1.8 1.4-1.9-1.4-1.8 1.4-1.9-1.4-1.8 1.4-1.9-1.4L9 27.5z"
        fill={`url(#${id}tape)`}
        stroke="#9d957d"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      <path d="M15 15.5h6M17 18.5h4M14 21.5h7" stroke="#8d8673" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M16 24h5" stroke="#f07a22" strokeWidth="1.6" strokeLinecap="round" />
      {/* the roll */}
      <rect x="5" y="3.5" width="22" height="8" rx="4" fill={`url(#${id}roll)`} stroke="#8f876f" strokeWidth="0.7" />
      <ellipse cx="7.2" cy="7.5" rx="2.2" ry="4" fill="#e3ddc9" stroke="#8f876f" strokeWidth="0.6" />
      <ellipse cx="7.2" cy="7.5" rx="0.9" ry="1.6" fill={`url(#${id}core)`} />
      <path d="M10 5.2h14" stroke="#ffffff" strokeWidth="0.9" strokeLinecap="round" opacity="0.9" />
    </svg>
  )
}

/** Dark metal speaker; orange sound waves when on, a muted cross when off. */
export function SpeakerIcon({ on, ...props }: IconProps & { on: boolean }) {
  const id = useId()
  return (
    <svg {...base(props)}>
      <defs>
        <linearGradient id={`${id}body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a8d88" />
          <stop offset="0.5" stopColor="#4d504c" />
          <stop offset="1" stopColor="#2a2c29" />
        </linearGradient>
        <linearGradient id={`${id}wave`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb066" />
          <stop offset="1" stopColor="#e1600d" />
        </linearGradient>
      </defs>
      <path
        d="M4 12.2c0-.9.7-1.6 1.6-1.6h4.6l7.2-5.9c.7-.6 1.7-.1 1.7.8v21c0 .9-1 1.4-1.7.8l-7.2-5.9H5.6c-.9 0-1.6-.7-1.6-1.6z"
        fill={`url(#${id}body)`}
        stroke="#1d1e1c"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path d="M10.6 11.4l6.5-5.3" stroke="#c9ccc6" strokeWidth="0.8" strokeLinecap="round" opacity="0.8" />
      <rect x="5.6" y="12.3" width="3.4" height="7.4" rx="0.8" fill="#1f201e" opacity="0.55" />
      {on ? (
        <g fill="none" stroke={`url(#${id}wave)`} strokeWidth="2.2" strokeLinecap="round">
          <path d="M22.3 12.2a5.3 5.3 0 0 1 0 7.6" />
          <path d="M25.4 8.9a9.8 9.8 0 0 1 0 14.2" />
        </g>
      ) : (
        <g stroke="#8a8578" strokeWidth="2.2" strokeLinecap="round">
          <path d="M22.5 12.5l6 7M28.5 12.5l-6 7" />
        </g>
      )}
    </svg>
  )
}

/** Brushed-metal trash bin with a ribbed body. */
export function TrashIcon(props: IconProps) {
  const id = useId()
  return (
    <svg {...base(props)}>
      <defs>
        <linearGradient id={`${id}metal`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9c9c97" />
          <stop offset="0.35" stopColor="#f1f1ee" />
          <stop offset="0.65" stopColor="#d2d2ce" />
          <stop offset="1" stopColor="#8b8b86" />
        </linearGradient>
        <linearGradient id={`${id}lid`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6f6f3" />
          <stop offset="1" stopColor="#9e9e99" />
        </linearGradient>
      </defs>
      <path d="M7.5 10h17l-1.6 17.1c-.1 1-1 1.9-2 1.9h-9.8c-1 0-1.9-.9-2-1.9z" fill={`url(#${id}metal)`} stroke="#5f5f5b" strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M12.3 13v12.5M16 13v12.5M19.7 13v12.5" stroke="#7a7a75" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M12.9 13v12.5M16.6 13v12.5M20.3 13v12.5" stroke="#ffffff" strokeWidth="0.5" strokeLinecap="round" opacity="0.8" />
      <rect x="5.5" y="6.8" width="21" height="3.6" rx="1.4" fill={`url(#${id}lid)`} stroke="#5f5f5b" strokeWidth="0.8" />
      <path d="M13 6.8V5.4c0-.5.4-.9.9-.9h4.2c.5 0 .9.4.9.9v1.4" fill="none" stroke="#5f5f5b" strokeWidth="1.1" />
    </svg>
  )
}
