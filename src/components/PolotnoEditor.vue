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
  theme?: 'light' | 'dark'
}>()

const emit = defineEmits<{
  ready: []
  save: [dataUrl: string]
}>()

const iframeRef = ref<HTMLIFrameElement | null>(null)
const ready = ref(false)

// Pending operations queue (for operations requested before iframe is ready)
let pendingImageUrl: string | null = null
let exportResolve: ((dataUrl: string | null) => void) | null = null

// Build iframe URL with params
const iframeSrc = computed(() => {
  const params = new URLSearchParams()
  if (props.apiKey) {
    params.set('apiKey', props.apiKey)
  }
  params.set('width', String(props.width || 1024))
  params.set('height', String(props.height || 1024))
  params.set('theme', props.theme || 'dark')
  return `/polotno?${params.toString()}`
})

// Handle messages from iframe
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
      // Handle programmatic export request
      if (exportResolve) {
        exportResolve(dataUrl)
        exportResolve = null
      } else {
        // Handle save from Polotno toolbar button
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

// Send message to iframe
function postMessage(message: object) {
  if (iframeRef.value?.contentWindow) {
    iframeRef.value.contentWindow.postMessage(message, '*')
  }
}

// Load image to canvas
function loadImageToCanvas(imageUrl: string) {
  if (!ready.value) {
    pendingImageUrl = imageUrl
    return
  }
  postMessage({ type: 'loadImage', data: { url: imageUrl } })
}

// Export image as data URL
function exportImage(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!ready.value) {
      resolve(null)
      return
    }
    exportResolve = resolve
    postMessage({ type: 'exportImage' })

    // Timeout after 10 seconds
    setTimeout(() => {
      if (exportResolve) {
        exportResolve(null)
        exportResolve = null
      }
    }, 10000)
  })
}

// Clear canvas
function clear() {
  postMessage({ type: 'clear' })
}

// Set canvas size
function setSize(width: number, height: number) {
  postMessage({ type: 'setSize', data: { width, height } })
}

onMounted(() => {
  window.addEventListener('message', handleMessage)

  // If initial image URL provided, queue it
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
