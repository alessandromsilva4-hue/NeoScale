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

## Segurança e perfis

- O primeiro acesso criado em `criar-acesso.html` recebe o perfil `ADMINISTRADOR` e inicializa o controle de acesso.
- Perfis disponíveis: `ADMINISTRADOR` (acesso completo), `CAIXA` (PDV e caixa) e `OPERADOR` (pesagem).
- Depois da criação do administrador, remova o link ou a própria página `criar-acesso.html` da publicação.
- Publique o arquivo `firestore.rules` no Firebase antes de usar o sistema em produção. Para criar novos perfis, um administrador deve criar o documento `usuarios/{uid}` no Firestore com os campos `nome`, `email`, `funcao` e `ativo`.
- A finalização de comandas usa transação no Firestore para impedir que dois PDVs cobrem a mesma comanda.


## Firebase - Caixa
O arquivo `firestore.rules` inclui uma regra de desenvolvimento que permite leitura e gravação para usuários autenticados. Publique essas regras no projeto Firebase se o sistema apresentar `Missing or insufficient permissions`.
