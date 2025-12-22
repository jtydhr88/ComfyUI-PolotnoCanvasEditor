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
  initialImageUrls?: string[]
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

let pendingImageUrls: string[] = []
let exportResolve: ((dataUrl: string | null) => void) | null = null
let exportPSDResolve: ((data: ArrayBuffer | null) => void) | null = null

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

function handleMessage(event: MessageEvent) {
  const { type, dataUrl, data, message, width, height, count } = event.data || {}

  switch (type) {
    case 'ready':
      ready.value = true
      emit('ready')
      if (pendingImageUrls.length > 0) {
        loadImagesToCanvas(pendingImageUrls)
        pendingImageUrls = []
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

    case 'exportPSDResult':
      if (exportPSDResolve) {
        const binary = atob(data)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }
        exportPSDResolve(bytes.buffer)
        exportPSDResolve = null
      }
      break

    case 'imageLoaded':
      console.log('[Polotno] Image loaded:', width, 'x', height)
      break

    case 'imagesLoaded':
      console.log('[Polotno] Loaded', count, 'images as layers')
      break

    case 'error':
      console.error('[Polotno] Error:', message)
      if (exportResolve) {
        exportResolve(null)
        exportResolve = null
      }
      if (exportPSDResolve) {
        exportPSDResolve(null)
        exportPSDResolve = null
      }
      break
  }
}

function postMessage(message: object) {
  if (iframeRef.value?.contentWindow) {
    iframeRef.value.contentWindow.postMessage(message, '*')
  }
}

function loadImagesToCanvas(imageUrls: string[]) {
  if (!ready.value) {
    pendingImageUrls = imageUrls
    return
  }
  postMessage({ type: 'loadImages', data: { urls: imageUrls } })
}

function loadImageToCanvas(imageUrl: string) {
  loadImagesToCanvas([imageUrl])
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

function exportPSD(): Promise<ArrayBuffer | null> {
  return new Promise((resolve) => {
    if (!ready.value) {
      resolve(null)
      return
    }
    exportPSDResolve = resolve
    postMessage({ type: 'exportPSD' })

    setTimeout(() => {
      if (exportPSDResolve) {
        exportPSDResolve(null)
        exportPSDResolve = null
      }
    }, 30000)
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

  if (props.initialImageUrls && props.initialImageUrls.length > 0) {
    pendingImageUrls = [...props.initialImageUrls]
  }
})

onUnmounted(() => {
  window.removeEventListener('message', handleMessage)
})

defineExpose({
  exportImage,
  exportPSD,
  loadImageToCanvas,
  loadImagesToCanvas,
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
