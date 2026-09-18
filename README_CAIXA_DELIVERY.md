# NeoScale — Caixa Delivery

O Caixa Delivery é um caixa financeiro separado do caixa do PDV.

Fluxo:
Pedido Delivery -> pagamento -> produção -> entrega -> recebimento/acerto -> Caixa Delivery -> fechamento.

Coleções Firestore:
- `caixasDelivery`: abertura/fechamento do caixa Delivery.
- `movimentosCaixaDelivery`: vendas, suprimentos, sangrias, despesas e ajustes.
- `acertosEntregadores`: acertos registrados com entregadores.

Regras:
- Venda, pagamento e entrega continuam sendo conceitos separados.
- Dinheiro em posse de entregador é mostrado separadamente do dinheiro físico no caixa.
- O PDV continua usando `caixas`/`movimentosCaixa`; o Delivery usa `caixasDelivery`/`movimentosCaixaDelivery`.
- O menu Financeiro ganhou o item Caixa Delivery.
