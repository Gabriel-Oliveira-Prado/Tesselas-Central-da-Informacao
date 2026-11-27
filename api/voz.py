"""Leitura dinâmica na Vercel com as mesmas vozes do servidor local."""
import hashlib
import json
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from tempfile import gettempdir
from threading import Lock
from urllib.request import urlopen

from scripts.sintetizar import carregar, sintetizar


modelo = None
trava = Lock()
base = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
arquivos = {
    "kokoro-v1.0.int8.onnx": "6e742170d309016e5891a994e1ce1559c702a2ccd0075e67ef7157974f6406cb",
    "voices-v1.0.bin": "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d",
}


def modelo_da_instancia():
    global modelo
    if modelo is None:
        pasta = Path(gettempdir()) / "central-kokoro"
        pasta.mkdir(exist_ok=True)
        for nome, esperado in arquivos.items():
            destino = pasta / nome
            if destino.is_file():
                with destino.open("rb") as existente:
                    if hashlib.file_digest(existente, "sha256").hexdigest() == esperado:
                        continue
            parcial = destino.with_suffix(".part")
            digest = hashlib.sha256()
            with urlopen(base + nome, timeout=40) as origem, parcial.open("wb") as arquivo:
                while bloco := origem.read(1024 * 1024):
                    digest.update(bloco)
                    arquivo.write(bloco)
            if digest.hexdigest() != esperado:
                raise ValueError("Modelo de voz inválido")
            parcial.replace(destino)
        modelo = carregar(pasta)
    return modelo


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            tamanho = int(self.headers.get("Content-Length", "0"))
            if not 0 < tamanho <= 4096:
                return self.send_error(413)
            pedido = json.loads(self.rfile.read(tamanho))
            voz, texto = pedido["voz"], pedido["texto"]
            if voz not in ("dora", "alex") or not isinstance(texto, str) or not 0 < len(texto.strip()) <= 500:
                return self.send_error(400)
        except (ValueError, KeyError, TypeError):
            return self.send_error(400)
        try:
            with trava:
                audio = sintetizar(modelo_da_instancia(), texto, voz)
        except Exception:
            return self.send_error(503, "Voz indisponivel")
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(audio)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(audio)
