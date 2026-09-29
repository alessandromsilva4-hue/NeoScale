NeoScale - sequência de comandas

Novas comandas usam exatamente 4 dígitos, em sequência:
#0001, #0002, #0003 ... #9999.

A sequência é controlada pela transação do documento configuracoes/contadorComandas.
Números cancelados não são reutilizados. Ao atingir 9999, uma nova comanda é bloqueada até que a regra de continuidade seja definida.

Registros antigos com 6 dígitos não são alterados automaticamente para evitar colisões no histórico.
