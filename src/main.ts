import { createApp, type App as VueApp } from 'vue'
import PrimeVue from 'primevue/config'
import { createI18n } from 'vue-i18n'
import Root from './Root.vue'
import en from '../locales/en/main.json'
import zh from '../locales/zh/main.json'

// PSD export
import { writePsd } from 'ag-psd'

// @ts-ignore - ComfyUI external module
import { app } from '../../../scripts/app.js'
// @ts-ignore - ComfyUI external module
import { api } from '../../../scripts/api.js'

declare global {
  interface Window {
    comfyAPI: {
      button: {
        ComfyButton: new (options: {
          icon?: string
          tooltip?: string
          content?: string
          action?: () => void
        }) => { element: HTMLElement }
      }
    }
  }
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en, zh }
})

let mountContainer: HTMLDivElement | null = null
let vueApp: VueApp | null = null
let rootInstance: InstanceType<typeof Root> | null = null

const IMAGE_NODES = ['LoadImage', 'PreviewImage', 'SaveImage']

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
  previewMediaType?: string
}

function isImageNode(node: unknown): node is ImageNode {
  if (!node || typeof node !== 'object') return false
  const n = node as ImageNode
  return (
    n.previewMediaType === 'image' ||
    (n.previewMediaType !== 'video' && !!n.imgs?.length)
  )
}

function getImageUrlsFromNode(node: ImageNode): string[] {
  if (node.images?.length) {
    return node.images.map((img) => {
      const params = new URLSearchParams({
        filename: img.filename,
        type: img.type || 'input',
        subfolder: img.subfolder || ''
      })
      return api.apiURL(`/view?${params.toString()}`)
    })
  }

  if (node.imgs?.length) {
    return node.imgs.map((img) => img.src).filter(Boolean)
  }

  const imageWidget = node.widgets?.find((w) => w.name === 'image')
  if (imageWidget?.value) {
    const value = imageWidget.value
    const match = value.match(/^(.+?)(?:\s*\[(\w+)\])?$/)
    if (match) {
      const fullPath = match[1]
      const type = match[2] || 'input'
      const lastSlash = fullPath.lastIndexOf('/')
      const subfolder = lastSlash > -1 ? fullPath.substring(0, lastSlash) : ''
      const filename = lastSlash > -1 ? fullPath.substring(lastSlash + 1) : fullPath
      const params = new URLSearchParams({ filename, type, subfolder })
      return [api.apiURL(`/view?${params.toString()}`)]
    }
  }

  return []
}


async function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

async function exportNodeAsPSD(node: ImageNode): Promise<void> {
  const imageUrls = getImageUrlsFromNode(node)
  if (imageUrls.length === 0) {
    console.error('[Polotno] No images found in node')
    return
  }

  try {
    const firstImg = await loadImageElement(imageUrls[0])
    const psdWidth = firstImg.width
    const psdHeight = firstImg.height

    const compositeCanvas = document.createElement('canvas')
    compositeCanvas.width = psdWidth
    compositeCanvas.height = psdHeight
    const compositeCtx = compositeCanvas.getContext('2d')!

    const layers = []

    for (let i = 0; i < imageUrls.length; i++) {
      const img = i === 0 ? firstImg : await loadImageElement(imageUrls[i])
      const layerCanvas = document.createElement('canvas')
      layerCanvas.width = psdWidth
      layerCanvas.height = psdHeight
      const layerCtx = layerCanvas.getContext('2d')!

      layerCtx.drawImage(img, 0, 0, psdWidth, psdHeight)
      compositeCtx.drawImage(img, 0, 0, psdWidth, psdHeight)

      layers.push({
        name: imageUrls.length > 1 ? `Layer ${i + 1}` : 'Image',
        canvas: layerCanvas,
        left: 0,
        top: 0,
        right: psdWidth,
        bottom: psdHeight
      })
    }

    const psd = {
      width: psdWidth,
      height: psdHeight,
      canvas: compositeCanvas,
      children: layers
    }

    const psdBuffer = writePsd(psd)

    const blob = new Blob([psdBuffer], { type: 'application/octet-stream' })
    const downloadUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `comfyui-export-${Date.now()}.psd`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(downloadUrl)

    console.log('[Polotno] PSD exported successfully')
  } catch (error) {
    console.error('[Polotno] Failed to export PSD:', error)
  }
}

function ensurePolotnoInstance(): InstanceType<typeof Root> {
  if (rootInstance) {
    return rootInstance
  }

  mountContainer = document.createElement('div')
  mountContainer.id = 'polotno-canvas-editor-root'
  document.body.appendChild(mountContainer)

  vueApp = createApp(Root)
  vueApp.use(i18n)
  vueApp.use(PrimeVue)

  rootInstance = vueApp.mount(mountContainer) as InstanceType<typeof Root>
  rootInstance.setSaveCallback(handleSaveToComfyUI)

  return rootInstance
}

