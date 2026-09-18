const KEY='neoscale_delivery_config';
const CLOSING_KEY='neoscale_delivery_closings';
const SERVICE_DEFAULT='';
const columns=[['NOVO','Novos'],['PREPARO','Em preparo'],['PRONTO','Prontos'],['ENTREGA','Em entrega'],['CONCLUIDO','Concluídos']];
let orders=[];
const printedOrders=new Set();

function loadConfig(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
function saveConfig(c){localStorage.setItem(KEY,JSON.stringify(c))}
function fmt(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function localOrders(){
  try{return JSON.parse(localStorage.getItem('neoscale_delivery_orders')||'[]')}catch{return[]}
}
function saveLocalOrders(rows){localStorage.setItem('neoscale_delivery_orders',JSON.stringify(rows))}
function isLocalOrder(o){return o?.origemLocal===true || o?.source==='PDV'}
function mergeOrders(incoming){
  const locais=localOrders();
  const map=new Map();
  locais.forEach(o=>map.set(o.id,o));
  incoming.forEach(o=>map.set(o.id,{...map.get(o.id),...o}));
  return Array.from(map.values()).sort((a,b)=>new Date(b.criadoEm||0)-new Date(a.criadoEm||0));
}

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
    orders=localOrders();
    setStatuses('idle');
    log.textContent=orders.length
      ? `Há ${orders.length} pedido(s) criado(s) diretamente pelo PDV.`
      : 'Serviço de integração ainda não configurado. Abra “Integrações” para conectar as plataformas.';
    last.textContent=orders.length?'Pedidos do PDV':'Aguardando configuração';
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
    orders=mergeOrders(incoming);
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
      orders=mergeOrders(Array.isArray(data.orders)?data.orders:[]);
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
    if(isLocalOrder(o)){
      o.status=next;
      const locais=localOrders();
      const i=locais.findIndex(x=>x.id===o.id);
      if(i>=0){locais[i]={...locais[i],status:next,atualizadoEm:new Date().toISOString()};saveLocalOrders(locais);}
      render();
      return;
    }
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

// =========================================================
// Rotas do menu lateral + Caixa/Entregadores/Relatórios
// =========================================================
const DELIVERY_CASH_KEY='neoscale_delivery_cash';
const DELIVERY_DRIVERS_KEY='neoscale_delivery_drivers';
const extraPanels={
  central:document.getElementById('deliveryDashboard'),
  caixa:document.getElementById('closingPanel'),
  entregadores:document.getElementById('entregadoresPanel'),
  relatorios:document.getElementById('relatoriosPanel'),
  integracoes:document.getElementById('integrationPanel')
};
function cashState(){try{return JSON.parse(localStorage.getItem(DELIVERY_CASH_KEY)||'null')}catch{return null}}
function setCashState(v){localStorage.setItem(DELIVERY_CASH_KEY,JSON.stringify(v))}
function renderDeliveryCash(){
  const c=cashState();
  const op=document.getElementById('deliveryCashOperator'), init=document.getElementById('deliveryCashInitial'), obs=document.getElementById('deliveryCashObservation'), state=document.getElementById('deliveryCashState');
  if(c){ if(op)op.value=c.operador||''; if(init)init.value=c.valorInicial||0; if(obs)obs.value=c.observacao||''; if(state)state.innerHTML=`<i class="bi bi-check-circle-fill"></i> Caixa aberto por <strong>${c.operador||'Operador'}</strong> em ${new Date(c.abertoEm).toLocaleString('pt-BR')}.`; }
  else if(state)state.innerHTML='<i class="bi bi-lock"></i> Caixa Delivery fechado.';
  const sales=orders.filter(o=>String(o.status||'').toUpperCase()==='CONCLUIDO').reduce((a,o)=>a+Number(o.total||0),0);
  const fees=orders.filter(o=>String(o.status||'').toUpperCase()==='CONCLUIDO').reduce((a,o)=>a+Number(o.platformFee||o.fee||o.tax||0),0);
  const initial=Number(c?.valorInicial||0), expected=initial+sales-fees;
  const informed=Number(document.getElementById('deliveryCashInformed')?.value||0);
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=fmt(v)};
  set('deliveryCashInitialView',initial);set('deliveryCashSales',sales);set('deliveryCashFees',fees);set('deliveryCashExpected',expected);set('deliveryCashDifference',informed-expected);
  const btn=document.getElementById('btnCloseDeliveryCash'); if(btn)btn.disabled=!c;
}
function renderDrivers(){
  let list=[];try{list=JSON.parse(localStorage.getItem(DELIVERY_DRIVERS_KEY)||'[]')}catch{}
  const el=document.getElementById('listaEntregadores');if(!el)return;
  el.innerHTML=list.length?list.map((d,i)=>`<div class="extra-row"><span><strong>${d.nome}</strong><small>${d.telefone||'Telefone não informado'}</small></span><button type="button" data-remove-driver="${i}" class="btn-remove-driver"><i class="bi bi-trash"></i></button></div>`).join(''):'<div class="extra-empty">Nenhum entregador cadastrado.</div>';
}
function renderReports(){
  const done=orders.filter(o=>String(o.status||'').toUpperCase()==='CONCLUIDO');
  const gross=done.reduce((a,o)=>a+Number(o.total||0),0);
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
  set('reportOrders',orders.length);set('reportGross',fmt(gross));set('reportCompleted',done.length);set('reportOpen',orders.length-done.length);
  const by={};done.forEach(o=>{const k=o.source||'Delivery';by[k]=(by[k]||0)+Number(o.total||0)});
  const el=document.getElementById('reportPlatforms');if(el)el.innerHTML=Object.keys(by).length?Object.entries(by).map(([k,v])=>`<div class="extra-row"><span><strong>${k}</strong><small>Pedidos concluídos</small></span><b>${fmt(v)}</b></div>`).join(''):'<div class="extra-empty">Nenhuma venda concluída.</div>';
}
function showDeliveryRoute(route){
  Object.values(extraPanels).forEach(p=>{if(p)p.hidden=true});
  const target=extraPanels[route]||extraPanels.central; target.hidden=false;
  const meta={central:['OPERAÇÃO OMNICHANNEL','Central de Delivery','iFood, 99Food e Anota AI em um único fluxo.'],caixa:['CONTROLE FINANCEIRO','Caixa Delivery — Abertura e Fechamento','Controle independente do caixa do Delivery.'],entregadores:['LOGÍSTICA','Entregadores','Cadastre e acompanhe os entregadores.'],relatorios:['ANÁLISE','Relatórios de Delivery','Resumo das vendas e pedidos do Delivery.'],integracoes:['CONFIGURAÇÃO','Integrações de Delivery','Conecte o NeoScale às plataformas.']}[route]||null;
  if(meta){deliveryEyebrow.textContent=meta[0];deliveryTitle.textContent=meta[1];deliverySubtitle.textContent=meta[2]}
  btnSync.hidden=route!=='central';btnClosing.hidden=true;btnConfig.hidden=route!=='central';
  if(route==='caixa')renderDeliveryCash(); if(route==='entregadores')renderDrivers(); if(route==='relatorios')renderReports();
  window.scrollTo({top:0,behavior:'smooth'});
}
function routeFromHash(){
  const h=String(location.hash||'').replace('#','');
  const route=h==='caixa-delivery'?'caixa':h==='entregadores'?'entregadores':h==='relatorios-delivery'?'relatorios':'central';
  showDeliveryRoute(route);
}
document.getElementById('btnOpenDeliveryCash')?.addEventListener('click',()=>{
  const operador=(document.getElementById('deliveryCashOperator')?.value||'').trim()||'Operador';
  const valorInicial=Math.max(0,Number(document.getElementById('deliveryCashInitial')?.value||0));
  setCashState({operador,valorInicial,observacao:(document.getElementById('deliveryCashObservation')?.value||'').trim(),abertoEm:new Date().toISOString()});
  renderDeliveryCash(); alert('Caixa Delivery aberto com sucesso.');
});
document.getElementById('deliveryCashInformed')?.addEventListener('input',renderDeliveryCash);
document.getElementById('btnCloseDeliveryCash')?.addEventListener('click',()=>{
  const c=cashState();if(!c)return;
  const sales=orders.filter(o=>String(o.status||'').toUpperCase()==='CONCLUIDO').reduce((a,o)=>a+Number(o.total||0),0);
  const fees=orders.filter(o=>String(o.status||'').toUpperCase()==='CONCLUIDO').reduce((a,o)=>a+Number(o.platformFee||o.fee||o.tax||0),0);
  const expected=Number(c.valorInicial||0)+sales-fees;const informed=Number(document.getElementById('deliveryCashInformed')?.value||0);const diff=informed-expected;
  const obs=(document.getElementById('deliveryCashCloseObservation')?.value||'').trim();
  if(Math.abs(diff)>=0.005&&!obs){alert('Informe uma observação/justificativa para a diferença.');return;}
  localStorage.setItem('neoscale_delivery_last_closing',JSON.stringify({closedAt:new Date().toISOString(),operador:c.operador,valorInicial:c.valorInicial,vendas:sales,taxas:fees,esperado:expected,informado:informed,diferenca:diff,observacao:obs}));
  localStorage.removeItem(DELIVERY_CASH_KEY); renderDeliveryCash(); alert('Caixa Delivery fechado com sucesso.');
});
document.getElementById('btnAddEntregador')?.addEventListener('click',()=>{
  const nome=(document.getElementById('entregadorNome')?.value||'').trim(); if(!nome){alert('Informe o nome do entregador.');return;}
  let list=[];try{list=JSON.parse(localStorage.getItem(DELIVERY_DRIVERS_KEY)||'[]')}catch{};list.push({nome,telefone:(document.getElementById('entregadorTelefone')?.value||'').trim()});localStorage.setItem(DELIVERY_DRIVERS_KEY,JSON.stringify(list));document.getElementById('entregadorNome').value='';document.getElementById('entregadorTelefone').value='';renderDrivers();
});
document.addEventListener('click',e=>{const b=e.target.closest('[data-remove-driver]');if(!b)return;let list=[];try{list=JSON.parse(localStorage.getItem(DELIVERY_DRIVERS_KEY)||'[]')}catch{};list.splice(Number(b.dataset.removeDriver),1);localStorage.setItem(DELIVERY_DRIVERS_KEY,JSON.stringify(list));renderDrivers();});
window.addEventListener('hashchange',routeFromHash);

window.addEventListener('neoscale:delivery-created',()=>{orders=mergeOrders([]);render();});
window.addEventListener('storage',e=>{if(e.key==='neoscale_delivery_orders'){orders=mergeOrders([]);render();}});
sync();
routeFromHash();
