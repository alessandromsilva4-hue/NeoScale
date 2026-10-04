import { db } from './firebase.js';
import { collection, getDocs, query, orderBy, limit, updateDoc, doc, serverTimestamp, writeBatch, setDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { caixaAberto } from './caixa.js';
import { finalizarComanda } from './comandas.js';

const lista = document.getElementById('listaComandas');
const busca = document.getElementById('buscaComanda');
const filtro = document.getElementById('filtroStatus');
let comandas = [];
const money = v => `R$ ${Number(v||0).toFixed(2).replace('.', ',')}`;
const esc = v => String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
function data(v){ if(!v) return '-'; const d=v.toDate?v.toDate():new Date(v); return isNaN(d)?'-':d.toLocaleString('pt-BR'); }
function status(s){ const c=s==='ABERTA'?'aberta':s==='FINALIZADA'?'finalizada':s==='TRANSFERIDA'?'transferida':'cancelada'; const label=s==='TRANSFERIDA'?'TRANSFERIDA':(s||'-'); return `<span class="badge ${c}">${esc(label)}</span>`; }
function render(){
 const termo=busca.value.trim().toLowerCase(), fs=filtro.value;
 const itens=comandas.filter(c=>!c.ocultaOperacional && c.status!=='FINALIZADA' && (fs==='TODAS'||c.status===fs)&&(!termo||[c.numero,c.codigoBarras,c.produto,c.tipo,...(Array.isArray(c.itens)?c.itens.map(i=>i.nome):[])].some(x=>String(x||'').toLowerCase().includes(termo))));
 lista.innerHTML=itens.length?itens.map(c=>{
  const tipo=c.tipo==='PROVISORIA'?'PROVISÓRIA':'PESAGEM';
  const cls=c.status==='CANCELADA'?'cancelada':(c.tipo==='PROVISORIA'?'provisoria':'peso');
  const badge=c.status==='CANCELADA'?'CANCELADA':(c.status==='FINALIZADA'?'FINALIZADA':tipo);
  const detalhe=c.tipo==='PROVISORIA'?(Array.isArray(c.itens)?`${c.itens.length} item(ns)`:'0 item(ns)'):(c.peso!=null?Number(c.peso).toFixed(3).replace('.',',')+' kg':'-');
  return `<article class="comanda-card ${cls}" data-open-card="${esc(c.id)}">
    <div class="comanda-card-top"><div><div class="comanda-number">#${esc(c.numero||'-')}</div><div class="comanda-type">${tipo}</div></div><span class="comanda-badge">${badge}</span></div>
    <div class="comanda-info"><div><span>${c.tipo==='PROVISORIA'?'Itens':'Peso'}</span><strong>${esc(detalhe)}</strong></div><div><span>Total</span><strong class="comanda-total">${money(c.total)}</strong></div></div>
    <div class="comanda-actions"><button class="view" data-view="${esc(c.id)}"><i class="bi bi-eye"></i> Abrir</button>${c.status==='ABERTA'?`<button class="finish" data-finish="${esc(c.id)}"><i class="bi bi-check2"></i> Finalizar</button>`:''}${c.status==='CANCELADA'?`<button class="delete" data-delete-cancel="${esc(c.id)}" title="Apagar cancelada"><i class="bi bi-trash3"></i></button>`:''}</div>
  </article>`;
 }).join(''):'<div class="comanda-empty"><i class="bi bi-inbox" style="font-size:30px;display:block;margin-bottom:8px"></i>Nenhuma comanda encontrada.</div>';
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=e=>{e.stopPropagation();abrir(b.dataset.view)});
 document.querySelectorAll('[data-finish]').forEach(b=>b.onclick=e=>{e.stopPropagation();finalizar(b.dataset.finish)});
 document.querySelectorAll('[data-delete-cancel]').forEach(b=>b.onclick=e=>{e.stopPropagation();apagarCancelada(b.dataset.deleteCancel)});

 document.querySelectorAll('[data-open-card]').forEach(b=>b.onclick=()=>abrir(b.dataset.openCard));
 const abertas=comandas.filter(c=>c.status==='ABERTA'); document.getElementById('statAbertas').textContent=abertas.length; document.getElementById('statFinalizadas').textContent='0'; document.getElementById('statCanceladas').textContent=comandas.filter(c=>c.status==='CANCELADA'&&!c.ocultaOperacional).length; document.getElementById('statValor').textContent=money(abertas.reduce((s,c)=>s+Number(c.total||0),0));
}
async function carregar(){ lista.innerHTML='<div class="comanda-empty">Carregando...</div>'; try{ const snap=await getDocs(query(collection(db,'comandas'),orderBy('criadoEm','desc'),limit(300))); comandas=snap.docs.map(d=>({id:d.id,...d.data()}));
 render(); }catch(e){ console.error(e); lista.innerHTML='<div class="comanda-empty">Não foi possível carregar as comandas.</div>'; } }
