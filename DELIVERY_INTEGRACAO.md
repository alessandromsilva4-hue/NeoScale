# NeoScale — Delivery e integrações

Foi adicionada a Central de Delivery com canais iFood, 99Food e Anota AI.

## Fluxo

Plataformas → Central de Pedidos → Cozinha → Entrega → Caixa/Financeiro

## O que já está no projeto

- `delivery.html`: central com visão Kanban.
- `css/delivery.css`: interface da central.
- `js/delivery.js`: modo demonstração e consumo de um backend de integração.
- `delivery-service/`: serviço Node separado para manter segredos fora do navegador.
- iFood: autenticação server-side e polling de eventos preparados para uso com credenciais/homologação.
- 99Food e Anota AI: endpoints webhook preparados para receber pedidos normalizados; a validação/assinatura deve seguir o contrato oficial de cada plataforma.

## Segurança

Nunca colocar `clientSecret`, tokens OAuth ou chaves privadas no HTML/JavaScript publicado pelo Firebase Hosting.

## iFood

A documentação oficial atual usa OAuth 2.0. Para uma aplicação centralizada, o token é obtido no servidor com `client_credentials`. O Order API disponibiliza polling a cada 30 segundos ou webhook e permite confirmar, iniciar preparo, marcar pronto, despachar e rastrear pedidos conforme o tipo de entrega.

## 99Food

A 99Food possui plataforma aberta para desenvolvedores com APIs de pedidos, cardápio e logística e processo próprio de certificação/autorização. O acesso de produção depende da aprovação e credenciais emitidas pela 99Food.

## Anota AI

A Anota AI mantém documentação oficial para integradoras, incluindo autenticação OAuth, APIs de pedidos e cardápio. O fluxo de produção depende da autorização/credenciais fornecidas pela plataforma.

## Próximo passo técnico

Depois de obter as credenciais/homologação, configurar as variáveis do `delivery-service` e conectar o serviço à hospedagem. O navegador do NeoScale conversa somente com o endpoint do serviço, nunca diretamente com os segredos das plataformas.
