/* NeoScale Printer Service - ponte HTTP -> impressora térmica TCP 9100.
   O navegador envia ESC/POS em application/octet-stream para /print.
   Cabeçalhos: X-Printer-IP e X-Printer-Port.
*/
const http = require('http');
const net = require('net');
const os = require('os');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 9100);
const DEFAULT_PRINTER_IP = process.env.PRINTER_IP || '';
const DEFAULT_PRINTER_PORT = Number(process.env.PRINTER_PORT || 9100);

function json(res, status, data) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,X-Printer-IP,X-Printer-Port','Access-Control-Allow-Methods':'POST,GET,OPTIONS'});
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
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method === 'GET' && req.url === '/health') return json(res, 200, {ok:true, service:'NeoScale Printer Service', host:os.hostname()});
  if (req.method !== 'POST' || !req.url.startsWith('/print')) return json(res, 404, {ok:false,error:'Not Found'});

  const ip = String(req.headers['x-printer-ip'] || DEFAULT_PRINTER_IP).trim();
  const port = Number(req.headers['x-printer-port'] || DEFAULT_PRINTER_PORT);
  if (!ip) return json(res, 400, {ok:false,error:'Informe X-Printer-IP ou PRINTER_IP.'});
  if (!Number.isInteger(port) || port < 1 || port > 65535) return json(res, 400, {ok:false,error:'Porta inválida.'});

  const chunks=[]; let total=0;
  req.on('data', chunk => { total += chunk.length; if (total <= 1024*1024) chunks.push(chunk); });
  req.on('end', async () => {
    if (total === 0) return json(res,400,{ok:false,error:'Corpo da impressão vazio.'});
    if (total > 1024*1024) return json(res,413,{ok:false,error:'Arquivo de impressão muito grande.'});
    try { await enviar(ip,port,Buffer.concat(chunks)); json(res,200,{ok:true,ip,port,bytes:total}); }
    catch (e) { json(res,502,{ok:false,error:e.message}); }
  });
});

server.listen(PORT, HOST, () => console.log(`NeoScale Printer Service ouvindo em http://${HOST}:${PORT}`));
