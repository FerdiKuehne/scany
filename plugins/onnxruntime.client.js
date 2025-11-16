// plugins/onnxruntime.client.js
import { defineNuxtPlugin } from '#app'
import * as ort from 'onnxruntime-web'

export default defineNuxtPlugin((nuxtApp) => {
  console.log('ONNX Runtime Web plugin loaded')
 
  // Point ONNX Runtime to the public folder
  ort.env.wasm.wasmPaths = '/ort/'
  ort.env.logLevel = "verbose";
  ort.env.debug = true;
  // Optional: configure threads
  ort.env.wasm.numThreads = 4
  ort.env.wasm.proxy = false

  // Provide ort to the app
  nuxtApp.provide('ort', ort)
})
