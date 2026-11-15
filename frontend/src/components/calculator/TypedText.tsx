import { motion } from 'motion/react'

interface Props {
  text: string
  /** Animate typing: earlier characters glide left, the new one fades in at the right edge. */
  live: boolean
  /** Changes when the text is replaced as a whole (e.g. a result); no glide then. */
  generation: string | number
}

/**
 * Text drawn one character per element so typing can animate. While typing,
 * characters keep their identity (keyed by position), so appending one makes
 * the others slide left (layout animation) while the new one fades in. A new
 * generation (a result) mounts fresh characters that appear at once.
 */
export function TypedText({ text, live, generation }: Props) {
  return (
    <>
      {Array.from(text).map((ch, i) => (
        <motion.span
          key={`${live ? 'live' : generation}-${i}`}
          className="typed-char"
          layout={live ? 'position' : false}
          initial={live ? { opacity: 0, x: '0.45em' } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.09, ease: 'easeOut' }}
        >
          {ch}
        </motion.span>
      ))}
    </>
  )
}
