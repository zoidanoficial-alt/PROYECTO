"""Servidor local mínimo para Revela SL3.

Uso:  python3 serve.py      y abre http://localhost:8080
(Los módulos de JavaScript necesitan http://, no funcionan con file://)
"""
import functools
import http.server
import os
import socketserver
import sys
import webbrowser

PORT = next((int(a) for a in sys.argv[1:] if a.isdigit()), 8080)
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".webmanifest": "application/manifest+json",
        ".svg": "image/svg+xml",
    }


with socketserver.TCPServer(("", PORT), functools.partial(Handler, directory=ROOT)) as httpd:
    url = f"http://localhost:{PORT}"
    print(f"Revela SL3 en {url}  (Ctrl+C para salir)")
    if "--no-browser" not in sys.argv:
        webbrowser.open(url)
    httpd.serve_forever()
