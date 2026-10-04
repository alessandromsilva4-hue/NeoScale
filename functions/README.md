# NF-e recebidas — NeoScale

A tela usa o Web Service oficial NFeDistribuicaoDFe para consultar DF-e destinados ao CNPJ do restaurante. O serviço oficial exige certificado digital de PJ/PF e a distribuição usa o CNPJ do interessado. A função `sincronizarNfe` usa certificado A1 (.pfx/.p12) somente durante a chamada e não grava o arquivo ou a senha no Firestore.

## Publicação

1. No diretório do projeto, execute `firebase deploy --only functions`.
2. A conta precisa ter faturamento/Cloud Functions habilitado conforme o projeto Firebase.
3. Depois, publique o hosting normalmente.

A função mantém o último NSU em `configuracoes/fiscal.ultNSU` e grava os documentos em `nfesRecebidas`.

Importante: o serviço oficial pode entregar resumo e eventos; o acesso ao conteúdo completo da NF-e segue as regras de distribuição/manifestação da NF-e. O NeoScale não envia manifestação automaticamente.
