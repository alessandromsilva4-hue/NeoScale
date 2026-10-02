import { db } from './firebase.js';
import { collection, getDocs, query, orderBy, limit, updateDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { caixaAberto } from './caixa.js';
import { finalizarComanda, adicionarItemComanda } from './comandas.js';

const lista = document.getElementById('listaComandas');
const busca = document.getElementById('buscaComanda');
const filtro = document.getElementById('filtroStatus');
let comandas = [];
let produtosEdicao = [];
let pendentesEdicao = [];
let modoEdicao = false;
const money = v => `R$ ${Number(v||0).toFixed(2).replace('.', ',')}`;
const esc = v => String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
function data(v){ if(!v) return '-'; const d=v.toDate?v.toDate():new Date(v); return isNaN(d)?'-':d.toLocaleString('pt-BR'); }
function status(s){ const c=s==='ABERTA'?'aberta':s==='FINALIZADA'?'finalizada':s==='TRANSFERIDA'?'transferida':'cancelada'; const label=s==='TRANSFERIDA'?'TRANSFERIDA':(s||'-'); return `<span class="badge ${c}">${esc(label)}</span>`; }
function render(){
 const termo=busca.value.trim().toLowerCase(), fs=filtro.value;
 const itens=comandas.filter(c=>(fs==='TODAS'||c.status===fs)&&(!termo||[c.numero,c.codigoBarras,c.produto,c.tipo,...(Array.isArray(c.itens)?c.itens.map(i=>i.nome):[])].some(x=>String(x||'').toLowerCase().includes(termo))));
 lista.innerHTML=itens.length?itens.map(c=>{
   const provisoria=c.tipo==='PROVISORIA';
   const itemCount=Array.isArray(c.itens)?c.itens.reduce((n,i)=>n+Number(i.quantidade||0),0):0;
   const detalhe=c.peso!=null?`${Number(c.peso).toFixed(3).replace('.',',')} kg`:itemCount?`${itemCount} item(ns)`:'Sem itens';
   const produto=provisoria?'Comanda provisória':esc(c.produto||'Refeição');
   const classeStatus=c.status==='ABERTA'?'aberta':c.status==='FINALIZADA'?'finalizada':c.status==='TRANSFERIDA'?'transferida':'cancelada';
   const classeTipo=provisoria?'provisoria':'pesagem';
   return `<article class="comanda-card ${classeTipo}" data-open="${esc(c.id)}" tabindex="0" role="button" aria-label="Abrir comanda ${esc(c.numero||'-')}">
     <div class="comanda-card-top">
       <div>
         <span class="comanda-eyebrow">${provisoria?'PROVISÓRIA':'PESAGEM'}</span>
         <strong class="comanda-numero">#${esc(c.numero||'-')}</strong>
       </div>
       <span class="badge ${classeStatus}">${esc(c.status||'-')}</span>
     </div>
     <div class="comanda-card-body">
       <span class="comanda-produto">${produto}</span>
       <span class="comanda-info"><i class="bi ${c.peso!=null?'bi-speedometer2':'bi-basket2'}"></i>${detalhe}</span>
     </div>
     <div class="comanda-card-bottom">
       <strong class="comanda-total">${money(c.total)}</strong>
       <span class="comanda-data">${data(c.criadoEm)}</span>
     </div>
     <div class="comanda-card-actions">
       <button class="btn-open-comanda" type="button" data-view="${esc(c.id)}"><i class="bi bi-eye"></i> Abrir comanda</button>
       ${c.status==='ABERTA'?`<button class="table-btn danger" type="button" data-cancel="${esc(c.id)}" title="Cancelar"><i class="bi bi-x-circle"></i></button>`:''}
     </div>
   </article>`;
 }).join(''):'<div class="empty grid-empty">Nenhuma comanda encontrada.</div>';
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=e=>{e.stopPropagation();abrir(b.dataset.view)});
 document.querySelectorAll('[data-open]').forEach(card=>{card.onclick=()=>abrir(card.dataset.open);card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();abrir(card.dataset.open)}}});
 document.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=e=>{e.stopPropagation();cancelar(b.dataset.cancel)});
 const abertas=comandas.filter(c=>c.status==='ABERTA'); document.getElementById('statAbertas').textContent=abertas.length; document.getElementById('statFinalizadas').textContent=comandas.filter(c=>c.status==='FINALIZADA').length; document.getElementById('statCanceladas').textContent=comandas.filter(c=>c.status==='CANCELADA').length; document.getElementById('statValor').textContent=money(abertas.reduce((s,c)=>s+Number(c.total||0),0));
}
async function carregar(){ lista.innerHTML='<div class="empty grid-empty">Carregando...</div>'; try{ const snap=await getDocs(query(collection(db,'comandas'),orderBy('criadoEm','desc'),limit(300))); comandas=snap.docs.map(d=>({id:d.id,...d.data()})); render(); }catch(e){ console.error(e); lista.innerHTML='<div class="empty grid-empty">Não foi possível carregar as comandas.</div>'; } }
function abrir(id){
 const c=comandas.find(x=>x.id===id); if(!c)return;
 modoEdicao=false; pendentesEdicao=[];
 document.getElementById('modalTitulo').textContent=`Comanda #${c.numero||''}`;
 renderDetalhe(c);
 document.getElementById('modalComanda').hidden=false;
}

