const KEY='neoscale_delivery_config';
const CLOSING_KEY='neoscale_delivery_closings';
const SERVICE_DEFAULT='';
const columns=[['NOVO','Novos'],['PREPARO','Em preparo'],['PRONTO','Prontos'],['ENTREGA','Em entrega'],['CONCLUIDO','Concluídos']];
let orders=[];
const printedOrders=new Set();

function loadConfig(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
function saveConfig(c){localStorage.setItem(KEY,JSON.stringify(c))}
function fmt(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}

function render(){
  const k=document.getElementById('kanban');
  k.innerHTML='';
  columns.forEach(([key,label])=>{
    const list=orders.filter(o=>o.status===key);
    const col=document.createElement('div');
    col.className='kanban-col';
    col.innerHTML=`<div class="kanban-title"><span>${label}</span><span>${list.length}</span></div>`;
    if(!list.length){
      col.insertAdjacentHTML('beforeend','<div class="empty-column"><i class="bi bi-inbox"></i><span>Nenhum pedido</span></div>');
    }
    list.forEach(o=>{
      const next=key==='NOVO'?'PREPARO':key==='PREPARO'?'PRONTO':key==='PRONTO'?'ENTREGA':key==='ENTREGA'?'CONCLUIDO':null;
      const printBadge=printedOrders.has(o.id)?'<small class="print-ok">🖨️ Impresso</small>':'';
      const b=next?`<button data-id="${o.id}" data-next="${next}">${next==='PREPARO'?'Iniciar preparo':next==='PRONTO'?'Marcar pronto':next==='ENTREGA'?'Saiu para entrega':'Concluir'}</button>`:'';
      const items=Array.isArray(o.items)?o.items:[];
      col.insertAdjacentHTML('beforeend',`<article class="order-card"><div class="order-top"><strong>${o.id||'Pedido'}</strong><span class="source">${o.source||'Delivery'}</span></div><p>${o.customer||'Cliente'}</p><div class="order-items">${items.map(x=>`• ${typeof x==='string'?x:`${x.quantity||1}x ${x.name||'Item'}${x.notes?` — ${x.notes}`:''}`}`).join('<br>')}</div><div class="order-foot"><b>${fmt(o.total)}</b><span>${printBadge}</span>${b}</div></article>`);
    });
    k.appendChild(col);
  });
  updateCounts();
}

function updateCounts(){
  const map={iFood:'ifoodCount','99Food':'food99Count','Anota AI':'anotaCount'};
  Object.entries(map).forEach(([s,id])=>document.getElementById(id).textContent=orders.filter(o=>o.source===s).length);
  document.getElementById('totalCount').textContent=orders.length;
}

function setStatuses(state){
  const text=state==='live'?'Conectado':state==='error'?'Falha na conexão':'Não configurado';
  [['ifoodStatus','iFood'],['food99Status','99Food'],['anotaStatus','Anota AI']].forEach(([id])=>document.getElementById(id).textContent=text);
}

async function sync(){
  const c=loadConfig();
  const log=document.getElementById('syncLog');
  const last=document.getElementById('lastSync');
  const service=(c.serviceUrl||'').trim().replace(/\/$/,'');
  if(!service){
    orders=[];
    setStatuses('idle');
    log.textContent='Serviço de integração ainda não configurado. Abra “Integrações” e informe a URL do serviço.';
    last.textContent='Aguardando configuração';
    render();
    return;
  }
  btnSync.disabled=true;
  const old=btnSync.innerHTML;
  btnSync.innerHTML='<i class="bi bi-arrow-repeat"></i> Sincronizando...';
  try{
    // O endpoint agregado dispara as sincronizações disponíveis no backend
    // (por exemplo, polling do iFood) e devolve a fila unificada.
    const r=await fetch(service+'/api/delivery/sync',{method:'POST'});
    if(!r.ok) throw new Error('HTTP '+r.status);
    const data=await r.json();
    const incoming=Array.isArray(data.orders)?data.orders:[];
    const previousIds=new Set(orders.map(o=>o.id));
    orders=incoming;
    for(const o of incoming){
      if(!previousIds.has(o.id) && !printedOrders.has(o.id)){
        try{ await printKitchen(o); o.printedAt=new Date().toISOString(); }
        catch(err){ console.warn('Impressão automática falhou para',o.id,err.message); }
      }
    }
    setStatuses(data.platforms||'live');
    log.textContent=`Sincronizado com o serviço às ${new Date().toLocaleTimeString('pt-BR')}. ${Number(data.events||0)} evento(s) processado(s).`;
    last.textContent=new Date().toLocaleString('pt-BR');
  }catch(e){
    // Fallback: ainda permite atualizar a fila já disponível no serviço.
    try{
      const r=await fetch(service+'/api/delivery/orders');
      if(!r.ok) throw new Error('HTTP '+r.status);
      const data=await r.json();
      orders=Array.isArray(data.orders)?data.orders:[];
      setStatuses('live');
      log.textContent=`Fila atualizada às ${new Date().toLocaleTimeString('pt-BR')}. Sincronização das plataformas indisponível.`;
      last.textContent=new Date().toLocaleString('pt-BR');
    }catch(fallback){
      orders=[];
      setStatuses('error');
      log.textContent=`Não foi possível conectar ao serviço de integração: ${e.message}.`;
      last.textContent='Falha na sincronização';
    }
  }finally{
    btnSync.disabled=false;
    btnSync.innerHTML=old;
  }
  render();
}
async function serviceRequest(path, options={}){
  const c=loadConfig();
  const service=(c.serviceUrl||'').trim().replace(/\/$/,'');
  if(!service) throw new Error('Serviço de Delivery não configurado.');
  const r=await fetch(service+path,options);
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error||('HTTP '+r.status));
  return data;
}

