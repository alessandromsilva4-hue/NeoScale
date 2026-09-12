# NeoScale — PDV, Caixa e Financeiro

Fluxo principal: **Pesagem → Comanda → Código de barras → PDV → Pagamento → Caixa → Financeiro → Fechamento**.

## Novas telas
- `pdv.html` — Frente de caixa e pagamento das comandas.
- `caixa.html` — abertura, acompanhamento e fechamento do caixa.
- `financeiro.html` — receitas, saídas e movimentações.
- `fechamento.html` — consolidação geral dos caixas.

## Firestore
Coleções usadas: `comandas`, `historico`, `caixas`, `movimentosCaixa` e `configuracoes/contadorComandas`.

Antes do primeiro teste, abra `caixa.html` e faça a abertura do caixa. O PDV bloqueia a finalização de venda quando não existe caixa aberto.


## Firebase - Caixa
O arquivo `firestore.rules` inclui uma regra de desenvolvimento que permite leitura e gravação para usuários autenticados. Publique essas regras no projeto Firebase se o sistema apresentar `Missing or insufficient permissions`.