function renderDetalhe(c){
 const itens=Array.isArray(c.itens)?c.itens:[];
 document.getElementById('detalheComanda').innerHTML=`<div class="detail-grid">
   <div><span>Status</span>${status(c.status)}</div>
   <div><span>Total</span><strong>${money(c.total)}</strong></div>
   <div><span>Tipo</span><strong>${c.tipo==='PROVISORIA'?'Comanda provisória':'Comanda de pesagem'}</strong></div>
   <div><span>Produto</span><strong>${esc(c.produto||'-')}</strong></div>
   <div><span>Peso</span><strong>${c.peso!=null?Number(c.peso).toFixed(3).replace('.',',')+' kg':'-'}</strong></div>
   <div><span>Itens</span><strong>${itens.length?itens.map(i=>`${Number(i.quantidade||0)}x ${esc(i.nome||'Produto')} — ${money(i.total ?? Number(i.preco||0)*Number(i.quantidade||0))}`).join('<br>'):'Nenhum item'}</strong></div>
   <div><span>Código</span><strong>${esc(c.codigoBarras||'-')}</strong></div>
   <div><span>Criada em</span><strong>${data(c.criadoEm)}</strong></div>
 </div>`;
 const a=document.getElementById('acoesComanda');
 a.innerHTML=c.status==='ABERTA'
   ? `<button class="btn-secondary" id="reabrirModal"><i class="bi bi-pencil-square"></i> Reabrir para edição</button><button class="btn-danger" id="cancelarModal">Cancelar comanda</button><button class="btn-primary" id="finalizarModal">Finalizar pagamento</button>`
   : `<span class="muted">Esta comanda não está mais aberta.</span>`;
 document.getElementById('reabrirModal')?.addEventListener('click',()=>reabrirEdicao(c.id));
 document.getElementById('cancelarModal')?.addEventListener('click',()=>cancelar(c.id));
 document.getElementById('finalizarModal')?.addEventListener('click',()=>finalizar(c.id));
}

async function carregarProdutosEdicao(){
 if(produtosEdicao.length)return;
 const snap=await getDocs(collection(db,'produtos'));
 produtosEdicao=snap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.ativo!==false && p.tipoVenda!=='peso');
}

async function reabrirEdicao(id){
 const c=comandas.find(x=>x.id===id); if(!c || c.status!=='ABERTA')return;
 try{
   await carregarProdutosEdicao();
   pendentesEdicao=[]; modoEdicao=true;
   renderEditor(c);
 }catch(e){console.error(e);alert('Não foi possível carregar os produtos para edição.');}
}

function renderEditor(c){
 const itens=Array.isArray(c.itens)?c.itens:[];
 document.getElementById('modalTitulo').textContent=`Editar comanda #${c.numero||''}`;
 document.getElementById('detalheComanda').innerHTML=`
   <div class="editor-resumo"><div><span>Tipo</span><strong>${c.tipo==='PROVISORIA'?'PROVISÓRIA':'PESAGEM'}</strong></div><div><span>Total atual</span><strong>${money(c.total)}</strong></div></div>
   <div class="editor-section"><div class="editor-section-title"><strong>Itens já lançados</strong><span>${itens.length} item(ns)</span></div>
   <div class="editor-itens">${itens.length?itens.map(i=>`<div class="editor-line"><span>${Number(i.quantidade||0)}x ${esc(i.nome||'Produto')}</span><strong>${money(i.total ?? Number(i.preco||0)*Number(i.quantidade||0))}</strong></div>`).join(''):'<div class="muted">Nenhum item lançado.</div>'}</div></div>
   <div class="editor-section"><div class="editor-section-title"><strong>Adicionar produtos</strong><span>Selecione os itens e envie</span></div>
   <input id="buscaProdutoCaixa" class="editor-search" placeholder="Buscar produto..." autocomplete="off">
   <div id="produtosCaixa" class="editor-products"></div></div>
   <div class="editor-section"><div class="editor-section-title"><strong>Pendentes</strong><span id="totalPendenteCaixa">R$ 0,00</span></div><div id="pendentesCaixa" class="editor-pendentes"><div class="muted">Nenhum item selecionado.</div></div></div>`;
 const a=document.getElementById('acoesComanda');
 a.innerHTML=`<button class="btn-secondary" id="voltarDetalhe">Voltar</button><button class="btn-secondary" id="cancelarPendentesCaixa">Cancelar itens</button><button class="btn-primary" id="enviarPendentesCaixa"><i class="bi bi-send"></i> Enviar itens</button>`;
 renderProdutosEdicao(c); renderPendentesEdicao();
 document.getElementById('buscaProdutoCaixa').addEventListener('input',()=>renderProdutosEdicao(c));
 document.getElementById('voltarDetalhe').onclick=()=>{pendentesEdicao=[];modoEdicao=false;renderDetalhe(c)};
 document.getElementById('cancelarPendentesCaixa').onclick=()=>{pendentesEdicao=[];renderPendentesEdicao()};
 document.getElementById('enviarPendentesCaixa').onclick=()=>enviarPendentesCaixa(c.id);
 setTimeout(()=>document.getElementById('buscaProdutoCaixa')?.focus(),30);
}