async function printKitchen(o){
  const data=await serviceRequest('/api/delivery/orders/'+encodeURIComponent(o.id)+'/print-kitchen',{method:'POST'});
  printedOrders.add(o.id);
  return data;
}

async function pushStatus(o,next){
  return serviceRequest('/api/delivery/orders/'+encodeURIComponent(o.id)+'/status',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:next})
  });
}

document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-next]');
  if(!b)return;
  const o=orders.find(x=>x.id===b.dataset.id);
  if(!o)return;
  const next=b.dataset.next;
  b.disabled=true;
  try{
    if(next==='PREPARO'&&!printedOrders.has(o.id)){
      await printKitchen(o);
      o.printedAt=new Date().toISOString();
    }
    const result=await pushStatus(o,next);
    if(result.order)o.status=result.order.status;
    else o.status=next;
    render();
  }catch(err){
    alert('Não foi possível avançar o pedido.\n\n'+err.message);
    render();
  }finally{b.disabled=false;}
});

const dashboard=document.getElementById('deliveryDashboard');
const integrationPanel=document.getElementById('integrationPanel');
const btnConfig=document.getElementById('btnConfig');
const btnClosing=document.getElementById('btnClosing');
const closingPanel=document.getElementById('closingPanel');
const btnRefreshClosing=document.getElementById('btnRefreshClosing');
const btnBackDelivery=document.getElementById('btnBackDelivery');
const btnRegisterClosing=document.getElementById('btnRegisterClosing');
const btnSync=document.getElementById('btnSync');
const deliveryTitle=document.getElementById('deliveryTitle');
const deliverySubtitle=document.getElementById('deliverySubtitle');
const deliveryEyebrow=document.getElementById('deliveryEyebrow');
const saveConfigButton=document.getElementById('saveConfig');

