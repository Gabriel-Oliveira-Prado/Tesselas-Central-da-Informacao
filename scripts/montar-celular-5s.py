"""Monta cinco telas reais da demonstração em um vídeo e GIF de cinco segundos."""
from pathlib import Path
import re
import subprocess

import imageio_ffmpeg

ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
pasta = Path("dist/demo-celular").resolve()
destino = Path("docs/gravacoes").resolve()
destino.mkdir(parents=True, exist_ok=True)

quadros = []
for numero in range(1, 6):
    quadros.extend([f"file '{numero}.png'", "duration 1"])
quadros.append("file '5.png'")
(pasta / "quadros.txt").write_text("\n".join(quadros), encoding="utf-8")
probe = subprocess.run([ffmpeg, "-i", str(pasta / "narracao.wav")], capture_output=True, text=True)
duracao = re.search(r"Duration: (\d+):(\d+):([\d.]+)", probe.stderr)
if not duracao:
    raise ValueError("Não consegui medir a narração.")
horas, minutos, segundos = map(float, duracao.groups())
fator = (horas * 3600 + minutos * 60 + segundos) / 5
# A leitura acompanha o resumo visual e termina junto dos cinco segundos.
voz = f"atempo={max(0.5, min(2, fator))},apad"
def executar(argumentos):
    subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", *argumentos], cwd=pasta, check=True)

executar(["-f", "concat", "-safe", "0", "-i", "quadros.txt", "-i", "narracao.wav",
          "-t", "5", "-vf", "fps=20,format=yuv420p", "-af", voz, "-c:v", "libx264",
          "-preset", "fast", "-crf", "22", "-c:a", "aac", "-movflags", "+faststart",
          str(destino / "celular-5s.mp4")])
executar(["-i", str(destino / "celular-5s.mp4"), "-t", "5", "-filter_complex",
          "[0:v]fps=10,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer",
          "-loop", "0", str(destino / "celular-5s.gif")])
(destino / "celular-5s.vtt").write_text(
    "WEBVTT\n\n00:00.000 --> 00:05.000\nNo celular, envie uma captura. Fale e encerre para pesquisar.\n",
    encoding="utf-8")
print("Vídeo narrado e GIF com cinco segundos em docs/gravacoes.")
