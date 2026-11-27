import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const python = process.env.CENTRAL_VOZ_PYTHON || fileURLToPath(new URL(process.platform === 'win32'
  ? '../dist/voz-ambiente/Scripts/python.exe' : '../dist/voz-ambiente/bin/python', import.meta.url));
let processo;
let atual;
const fila = [];

function proximo() {
  if (atual) return;
  while (fila.length && fila[0].res.destroyed) fila.shift();
  if (!fila.length) return;
  atual = fila.shift();
  if (!processo) {
    const filho = spawn(python, [fileURLToPath(new URL('sintetizar.py', import.meta.url))], {windowsHide:true, stdio:['pipe','pipe','ignore']});
    processo = filho;
    const linhas = createInterface({ input:filho.stdout });
    linhas.on('line', linha => {
      if (processo !== filho || !atual) return;
      const { res, limite } = atual;
      clearTimeout(limite);
      atual = null;
      if (!res.destroyed) {
        if (linha) res.writeHead(200, {'Content-Type':'audio/wav','Cache-Control':'no-store'}).end(Buffer.from(linha,'base64'));
        else res.writeHead(503).end();
      }
      proximo();
    });
    function falhou() {
      if (processo !== filho) return;
      processo = null;
      for (const item of [atual, ...fila.splice(0)]) {
        if (!item) continue;
        clearTimeout(item.limite);
        if (!item.res.destroyed) item.res.writeHead(503).end();
      }
      atual = null;
    }
    filho.once('error', falhou);
    filho.once('close', falhou);
    filho.stdin.on('error', () => filho.kill());
  }
  atual.limite = setTimeout(() => processo?.kill(), 45000);
  processo.stdin.write(JSON.stringify(atual.pedido) + '\n');
}

export async function atenderVoz(req, res) {
  if (req.method !== 'POST' || req.headers['content-type']?.split(';')[0] !== 'application/json') return res.writeHead(415).end();
  const partes = [];
  let tamanho = 0;
  for await (const parte of req) {
    tamanho += parte.length;
    if (tamanho > 4096) return res.writeHead(413).end();
    partes.push(parte);
  }
  let pedido;
  try { pedido = JSON.parse(Buffer.concat(partes).toString()); } catch { return res.writeHead(400).end(); }
  if (!['alex','dora'].includes(pedido?.voz) || typeof pedido.texto !== 'string' || !pedido.texto.trim() || pedido.texto.length > 500) return res.writeHead(400).end();
  if (fila.length >= 5) return res.writeHead(429).end();
  fila.push({pedido:{voz:pedido.voz, texto:pedido.texto}, res});
  proximo();
}
