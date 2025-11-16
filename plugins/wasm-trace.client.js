// plugins/wasm-trace.client.js
export default defineNuxtPlugin(() => {
    console.log("⚡ SAFE WASM TRACE ENABLED");
  
    const log = (...args) => console.debug("[WASM TRACE]", ...args);
  
    addEventListener("fetch", e => log("fetch", e.request.url));
    addEventListener("error", e => log("error", e.message));
    addEventListener("unhandledrejection", e => log("promise rejection", e.reason));
  
    // Log ONNX network requests only
    const origFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = args[0];
      if (typeof url === "string" && url.includes("ort")) {
        log("fetching", url);
      }
      return origFetch.apply(this, args);
    };
  });
  