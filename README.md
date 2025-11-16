# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.


/public
  /models
    depth_anything_v2_vitb_dynamic.onnx   # 371 MB
    midas_small.onnx                       # optional, if you use MiDaS depth

  /shaders
    depth-postprocess.wgsl
    tsdf-fusion.wgsl
    pointcloud-render.wgsl

/assets
  global.css   # optional global styling

/components
  CameraView.vue
  DepthCanvas.vue
  PointCloudView.vue
  UIControls.vue
  LoadingSpinner.vue

/composables
  useCamera.js          # WASM + JS webcam utils
  useDepthEngine.ts     # ONNX WebGPU depth pipeline
  usePointCloud.ts      # WebGPU point cloud generator
  useTSDF.ts            # TSDF fusion pipeline

/plugins
  onnxruntime.client.ts # ONNX Runtime WebGPU plugin

/utils
  preprocess.js         # WASM preprocessing
  postprocess.js        # CPU normalization
  webgpu-utils.js       # GPU helpers
  tensorToImage.js      # Depth → canvas image
  wasm-utils.js         # Load/compile WASM modules

/pages
  index.vue
  depth.vue

/app.vue
/nuxt.config.ts# scany
