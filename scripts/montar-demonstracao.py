"""Monta a captura do Playwright com as falas do teste e legendas selecionáveis."""
import json
from pathlib import Path
import subprocess
import sys
import wave

import imageio_ffmpeg

ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
pasta = Path(sys.argv[1]).resolve()
cenas = json.loads((pasta / "cenas.json").read_text(encoding="utf-8"))
destino = Path("docs/gravacoes").resolve()


def executar(argumentos, local):
    subprocess.run([ffmpeg, "-loglevel", "error", "-y", *argumentos], cwd=local, check=True)


def tempo(ms):
    h, resto = divmod(ms, 3600000)
    m, resto = divmod(resto, 60000)
    s, frac = divmod(resto, 1000)
    return f"{h:02}:{m:02}:{s:02}.{frac:03}"


inicio = 0
lista = []
legendas = ["WEBVTT", ""]
for i, cena in enumerate(cenas, start=1):
    trecho = Path(cena["pasta"])
    executar(["-i", "som", "-ar", "48000", "-ac", "1", "som.wav"], trecho)
    with wave.open(str(trecho / "som.wav")) as audio:
        duracao_voz = audio.getnframes() / audio.getframerate()
    quadros = cena["quadros"]
    base = quadros[0]["ms"]
    duracao = max((quadros[-1]["ms"] - base) / 1000 + 0.55, duracao_voz + 0.65)
    # Cada segmento termina no limite de um quadro. O VTT usa a mesma base temporal.
    quadros_total = int(duracao * 20 + 1)
    duracao = quadros_total / 20
    entradas = []
    for j, quadro in enumerate(quadros):
        fim = quadros[j + 1]["ms"] if j + 1 < len(quadros) else base + duracao * 1000
        entradas += [f"file '{quadro['arquivo']}'", f"duration {(fim - quadro['ms']) / 1000:.4f}"]
    entradas.append(f"file '{quadros[-1]['arquivo']}'")
    (trecho / "quadros.txt").write_text("\n".join(entradas), encoding="utf-8")
    executar(["-f", "concat", "-safe", "0", "-i", "quadros.txt", "-i", "som.wav", "-t", str(duracao),
              "-vf", "fps=20,format=yuv420p", "-af", "apad", "-c:v", "libx264", "-threads", "2",
              "-preset", "fast", "-crf", "24", "-c:a", "aac", "-b:a", "96k", "cena.mp4"], trecho)
    lista.append(f"file '{(trecho / 'cena.mp4').as_posix()}'")
    fim = inicio + quadros_total * 50
    legendas += [f"{tempo(inicio)} --> {tempo(fim)}", cena["texto"], ""]
    inicio = fim
(pasta / "videos.txt").write_text("\n".join(lista), encoding="utf-8")
vtt = destino / "demonstracao.vtt"
vtt.write_text("\n".join(legendas), encoding="utf-8")
executar(["-f", "concat", "-safe", "0", "-i", "videos.txt", "-i", str(vtt),
          "-map", "0:v", "-map", "0:a", "-map", "1:s", "-c", "copy", "-c:s", "mov_text",
          "-metadata:s:s:0", "language=por", "-disposition:s:0", "default", "-movflags", "+faststart",
          str(destino / "demonstracao.mp4")], pasta)
print(f"{len(cenas)} cenas, {inicio/1000:.1f} segundos, vídeo com áudio e legendas.")
