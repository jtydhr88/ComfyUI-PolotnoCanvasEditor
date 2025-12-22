import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'

// Polotno imports
import { PolotnoContainer, SidePanelWrap, WorkspaceWrap } from 'polotno'
import { Toolbar } from 'polotno/toolbar/toolbar'
import { ZoomButtons } from 'polotno/toolbar/zoom-buttons'
import { SidePanel } from 'polotno/side-panel'
import { Workspace } from 'polotno/canvas/workspace'
import { createStore } from 'polotno/model/store'
import { DownloadButton } from 'polotno/toolbar/download-button'
import { Button, Menu, MenuItem, Popover } from '@blueprintjs/core'

// PSD export
import { writePsd } from 'ag-psd'

// Import Blueprint CSS (required for Polotno UI)
import '@blueprintjs/core/lib/css/blueprint.css'

// Get params from URL
const urlParams = new URLSearchParams(window.location.search)
const apiKey = urlParams.get('apiKey') || '123'
const initialTheme = urlParams.get('theme') || 'dark'

// Create store
const store = createStore({
  key: apiKey,
  showCredit: !urlParams.get('apiKey')
})

// Set initial size
const width = parseInt(urlParams.get('width')) || 1024
const height = parseInt(urlParams.get('height')) || 1024
store.setSize(width, height)
store.addPage()

// Export store for external access
window.polotnoStore = store

