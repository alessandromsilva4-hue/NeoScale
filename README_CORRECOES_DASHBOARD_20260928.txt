CORREÇÕES DO DASHBOARD

1. Menu do usuário no topo
- O botão do usuário continua sendo clicável.
- O menu abre no topo e tem z-index elevado para não ficar atrás de outros elementos.
- Mostra nome, função e e-mail do usuário autenticado.
- O nome é lido do perfil usuarios/{uid}; se o perfil ainda estiver com o nome padrão Administrador, usa o displayName do Firebase e depois o nome derivado do e-mail.
- Configurações, Histórico e Sair continuam no menu do usuário.
- A lateral não contém usuário nem Sair.

2. Imagem do resumo da operação
- Criada versão otimizada da mesma foto para o banner: img/restaurante-quiosque-banner.webp/jpg.
- O navegador recebe preload da imagem com alta prioridade.
- O banner usa a imagem otimizada como fundo e também como imagem visível, reduzindo o flash verde antes da foto.
- O HTML/CSS/JS do dashboard receberam versão de cache para forçar a atualização após publicação.

3. Novo cadastro de acesso
- criar-acesso.html agora pede Nome do usuário e grava o nome no Firebase Auth e em usuarios/{uid}.

IMPORTANTE: usuários antigos que ainda estiverem com nome "Administrador" serão exibidos pelo nome derivado do e-mail até que o perfil seja atualizado.
