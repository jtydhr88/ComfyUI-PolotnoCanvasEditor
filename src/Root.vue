<template>
  <Dialog
    v-model:visible="visible"
    :header="$t('dialog.title')"
    :style="{ width: '95vw', height: '95vh' }"
    :maximizable="true"
    :modal="true"
    :closable="true"
    :draggable="false"
    content-class="h-full"
    @hide="handleClose"
  >
    <PolotnoEditor
      v-if="visible"
      ref="polotnoEditorRef"
      :api-key="apiKey"
      :initial-image-url="currentImageUrl"
      :width="canvasWidth"
      :height="canvasHeight"
      :theme="theme"
      @ready="handleEditorReady"
      @save="handleSave"
    />
  </Dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Dialog from 'primevue/dialog'
import PolotnoEditor from './components/PolotnoEditor.vue'

// @ts-ignore - ComfyUI external module
import { app } from '../../../scripts/app.js'

interface ImageNode {
  id: number
  imgs?: HTMLImageElement[]
  images?: Array<{
    filename: string
    subfolder?: string
    type?: string
  }>
  widgets?: Array<{
    name: string
    value: string
  }>
}

const visible = ref(false)
const currentImageUrl = ref<string | null>(null)
const currentNode = ref<ImageNode | null>(null)
const editorReady = ref(false)
const polotnoEditorRef = ref<InstanceType<typeof PolotnoEditor> | null>(null)

// Settings
const apiKey = ref('')
const canvasWidth = ref(1024)
const canvasHeight = ref(1024)
const theme = ref<'light' | 'dark'>('dark')

// Save callback
let saveCallback: ((dataUrl: string, node: ImageNode | null) => Promise<void>) | null = null

onMounted(() => {
  // Load settings
  apiKey.value = app.ui?.settings?.getSettingValue('Comfy.PolotnoCanvasEditor.ApiKey') || ''
  canvasWidth.value = app.ui?.settings?.getSettingValue('Comfy.PolotnoCanvasEditor.DefaultWidth') || 1024
  canvasHeight.value = app.ui?.settings?.getSettingValue('Comfy.PolotnoCanvasEditor.DefaultHeight') || 1024

  // Get current ComfyUI theme
  const colorPalette = app.ui?.settings?.getSettingValue('Comfy.ColorPalette') || ''
  theme.value = colorPalette.includes('light') ? 'light' : 'dark'
})

function open(): void {
  visible.value = true
}

function close(): void {
  visible.value = false
}

function loadImage(imageUrl: string, node?: ImageNode): void {
  currentImageUrl.value = imageUrl
  currentNode.value = node || null
  visible.value = true
}

function openNew(node?: ImageNode): void {
  currentImageUrl.value = null
  currentNode.value = node || null
  visible.value = true
}

function setSaveCallback(callback: (dataUrl: string, node: ImageNode | null) => Promise<void>): void {
  saveCallback = callback
}

function handleEditorReady(): void {
  editorReady.value = true
}

function handleClose(): void {
  editorReady.value = false
  currentImageUrl.value = null
  currentNode.value = null
}

async function handleSave(dataUrl: string): Promise<void> {
  if (!saveCallback) return

  try {
    await saveCallback(dataUrl, currentNode.value)
    close()
  } catch (error) {
    console.error('[Polotno] Save failed:', error)
  }
}

defineExpose({
  open,
  close,
  loadImage,
  openNew,
  setSaveCallback
})
</script>

<style>
/* Global style for PrimeVue Dialog - not scoped */
.p-dialog-content {
  flex: 1;
  overflow: hidden;
  padding: 0 !important;
}
</style>
