export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  ssr: false,
  css: ['@/assets/global.css'],
  plugins: ['@/plugins/onnxruntime.client.js','@/plugins/wasm-trace.client.js'],
  runtimeConfig: {
    public: {
      modelBasePath: '/models/' // public path accessible in the browser
    }
  },

  vite: {
    build: {
      target: 'esnext'
    }
  },

  nitro: {
    routeRules: {
      '/**': {
        headers: {
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp'
        }
      }
    },
    publicAssets: [
      {
        dir: 'public',
        maxAge: 60 * 60 * 24 * 7
      }
    ]
  }
})