function getCompletedOrders(){ return orders.filter(o=>String(o.status||'').toUpperCase()==='CONCLUIDO'); }
function getPayment(o){ return o.paymentMethod||o.payment||o.paymentType||o.payment?.method||'Não informado'; }
function renderClosing(){
  const completed=getCompletedOrders();
  const gross=completed.reduce((sum,o)=>sum+Number(o.total||0),0);
  const avg=completed.length?gross/completed.length:0;
  document.getElementById('closingOrders').textContent=completed.length;
  document.getElementById('closingGross').textContent=fmt(gross);
  document.getElementById('closingAverage').textContent=fmt(avg);
  document.getElementById('closingOpen').textContent=orders.filter(o=>String(o.status||'').toUpperCase()!=='CONCLUIDO').length;
  const platforms={}; completed.forEach(o=>{const k=o.source||'Delivery'; if(!platforms[k])platforms[k]={count:0,total:0}; platforms[k].count++; platforms[k].total+=Number(o.total||0);});
  const payments={}; completed.forEach(o=>{const k=getPayment(o); if(!payments[k])payments[k]={count:0,total:0}; payments[k].count++; payments[k].total+=Number(o.total||0);});
  const renderList=(obj,el)=>{const node=document.getElementById(el); const entries=Object.entries(obj); node.innerHTML=entries.length?entries.map(([name,v])=>`<div class="closing-row"><span><strong>${name}</strong><small>${v.count} pedido(s)</small></span><b>${fmt(v.total)}</b></div>`).join(''):'<div class="closing-empty">Nenhuma venda concluída para conferir.</div>';};
  renderList(platforms,'closingPlatforms'); renderList(payments,'closingPayments');
  document.getElementById('closingGeneratedAt').textContent='Atualizado em '+new Date().toLocaleString('pt-BR');
  document.getElementById('closingReport').innerHTML=completed.length?`<div class="closing-report-lines"><span>Vendas concluídas</span><b>${completed.length}</b><span>Faturamento bruto</span><b>${fmt(gross)}</b><span>Pedidos em aberto</span><b>${orders.length-completed.length}</b></div>`:'Nenhuma venda concluída disponível para fechamento.';
}
function openClosing(){
  dashboard.hidden=true; integrationPanel.hidden=true; closingPanel.hidden=false;
  deliveryEyebrow.textContent='FECHAMENTO DE DELIVERY'; deliveryTitle.textContent='Fechamento de caixa do Delivery'; deliverySubtitle.textContent='Confira as vendas concluídas antes de registrar o fechamento.';
  btnSync.hidden=true; btnClosing.hidden=true; btnConfig.hidden=true; renderClosing(); window.scrollTo({top:0,behavior:'smooth'});
}
function closeClosing(){
  closingPanel.hidden=true; dashboard.hidden=false; integrationPanel.hidden=true;
  deliveryEyebrow.textContent='OPERAÇÃO OMNICHANNEL'; deliveryTitle.textContent='Central de Delivery'; deliverySubtitle.textContent='iFood, 99Food e Anota AI em um único fluxo.';
  btnSync.hidden=false; btnClosing.hidden=false; btnConfig.hidden=false; window.scrollTo({top:0,behavior:'smooth'});
}
function openIntegrations(){
  const c=loadConfig();
  document.getElementById('serviceUrl').value=c.serviceUrl||SERVICE_DEFAULT;
  document.getElementById('operationMode').value='live';
  dashboard.hidden=true;
  integrationPanel.hidden=false;
  deliveryEyebrow.textContent='CONFIGURAÇÃO';
  deliveryTitle.textContent='Integrações de Delivery';
  deliverySubtitle.textContent='Conecte o NeoScale às plataformas e mantenha os pedidos em um único fluxo.';
  btnSync.hidden=true;
  btnConfig.innerHTML='<i class="bi bi-arrow-left"></i> Voltar à Central';
  window.scrollTo({top:0,behavior:'smooth'});
}

function closeIntegrations(){
  integrationPanel.hidden=true;
  closingPanel.hidden=true;
  dashboard.hidden=false;
  deliveryEyebrow.textContent='OPERAÇÃO OMNICHANNEL';
  deliveryTitle.textContent='Central de Delivery';
  deliverySubtitle.textContent='iFood, 99Food e Anota AI em um único fluxo.';
  btnSync.hidden=false;
  btnConfig.innerHTML='<i class="bi bi-sliders"></i> Integrações';
  window.scrollTo({top:0,behavior:'smooth'});
}

btnConfig.onclick=()=>{if(integrationPanel.hidden)openIntegrations();else closeIntegrations()};
btnClosing.onclick=openClosing;
btnBackDelivery.onclick=closeClosing;
btnRefreshClosing.onclick=()=>{renderClosing(); sync();};
btnRegisterClosing.onclick=()=>{
  const completed=getCompletedOrders();
  if(!completed.length){alert('Não há pedidos concluídos para registrar o fechamento.');return;}
  const gross=completed.reduce((sum,o)=>sum+Number(o.total||0),0);
  let list=[]; try{list=JSON.parse(localStorage.getItem(CLOSING_KEY)||'[]')}catch{}
  list.push({id:'FECH-DEL-'+Date.now(),createdAt:new Date().toISOString(),orders:completed.length,total:gross});
  localStorage.setItem(CLOSING_KEY,JSON.stringify(list));
  alert(`Fechamento do Delivery registrado.\n\nPedidos: ${completed.length}\nTotal: ${fmt(gross)}`);
};
saveConfigButton.onclick=()=>{
  saveConfig({serviceUrl:document.getElementById('serviceUrl').value.trim(),mode:'live'});
  alert('Configuração de Delivery salva.');
  closeIntegrations();
  sync();
};
btnSync.onclick=sync;
sync();