async function handleSaveToComfyUI(imageDataUrl: string, node: ImageNode): Promise<void> {
  try {
    const response = await fetch(imageDataUrl)
    const blob = await response.blob()

    const timestamp = Date.now()
    const filename = `polotno-${timestamp}.png`

    const formData = new FormData()
    formData.append('image', blob, filename)
    formData.append('type', 'input')
    formData.append('subfolder', 'polotno')
    formData.append('overwrite', 'true')

    const uploadResponse = await api.fetchApi('/upload/image', {
      method: 'POST',
      body: formData
    })

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload image')
    }

    const result = await uploadResponse.json()

    if (node) {
      const widgetValue = result.subfolder
        ? `${result.subfolder}/${result.name} [input]`
        : `${result.name} [input]`

      node.images = [{
        filename: result.name,
        subfolder: result.subfolder || '',
        type: 'input'
      }]

      const imageWidget = node.widgets?.find((w) => w.name === 'image') as
        | { name: string; value: string; options?: { values?: string[] }; callback?: (value: string) => void }
        | undefined

      if (imageWidget) {
        if (imageWidget.options?.values && !imageWidget.options.values.includes(widgetValue)) {
          imageWidget.options.values.push(widgetValue)
        }
        imageWidget.value = widgetValue

        const anyNode = node as { widgets?: unknown[]; widgets_values?: unknown[] }
        if (anyNode.widgets_values && anyNode.widgets) {
          const widgetIndex = (anyNode.widgets as { name: string }[]).findIndex((w) => w.name === 'image')
          if (widgetIndex >= 0) {
            anyNode.widgets_values[widgetIndex] = widgetValue
          }
        }

        const propsNode = node as { properties?: Record<string, unknown> }
        if (propsNode.properties) {
          propsNode.properties['image'] = widgetValue
        }

        imageWidget.callback?.(widgetValue)
      }

      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = imageDataUrl
      await new Promise((resolve) => { img.onload = resolve })
      node.imgs = [img]

      app.graph.setDirtyCanvas(true, true)
    }

    console.log('[Polotno] Image saved successfully:', result)
  } catch (error) {
    console.error('[Polotno] Failed to save image:', error)
    throw error
  }
}

function openPolotnoEditor(node?: ImageNode): void {
  const instance = ensurePolotnoInstance()

  if (node) {
    const imageUrls = getImageUrlsFromNode(node)
    if (imageUrls.length > 0) {
      instance.loadImages(imageUrls, node)
    } else {
      instance.openNew(node)
    }
  } else {
    instance.openNew()
  }
}

app.registerExtension({
  name: 'ComfyUI.PolotnoCanvasEditor',

  settings: [
    {
      id: 'Comfy.PolotnoCanvasEditor.ApiKey',
      category: ['Polotno Canvas Editor', 'API Key'],
      name: 'Polotno API Key',
      tooltip: 'Your Polotno API key. Get one from https://polotno.com. Leave empty for open-source/non-profit use.',
      type: 'text',
      defaultValue: ''
    },
    {
      id: 'Comfy.PolotnoCanvasEditor.DefaultWidth',
      category: ['Polotno Canvas Editor', 'Canvas'],
      name: 'Default Canvas Width',
      tooltip: 'Default width for new canvas',
      type: 'number',
      defaultValue: 1024
    },
    {
      id: 'Comfy.PolotnoCanvasEditor.DefaultHeight',
      category: ['Polotno Canvas Editor', 'Canvas'],
      name: 'Default Canvas Height',
      tooltip: 'Default height for new canvas',
      type: 'number',
      defaultValue: 1024
    }
  ],

  setup() {
    const { ComfyButton } = window.comfyAPI.button
    const button = new ComfyButton({
      icon: 'palette',
      tooltip: 'Polotno Canvas Editor',
      content: 'Polotno Canvas',
      action: () => openPolotnoEditor()
    })
    app.menu?.settingsGroup.append(button)
  },

  getNodeMenuItems(node: unknown) {
    const typedNode = node as { constructor?: { comfyClass?: string } }
    const nodeClass = typedNode?.constructor?.comfyClass

    if (!nodeClass || !IMAGE_NODES.includes(nodeClass)) {
      if (!isImageNode(node)) {
        return []
      }
    }

    const imageUrls = getImageUrlsFromNode(node as ImageNode)
    const count = imageUrls.length

    return [
      null,
      {
        content: count > 1 ? `Open in Polotno (${count} as layers)` : 'Open in Polotno Canvas Editor',
        callback: () => {
          openPolotnoEditor(node as ImageNode)
        }
      },
      {
        content: count > 1 ? `Export as PSD (${count} layers)` : 'Export as PSD',
        callback: () => {
          exportNodeAsPSD(node as ImageNode)
        }
      }
    ]
  }
})

export { openPolotnoEditor, exportNodeAsPSD }