function renderProdutosEdicao(c){
 const el=document.getElementById('produtosCaixa'); if(!el)return;
 const termo=(document.getElementById('buscaProdutoCaixa')?.value||'').trim().toLowerCase();
 const lista=produtosEdicao.filter(p=>!termo||String(p.nome||'').toLowerCase().includes(termo)).slice(0,80);
 el.innerHTML=lista.length?lista.map(p=>`<button type="button" class="editor-product" data-prod="${esc(p.id)}"><strong>${esc(p.nome||'Produto')}</strong><span>${money(p.precoUnit ?? p.preco ?? 0)}</span></button>`).join(''):'<div class="muted">Nenhum produto encontrado.</div>';
 el.querySelectorAll('[data-prod]').forEach(b=>b.onclick=()=>{const p=produtosEdicao.find(x=>x.id===b.dataset.prod);if(!p)return;const idx=pendentesEdicao.findIndex(x=>x.produtoId===p.id&&x.tipo==='UNIDADE');if(idx>=0)pendentesEdicao[idx].quantidade=Number(pendentesEdicao[idx].quantidade||0)+1;else pendentesEdicao.push({produtoId:p.id,nome:p.nome||'Produto',preco:Number(p.precoUnit ?? p.preco ?? 0),quantidade:1,tipo:'UNIDADE'});renderPendentesEdicao();});
}

function renderPendentesEdicao(){
 const el=document.getElementById('pendentesCaixa'); if(!el)return;
 const total=pendentesEdicao.reduce((s,i)=>s+Number(i.preco||0)*Number(i.quantidade||0),0);
 document.getElementById('totalPendenteCaixa').textContent=money(total);
 el.innerHTML=pendentesEdicao.length?pendentesEdicao.map((i,idx)=>`<div class="editor-line pending"><span>${Number(i.quantidade||0)}x ${esc(i.nome)}</span><strong>${money(Number(i.preco||0)*Number(i.quantidade||0))}<button type="button" class="remove-editor" data-remover="${idx}"><i class="bi bi-x"></i></button></strong></div>`).join(''):'<div class="muted">Nenhum item selecionado.</div>';
 el.querySelectorAll('[data-remover]').forEach(b=>b.onclick=()=>{pendentesEdicao.splice(Number(b.dataset.remover),1);renderPendentesEdicao()});
}

async function enviarPendentesCaixa(id){
 if(!pendentesEdicao.length){alert('Nenhum item selecionado para enviar.');return;}
 const c=comandas.find(x=>x.id===id); if(!c)return;
 if(!confirm(`Enviar os itens para a comanda #${c.numero}?`))return;
 try{
   let atual=c;
   for(const item of pendentesEdicao) atual=await adicionarItemComanda(id,item);
   const idx=comandas.findIndex(x=>x.id===id); if(idx>=0)comandas[idx]={...comandas[idx],...atual};
   pendentesEdicao=[]; modoEdicao=false;
   renderDetalhe(comandas[idx]); render();
   alert('Itens enviados para a comanda.');
 }catch(e){console.error(e);alert(e.message||'Não foi possível enviar os itens.');}
}

async function cancelar(id){ if(!confirm('Cancelar esta comanda?'))return; try{await updateDoc(doc(db,'comandas',id),{status:'CANCELADA',canceladaEm:serverTimestamp()}); document.getElementById('modalComanda').hidden=true; await carregar();}catch(e){alert('Não foi possível cancelar a comanda.');console.error(e);} }
async function finalizar(id){ const c=comandas.find(x=>x.id===id); if(!c)return; try{const caixa=await caixaAberto(); if(!caixa){alert('Abra o caixa antes de finalizar a comanda.');return;} const forma=prompt('Forma de pagamento (PIX, DINHEIRO, CARTAO):','PIX'); if(!forma)return; await finalizarComanda(id, forma.toUpperCase()); document.getElementById('modalComanda').hidden=true; await carregar();}catch(e){alert(e.message||'Não foi possível finalizar.');console.error(e);} }
busca.addEventListener('input',render); filtro.addEventListener('change',render); document.getElementById('btnAtualizar').onclick=carregar; document.getElementById('fecharModal').onclick=()=>document.getElementById('modalComanda').hidden=true; document.getElementById('modalComanda').addEventListener('click',e=>{if(e.target.id==='modalComanda')e.currentTarget.hidden=true}); carregar();
