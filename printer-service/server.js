/* NeoScale Printer Service - ponte HTTP -> impressora térmica TCP 9100.
   O navegador envia ESC/POS em application/octet-stream para /print.
   Cabeçalhos: X-Printer-IP e X-Printer-Port.
*/
const http = require('http');
const net = require('net');
const os = require('os');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 9100);
const DEFAULT_PRINTER_IP = process.env.PRINTER_IP || '';
const DEFAULT_PRINTER_PORT = Number(process.env.PRINTER_PORT || 9100);
const SERVICE_KEY = process.env.PRINTER_SERVICE_KEY || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';

function headers(origin = '') {
  const allowed = ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : '';
  return {
    'Content-Type':'application/json; charset=utf-8',
    ...(allowed ? {'Access-Control-Allow-Origin':allowed, 'Vary':'Origin'} : {}),
    'Access-Control-Allow-Headers':'Content-Type,X-Printer-IP,X-Printer-Port,X-Printer-Key',
    'Access-Control-Allow-Methods':'POST,GET,OPTIONS'
  };
}

function json(res, status, data, origin) {
  res.writeHead(status, headers(origin));
  res.end(JSON.stringify(data));
}

function enviar(ip, port, body) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let terminou = false;
    const fim = (erro) => { if (terminou) return; terminou=true; socket.destroy(); erro ? reject(erro) : resolve(); };
    socket.setTimeout(7000, () => fim(new Error('Tempo esgotado ao conectar na impressora.')));
    socket.once('error', fim);
    socket.connect(port, ip, () => socket.end(body, () => fim()));
  });
}

const server = http.createServer((req, res) => {
  const origin = String(req.headers.origin || '');
  if (req.method === 'OPTIONS') return json(res, 204, {}, origin);
  if (req.method === 'GET' && req.url === '/health') return json(res, 200, {ok:true, service:'NeoScale Printer Service', host:os.hostname()}, origin);
  if (req.method !== 'POST' || !req.url.startsWith('/print')) return json(res, 404, {ok:false,error:'Not Found'}, origin);
  if (!SERVICE_KEY) return json(res, 503, {ok:false,error:'Defina PRINTER_SERVICE_KEY antes de iniciar o serviço.'}, origin);
  if (req.headers['x-printer-key'] !== SERVICE_KEY) return json(res, 401, {ok:false,error:'Chave de impressão inválida.'}, origin);

  const ip = String(req.headers['x-printer-ip'] || DEFAULT_PRINTER_IP).trim();
  const port = Number(req.headers['x-printer-port'] || DEFAULT_PRINTER_PORT);
  if (!DEFAULT_PRINTER_IP) return json(res, 503, {ok:false,error:'Defina PRINTER_IP para restringir o destino de impressão.'}, origin);
  if (ip !== DEFAULT_PRINTER_IP) return json(res, 403, {ok:false,error:'A impressora solicitada não é autorizada.'}, origin);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || port !== DEFAULT_PRINTER_PORT) return json(res, 400, {ok:false,error:'Porta de impressão não autorizada.'}, origin);

  const chunks=[]; let total=0;
  req.on('data', chunk => { total += chunk.length; if (total <= 1024*1024) chunks.push(chunk); });
  req.on('end', async () => {
    if (total === 0) return json(res,400,{ok:false,error:'Corpo da impressão vazio.'},origin);
    if (total > 1024*1024) return json(res,413,{ok:false,error:'Arquivo de impressão muito grande.'},origin);
    try { await enviar(ip,port,Buffer.concat(chunks)); json(res,200,{ok:true,ip,port,bytes:total},origin); }
    catch (e) { json(res,502,{ok:false,error:e.message},origin); }
  });
});

server.listen(PORT, HOST, () => console.log(`NeoScale Printer Service ouvindo em http://${HOST}:${PORT}`));
