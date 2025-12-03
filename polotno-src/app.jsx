import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'

import { PolotnoContainer, SidePanelWrap, WorkspaceWrap } from 'polotno'
import { Toolbar } from 'polotno/toolbar/toolbar'
import { ZoomButtons } from 'polotno/toolbar/zoom-buttons'
import { SidePanel } from 'polotno/side-panel'
import { Workspace } from 'polotno/canvas/workspace'
import { createStore } from 'polotno/model/store'
import { DownloadButton } from 'polotno/toolbar/download-button'
import { Button } from '@blueprintjs/core'

import '@blueprintjs/core/lib/css/blueprint.css'

const urlParams = new URLSearchParams(window.location.search)
const apiKey = urlParams.get('apiKey') || 'nFA5H9elEytDyPyvKL7T'

const store = createStore({
  key: apiKey,
  showCredit: !urlParams.get('apiKey')
})

const width = parseInt(urlParams.get('width')) || 1024
const height = parseInt(urlParams.get('height')) || 1024
store.setSize(width, height)
store.addPage()

window.polotnoStore = store

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

function App() {
  useEffect(() => {
    const handleMessage = async (event) => {
      const { type, data } = event.data || {}

      switch (type) {
        case 'loadImage':
          await loadImage(data.url)
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
      }
    }

    window.addEventListener('message', handleMessage)

    window.parent.postMessage({ type: 'ready' }, '*')

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

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

async function loadImage(url) {
  if (!url) return

  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = url
    })

    store.setSize(img.width, img.height)

    const page = store.pages[0]
    if (page) {
      page.children.forEach((child) => {
        page.removeElement(child.id)
      })

      page.addElement({
        type: 'image',
        src: url,
        x: 0,
        y: 0,
        width: img.width,
        height: img.height
      })
    }

    window.parent.postMessage({ type: 'imageLoaded', width: img.width, height: img.height }, '*')
  } catch (error) {
    console.error('[Polotno] Failed to load image:', error)
    window.parent.postMessage({ type: 'error', message: 'Failed to load image' }, '*')
  }
}

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

function clearCanvas() {
  const page = store.pages[0]
  if (page) {
    page.children.forEach((child) => {
      page.removeElement(child.id)
    })
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<App />)
