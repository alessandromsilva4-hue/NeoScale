/* NeoScale - menu centralizado */
const MENU = [
  { section: 'GERAL', items: [
    ['dashboard.html','bi-grid-1x2','Dashboard','dashboard'],
    ['central.html','bi-diagram-3','Central de Pedidos','central']
  ]},
  { section: 'CLIENTES', items: [
    ['clientes.html','bi-people','Clientes','clientes'],
    ['historico.html','bi-clock-history','Histórico','historico']
  ]},
  { section: 'CADASTROS', items: [
    ['produtos.html','bi-box-seam','Produtos','produtos'],
    ['mesas.html','bi-grid-3x3-gap','Mesas','mesas'],
    ['comandas.html','bi-receipt-cutoff','Comandas','comandas'],
    ['ficha-tecnica.html','bi-journal-text','Ficha Técnica','ficha-tecnica']
  ]},
  { section: 'VENDAS', items: [
    ['pdv.html','bi-shop','Frente de Loja / PDV','pdv'],
    ['pesagem.html','bi-speedometer2','Pesagem','pesagem'],
    ['delivery.html','bi-bicycle','Delivery','delivery'],
    ['quiosque.html','bi-display','Quiosque','quiosque']
  ]},
  { section: 'OPERAÇÃO', items: [
    ['cozinha.html','bi-display','Produção / KDS','cozinha'],
    ['estoque.html','bi-boxes','Estoque','estoque'],
    ['compras.html','bi-cart3','Compras','compras']
  ]},
  { section: 'FINANCEIRO', items: [
    ['caixa.html','bi-cash-stack','Caixa','caixa'],
    ['caixa-delivery.html','bi-bicycle','Caixa Delivery','caixa-delivery'],
    ['financeiro.html','bi-wallet2','Financeiro','financeiro'],
    ['fechamento.html','bi-clipboard2-check','Fechamento','fechamento']
  ]},
  { section: 'GESTÃO', items: [
    ['relatorios.html','bi-bar-chart-line','Relatórios','relatorios'],
    ['fiscal.html','bi-receipt','Fiscal','fiscal'],
    ['configuracoes.html','bi-gear','Configurações','configuracoes']
  ]}
];

function paginaAtual(){
  return (location.pathname.split('/').pop() || 'dashboard.html').replace('.html','').toLowerCase();
}

function construirSidebar(el){
  const atual = paginaAtual();
  el.innerHTML = `
    <div class="sidebar-brand">
      <div class="sidebar-brand-mark"><i class="bi bi-bar-chart-steps"></i></div>
      <div><strong>NeoScale</strong><span>Gestão Inteligente</span></div>
      <button class="sidebar-close" type="button" aria-label="Fechar menu"><i class="bi bi-x-lg"></i></button>
    </div>
    <nav class="sidebar-menu" aria-label="Menu principal">
      ${MENU.map(group => `
        <div class="sidebar-section">
          <div class="sidebar-section-title">${group.section}</div>
          ${group.items.map(([href,icon,label,key]) => `<a href="${href}" class="${atual===key?'active':''}" data-page="${key}"><i class="bi ${icon}"></i><span>${label}</span></a>`).join('')}
        </div>`).join('')}
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-user"><div class="sidebar-avatar"><i class="bi bi-person-fill"></i></div><div><strong id="sidebarUserName">Operador</strong><span id="sidebarUserRole">Usuário</span></div></div>
      <button type="button" id="btnSairNeoScale"><i class="bi bi-box-arrow-right"></i><span>Sair</span></button>
    </div>`;

  el.querySelector('.sidebar-close')?.addEventListener('click',()=>document.body.classList.remove('sidebar-open'));
  if(!document.getElementById('neoMobileMenu')){ const b=document.createElement('button'); b.id='neoMobileMenu'; b.className='neo-mobile-menu'; b.innerHTML='<i class="bi bi-list"></i>'; b.setAttribute('aria-label','Abrir menu'); b.onclick=()=>document.body.classList.add('sidebar-open'); document.body.appendChild(b); }
  el.querySelector('#btnSairNeoScale')?.addEventListener('click',async()=>{
    try {
      const { encerrarSessao } = await import('./sessao.js');
      await encerrarSessao();
    } catch(e) { console.error(e); location.href='index.html'; }
  });
}

document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('[data-sidebar], .sidebar').forEach(construirSidebar);
});
