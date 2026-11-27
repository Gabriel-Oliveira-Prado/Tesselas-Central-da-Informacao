"""Sintetiza português brasileiro localmente. O protocolo usa uma linha JSON por trecho."""
import base64
import io
import json
from pathlib import Path
import sys
import wave

import numpy as np
import onnxruntime as ort
from kokoro_onnx import Kokoro

PASTA = Path(__file__).resolve().parents[1] / "dist" / "modelo-voz"


def carregar():
    opcoes = ort.SessionOptions()
    opcoes.intra_op_num_threads = 2
    opcoes.inter_op_num_threads = 1
    sessao = ort.InferenceSession(str(PASTA / "kokoro-v1.0.int8.onnx"), opcoes, providers=["CPUExecutionProvider"])
    return Kokoro.from_session(sessao, str(PASTA / "voices-v1.0.bin"))


def sintetizar(modelo, texto, voz):
    onda, taxa = modelo.create(texto, voice={"dora": "pf_dora", "alex": "pm_alex"}[voz], lang="pt-br")
    destino = io.BytesIO()
    with wave.open(destino, "wb") as arquivo:
        arquivo.setparams((1, 2, taxa, 0, "NONE", "not compressed"))
        arquivo.writeframes((np.clip(onda, -1, 1) * 32767).astype("<i2").tobytes())
    return destino.getvalue()


if __name__ == "__main__":
    modelo = carregar()
    for linha in sys.stdin.buffer:
        try:
            pedido = json.loads(linha)
            audio = sintetizar(modelo, pedido["texto"], pedido["voz"])
            print(base64.b64encode(audio).decode("ascii"), flush=True)
        except Exception:
            print("", flush=True)