// Export PSD function
async function exportPSD(download = true) {
  try {
    const page = store.pages[0]
    if (!page) {
      throw new Error('No page found')
    }

    const psdWidth = store.width
    const psdHeight = store.height

    // Create composite canvas
    const compositeCanvas = document.createElement('canvas')
    compositeCanvas.width = psdWidth
    compositeCanvas.height = psdHeight
    const compositeCtx = compositeCanvas.getContext('2d')

    // Build layers from polotno elements
    const layers = []

    for (const element of page.children) {
      if (element.type === 'image' && element.src) {
        try {
          const img = await loadImageElement(element.src)
          const layerCanvas = document.createElement('canvas')
          layerCanvas.width = psdWidth
          layerCanvas.height = psdHeight
          const layerCtx = layerCanvas.getContext('2d')

          // Draw image with element's transform
          layerCtx.save()
          layerCtx.globalAlpha = element.opacity !== undefined ? element.opacity : 1
          layerCtx.translate(element.x + element.width / 2, element.y + element.height / 2)
          layerCtx.rotate((element.rotation || 0) * Math.PI / 180)
          layerCtx.drawImage(img, -element.width / 2, -element.height / 2, element.width, element.height)
          layerCtx.restore()

          // Also draw to composite
          compositeCtx.save()
          compositeCtx.globalAlpha = element.opacity !== undefined ? element.opacity : 1
          compositeCtx.translate(element.x + element.width / 2, element.y + element.height / 2)
          compositeCtx.rotate((element.rotation || 0) * Math.PI / 180)
          compositeCtx.drawImage(img, -element.width / 2, -element.height / 2, element.width, element.height)
          compositeCtx.restore()

          layers.push({
            name: element.name || `Layer ${layers.length + 1}`,
            canvas: layerCanvas,
            left: 0,
            top: 0,
            right: psdWidth,
            bottom: psdHeight,
            opacity: element.opacity !== undefined ? element.opacity : 1,
            blendMode: 'normal'
          })
        } catch (err) {
          console.warn('[Polotno] Failed to process layer:', element.name, err)
        }
      } else if (element.type === 'text') {
        // Render text element to canvas
        const layerCanvas = document.createElement('canvas')
        layerCanvas.width = psdWidth
        layerCanvas.height = psdHeight
        const layerCtx = layerCanvas.getContext('2d')

        layerCtx.save()
        layerCtx.globalAlpha = element.opacity !== undefined ? element.opacity : 1
        layerCtx.translate(element.x + element.width / 2, element.y + element.height / 2)
        layerCtx.rotate((element.rotation || 0) * Math.PI / 180)
        layerCtx.font = `${element.fontSize || 16}px ${element.fontFamily || 'Arial'}`
        layerCtx.fillStyle = element.fill || '#000000'
        layerCtx.textAlign = 'center'
        layerCtx.textBaseline = 'middle'
        layerCtx.fillText(element.text || '', 0, 0)
        layerCtx.restore()

        // Also draw to composite
        compositeCtx.save()
        compositeCtx.globalAlpha = element.opacity !== undefined ? element.opacity : 1
        compositeCtx.translate(element.x + element.width / 2, element.y + element.height / 2)
        compositeCtx.rotate((element.rotation || 0) * Math.PI / 180)
        compositeCtx.font = `${element.fontSize || 16}px ${element.fontFamily || 'Arial'}`
        compositeCtx.fillStyle = element.fill || '#000000'
        compositeCtx.textAlign = 'center'
        compositeCtx.textBaseline = 'middle'
        compositeCtx.fillText(element.text || '', 0, 0)
        compositeCtx.restore()

        layers.push({
          name: element.name || element.text?.substring(0, 20) || `Text ${layers.length + 1}`,
          canvas: layerCanvas,
          left: 0,
          top: 0,
          right: psdWidth,
          bottom: psdHeight,
          opacity: element.opacity !== undefined ? element.opacity : 1,
          blendMode: 'normal'
        })
      }
    }

    // If no layers, use composite image from polotno
    if (layers.length === 0) {
      const dataUrl = await store.toDataURL({ mimeType: 'image/png', pixelRatio: 1 })
      const img = await loadImageElement(dataUrl)
      compositeCtx.drawImage(img, 0, 0)
      layers.push({
        name: 'Layer 1',
        canvas: compositeCanvas,
        left: 0,
        top: 0,
        right: psdWidth,
        bottom: psdHeight
      })
    }

    // Create PSD structure
    const psd = {
      width: psdWidth,
      height: psdHeight,
      canvas: compositeCanvas,
      children: layers
    }

    // Write PSD
    const psdBuffer = writePsd(psd)

    if (download) {
      // Download as file
      const blob = new Blob([psdBuffer], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `polotno-export-${Date.now()}.psd`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      return null
    } else {
      // Return as ArrayBuffer for postMessage
      return psdBuffer
    }
  } catch (error) {
    console.error('[Polotno] Failed to export PSD:', error)
    throw error
  }
}

// Expose exportPSD globally
window.exportPSD = exportPSD

// Custom ActionControls with Save to ComfyUI and Export PSD buttons
const ActionControls = ({ store }) => {
  const [saving, setSaving] = useState(false)
  const [exportingPSD, setExportingPSD] = useState(false)

  const handleSaveToComfyUI = async () => {
    setSaving(true)
    try {
      const dataUrl = await store.toDataURL({
        mimeType: 'image/png',
        pixelRatio: 1
      })
      window.parent.postMessage({ type: 'exportResult', dataUrl }, '*')
    } catch (error) {
      console.error('[Polotno] Failed to export:', error)
      window.parent.postMessage({ type: 'error', message: 'Failed to export image' }, '*')
    } finally {
      setSaving(false)
    }
  }

  const handleExportPSD = async () => {
    setExportingPSD(true)
    try {
      await exportPSD(true)
    } catch (error) {
      console.error('[Polotno] Failed to export PSD:', error)
      window.parent.postMessage({ type: 'error', message: 'Failed to export PSD' }, '*')
    } finally {
      setExportingPSD(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <DownloadButton store={store} />
      <Button
        intent="primary"
        icon="document"
        loading={exportingPSD}
        onClick={handleExportPSD}
      >
        Export PSD
      </Button>
      <Button
        intent="success"
        icon="upload"
        loading={saving}
        onClick={handleSaveToComfyUI}
      >
        Save to ComfyUI
      </Button>
    </div>
  )
}

// App component
function App() {
  const [theme, setTheme] = useState(initialTheme)

  useEffect(() => {
    const handleMessage = async (event) => {
      const { type, data } = event.data || {}

      switch (type) {
        case 'loadImage':
          await loadImages([data.url])
          break
        case 'loadImages':
          await loadImages(data.urls)
          break
        case 'exportImage':
          await exportImage()
          break
        case 'exportPSD':
          await handleExportPSDMessage()
          break
        case 'clear':
          clearCanvas()
          break
        case 'setSize':
          store.setSize(data.width, data.height)
          break
        case 'setTheme':
          setTheme(data.theme)
          break
      }
    }

    window.addEventListener('message', handleMessage)
    window.parent.postMessage({ type: 'ready' }, '*')

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('bp5-dark')
    } else {
      document.body.classList.remove('bp5-dark')
    }
  }, [theme])

  return (
    <PolotnoContainer style={{ width: '100%', height: '100vh' }}>
      <SidePanelWrap>
        <SidePanel store={store} />
      </SidePanelWrap>
      <WorkspaceWrap>
        <Toolbar store={store} components={{ ActionControls }} />
        <Workspace store={store} />
        <ZoomButtons store={store} />
      </WorkspaceWrap>
    </PolotnoContainer>
  )
}

// Helper: Load image element
async function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

// Load multiple images as layers
async function loadImages(urls) {
  if (!urls || urls.length === 0) return

  try {
    const page = store.pages[0]
    if (!page) return

    // Clear existing elements
    page.children.forEach((child) => {
      page.removeElement(child.id)
    })

    // Load first image to set canvas size
    const firstImg = await loadImageElement(urls[0])
    store.setSize(firstImg.width, firstImg.height)

    // Add all images as layers
    for (let i = 0; i < urls.length; i++) {
      const img = i === 0 ? firstImg : await loadImageElement(urls[i])
      page.addElement({
        type: 'image',
        src: urls[i],
        x: 0,
        y: 0,
        width: img.width,
        height: img.height,
        name: urls.length > 1 ? `Batch ${i + 1}` : 'Image'
      })
    }

    window.parent.postMessage({
      type: urls.length > 1 ? 'imagesLoaded' : 'imageLoaded',
      count: urls.length,
      width: firstImg.width,
      height: firstImg.height
    }, '*')
  } catch (error) {
    console.error('[Polotno] Failed to load images:', error)
    window.parent.postMessage({ type: 'error', message: 'Failed to load images' }, '*')
  }
}

// Export canvas as image
async function exportImage() {
  try {
    const dataUrl = await store.toDataURL({
      mimeType: 'image/png',
      pixelRatio: 1
    })
    window.parent.postMessage({ type: 'exportResult', dataUrl }, '*')
  } catch (error) {
    console.error('[Polotno] Failed to export:', error)
    window.parent.postMessage({ type: 'error', message: 'Failed to export image' }, '*')
  }
}

// Handle export PSD message from parent
async function handleExportPSDMessage() {
  try {
    const psdBuffer = await exportPSD(false)
    // Convert ArrayBuffer to base64 for postMessage
    const bytes = new Uint8Array(psdBuffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)
    window.parent.postMessage({ type: 'exportPSDResult', data: base64 }, '*')
  } catch (error) {
    console.error('[Polotno] Failed to export PSD:', error)
    window.parent.postMessage({ type: 'error', message: 'Failed to export PSD' }, '*')
  }
}

// Clear canvas
function clearCanvas() {
  const page = store.pages[0]
  if (page) {
    page.children.forEach((child) => {
      page.removeElement(child.id)
    })
  }
}

// Render app
const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<App />)
