import { db } from './firebase.js';
import { collection, getDocs, query, where, limit } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { criarComandaProvisoria, adicionarItemComanda, transferirItensComanda } from './comandas.js';

const $ = id => document.getElementById(id);
let comandas = [];
let produtos = [];
let selecionada = null;
let pendentes = [];
const money = v => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc = v => String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

async function carregar(){
  try{
    const [cs, ps] = await Promise.all([
      getDocs(query(collection(db,'comandas'),where('status','==','ABERTA'),limit(300))),
      getDocs(collection(db,'produtos'))
    ]);
    comandas = cs.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>{ const ta=a.tipo==='PROVISORIA'?0:1; const tb=b.tipo==='PROVISORIA'?0:1; return ta-tb || Number(a.numero)-Number(b.numero); });
    produtos = ps.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.ativo!==false && p.tipoVenda!=='peso');
    renderComandas();
    if(selecionada){ const atual=comandas.find(c=>c.id===selecionada.id); selecionada=atual||null; }
    if(selecionada) renderModal();
    renderTransferencia();
  }catch(e){
    console.error(e);
    $('listaComandasGarcom').innerHTML='<div class="command-empty"><i class="bi bi-exclamation-triangle"></i>Não foi possível carregar as comandas.</div>';
  }
}

function renderComandas(){
  const el=$('listaComandasGarcom');
  const termo=($('buscaGarcom').value||'').trim().toLowerCase();
  const filtro=$('filtroComanda').value;
  let lista=comandas.filter(c=>c.status==='ABERTA');
  lista=lista.filter(c=>{
    const numero=String(c.numero||'').toLowerCase();
    const tipo=c.tipo==='PROVISORIA'?'PROVISORIA':'PESO';
    if(termo && !numero.includes(termo)) return false;
    if(filtro==='PROVISORIA' && tipo!=='PROVISORIA') return false;
    if(filtro==='PESO' && tipo!=='PESO') return false;
    return true;
  }).sort((a,b)=>{
    const ta=a.tipo==='PROVISORIA'?0:1;
    const tb=b.tipo==='PROVISORIA'?0:1;
    return ta-tb || Number(a.numero)-Number(b.numero);
  });

  if(!lista.length){
    el.innerHTML='<div class="command-empty"><i class="bi bi-inbox"></i>Nenhuma comanda aberta no momento.<br><small>Use <strong>Criar comanda provisória</strong> para atender um cliente que veio somente para beber.</small></div>';
    return;
  }

  el.innerHTML=lista.map(c=>{
    const provisoria=c.tipo==='PROVISORIA';
    const label=provisoria?'PROVISÓRIA':'PESAGEM';
    const valor=Number(c.total||0)>0?money(c.total):'Sem itens';
    return `<button type="button" class="command-tile ${provisoria?'provisional':'peso'}" data-c="${esc(c.id)}">
      <div class="tile-head"><div><small>${provisoria?'Comanda provisória':'Comanda da pesagem'}</small><strong>#${esc(c.numero)}</strong></div><span class="tile-status">${label}</span></div>
      <div class="tile-bottom"><span class="tile-value">${valor}</span><span class="tile-action">Abrir <i class="bi bi-chevron-right"></i></span></div>
    </button>`;
  }).join('');
  el.querySelectorAll('[data-c]').forEach(b=>b.addEventListener('click',()=>abrirComanda(b.dataset.c)));
}

async function novaComanda(){
  try{
    // A sequência é gerada pelo contador global. Não existem posições fixas/slots.
    const c=await criarComandaProvisoria();
    comandas.push(c);
    comandas.sort((a,b)=>{ const ta=a.tipo==='PROVISORIA'?0:1; const tb=b.tipo==='PROVISORIA'?0:1; return ta-tb || Number(a.numero)-Number(b.numero); });
    selecionada=c;
    pendentes=[];
    renderComandas();
    renderModal();
    $('modalLancamento').hidden=false;
    setTimeout(()=>$('buscaProdutoModal').focus(),50);
  }catch(e){
    console.error(e);
    alert(e.message||'Não foi possível criar a comanda provisória.');
  }
}

function abrirComanda(id){
  const c=comandas.find(x=>x.id===id); if(!c)return;
  selecionada=c; pendentes=[]; renderModal(); $('modalLancamento').hidden=false; setTimeout(()=>$('buscaProdutoModal').focus(),50);
}

function renderModal(){
  if(!selecionada)return;
  $('tituloLancamento').textContent=`Comanda #${selecionada.numero}`;
  $('subtituloLancamento').textContent=selecionada.tipo==='PROVISORIA'?'Comanda provisória — lance as bebidas e envie quando terminar.':'Comanda da pesagem — adicione bebidas nesta mesma comanda.';
  $('numeroSelecionado').textContent=`#${selecionada.numero}`;
  $('tipoSelecionado').textContent=selecionada.tipo==='PROVISORIA'?'PROVISÓRIA':'PESAGEM';
  const itens=Array.isArray(selecionada.itens)?selecionada.itens:[];
  $('itensSelecionada').innerHTML=itens.length?itens.map(i=>`<div class="current-line"><span>${Number(i.quantidade||0)}x ${esc(i.nome||'Produto')}</span><strong>${money(i.total ?? Number(i.preco||0)*Number(i.quantidade||0))}</strong></div>`).join(''):'<div class="pending-empty">Nenhum item lançado.</div>';
  renderProdutos(); renderPendentes(); renderTransferencia();
}

