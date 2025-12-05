import type { H3Event } from 'h3'

export default defineEventHandler((event: H3Event) => {
  const url = event.req.url || ''
  if (url.startsWith('/ort/')) {
    setHeader(event, 'Cross-Origin-Opener-Policy', 'same-origin')
    setHeader(event, 'Cross-Origin-Embedder-Policy', 'require-corp')
  }
})
