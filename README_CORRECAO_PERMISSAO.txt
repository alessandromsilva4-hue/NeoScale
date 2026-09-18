CORREÇÃO - CAIXA DELIVERY

O erro "Seu perfil não tem permissão para acessar esta tela." ocorria porque
a rota "caixa-delivery" existia no menu, mas não estava autorizada no controle
de acesso de sessao.js.

A correção libera:
- ADMINISTRADOR -> Caixa Delivery
- CAIXA -> Caixa Delivery

OPERADOR continua sem acesso ao caixa financeiro.

Também foi corrigida a chave do menu "Ficha Técnica" para coincidir com
a rota protegida "ficha-tecnica".

Importante: depois de publicar esta versão, saia do NeoScale e entre novamente.
