<template>
  <div class="polotno-wrapper h-full w-full flex">
    <div class="flex-1 relative">
      <div v-if="!ready" class="polotno-loading">
        Loading Polotno Editor...
      </div>
      <iframe
        ref="iframeRef"
        :src="iframeSrc"
        class="polotno-iframe h-full w-full"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  apiKey?: string
  initialImageUrl?: string | null
  width?: number
  height?: number
}>()

const emit = defineEmits<{
  ready: []
  save: [dataUrl: string]
}>()

const iframeRef = ref<HTMLIFrameElement | null>(null)
const ready = ref(false)

let pendingImageUrl: string | null = null
let exportResolve: ((dataUrl: string | null) => void) | null = null

const iframeSrc = computed(() => {
  const params = new URLSearchParams()
  if (props.apiKey) {
    params.set('apiKey', props.apiKey)
  }
  params.set('width', String(props.width || 1024))
  params.set('height', String(props.height || 1024))
  return `/polotno?${params.toString()}`
})

function handleMessage(event: MessageEvent) {
  const { type, dataUrl, message, width, height } = event.data || {}

  switch (type) {
    case 'ready':
      ready.value = true
      emit('ready')
      // Load pending image if any
      if (pendingImageUrl) {
        loadImageToCanvas(pendingImageUrl)
        pendingImageUrl = null
      }
      break

    case 'exportResult':
      if (exportResolve) {
        exportResolve(dataUrl)
        exportResolve = null
      } else {
        emit('save', dataUrl)
      }
      break

    case 'imageLoaded':
      console.log('[Polotno] Image loaded:', width, 'x', height)
      break

    case 'error':
      console.error('[Polotno] Error:', message)
      if (exportResolve) {
        exportResolve(null)
        exportResolve = null
      }
      break
  }
}

function handleIframeLoad() {
  // iframe loaded, waiting for 'ready' message from app
}

function postMessage(message: object) {
  if (iframeRef.value?.contentWindow) {
    iframeRef.value.contentWindow.postMessage(message, '*')
  }
}

function loadImageToCanvas(imageUrl: string) {
  if (!ready.value) {
    pendingImageUrl = imageUrl
    return
  }
  postMessage({ type: 'loadImage', data: { url: imageUrl } })
}

function exportImage(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!ready.value) {
      resolve(null)
      return
    }
    exportResolve = resolve
    postMessage({ type: 'exportImage' })

    setTimeout(() => {
      if (exportResolve) {
        exportResolve(null)
        exportResolve = null
      }
    }, 10000)
  })
}

function clear() {
  postMessage({ type: 'clear' })
}

function setSize(width: number, height: number) {
  postMessage({ type: 'setSize', data: { width, height } })
}

onMounted(() => {
  window.addEventListener('message', handleMessage)

  if (props.initialImageUrl) {
    pendingImageUrl = props.initialImageUrl
  }
})

onUnmounted(() => {
  window.removeEventListener('message', handleMessage)
})

defineExpose({
  exportImage,
  loadImageToCanvas,
  clear,
  setSize
})
</script>

<style scoped>
.polotno-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 16px;
  color: #888;
  z-index: 1;
}

.polotno-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}
</style>
