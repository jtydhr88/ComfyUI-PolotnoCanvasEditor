import { createApp, type App as VueApp } from 'vue'
import PrimeVue from 'primevue/config'
import { createI18n } from 'vue-i18n'
import Root from './Root.vue'
import en from '../locales/en/main.json'
import zh from '../locales/zh/main.json'

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

// i18n setup
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en, zh }
})

// Vue app instance management
let mountContainer: HTMLDivElement | null = null
let vueApp: VueApp | null = null
let rootInstance: InstanceType<typeof Root> | null = null

// Image nodes that support the editor
const IMAGE_NODES = [
  'LoadImage',
  'PreviewImage',
  'SaveImage',
  'LoadImageMask',
  'ImageScale',
  'ImageInvert',
  'ImageBatch',
  'ImagePadForOutpaint'
]

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

function getImageUrlFromNode(node: ImageNode): string | null {
  // Try node.images first (server-stored images)
  if (node.images?.[0]) {
    const img = node.images[0]
    const params = new URLSearchParams({
      filename: img.filename,
      type: img.type || 'input',
      subfolder: img.subfolder || ''
    })
    return api.apiURL(`/view?${params.toString()}`)
  }

  // Try node.imgs (HTMLImageElement array)
  if (node.imgs?.[0]?.src) {
    return node.imgs[0].src
  }

  // Try image widget
  const imageWidget = node.widgets?.find((w) => w.name === 'image')
  if (imageWidget?.value) {
    const value = imageWidget.value
    // Parse format: "subfolder/filename [type]" or "filename"
    const match = value.match(/^(.+?)(?:\s*\[(\w+)\])?$/)
    if (match) {
      const fullPath = match[1]
      const type = match[2] || 'input'
      const lastSlash = fullPath.lastIndexOf('/')
      const subfolder = lastSlash > -1 ? fullPath.substring(0, lastSlash) : ''
      const filename = lastSlash > -1 ? fullPath.substring(lastSlash + 1) : fullPath

      const params = new URLSearchParams({
        filename,
        type,
        subfolder
      })
      return api.apiURL(`/view?${params.toString()}`)
    }
  }

  return null
}

function ensurePolotnoInstance(): InstanceType<typeof Root> {
  if (rootInstance) {
    return rootInstance
  }

  // Create mount container
  mountContainer = document.createElement('div')
  mountContainer.id = 'polotno-canvas-editor-root'
  document.body.appendChild(mountContainer)

  // Create Vue app
  vueApp = createApp(Root)
  vueApp.use(i18n)
  vueApp.use(PrimeVue)

  rootInstance = vueApp.mount(mountContainer) as InstanceType<typeof Root>

  // Set save callback
  rootInstance.setSaveCallback(handleSaveToComfyUI)

  return rootInstance
}

async function handleSaveToComfyUI(imageDataUrl: string, node: ImageNode): Promise<void> {
  try {
    // Convert data URL to blob
    const response = await fetch(imageDataUrl)
    const blob = await response.blob()

    // Generate filename with timestamp
    const timestamp = Date.now()
    const filename = `polotno-${timestamp}.png`

    // Upload to ComfyUI
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

    // Update node with new image reference
    if (node) {
      const widgetValue = result.subfolder
        ? `${result.subfolder}/${result.name}`
        : result.name

      // Update node.images
      node.images = [
        {
          filename: result.name,
          subfolder: result.subfolder || '',
          type: 'input'
        }
      ]

      // Update image widget if exists
      const imageWidget = node.widgets?.find((w) => w.name === 'image')
      if (imageWidget) {
        imageWidget.value = widgetValue
      }

      // Refresh node preview
      const img = new Image()
      img.src = imageDataUrl
      await new Promise((resolve) => {
        img.onload = resolve
      })
      node.imgs = [img]

      // Mark graph as dirty
      app.graph.setDirtyCanvas(true)
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
    const imageUrl = getImageUrlFromNode(node)
    if (imageUrl) {
      instance.loadImage(imageUrl, node)
    } else {
      instance.openNew(node)
    }
  } else {
    instance.openNew()
  }
}

// Register extension
app.registerExtension({
  name: 'ComfyUI.PolotnoCanvasEditor',

  settings: [
    {
      id: 'Comfy.PolotnoCanvasEditor.ApiKey',
      category: ['Polotno Canvas Editor', 'API Key'],
      name: 'Polotno API Key',
      tooltip:
        'Your Polotno API key. Get one from https://polotno.com. Leave empty for open-source/non-profit use.',
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

    // Add button to top menu
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

    // Check if it's an image node
    if (!nodeClass || !IMAGE_NODES.includes(nodeClass)) {
      // Also check if node has images
      if (!isImageNode(node)) {
        return []
      }
    }

    return [
      null, // Separator
      {
        content: 'Open in Polotno Canvas Editor',
        callback: () => {
          openPolotnoEditor(node as ImageNode)
        }
      }
    ]
  }
})

export { openPolotnoEditor }