function renderProdutos(){
  const el=$('produtosGarcom');
  if(!selecionada){el.innerHTML='<div class="command-empty">Selecione uma comanda.</div>';return;}
  const busca=($('buscaProdutoModal').value||'').trim().toLowerCase();
  const lista=produtos.filter(p=>!busca||String(p.nome||'').toLowerCase().includes(busca));
  el.innerHTML=lista.length?lista.map(p=>`<button type="button" class="modal-product" data-p="${esc(p.id)}"><strong>${esc(p.nome||'Produto')}</strong><span>${money(p.precoUnit ?? p.preco ?? 0)}</span></button>`).join(''):'<div class="command-empty">Nenhum produto encontrado.</div>';
  el.querySelectorAll('[data-p]').forEach(b=>b.addEventListener('click',()=>lancarProduto(b.dataset.p)));
}

function renderPendentes(){
  const el=$('itensPendentes');
  const total=pendentes.reduce((s,i)=>s+Number(i.preco||0)*Number(i.quantidade||0),0);
  $('totalPendente').textContent=money(total);
  if(!pendentes.length){el.innerHTML='<div class="pending-empty">Nenhum item selecionado.</div>';return;}
  el.innerHTML=pendentes.map((i,idx)=>`<div class="pending-line-modal"><span><strong>${Number(i.quantidade||0)}x ${esc(i.nome||'Produto')}</strong><br><small>${money(i.preco)} cada</small></span><div><strong>${money(Number(i.preco||0)*Number(i.quantidade||0))}</strong><button type="button" class="remove-pending" data-remover="${idx}" title="Cancelar item"><i class="bi bi-x"></i></button></div></div>`).join('');
  el.querySelectorAll('[data-remover]').forEach(b=>b.addEventListener('click',()=>{pendentes.splice(Number(b.dataset.remover),1);renderPendentes();}));
}

function renderTransferencia(){
  const sel=$('destinoTransferencia'); if(!sel)return;
  const lista=comandas.filter(c=>c.tipo==='PESO' && c.status==='ABERTA' && c.id!==selecionada?.id);
  sel.innerHTML='<option value="">Comanda da pesagem</option>'+lista.map(c=>`<option value="${esc(c.id)}">#${esc(c.numero)} — ${money(c.total)}</option>`).join('');
}

function lancarProduto(id){
  if(!selecionada){alert('Abra uma comanda primeiro.');return;}
  const p=produtos.find(x=>x.id===id); if(!p)return;
  const idx=pendentes.findIndex(x=>x.produtoId===p.id && x.tipo==='UNIDADE');
  if(idx>=0) pendentes[idx].quantidade=Number(pendentes[idx].quantidade||0)+1;
  else pendentes.push({produtoId:p.id,nome:p.nome||'Produto',preco:Number(p.precoUnit ?? p.preco ?? 0),quantidade:1,tipo:'UNIDADE'});
  renderPendentes();
}

async function enviarPendentes(){
  if(!selecionada){alert('Abra uma comanda primeiro.');return;}
  if(!pendentes.length){alert('Nenhum item para enviar.');return;}
  const resumo=pendentes.map(i=>`${i.quantidade}x ${i.nome}`).join('\n');
  if(!confirm(`Enviar para a comanda #${selecionada.numero}?\n\n${resumo}`))return;
  try{
    let atual=selecionada;
    for(const item of pendentes) atual=await adicionarItemComanda(atual.id,item);
    selecionada={id:atual.id,...atual};
    const idx=comandas.findIndex(c=>c.id===selecionada.id); if(idx>=0)comandas[idx]=selecionada;
    pendentes=[]; renderComandas(); renderModal();
  }catch(e){console.error(e);alert(e.message||'Não foi possível enviar os itens.');}
}

async function transferir(){
  if(!selecionada){alert('Abra uma comanda provisória.');return;}
  if(selecionada.tipo!=='PROVISORIA'){alert('Somente a comanda provisória pode ser transferida.');return;}
  const destino=$('destinoTransferencia').value; if(!destino){alert('Selecione a comanda da pesagem.');return;}
  if(!confirm(`Transferir os itens da comanda #${selecionada.numero} para a comanda da pesagem?`))return;
  try{
    const r=await transferirItensComanda(selecionada.id,destino);
    await carregar();
    selecionada=comandas.find(c=>c.id===destino)||null; pendentes=[];
    if(selecionada)renderModal();
    alert(`Itens transferidos para a comanda #${r.destinoNumero}.`);
  }catch(e){console.error(e);alert(e.message||'Não foi possível transferir.');}
}

function fecharModal(){ $('modalLancamento').hidden=true; selecionada=null; pendentes=[]; }
$('btnNovaComanda').addEventListener('click',novaComanda);
$('btnEnviarPendentes').addEventListener('click',enviarPendentes);
$('btnCancelarPendentes').addEventListener('click',()=>{if(pendentes.length&&!confirm('Cancelar os itens ainda não enviados?'))return;pendentes=[];renderPendentes();});
$('btnTransferir').addEventListener('click',transferir);
$('btnAtualizar').addEventListener('click',carregar);
$('fecharLancamento').addEventListener('click',fecharModal);
$('modalLancamento').addEventListener('click',e=>{if(e.target.id==='modalLancamento')fecharModal();});
$('buscaGarcom').addEventListener('input',renderComandas);
$('filtroComanda').addEventListener('change',renderComandas);
$('buscaProdutoModal').addEventListener('input',renderProdutos);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('modalLancamento').hidden)fecharModal();});
carregar();
