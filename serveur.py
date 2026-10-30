#!/usr/bin/env python3
"""Foulée — serveur local.

Sert l'application sur http://localhost:8777 (écoute sur 127.0.0.1 uniquement) et ouvre le navigateur.
Au premier lancement, télécharge MediaPipe Tasks Vision et les modèles de pose dans vendor/ ;
ensuite l'application fonctionne entièrement hors ligne.

Options : [port] --no-browser --offline (ne rien télécharger)
"""
import http.server, os, socketserver, sys, threading, urllib.request, webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
args = [a for a in sys.argv[1:] if not a.startswith('--')]
PORT = int(args[0]) if args else 8777

MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14'
MODELS = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker'
DEPS = {
    'vendor/vision_bundle.mjs': f'{MP}/vision_bundle.mjs',
    'vendor/wasm/vision_wasm_internal.js': f'{MP}/wasm/vision_wasm_internal.js',
    'vendor/wasm/vision_wasm_internal.wasm': f'{MP}/wasm/vision_wasm_internal.wasm',
    'vendor/wasm/vision_wasm_nosimd_internal.js': f'{MP}/wasm/vision_wasm_nosimd_internal.js',
    'vendor/wasm/vision_wasm_nosimd_internal.wasm': f'{MP}/wasm/vision_wasm_nosimd_internal.wasm',
    'vendor/models/pose_landmarker_full.task': f'{MODELS}/pose_landmarker_full/float16/1/pose_landmarker_full.task',
    'vendor/models/pose_landmarker_heavy.task': f'{MODELS}/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
}


def fetch_deps():
    missing = {p: u for p, u in DEPS.items() if not os.path.exists(p)}
    if not missing:
        return
    print('Premier lancement : téléchargement de MediaPipe et des modèles de pose (≈ 60 Mo)…')
    for path, url in missing.items():
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = path + '.part'
        try:
            print(f'  {os.path.basename(path)}', end='', flush=True)
            with urllib.request.urlopen(url, timeout=60) as r, open(tmp, 'wb') as f:
                while chunk := r.read(1 << 16):
                    f.write(chunk)
            os.replace(tmp, path)
            print(' ✓')
        except Exception as e:  # l'application se rabat sur le CDN si un fichier manque
            print(f' échec ({e})')
            if os.path.exists(tmp):
                os.remove(tmp)


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.mjs': 'text/javascript', '.js': 'text/javascript', '.wasm': 'application/wasm',
                      '.task': 'application/octet-stream'}

    def log_message(self, *args):
        pass


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    if '--offline' not in sys.argv:
        fetch_deps()
    with Server(('127.0.0.1', PORT), Handler) as srv:
        url = f'http://localhost:{PORT}/'
        print(f'Foulée tourne sur {url}  (Ctrl+C pour arrêter)')
        if '--no-browser' not in sys.argv:
            threading.Timer(0.8, lambda: webbrowser.open(url)).start()
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            print('\nArrêt.')
