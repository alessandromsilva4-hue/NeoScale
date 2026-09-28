/* NeoScale - menu lateral centralizado e recolhível */
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
    ['usuarios.html','bi-person-badge','Usuários','usuarios'],
    ['configuracoes.html','bi-gear','Configurações','configuracoes']
  ]}
];

const MENU_STATE_KEY = 'neoscale_sidebar_sections';

function paginaAtual(){
  return (location.pathname.split('/').pop() || 'dashboard.html').replace('.html','').toLowerCase();
}

function lerEstadoMenu(){
  try { return JSON.parse(localStorage.getItem(MENU_STATE_KEY) || '{}'); }
  catch { return {}; }
}

function salvarEstadoMenu(estado){
  try { localStorage.setItem(MENU_STATE_KEY, JSON.stringify(estado)); } catch {}
}

function construirSidebar(el){
  const atual = paginaAtual();
  const estado = lerEstadoMenu();
  const grupoAtivo = MENU.findIndex(group => group.items.some(([, , , key]) => key === atual));

  el.innerHTML = `
    <div class="sidebar-brand">
      <div class="sidebar-brand-mark"><i class="bi bi-bar-chart-steps"></i></div>
      <div><strong>NeoScale</strong><span>Gestão Inteligente</span></div>
      <button class="sidebar-close" type="button" aria-label="Fechar menu"><i class="bi bi-x-lg"></i></button>
    </div>
    <nav class="sidebar-menu" aria-label="Menu principal">
      ${MENU.map((group, index) => {
        const temAtivo = group.items.some(([, , , key]) => key === atual);
        const aberto = temAtivo || estado[group.section] === true;
        return `
          <div class="sidebar-section ${aberto ? 'is-open' : ''}" data-section="${group.section}">
            <button type="button" class="sidebar-section-toggle" aria-expanded="${aberto}" aria-controls="sidebar-group-${index}">
              <span>${group.section}</span><i class="bi bi-chevron-down" aria-hidden="true"></i>
            </button>
            <div class="sidebar-section-items" id="sidebar-group-${index}">
              ${group.items.map(([href,icon,label,key]) => `<a href="${href}" class="${atual===key?'active':''}" data-page="${key}"><i class="bi ${icon}"></i><span>${label}</span></a>`).join('')}
            </div>
          </div>`;
      }).join('')}
    </nav>
    </div>`;

  el.querySelectorAll('.sidebar-section-toggle').forEach(button => {
    button.addEventListener('click', () => {
      const section = button.closest('.sidebar-section');
      const nome = section.dataset.section;
      const abrir = !section.classList.contains('is-open');

      // Apenas um grupo aberto por vez: mantém o menu compacto.
      el.querySelectorAll('.sidebar-section.is-open').forEach(other => {
        if (other !== section) {
          other.classList.remove('is-open');
          other.querySelector('.sidebar-section-toggle')?.setAttribute('aria-expanded', 'false');
        }
      });

      section.classList.toggle('is-open', abrir);
      button.setAttribute('aria-expanded', String(abrir));

      const novoEstado = {};
      if (abrir) novoEstado[nome] = true;
      salvarEstadoMenu(novoEstado);
    });
  });

  el.querySelector('.sidebar-close')?.addEventListener('click',()=>document.body.classList.remove('sidebar-open'));

  if(!document.getElementById('neoMobileMenu')){
    const b=document.createElement('button');
    b.id='neoMobileMenu';
    b.className='neo-mobile-menu';
    b.innerHTML='<i class="bi bi-list"></i>';
    b.setAttribute('aria-label','Abrir menu');
    b.onclick=()=>document.body.classList.add('sidebar-open');
    document.body.appendChild(b);
  }

}

document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('[data-sidebar], .sidebar').forEach(construirSidebar);
});
