import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Adaptive — AI learning that follows your actual understanding'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          gap: 24,
          padding: 80,
          background: '#0a0a0a',
          color: '#fafafa',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 28, opacity: 0.6 }}>Adaptive</div>
        <div style={{ fontSize: 68, fontWeight: 600, lineHeight: 1.1 }}>
          Learn what you actually
          <br />
          do not know.
        </div>
        <div style={{ fontSize: 28, opacity: 0.7, maxWidth: 820 }}>
          An AI tutor built on prerequisite graphs and real assessment.
        </div>
      </div>
    ),
    size,
  )
}
