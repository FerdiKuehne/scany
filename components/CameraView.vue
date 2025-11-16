<template>
  <div>
    <video ref="video" autoplay playsinline muted class="border w-full h-auto"></video>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, defineExpose } from "vue";

const video = ref(null);
let stream = null;

async function startCamera() {
  stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 256, height: 256 }   // FORCE 256x256
  });

  video.value.srcObject = stream;

  // WAIT UNTIL METADATA IS READY
  await new Promise(resolve => {
    video.value.onloadedmetadata = resolve;
  });
}

function stopCamera() {
  if (stream) stream.getTracks().forEach(track => track.stop());
}

// CAPTURE A FRAME SAFELY
function captureFrame() {
  if (!video.value || video.value.videoWidth === 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = video.value.videoWidth;
  canvas.height = video.value.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video.value, 0, 0);

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

defineExpose({ startCamera, stopCamera, captureFrame });
</script>
