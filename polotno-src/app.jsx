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
import { Button } from '@blueprintjs/core'

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

// Custom ActionControls with Save to ComfyUI button
const ActionControls = ({ store }) => {
  const [saving, setSaving] = useState(false)

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

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <DownloadButton store={store} />
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
