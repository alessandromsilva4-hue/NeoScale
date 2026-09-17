# NeoScale Printer Service

Ponte local entre o navegador do NeoScale e uma impressora térmica TCP/9100.

## Iniciar

No Windows, com Node.js instalado:

```powershell
cd printer-service
node server.js
```

Teste:

```powershell
curl.exe http://127.0.0.1:9100/health
```

## Configurar no NeoScale

Em Configurações:
- Modo de impressão: **Impressão direta**
- Servidor de impressão: `http://IP-DO-PC:9100/print`
- IP da impressora: IP da térmica
- Porta TCP: `9100`

Se o NeoScale estiver hospedado em HTTPS, o Chrome pode bloquear uma chamada HTTP por mixed content. Nesse cenário, use HTTPS no serviço (por exemplo, com certificado local/mkcert) ou hospede o NeoScale localmente em HTTPS.

## Observação

O serviço recebe ESC/POS bruto e encaminha para a impressora. Ele não altera o conteúdo.
