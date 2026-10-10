# NeoScale Printer Service

Ponte local entre o navegador do NeoScale e uma impressora térmica TCP/9100.

## Iniciar

No Windows, com Node.js instalado:

```powershell
cd printer-service
$env:PRINTER_IP="192.168.1.100"
$env:PRINTER_PORT="9100"
$env:PRINTER_SERVICE_KEY="crie-uma-chave-longa-e-exclusiva"
$env:ALLOWED_ORIGIN="https://seu-dominio.example"
node server.js
```

Teste:

```powershell
curl.exe http://127.0.0.1:9100/health
```

## Configurar no NeoScale

Em Configurações:
- Modo de impressão: **Impressão direta**
- Servidor de impressão: `http://127.0.0.1:9100/print` quando o sistema e o serviço estiverem no mesmo computador
- IP da impressora: IP da térmica
- Porta TCP: `9100`
- Chave do servidor de impressão: o mesmo valor de `PRINTER_SERVICE_KEY`

Se o NeoScale estiver hospedado em HTTPS, o Chrome pode bloquear uma chamada HTTP por mixed content. Nesse cenário, use HTTPS no serviço (por exemplo, com certificado local/mkcert) ou hospede o NeoScale localmente em HTTPS.

## Observação

O serviço inicia apenas em `127.0.0.1`, exige chave, aceita somente o IP/porta definidos nas variáveis de ambiente e bloqueia origens não autorizadas. Para disponibilizá-lo a outros computadores, defina `HOST=0.0.0.0`, mantenha `ALLOWED_ORIGIN` preenchido e restrinja a porta no firewall à rede interna.
