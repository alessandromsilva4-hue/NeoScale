/* NeoScale Compras — controlador de interface independente do módulo de dados. */
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const page = (location.pathname.split('/').pop() || 'compras.html').replace(/\.html$/i,'').toLowerCase();
  let loading = null;

  function api(){ return window.NeoScaleCompras || null; }

  async function ensureApi(){
    if(api()) return api();
    if(!loading){
      loading = import('./compras.js').then(()=>api()).catch(err=>{
        console.error('NeoScale Compras: falha ao carregar compras.js', err);
        throw err;
      });
    }
    const a = await loading;
    if(!a) throw new Error('O módulo de Compras não foi carregado. Atualize a página (Ctrl+Shift+R).');
    return a;
  }

  function actionForPage(a){
    if(page==='requisicoes') return a.reqForm;
    if(page==='cotacoes') return a.cotForm;
    if(page==='fornecedores') return a.fornecedorForm;
    if(page==='pedidos-compra') return a.pedForm;
    return null;
  }

  async function run(fn){
    try{
      const a = await ensureApi();
      fn(a);
    }catch(err){
      console.error(err);
      alert(err?.message || 'Não foi possível executar esta ação.');
    }
  }

  function bind(id, fn){
    const el=$(id);
    if(!el || el.dataset.neoUiBound==='1') return;
    el.dataset.neoUiBound='1';
    el.type = el.type || 'button';
    el.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      run(fn);
    }, false);
  }

  function bindAll(){
    bind('btnAtualizar', a=>a.load());
    bind('btnNovaReq', a=>a.reqForm());
    bind('btnNovaCot', a=>a.cotForm());
    bind('btnNovoFornecedor', a=>a.fornecedorForm());
    bind('btnNovoPedido', a=>a.pedForm());
    bind('btnNovaAcao', a=>{
      const fn=actionForPage(a);
      if(fn) fn();
    });
    bind('modalX', a=>a.closeModal());
    bind('modalCancelar', a=>a.closeModal());

    // Ações criadas dinamicamente dentro das tabelas/modais.
    const root=document;
    if(root.body && !root.body.dataset.neoComprasDelegated){
      root.body.dataset.neoComprasDelegated='1';
      root.body.addEventListener('click', function(e){
        const b=e.target.closest('[data-action]');
        if(b && b.dataset.neoDelegated!=='1'){
          const act=b.dataset.action, id=b.dataset.id;
          if(['req-edit','req-cot','cot-edit','cot-enviar','cot-aprovar','cot-ped','forn-edit','ped-edit','ped-next','ped-receber'].includes(act)){
            e.preventDefault();
            e.stopPropagation();
            run(a=>{
              const list={req:a.reqForm,cot:a.cotForm,forn:a.fornecedorForm,ped:a.pedForm};
              if(act==='req-edit') return a.reqForm((a.__state?.req||[]).find(x=>x.id===id));
              if(act==='cot-edit') return a.cotForm((a.__state?.cot||[]).find(x=>x.id===id));
              if(act==='forn-edit') return a.fornecedorForm((a.__state?.forn||[]).find(x=>x.id===id));
              if(act==='ped-edit') return a.pedForm((a.__state?.ped||[]).find(x=>x.id===id));
              if(act==='cot-enviar') return a.envioCotacaoForm((a.__state?.cot||[]).find(x=>x.id===id));
              if(act==='cot-aprovar') return a.approveCot(id);
              if(act==='ped-next') return a.advance(id);
              if(act==='ped-receber') return a.receiveForm((a.__state?.ped||[]).find(x=>x.id===id));
              if(act==='req-cot') return location.href='cotacoes.html?novo=1&reqId='+encodeURIComponent(id);
              if(act==='cot-ped') return location.href='pedidos-compra.html?novo=1&cotId='+encodeURIComponent(id);
            });
          }
        }
        const channel=e.target.closest('[data-send-channel]');
        if(channel){
          e.preventDefault();
          const canal=channel.dataset.sendChannel;
          run(a=>{
            const id=a.__currentId;
            if(a.__sendCotacao) return a.__sendCotacao(id,canal);
          });
        }
      }, true);
    }
  }

  // Binding imediato e também após o DOM estar pronto.
  bindAll();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bindAll,{once:true});
  const observer=new MutationObserver(bindAll);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>observer.disconnect(),15000);
})();
