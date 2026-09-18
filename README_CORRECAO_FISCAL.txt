CORREÇÃO DA TELA FISCAL — NEOSCALE

Problema:
O modal fiscal aparecia como uma caixa branca vazia mesmo quando deveria
estar oculto. O CSS estava forçando a exibição do modal e ignorando o
atributo HTML hidden.

Correção:
- .modal-fiscal[hidden] agora usa display:none !important.
- Modais comuns encontrados no CSS também respeitam hidden.
- Foi adicionada uma proteção na página fiscal quando necessário.

Resultado:
O modal vazio não deve mais aparecer ao abrir a tela Fiscal.
Ele só será exibido quando o código JavaScript mandar abri-lo.
