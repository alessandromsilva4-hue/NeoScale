# NeoScale — fluxo automático de cozinha e status pronto

## Fluxo

1. Pedido chega do iFood, 99Food ou Anota AI.
2. NeoScale normaliza o pedido na Central de Delivery.
3. Ao confirmar/receber o pedido, o operador pode enviar para **Em preparo**.
4. O NeoScale imprime automaticamente a comanda da cozinha via `printer-service` (ESC/POS TCP 9100).
5. A cozinha prepara o pedido.
6. Ao clicar **Marcar pronto**, o NeoScale primeiro tenta atualizar a plataforma de origem.
7. Somente após a atualização remota bem-sucedida (ou retorno de pendência configurada para uma plataforma ainda não homologada) o pedido muda de coluna.
8. Para iFood:
   - retirada / entrega com parceiro iFood: `POST /readyToPickup`;
   - entrega própria: `POST /dispatch` com `deliveredBy: MERCHANT`.

## Impressão

Configure no `delivery-service/.env`:

- `PRINTER_SERVICE_URL=http://localhost:9100`
- `PRINTER_IP=<IP DA IMPRESSORA>`
- `PRINTER_PORT=9100`

O pedido é impresso uma vez por `orderId`. O serviço mantém um log em memória para impedir duplicação durante a execução.

## 99Food e Anota AI

As APIs oficiais existem e possuem fluxo de integração/homologação, mas os endpoints exatos de avanço de status devem ser preenchidos conforme o contrato/credenciais da aplicação NeoScale. Por isso o projeto deixa `99FOOD_READY_URL` e `ANOTA_READY_URL` configuráveis, sem inventar endpoints de produção.