function abrir(id){ const c=comandas.find(x=>x.id===id); if(!c)return; document.getElementById('modalTitulo').textContent=`Comanda #${c.numero||''}`; document.getElementById('detalheComanda').innerHTML=`<div class="detail-grid"><div><span>Status</span>${status(c.status)}</div><div><span>Total</span><strong>${money(c.total)}</strong></div><div><span>Tipo</span><strong>${c.tipo==='PROVISORIA'?'Comanda provisória':'Comanda de pesagem'}</strong></div><div><span>Produto</span><strong>${esc(c.produto||'-')}</strong></div><div><span>Peso</span><strong>${c.peso!=null?Number(c.peso).toFixed(3).replace('.',',')+' kg':'-'}</strong></div><div><span>Itens</span><strong>${Array.isArray(c.itens)?c.itens.map(i=>`${Number(i.quantidade||0)}x ${esc(i.nome||'Produto')}`).join('<br>'):'-'}</strong></div><div><span>Código</span><strong>${esc(c.codigoBarras||'-')}</strong></div><div><span>Criada em</span><strong>${data(c.criadoEm)}</strong></div></div>`; const a=document.getElementById('acoesComanda'); a.innerHTML=c.status==='ABERTA'?`<button class="btn-danger" id="cancelarModal">Cancelar comanda</button><button class="btn-primary" id="finalizarModal">Finalizar pagamento</button>`:`<span class="muted">Esta comanda não está mais aberta.</span>`; document.getElementById('modalComanda').hidden=false; document.getElementById('cancelarModal')?.addEventListener('click',()=>cancelar(c.id)); document.getElementById('finalizarModal')?.addEventListener('click',()=>finalizar(c.id)); }
async function arquivarCancelada(c){
 const ref=doc(db,'cancelamentosComandas',c.id);
 await setDoc(ref,{...c,origemComandaId:c.id,arquivadaEm:serverTimestamp(),status:'CANCELADA'},{merge:true});
}
async function cancelar(id){
 const c=comandas.find(x=>x.id===id); if(!c)return;
 const motivo=prompt(`Informe o motivo do cancelamento da comanda #${c.numero||''}:`, '');
 if(motivo===null)return;
 const texto=motivo.trim(); if(!texto){alert('Informe o motivo do cancelamento.');return;}
 try{
  await updateDoc(doc(db,'comandas',id),{status:'CANCELADA',motivoCancelamento:texto,canceladaEm:serverTimestamp(),canceladaPor:localStorage.getItem('usuarioNome')||localStorage.getItem('usuario')||'Operador'});
  const atualizado={...c,status:'CANCELADA',motivoCancelamento:texto}; await arquivarCancelada(atualizado);
  document.getElementById('modalComanda').hidden=true; await carregar();
 }catch(e){alert('Não foi possível cancelar a comanda.');console.error(e);} 
}
async function apagarCancelada(id){
 const c=comandas.find(x=>x.id===id); if(!c||c.status!=='CANCELADA')return;
 if(!confirm(`Apagar definitivamente a comanda cancelada #${c.numero||''}?\n\nEla será removida da tela de comandas, mas o registro de auditoria do cancelamento será preservado.`))return;
 try{ await arquivarCancelada(c); await deleteDoc(doc(db,'comandas',id)); await carregar(); }
 catch(e){ console.error(e); alert('Não foi possível apagar a comanda cancelada. Verifique as permissões do Firestore.'); }
}
async function apagarTodosCancelados(){
 const canceladas=comandas.filter(c=>c.status==='CANCELADA');
 if(!canceladas.length){alert('Não há comandas canceladas para apagar.');return;}
 if(!confirm(`Apagar ${canceladas.length} comanda(s) cancelada(s) da tela?\n\nOs registros de auditoria dos cancelamentos serão preservados.`))return;
 try{
  const batch=writeBatch(db);
  for(const c of canceladas){
   const arq=doc(db,'cancelamentosComandas',c.id); batch.set(arq,{...c,origemComandaId:c.id,arquivadaEm:serverTimestamp(),status:'CANCELADA'},{merge:true});
   batch.delete(doc(db,'comandas',c.id));
  }
  await batch.commit(); await carregar();
 }catch(e){ console.error(e); alert('Não foi possível apagar as comandas canceladas. Verifique as permissões do Firestore.'); }
}
async function finalizar(id){ const c=comandas.find(x=>x.id===id); if(!c)return; try{const caixa=await caixaAberto(); if(!caixa){alert('Abra o caixa antes de finalizar a comanda.');return;} const forma=prompt('Forma de pagamento (PIX, DINHEIRO, CARTAO):','PIX'); if(!forma)return; await finalizarComanda(id, forma.toUpperCase()); document.getElementById('modalComanda').hidden=true; await carregar();}catch(e){alert(e.message||'Não foi possível finalizar.');console.error(e);} }
busca.addEventListener('input',render); filtro.addEventListener('change',render); document.getElementById('btnAtualizar').onclick=carregar; document.getElementById('btnApagarCanceladas')?.addEventListener('click',apagarTodosCancelados); document.getElementById('fecharModal').onclick=()=>document.getElementById('modalComanda').hidden=true; document.getElementById('modalComanda').addEventListener('click',e=>{if(e.target.id==='modalComanda')e.currentTarget.hidden=true}); carregar();
