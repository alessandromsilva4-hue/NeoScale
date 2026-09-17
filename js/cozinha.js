const KEY='neoscale_delivery_config';
let orders=[];
const statuses=['NOVO','PREPARO','PRONTO'];
const lists={NOVO:'listNovo',PREPARO:'listPreparo',PRONTO:'listPronto'};
const counts={NOVO:'countNovo',PREPARO:'countPreparo',PRONTO:'countPronto'};

function config(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
function serviceUrl(){return (config().serviceUrl||'').trim().replace(/\/$/,'')}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function itemHtml(x){if(typeof x==='string')return `<div class="kds-item"><b>•</b><span>${escapeHtml(x)}</span></div>`;return `<div class="kds-item"><b>${escapeHtml(x.quantity||1)}x</b><span>${escapeHtml(x.name||'Item')}</span></div>`}
function render(){
  statuses.forEach(status=>{
    const root=document.getElementById(lists[status]);
    const count=document.getElementById(counts[status]);
    const items=orders.filter(o=>o.status===status);
    count.textContent=items.length;
    root.innerHTML='';
    if(!items.length){root.innerHTML='<div class="kds-empty"><i class="bi bi-egg-fried"></i><span>Nenhum pedido aguardando nesta etapa.</span></div>';return;}
    items.forEach(o=>{
      const arr=Array.isArray(o.items)?o.items:[];
      const next=status==='NOVO'?'PREPARO':status==='PREPARO'?'PRONTO':null;
      const label=next==='PREPARO'?'Iniciar preparo':'Marcar pronto';
      root.insertAdjacentHTML('beforeend',`<article class="kds-ticket"><div class="kds-ticket-top"><strong class="kds-ticket-id">${escapeHtml(o.id||'Pedido')}</strong><span class="kds-source">${escapeHtml(o.source||'Delivery')}</span></div><div class="kds-customer">${escapeHtml(o.customer||'Cliente')}</div><div class="kds-items">${arr.length?arr.map(itemHtml).join(''):'<div class="kds-item"><span>Itens do pedido não informados.</span></div>'}</div>${o.notes?`<div class="kds-note"><strong>Observação:</strong> ${escapeHtml(o.notes)}</div>`:''}<div class="kds-ticket-foot">${next?`<button class="kds-action" data-id="${escapeHtml(o.id)}" data-next="${next}">${label}</button>`:'<span class="kds-source">Pronto para entrega</span>'}</div></article>`);
    });
  });
}

async function sync(){
  const msg=document.getElementById('kdsMessage');
  const service=serviceUrl();
  const btn=document.getElementById('btnRefresh');
  if(!service){
    orders=[];
    render();
    msg.textContent='Serviço de integração ainda não configurado. Configure a URL em Integrações de Delivery.';
    return;
  }
  const old=btn.innerHTML;
  btn.disabled=true;
  btn.innerHTML='<i class="bi bi-arrow-repeat"></i> Atualizando...';
  try{
    const r=await fetch(service+'/api/delivery/sync',{method:'POST'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const data=await r.json();
    orders=Array.isArray(data.orders)?data.orders:[];
    render();
    msg.textContent=`KDS atualizado às ${new Date().toLocaleTimeString('pt-BR')}.`;
  }catch(e){
    try{
      const r=await fetch(service+'/api/delivery/orders');
      if(!r.ok)throw new Error('HTTP '+r.status);
      const data=await r.json();
      orders=Array.isArray(data.orders)?data.orders:[];
      render();
      msg.textContent=`Fila atualizada às ${new Date().toLocaleTimeString('pt-BR')}.`;
    }catch(fallback){
      orders=[];
      render();
      msg.textContent=`Não foi possível atualizar o KDS: ${e.message}.`;
      console.error(e);
    }
  }finally{
    btn.disabled=false;
    btn.innerHTML=old;
  }
}
async function update(id,next,button){
  const service=serviceUrl();
  button.disabled=true;
  try{
    if(!service)throw new Error('Serviço não configurado.');
    const r=await fetch(service+'/api/delivery/orders/'+encodeURIComponent(id)+'/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:next})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||('HTTP '+r.status));
    const order=orders.find(o=>o.id===id);
    if(order)order.status=next;
    render();
  }catch(e){alert('Não foi possível atualizar o pedido.\n\n'+e.message);button.disabled=false}
}

document.addEventListener('click',e=>{const b=e.target.closest('[data-id][data-next]');if(!b)return;update(b.dataset.id,b.dataset.next,b)});
document.getElementById('btnRefresh').addEventListener('click',sync);
setInterval(sync,10000);
setInterval(()=>{document.getElementById('kdsClock').textContent=new Date().toLocaleTimeString('pt-BR')},1000);
sync();