/* NeoScale — Caixa Delivery: abertura + fechamento */
(function(){
  const KEY="neoscale_delivery_caixa";
  const $=id=>document.getElementById(id);
  const brl=v=>(Number(v)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"null")}catch(e){return null}};
  const save=v=>localStorage.setItem(KEY,JSON.stringify(v));

  function totals(c){
    const initial=+c.fundoInicial||0, vendas=+c.vendas||0, taxas=+c.taxas||0, sang=+c.sangrias||0, supr=+c.suprimentos||0;
    return {initial,vendas,taxas,sang,supr,expected:initial+vendas-taxas-sang+supr};
  }
  function render(){
    const c=load(), open=!!(c&&c.status==="ABERTO");
    if($("nsCdStatus"))$("nsCdStatus").textContent=open?"Aberto":"Fechado";
    if($("nsCdOperador"))$("nsCdOperador").textContent=c?.operador||"—";
    if($("nsCdAbertura"))$("nsCdAbertura").textContent=c?.abertoEm?new Date(c.abertoEm).toLocaleString("pt-BR"):"—";
    if($("nsCdAberturaBox"))$("nsCdAberturaBox").hidden=open;
    if($("nsCdFechamentoBox"))$("nsCdFechamentoBox").hidden=!open;
    if(open){
      const t=totals(c);
      const vals={nsCdInicial:t.initial,nsCdVendas:t.vendas,nsCdDinheiro:c.dinheiro,nsCdPix:c.pix,nsCdCartao:c.cartao,nsCdTaxas:t.taxas,nsCdSangrias:t.sang,nsCdSuprimentos:t.supr,nsCdEsperado:t.expected};
      Object.entries(vals).forEach(([id,v])=>{if($(id))$(id).textContent=brl(v)});
      if($("nsCdDiferenca"))$("nsCdDiferenca").textContent=brl((+$("nsCdInformado")?.value||0)-t.expected);
    }
  }
  function abrir(){
    const operador=$("nsCdOperadorInput")?.value.trim(), fundo=+$("nsCdFundo")?.value||0;
    if(!operador){alert("Informe o operador.");return;}
    save({status:"ABERTO",operador,fundoInicial:fundo,abertoEm:new Date().toISOString(),aberturaObs:$("nsCdAberturaObs")?.value||"",vendas:0,dinheiro:0,pix:0,cartao:0,taxas:0,sangrias:0,suprimentos:0});
    render();
  }
  function fechar(){
    const c=load(); if(!c)return;
    const t=totals(c), informado=+$("nsCdInformado")?.value||0;
    c.status="FECHADO"; c.fechadoEm=new Date().toISOString(); c.valorEsperado=t.expected; c.valorInformado=informado; c.diferenca=informado-t.expected; c.fechamentoObs=$("nsCdFechamentoObs")?.value||"";
    save(c); render(); alert("Caixa Delivery fechado.");
  }
  function relatorio(){
    const c=load(); if(!c||c.status!=="FECHADO"){alert("Feche o caixa antes de gerar o relatório.");return;}
    const w=window.open("","_blank"); if(!w)return;
    w.document.write("<html><head><title>Fechamento Caixa Delivery</title></head><body style='font-family:Arial;padding:30px'><h1>Fechamento Caixa Delivery</h1>"+
      "<p><b>Operador:</b> "+(c.operador||"—")+"</p><p><b>Valor esperado:</b> "+brl(c.valorEsperado)+"</p>"+
      "<p><b>Valor informado:</b> "+brl(c.valorInformado)+"</p><p><b>Diferença:</b> "+brl(c.diferenca)+"</p>"+
      "<p><b>Observação:</b> "+(c.fechamentoObs||"—")+"</p></body></html>");
    w.document.close(); w.print();
  }
  document.addEventListener("click",e=>{
    const a=e.target.closest('a[href="#caixa-delivery"]');
    if(a){e.preventDefault();const p=$("caixa-delivery");if(p){p.hidden=false;p.scrollIntoView({behavior:"smooth"});render();}return;}
    if(e.target.closest("#nsCdAbrir"))abrir();
    if(e.target.closest("#nsCdFechar"))fechar();
    if(e.target.closest("#nsCdRelatorio"))relatorio();
  });
  document.addEventListener("input",e=>{if(e.target.id==="nsCdInformado")render()});
  window.nsCaixaDelivery={load,save,render};
  document.addEventListener("DOMContentLoaded",render);
})();
