import { db } from './firebase.js';
import { collection, getDocs, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
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
    comandas=cs.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.numero).localeCompare(String(b.numero),'pt-BR',{numeric:true}));
    produtos=ps.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.ativo!==false && p.tipoVenda!=='peso');
    renderComandas(); renderProdutos(); renderTransferencia();
  }catch(e){console.error(e); $('listaComandas').innerHTML='<div class="empty-garcom">Não foi possível carregar as comandas.</div>';}
}

function renderComandas(){
  const el=$('listaComandasGarcom');
  const busca=($('buscaComanda')?.value||'').trim().toLowerCase();
  const filtro=$('filtroComanda')?.value||'TODOS';
  const lista=comandas.filter(c=>{
    const texto=String(c.numero||'').toLowerCase();
    const status=c.itens?.length?'OCUPADA':'LIVRE';
    return (!busca||texto.includes(busca)) && (filtro==='TODOS'||status===filtro);
  });
  if(!lista.length){el.innerHTML='<div class="empty-garcom">Nenhuma comanda encontrada.</div>';return;}
  el.innerHTML=lista.map(c=>{
    const status=c.itens?.length?'OCUPADA':'LIVRE';
    const cls=status==='LIVRE'?'free':'busy';
    const label=c.tipo==='PROVISORIA'?'Comanda provisória':(c.tipo==='PESO'?'Comanda da pesagem':'Comanda');
    return `<div class="command-card ${selecionada?.id===c.id?'active':''}" data-c="${c.id}">
      <div class="command-top"><div><span class="command-name">Comanda</span><span class="command-number">#${esc(c.numero)}</span></div>
      <div class="command-actions"><button type="button" class="mini-btn primary" data-pedido="${c.id}"><i class="bi bi-plus-lg"></i> Pedido</button><button type="button" class="mini-btn icon" data-selecionar="${c.id}"><i class="bi bi-chevron-down"></i></button></div></div>
      <div class="command-status ${cls}">${status==='LIVRE'?'Livre':'Ocupada'} · ${label}</div>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-pedido],[data-selecionar]').forEach(b=>b.onclick=ev=>{ev.stopPropagation(); selecionarComanda(b.dataset.pedido||b.dataset.selecionar);});
  el.querySelectorAll('.command-card').forEach(b=>b.onclick=()=>selecionarComanda(b.dataset.c));
}

function selecionarComanda(id){
  selecionada=comandas.find(c=>c.id===id)||null; pendentes=[]; renderComandas(); renderSelecionada(); renderProdutos(); renderTransferencia();
  $('workspaceGarcom')?.scrollIntoView({behavior:'smooth',block:'start'});
}

function renderSelecionada(){
  $('tituloSelecionada').textContent=selecionada?`Comanda #${selecionada.numero}`:'Nenhuma comanda selecionada';
  $('tipoSelecionado').textContent=selecionada?(selecionada.tipo==='PROVISORIA'?'PROVISÓRIA':'PESAGEM'):'SEM COMANDA';
  const itens=selecionada?.itens||[];
  $('itensSelecionada').className=itens.length?'':'empty-garcom';
  $('itensSelecionada').innerHTML=itens.length?itens.map(i=>`<div class="selected-line"><span>${Number(i.quantidade||0)}x ${esc(i.nome||'Produto')}</span><strong>${money(i.total ?? Number(i.preco||0)*Number(i.quantidade||0))}</strong></div>`).join(''):'Nenhum item lançado.';
  $('totalSelecionada').textContent=money(selecionada?.total||0);
  renderPendentes();
}

function renderPendentes(){
  const el=$('itensPendentes');
  const total=pendentes.reduce((s,i)=>s+Number(i.preco||0)*Number(i.quantidade||0),0);
  $('totalPendente').textContent=money(total);
  if(!pendentes.length){el.className='pending-empty';el.textContent='Nenhum item selecionado.';return;}
  el.className='';
  el.innerHTML=pendentes.map((i,idx)=>`<div class="pending-line"><div class="pending-line-main"><strong>${Number(i.quantidade||0)}x ${esc(i.nome||'Produto')}</strong><small>${money(Number(i.preco||0))} cada · ${money(Number(i.preco||0)*Number(i.quantidade||0))}</small></div><button type="button" class="btn-danger-soft" data-remover-pendente="${idx}" title="Cancelar este item"><i class="bi bi-trash"></i> Cancelar</button></div>`).join('');
  el.querySelectorAll('[data-remover-pendente]').forEach(b=>b.onclick=()=>{pendentes.splice(Number(b.dataset.removerPendente),1);renderPendentes();});
}

function renderProdutos(){
  const el=$('produtosGarcom');
  if(!selecionada){el.innerHTML='<div class="empty-garcom">Selecione uma comanda primeiro.</div>';return;}
  const busca=($('buscaGarcom').value||'').trim().toLowerCase();
  const lista=produtos.filter(p=>!busca||String(p.nome||'').toLowerCase().includes(busca));
  el.innerHTML=lista.length?lista.map(p=>`<button type="button" class="garcom-product" data-p="${p.id}"><strong>${esc(p.nome||'Produto')}</strong><span>${money(p.precoUnit ?? p.preco ?? 0)}</span></button>`).join(''):'<div class="empty-garcom">Nenhum produto encontrado.</div>';
  el.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>lancarProduto(b.dataset.p));
}

function renderTransferencia(){
  const sel=$('destinoTransferencia');
  const lista=comandas.filter(c=>c.tipo==='PESO' && c.status==='ABERTA');
  sel.innerHTML='<option value="">Selecione a comanda da pesagem</option>'+lista.map(c=>`<option value="${c.id}">#${esc(c.numero)} — ${money(c.total)}</option>`).join('');
}

async function lancarProduto(id){
  if(!selecionada){alert('Selecione uma comanda primeiro.');return;}
  const p=produtos.find(x=>x.id===id); if(!p)return;
  const idx=pendentes.findIndex(x=>x.produtoId===p.id && x.tipo==='UNIDADE');
  if(idx>=0) pendentes[idx].quantidade=Number(pendentes[idx].quantidade||0)+1;
  else pendentes.push({produtoId:p.id,nome:p.nome||'Produto',preco:Number(p.precoUnit ?? p.preco ?? 0),quantidade:1,tipo:'UNIDADE'});
  renderPendentes();
}

async function enviarPendentes(){
  if(!selecionada){alert('Selecione uma comanda primeiro.');return;}
  if(!pendentes.length){alert('Nenhum item para enviar.');return;}
  const resumo=pendentes.map(i=>`${i.quantidade}x ${i.nome}`).join('\n');
  if(!confirm(`Enviar estes itens para a comanda #${selecionada.numero}?\n\n${resumo}`))return;
  try{
    let atual=selecionada;
    for(const item of pendentes){
      atual=await adicionarItemComanda(atual.id,item);
    }
    selecionada={id:atual.id,...atual};
    const idx=comandas.findIndex(c=>c.id===selecionada.id); if(idx>=0)comandas[idx]=selecionada;
    pendentes=[];
    renderComandas(); renderSelecionada(); renderProdutos();
  }catch(e){console.error(e);alert(e.message||'Não foi possível enviar os itens para a comanda.');}
}

async function novaComanda(){
  try{
    const c=await criarComandaProvisoria();
    comandas.push(c); comandas.sort((a,b)=>Number(a.numero)-Number(b.numero)); selecionada=c; pendentes=[];
    renderComandas(); renderSelecionada(); renderProdutos(); renderTransferencia();
    alert(`Comanda #${c.numero} aberta.`);
  }catch(e){console.error(e);alert(e.message||'Não foi possível abrir a comanda.');}
}

async function transferir(){
  if(!selecionada){alert('Selecione a comanda provisória.');return;}
  if(selecionada.tipo!=='PROVISORIA'){alert('Selecione uma comanda provisória para transferir.');return;}
  const destino=$('destinoTransferencia').value; if(!destino){alert('Selecione a comanda gerada pela pesagem.');return;}
  if(!confirm(`Transferir todos os itens da comanda #${selecionada.numero} para a comanda da pesagem?`))return;
  try{
    const r=await transferirItensComanda(selecionada.id,destino);
    alert(`Itens transferidos para a comanda #${r.destinoNumero}.`);
    selecionada=comandas.find(c=>c.id===destino)||null;
    await carregar();
    selecionada=comandas.find(c=>c.id===destino)||null;
    pendentes=[];renderComandas();renderSelecionada();renderProdutos();renderTransferencia();
  }catch(e){console.error(e);alert(e.message||'Não foi possível transferir.');}
}

$('btnNovaComanda').onclick=novaComanda;
$('btnNovoPedido').onclick=()=>{ if(!selecionada){alert('Selecione uma comanda primeiro.'); return;} $('workspaceGarcom')?.scrollIntoView({behavior:'smooth',block:'start'}); };
$('buscaComanda').addEventListener('input',renderComandas);
$('filtroComanda').addEventListener('change',renderComandas);
$('btnEnviarPendentes').onclick=enviarPendentes;
$('btnCancelarPendentes').onclick=()=>{ if(pendentes.length && !confirm('Cancelar todos os itens ainda não enviados?')) return; pendentes=[]; renderPendentes(); };
$('btnAtualizar').onclick=carregar;
$('btnTransferir').onclick=transferir;
$('buscaGarcom').addEventListener('input',renderProdutos);
carregar();
