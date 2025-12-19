"""
ComfyUI-PolotnoCanvasEditor
A ComfyUI extension that integrates Polotno Canvas Editor for advanced image editing.
"""

import os
import nodes
from aiohttp import web
from pathlib import Path

js_dir = os.path.join(os.path.dirname(os.path.realpath(__file__)), "js")
nodes.EXTENSION_WEB_DIRS["ComfyUI-PolotnoCanvasEditor"] = js_dir

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS']

from server import PromptServer

routes = PromptServer.instance.routes

POLOTNO_UI_PATH = Path(__file__).parent / 'polotno-ui'

@routes.get('/polotno')
async def serve_polotno_index(request):
    """Serve the main Polotno UI index.html with no-cache headers"""
    index_path = POLOTNO_UI_PATH / 'index.html'
    if index_path.exists():
        # Set no-cache headers so browser always checks for updates
        response = web.FileResponse(index_path)
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response
    else:
        return web.Response(
            text="Polotno UI not found. Please build polotno-src first: cd polotno-src && npm install && npm run build",
            status=404)


@routes.get('/polotno/{path:.*}')
async def serve_polotno_static(request):
    print("Serving Polotno static")
    """Serve static files for Polotno UI"""
    path = request.match_info.get('path', '')

    if '..' in path or path.startswith('/'):
        return web.Response(text="Invalid path", status=400)

    file_path = POLOTNO_UI_PATH / path

    if file_path.is_dir():
        index_path = file_path / 'index.html'
        if index_path.exists():
            return web.FileResponse(index_path)

    if file_path.exists() and file_path.is_file():
        return web.FileResponse(file_path)

    return web.Response(text="File not found", status=404)
