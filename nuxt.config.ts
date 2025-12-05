// nuxt.config.ts
export default defineNuxtConfig({
  ssr: false,
  nitro: {
    routeRules: {
      '/ort/**': {
        headers: {
          'Cross-Origin-Embedder-Policy': 'require-corp',
          'Cross-Origin-Opener-Policy': 'same-origin',
        }
      }
    }
  }
});
