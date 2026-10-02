import { db } from './firebase.js';
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const $=id=>document.getElementById(id);
const br=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dt=v=>v?.toDate?v.toDate():v?new Date(v):null;
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let movimentos=[], caixas=[], pedidos=[];

function periodo(){
 const inicio=$('relInicio').value?new Date($('relInicio').value+'T00:00:00'):null;
 const fim=$('relFim').value?new Date($('relFim').value+'T23:59:59'):null;
 return {inicio,fim};
}
function dentro(v){const d=dt(v);if(!d)return false;const {inicio,fim}=periodo();return (!inicio||d>=inicio)&&(!fim||d<=fim)}
function valorMov(tipo){return movimentos.filter(m=>m.tipo===tipo&&dentro(m.criadoEm)).reduce((a,m)=>a+Number(m.valor||0),0)}
function pagamentos(){
 const map={DINHEIRO:0,PIX:0,'CRÉDITO':0,'DÉBITO':0,OUTROS:0};
 movimentos.filter(m=>m.tipo==='VENDA'&&dentro(m.criadoEm)).forEach(m=>{const k=String(m.forma||'OUTROS').toUpperCase();if(k.includes('DINHEIRO'))map.DINHEIRO+=Number(m.valor||0);else if(k.includes('PIX'))map.PIX+=Number(m.valor||0);else if(k.includes('CRÉDITO')||k.includes('CREDITO'))map['CRÉDITO']+=Number(m.valor||0);else if(k.includes('DÉBITO')||k.includes('DEBITO'))map['DÉBITO']+=Number(m.valor||0);else map.OUTROS+=Number(m.valor||0)});return map;
}
function delivery(){
 let rows=[];try{rows=JSON.parse(localStorage.getItem('neoscale_delivery_orders')||'[]')}catch{}
 const map={IFOOD:0,'99FOOD':0,'ANOTA AI':0,BALCÃO:0};
 rows.filter(o=>dentro(o.criadoEm||o.data||o.createdAt)).forEach(o=>{const s=String(o.source||o.platform||o.canal||o.origem||'BALCÃO').toUpperCase();const k=s.includes('IFOOD')?'IFOOD':s.includes('99')?'99FOOD':s.includes('ANOTA')?'ANOTA AI':'BALCÃO';map[k]+=Number(o.total||o.valor||0)});return map;
}
function render(){
 const vendas=valorMov('VENDA'), entradas=valorMov('SUPRIMENTO')+vendas, saidas=valorMov('SANGRIA')+valorMov('DESPESA');
 const vendasCount=movimentos.filter(m=>m.tipo==='VENDA'&&dentro(m.criadoEm)).length;
 $('kpiFaturamento').textContent=br(vendas);$('kpiPedidos').textContent=vendasCount.toLocaleString('pt-BR');$('kpiTicket').textContent=br(vendasCount?vendas/vendasCount:0);$('kpiProdutos').textContent=movimentos.filter(m=>m.tipo==='VENDA'&&dentro(m.criadoEm)).length.toLocaleString('pt-BR');
 const p=pagamentos(); $('pagDinheiro').textContent=br(p.DINHEIRO);$('pagPix').textContent=br(p.PIX);$('pagCredito').textContent=br(p['CRÉDITO']);$('pagDebito').textContent=br(p['DÉBITO']);$('pagOutros').textContent=br(p.OUTROS);
 const d=delivery();$('platIfood').textContent=br(d.IFOOD);$('plat99').textContent=br(d['99FOOD']);$('platAnota').textContent=br(d['ANOTA AI']);$('platBalcao').textContent=br(d['BALCÃO']);$('platTotal').textContent=br(Object.values(d).reduce((a,b)=>a+b,0));
 $('resumoVendas').textContent=br(vendas);$('resumoEntradas').textContent=br(entradas);$('resumoSaidas').textContent=br(saidas);$('resumoLiquido').textContent=br(entradas-saidas);
 const recent=movimentos.filter(m=>m.tipo==='VENDA'&&dentro(m.criadoEm)).slice().sort((a,b)=>(dt(b.criadoEm)?.getTime()||0)-(dt(a.criadoEm)?.getTime()||0)).slice(0,8);
 $('tbodyVendas').innerHTML=recent.length?recent.map(m=>`<tr><td>${dt(m.criadoEm)?.toLocaleString('pt-BR')||'—'}</td><td>${esc(m.descricao||'Venda')}</td><td>${esc(m.forma||'—')}</td><td class="money">${br(m.valor)}</td></tr>`).join(''):'<tr><td colspan="4" class="rel-empty">Nenhuma venda encontrada no período.</td></tr>';
 $('periodoLabel').textContent=`Período: ${$('relInicio').value||'—'} até ${$('relFim').value||'—'}`;
}
async function carregar(){
 try{
  const [ms,cs]=await Promise.all([getDocs(query(collection(db,'movimentosCaixa'),orderBy('criadoEm','desc'))),getDocs(query(collection(db,'caixas'),orderBy('abertoEm','desc')))]);
  movimentos=ms.docs.map(d=>({id:d.id,...d.data()}));caixas=cs.docs.map(d=>({id:d.id,...d.data()}));
 }catch(e){console.error('Relatórios:',e);movimentos=[];caixas=[]}
 render();
}
function defaults(){const now=new Date();const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());$('relInicio').value=start.toISOString().slice(0,10);$('relFim').value=now.toISOString().slice(0,10)}
$('relAplicar')?.addEventListener('click',render);$('relHoje')?.addEventListener('click',()=>{defaults();render()});$('relImprimir')?.addEventListener('click',()=>window.print());
defaults();carregar();
