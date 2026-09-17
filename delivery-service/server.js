import express from 'express';
import cors from 'cors';
const app=express(); app.use(cors()); app.use(express.json({limit:'2mb'}));
const PORT=process.env.PORT||8787;
const PRINTER_SERVICE_URL=String(process.env.PRINTER_SERVICE_URL||'http://localhost:9100').replace(/\/$/,'');
const DEFAULT_PRINTER_IP=String(process.env.PRINTER_IP||'');
const DEFAULT_PRINTER_PORT=Number(process.env.PRINTER_PORT||9100);
let orders=new Map();
const printLog=new Map();

const normalize=(o,source)=>({
 id:o.id||o.orderId||`${source}-${Date.now()}`,
 source,
 externalId:o.id||o.orderId||'',
 displayId:o.displayId||o.code||o.orderNumber||o.id||'',
 customer:o.customer?.name||o.customerName||o.customer?.firstName||'Cliente',
 status:mapStatus(o.status),
 items:(o.items||o.products||[]).map(i=>({quantity:Number(i.quantity||1),name:i.name||i.description||i.title||'Item',notes:i.notes||i.observations||''})),
 total:Number(o.total?.value??o.total??o.amount??0),
 deliveryType:o.orderType||o.deliveryType||'DELIVERY',
 deliveredBy:o.deliveredBy||'',
 address:o.delivery?.address||o.address||null,
 createdAt:o.createdAt||new Date().toISOString()
});
function mapStatus(s){const x=String(s||'NEW').toUpperCase();if(['PLACED','NEW','CONFIRMED','PENDING','RECEIVED'].includes(x))return 'NOVO';if(['PREPARATION_STARTED','PREPARING','IN_PREPARATION','ACCEPTED'].includes(x))return 'PREPARO';if(['READY_TO_PICKUP','READY','READY_FOR_DELIVERY','PREPARED'].includes(x))return 'PRONTO';if(['DISPATCHED','OUT_FOR_DELIVERY','IN_DELIVERY','DELIVERY'].includes(x))return 'ENTREGA';if(['CONCLUDED','DELIVERED','COMPLETED','FINISHED'].includes(x))return 'CONCLUIDO';return 'NOVO'}
function esc(v){return String(v??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
function money(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function buildKitchenEscPos(o){
 const out=[]; const push=s=>out.push(Buffer.from(s,'utf8'));
 const init=Buffer.from([0x1b,0x40]), boldOn=Buffer.from([0x1b,0x45,0x01]), boldOff=Buffer.from([0x1b,0x45,0x00]);
 const center=Buffer.from([0x1b,0x61,0x01]), left=Buffer.from([0x1b,0x61,0x00]), cut=Buffer.from([0x1d,0x56,0x00]);
 out.push(init,center,boldOn); push('NEOSCALE\n'); out.push(boldOff); push('COZINHA - DELIVERY\n');
 push('--------------------------------\n'); out.push(left,boldOn); push(`PEDIDO: ${o.displayId||o.id}\n`); out.push(boldOff);
 push(`ORIGEM: ${o.source}\nCLIENTE: ${o.customer}\n`); if(o.deliveryType) push(`TIPO: ${o.deliveryType}\n`); push(`DATA: ${new Date().toLocaleString('pt-BR')}\n`); push('--------------------------------\n');
 for(const item of o.items||[]){out.push(boldOn); push(`${item.quantity}x ${item.name}\n`); out.push(boldOff); if(item.notes) push(`  Obs: ${item.notes}\n`);}
 push('--------------------------------\n'); out.push(boldOn); push(`TOTAL: ${money(o.total)}\n`); out.push(boldOff); push('\n*** PREPARAR PEDIDO ***\n\n\n'); out.push(cut); return Buffer.concat(out);
}
async function printKitchen(o){
 const key=o.id; if(printLog.has(key)) return {alreadyPrinted:true,...printLog.get(key)};
 const body=buildKitchenEscPos(o);
 const ip=String(process.env.PRINTER_IP||'').trim(); const port=Number(process.env.PRINTER_PORT||9100);
 if(!ip) throw new Error('PRINTER_IP não configurado no delivery-service.');
 const r=await fetch(`${PRINTER_SERVICE_URL}/print`,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Printer-IP':ip,'X-Printer-Port':String(port)},body});
 if(!r.ok) throw new Error(`Printer Service HTTP ${r.status}: ${await r.text()}`);
 const result={printedAt:new Date().toISOString(),printerIp:ip,printerPort:port}; printLog.set(key,result); return result;
}
app.get('/health',(req,res)=>res.json({ok:true,service:'neoscale-delivery',printerService:PRINTER_SERVICE_URL}));
async function syncIfoodIntoMemory(){
  const id=process.env.IFOOD_CLIENT_ID, secret=process.env.IFOOD_CLIENT_SECRET;
  if(!id||!secret) return {configured:false,events:0};
  const token=await getIfoodToken();
  const r=await fetch('https://merchant-api.ifood.com.br/order/v1.0/orders:polling',{headers:{Authorization:`Bearer ${token}`}});
  if(!r.ok) throw new Error(`iFood polling ${r.status}: ${await r.text()}`);
  const d=await r.json();
  let events=0;
  for(const e of d.events||[]){
    if(!e.orderId) continue;
    events++;
    let detail=e.metadata||{};
    if(!e.metadata){
      const dr=await fetch(`https://merchant-api.ifood.com.br/order/v1.0/orders/${encodeURIComponent(e.orderId)}`,{headers:{Authorization:`Bearer ${token}`}});
      if(dr.ok) detail=await dr.json();
    }
    const o=normalize({...detail,id:e.orderId},'iFood');
    orders.set(o.id,o);
  }
  return {configured:true,events};
}
app.post('/api/delivery/sync',async(req,res)=>{
  const result={events:0,platforms:{},orders:[]};
  try{
    const ifood=await syncIfoodIntoMemory();
    result.platforms.iFood=ifood.configured?'Conectado':'Não configurado';
    result.events+=ifood.events;
  }catch(e){
    result.platforms.iFood='Falha na conexão';
    result.warning=e.message;
  }
  result.orders=[...orders.values()];
  res.json(result);
});
app.get('/api/delivery/orders',(req,res)=>res.json({orders:[...orders.values()]}));
app.get('/api/delivery/orders/:id/print-status',(req,res)=>res.json({printed:Boolean(printLog.get(req.params.id)),data:printLog.get(req.params.id)||null}));
app.post('/api/delivery/orders/:id/print-kitchen',async(req,res)=>{const o=orders.get(req.params.id);if(!o)return res.status(404).json({error:'Pedido não encontrado'});try{const result=await printKitchen(o);res.json({ok:true,orderId:o.id,...result})}catch(e){res.status(502).json({ok:false,error:e.message})}});

async function updateIfood(o,status){
 const token=await getIfoodToken(); const base='https://merchant-api.ifood.com.br/order/v1.0/orders/'+encodeURIComponent(o.externalId||o.id);
 let endpoint='/readyToPickup',body;
 if(status==='PRONTO' && String(o.deliveredBy||'').toUpperCase()==='MERCHANT'){endpoint='/dispatch';body={deliveredBy:'MERCHANT'}}
 else if(status==='ENTREGA'){endpoint='/dispatch';body={deliveredBy:'MERCHANT'}}
 const r=await fetch(base+endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 if(!r.ok) throw new Error(`iFood ${endpoint} ${r.status}: ${await r.text()}`); return {platform:'iFood',endpoint,remoteStatus:status};
}
async function updateConfigurable(source,o,status){
 const prefix=source==='99Food'?'99FOOD':'ANOTA'; const url=String(process.env[`${prefix}_READY_URL`]||'').trim();
 if(!url) return {platform:source,remoteStatus:'PENDENTE_CONFIGURACAO',message:`Endpoint de status ${source} não configurado. Homologar contrato antes de produção.`};
 const headers={'Content-Type':'application/json'}; const token=process.env[`${prefix}_ACCESS_TOKEN`]; if(token) headers.Authorization=`Bearer ${token}`;
 const r=await fetch(url,{method:'POST',headers,body:JSON.stringify({orderId:o.externalId||o.id,status:'READY',neoscaleStatus:status})});
 if(!r.ok) throw new Error(`${source} status ${r.status}: ${await r.text()}`); return {platform:source,remoteStatus:'READY'};
}
async function updatePlatform(o,status){
 if(o.source==='iFood') return updateIfood(o,status);
 if(o.source==='99Food') return updateConfigurable('99Food',o,status);
 if(o.source==='Anota AI') return updateConfigurable('Anota AI',o,status);
 return {platform:o.source,remoteStatus:'LOCAL'};
}
app.post('/api/delivery/orders/:id/status',async(req,res)=>{const o=orders.get(req.params.id);if(!o)return res.status(404).json({error:'Pedido não encontrado'});const status=req.body.status||o.status;try{let platform=null;if(status==='PRONTO'||status==='ENTREGA')platform=await updatePlatform(o,status);o.status=status;o.lastPlatformUpdate=platform;orders.set(o.id,o);res.json({ok:true,order:o,platform})}catch(e){res.status(502).json({ok:false,error:e.message,order:o})}});

let ifoodToken=null,ifoodExpiresAt=0;
async function getIfoodToken(){if(ifoodToken&&Date.now()<ifoodExpiresAt-60000)return ifoodToken;const id=process.env.IFOOD_CLIENT_ID,secret=process.env.IFOOD_CLIENT_SECRET;if(!id||!secret)throw new Error('Credenciais iFood ausentes');const r=await fetch('https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grantType:'client_credentials',clientId:id,clientSecret:secret})});if(!r.ok)throw new Error(`iFood auth ${r.status}`);const d=await r.json();ifoodToken=d.accessToken;ifoodExpiresAt=Date.now()+Number(d.expiresIn||21600)*1000;return ifoodToken}
app.post('/api/delivery/sync/ifood',async(req,res)=>{try{const token=await getIfoodToken();const r=await fetch('https://merchant-api.ifood.com.br/order/v1.0/orders:polling',{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error(`iFood polling ${r.status}`);const d=await r.json();for(const e of d.events||[]){if(e.orderId){let detail=e.metadata||{};if(!e.metadata){const dr=await fetch(`https://merchant-api.ifood.com.br/order/v1.0/orders/${e.orderId}`,{headers:{Authorization:`Bearer ${token}`}});if(dr.ok)detail=await dr.json()}const o=normalize({...detail,id:e.orderId},'iFood');orders.set(o.id,o)}}res.json({ok:true,events:(d.events||[]).length,orders:[...orders.values()]})}catch(e){res.status(502).json({error:e.message})}});
app.post('/api/webhooks/99food',(req,res)=>{const o=normalize(req.body,'99Food');orders.set(o.id,o);res.status(202).json({received:true,id:o.id})});
app.post('/api/webhooks/anota',(req,res)=>{const o=normalize(req.body,'Anota AI');orders.set(o.id,o);res.status(202).json({received:true,id:o.id})});
app.listen(PORT,()=>console.log(`NeoScale Delivery Service em http://localhost:${PORT}`));
