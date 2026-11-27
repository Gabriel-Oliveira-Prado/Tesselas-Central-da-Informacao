"""Execute uma vez no servidor com Python 3.12 para habilitar a leitura de textos livres."""
import hashlib
from pathlib import Path
import os
import subprocess
import urllib.request
import venv

dist = Path(__file__).resolve().parents[1] / "dist"
ambiente = dist / "voz-ambiente"
venv.EnvBuilder(with_pip=True).create(ambiente)
python = ambiente / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
subprocess.run([str(python), "-m", "pip", "install", "kokoro-onnx==0.4.9"], check=True)
base = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
pasta = dist / "modelo-voz"
pasta.mkdir(exist_ok=True)
for nome, digest in {
    "kokoro-v1.0.int8.onnx": "6e742170d309016e5891a994e1ce1559c702a2ccd0075e67ef7157974f6406cb",
    "voices-v1.0.bin": "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d",
}.items():
    destino = pasta / nome
    if destino.exists() and hashlib.sha256(destino.read_bytes()).hexdigest() == digest:
        continue
    parcial = destino.with_suffix(".part")
    urllib.request.urlretrieve(base + nome, parcial)
    if hashlib.sha256(parcial.read_bytes()).hexdigest() != digest:
        raise ValueError("O arquivo recebido não corresponde ao modelo esperado.")
    parcial.replace(destino)
