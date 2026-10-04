# NeoScale — Fluxo financeiro unificado

## Fluxo
1. NF-e recebida pelo CNPJ -> `nfesRecebidas` -> gerar conta a pagar.
2. Boleto/DDA -> `boletosDda` (importação CSV/JSON ou cadastro) -> gerar conta a pagar.
3. Conta a pagar -> acompanhamento de vencimento -> marcar como pago.

## NF-e / SEFAZ
A função `sincronizarNfe` consulta o NFeDistribuicaoDFe usando certificado digital A1 e mantém o último NSU em `configuracoes/fiscal`. O certificado e a senha são recebidos pela função e não são gravados no Firestore pela aplicação.

Para uso real, publique as Cloud Functions e configure o projeto Firebase. A empresa precisa ter certificado A1 válido e autorização/condições exigidas pela SEFAZ.

## DDA
O DDA é uma infraestrutura bancária; o Banco Central descreve a apresentação eletrônica de boletos por instituições participantes. O NeoScale deixa o domínio `boletosDda` pronto, aceita CSV/JSON e cadastro manual. Para captura automática será necessário integrar a API/webhook do banco ou provedor financeiro escolhido pelo restaurante. Não existe uma consulta pública da SEFAZ para descobrir boletos pelo CNPJ.

## Publicação
- `firebase deploy --only functions`
- `firebase deploy --only hosting`
- `firebase deploy --only firestore:rules`

Não coloque certificado ou senha em código-fonte, Firestore, Git ou chat.
