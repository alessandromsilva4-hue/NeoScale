CORREÇÃO FINAL — CAIXA DELIVERY

A mensagem "Não foi possível acessar o Caixa Delivery" podia ser causada
pelas consultas do Firestore usando where + orderBy em campos diferentes,
o que exige índices compostos no Firebase.

A implementação foi ajustada para:
- consultar sem orderBy composto;
- ordenar os resultados no JavaScript;
- eliminar a necessidade desses índices compostos;
- manter histórico e movimentações ordenados;
- gravar totalVendas no fechamento;
- mostrar a mensagem real do Firestore caso ainda exista algum erro.

Também permanece a correção anterior de permissão:
- ADMINISTRADOR: acesso
- CAIXA: acesso
- OPERADOR: sem acesso ao caixa financeiro

Após publicar, faça Ctrl+F5 e entre novamente no NeoScale.
