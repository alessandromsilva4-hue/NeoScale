import { db } from './firebase.js';
import { caixaAberto, registrarMovimento } from './caixa.js';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc,
  query, orderBy, serverTimestamp, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const $ = id => document.getElementById(id);
const moeda = v => Number(v || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc = v => String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));

let mesas = [];
let produtos = [];
let mesaAtual = null;
let filtro = 'TODAS';

function avisar(msg,tipo='ok'){
  const el=$('mesaMensagem'); if(!el)return;
  el.textContent=msg; el.className=`mesa-message show ${tipo}`;
  clearTimeout(window.__mesaMsg); window.__mesaMsg=setTimeout(()=>el.className='mesa-message',4500);
}

async function obterQuantidadeMesas(){
  const ref=doc(db,'configuracoes','mesas');
  const snap=await getDoc(ref);
  return Math.min(100,Math.max(1,Number(snap.exists()?snap.data().quantidade||12:12)));
}

async function garantirMesas(){
  const quantidade=await obterQuantidadeMesas();
  const snap=await getDocs(collection(db,'mesas'));
  const existentes=new Map(snap.docs.map(d=>[d.id,{id:d.id,...d.data()}]));
  const writes=[];
  for(let n=1;n<=quantidade;n++){
    const id=`mesa_${String(n).padStart(3,'0')}`;
    if(!existentes.has(id)) writes.push(setDoc(doc(db,'mesas',id),{
      numero:n,status:'LIVRE',cliente:'',itens:[],total:0,criadaEm:serverTimestamp(),atualizadaEm:serverTimestamp()
    }));
  }
  if(writes.length) await Promise.all(writes);
  return quantidade;
}

async function carregarMesas(){
  try{
    await garantirMesas();
    const snap=await getDocs(query(collection(db,'mesas'),orderBy('numero','asc')));
    mesas=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderMesas(); atualizarResumo();
  }catch(e){console.error(e); avisar('Não foi possível carregar as mesas. Verifique a conexão com o Firebase.','err');}
}

async function carregarProdutos(){
  try{
    const snap=await getDocs(collection(db,'produtos'));
    produtos=snap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.ativo!==false && p.tipoVenda!=='peso');
    const cats=['Todos',...new Set(produtos.map(p=>p.categoria).filter(Boolean))];
    $('categoriaProdutoMesa').innerHTML=cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    renderProdutosModal();
  }catch(e){console.error(e);}
}

function preco(p){return Number(p.precoUnit ?? p.preco ?? 0);}
function statusTexto(m){return m.status==='ABERTA'?'Ocupada':'Livre';}
function classeStatus(m){return m.status==='ABERTA'?'ocupada':'livre';}

function renderMesas(){
  const grid=$('mesasGrid'); if(!grid)return;
  const lista=filtro==='TODAS'?mesas:mesas.filter(m=>m.status===filtro);
  if(!lista.length){grid.innerHTML='<div class="mesas-empty">Nenhuma mesa encontrada neste filtro.</div>';return;}
  grid.innerHTML=lista.map(m=>{
    const total=Number(m.total||0);
    const itens=(m.itens||[]).reduce((s,i)=>s+Number(i.quantidade||0),0);
    return `<button class="mesa-card ${classeStatus(m)}" data-mesa="${m.id}" type="button">
      <div class="mesa-card-top"><span class="mesa-number">Mesa ${m.numero}</span><span class="mesa-dot"></span></div>
      <strong>${statusTexto(m)}</strong>
      ${m.status==='ABERTA'?`<span class="mesa-client">${esc(m.cliente||'Sem cliente')}</span><span class="mesa-total">${moeda(total)}</span><small>${itens} ${itens===1?'item':'itens'}</small>`:'<span class="mesa-client">Disponível</span><span class="mesa-total">—</span><small>Toque para abrir</small>'}
    </button>`;
  }).join('');
  grid.querySelectorAll('[data-mesa]').forEach(b=>b.onclick=()=>abrirMesa(b.dataset.mesa));
}

function atualizarResumo(){
  const livres=mesas.filter(m=>m.status!=='ABERTA').length;
  const ocupadas=mesas.filter(m=>m.status==='ABERTA').length;
  $('qtdLivres').textContent=livres; $('qtdOcupadas').textContent=ocupadas; $('qtdTotal').textContent=mesas.length;
}

function renderProdutosModal(){
  const el=$('produtosMesa'); if(!el)return;
  const busca=($('buscaProdutoMesa')?.value||'').toLowerCase().trim();
  const cat=$('categoriaProdutoMesa')?.value||'Todos';
  const lista=produtos.filter(p=>(cat==='Todos'||p.categoria===cat)&&(!busca||String(p.nome||'').toLowerCase().includes(busca)));
  el.innerHTML=lista.length?lista.map(p=>`<button class="mesa-product" type="button" data-prod="${p.id}"><span>${esc(p.nome||'Produto')}</span><strong>${moeda(preco(p))}</strong><small>${esc(p.categoria||'Sem categoria')}</small></button>`).join(''):'<div class="produtos-empty">Nenhum produto encontrado.</div>';
  el.querySelectorAll('[data-prod]').forEach(b=>b.onclick=()=>adicionarProduto(b.dataset.prod));
}

function renderItens(){
  const tbody=$('itensMesa'); if(!tbody)return;
  const itens=mesaAtual?.itens||[];
  tbody.innerHTML=itens.length?itens.map((i,idx)=>`<tr><td>${esc(i.nome)}</td><td><div class="qty"><button data-minus="${idx}" type="button">−</button><span>${i.quantidade}</span><button data-plus="${idx}" type="button">+</button></div></td><td>${moeda(i.preco)}</td><td>${moeda(Number(i.preco)*Number(i.quantidade))}</td><td><button class="remove-item" data-remove="${idx}" type="button"><i class="bi bi-trash3"></i></button></td></tr>`).join(''):'<tr><td colspan="5" class="sem-itens">Nenhum produto adicionado.</td></tr>';
  tbody.querySelectorAll('[data-minus]').forEach(b=>b.onclick=()=>alterarItem(Number(b.dataset.minus),-1));
  tbody.querySelectorAll('[data-plus]').forEach(b=>b.onclick=()=>alterarItem(Number(b.dataset.plus),1));
  tbody.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>removerItem(Number(b.dataset.remove)));
  $('totalMesa').textContent=moeda(mesaAtual?.total||0);
}

function fecharModal(){ $('mesaModal')?.classList.remove('show'); mesaAtual=null; }
function abrirModal(){ $('mesaModal')?.classList.add('show'); }

async function abrirMesa(id){
  const m=mesas.find(x=>x.id===id); if(!m)return;
  mesaAtual=m;
  $('numeroMesaModal').textContent=m.numero;
  $('clienteMesa').value=m.cliente||'';
  $('totalMesa').textContent=moeda(m.total);
  $('formaPagamentoMesa').value='Dinheiro';
  renderItens(); abrirModal();
}

async function salvarCliente(){
  if(!mesaAtual)return;
  const cliente=$('clienteMesa').value.trim();
  await updateDoc(doc(db,'mesas',mesaAtual.id),{cliente,atualizadaEm:serverTimestamp()});
  mesaAtual.cliente=cliente;
  const local=mesas.find(m=>m.id===mesaAtual.id); if(local)local.cliente=cliente;
  renderMesas();
  avisar('Cliente da mesa atualizado.');
}

async function adicionarProduto(id){
  if(!mesaAtual)return;
  const p=produtos.find(x=>x.id===id); if(!p)return;
  const itens=[...(mesaAtual.itens||[])];
  const idx=itens.findIndex(i=>i.produtoId===id);
  if(idx>=0) itens[idx].quantidade+=1;
  else itens.push({produtoId:id,nome:p.nome||'Produto',preco:preco(p),quantidade:1});
  const total=itens.reduce((s,i)=>s+Number(i.preco||0)*Number(i.quantidade||0),0);
  await updateDoc(doc(db,'mesas',mesaAtual.id),{itens,total,status:'ABERTA',atualizadaEm:serverTimestamp(),abertaEm:mesaAtual.abertaEm||serverTimestamp()});
  mesaAtual={...mesaAtual,itens,total,status:'ABERTA'};
  const local=mesas.find(m=>m.id===mesaAtual.id); if(local)Object.assign(local,mesaAtual);
  renderItens(); renderMesas(); atualizarResumo();
  avisar(`${p.nome} adicionado à mesa ${mesaAtual.numero}.`);
}

async function alterarItem(index,delta){
  if(!mesaAtual)return;
  const itens=[...(mesaAtual.itens||[])]; if(!itens[index])return;
  itens[index].quantidade+=delta; if(itens[index].quantidade<=0)itens.splice(index,1);
  await salvarItens(itens);
}
async function removerItem(index){
  if(!mesaAtual)return; const itens=[...(mesaAtual.itens||[])]; itens.splice(index,1); await salvarItens(itens);
}
async function salvarItens(itens){
  const total=itens.reduce((s,i)=>s+Number(i.preco||0)*Number(i.quantidade||0),0);
  await updateDoc(doc(db,'mesas',mesaAtual.id),{itens,total,atualizadaEm:serverTimestamp()});
  mesaAtual={...mesaAtual,itens,total}; const local=mesas.find(m=>m.id===mesaAtual.id); if(local)Object.assign(local,mesaAtual);
  renderItens();renderMesas();atualizarResumo();
}

async function abrirMesaSeLivre(){
  if(!mesaAtual)return;
  if(mesaAtual.status==='ABERTA')return;
  await updateDoc(doc(db,'mesas',mesaAtual.id),{status:'ABERTA',cliente:$('clienteMesa').value.trim(),itens:[],total:0,abertaEm:serverTimestamp(),atualizadaEm:serverTimestamp()});
  mesaAtual={...mesaAtual,status:'ABERTA',cliente:$('clienteMesa').value.trim(),itens:[],total:0};
  const local=mesas.find(m=>m.id===mesaAtual.id);if(local)Object.assign(local,mesaAtual);
  renderItens();renderMesas();atualizarResumo();
  avisar(`Mesa ${mesaAtual.numero} aberta.`);
}

async function fecharMesa(){
  if(!mesaAtual)return;
  const total=Number(mesaAtual.total||0); if(total<=0){avisar('Adicione pelo menos um produto antes de fechar a mesa.','err');return;}
  const forma=$('formaPagamentoMesa').value;
  const caixa=await caixaAberto(); if(!caixa){avisar('Nenhum caixa está aberto. Abra o caixa antes de fechar a mesa.','err');return;}
  const mesaRef=doc(db,'mesas',mesaAtual.id);
  const vendaRef=doc(collection(db,'vendasMesas'));
  const dados={numeroMesa:mesaAtual.numero,cliente:mesaAtual.cliente||'',itens:mesaAtual.itens||[],total,forma,criadoEm:serverTimestamp(),status:'FINALIZADA'};
  try{
    await runTransaction(db,async tx=>{
      const snap=await tx.get(mesaRef);
      if(!snap.exists()||snap.data().status!=='ABERTA')throw new Error('A mesa não está aberta.');
      const movRef=doc(collection(db,'movimentosCaixa'));
      tx.update(mesaRef,{status:'LIVRE',cliente:'',itens:[],total:0,fechadaEm:serverTimestamp(),atualizadaEm:serverTimestamp()});
      tx.set(vendaRef,dados);
      tx.set(movRef,{caixaId:caixa.id,tipo:'VENDA',valor:total,forma,descricao:`Mesa ${mesaAtual.numero}`,referencia:vendaRef.id,criadoEm:serverTimestamp()});
    });
    avisar(`Mesa ${mesaAtual.numero} fechada. Venda de ${moeda(total)} registrada.`);
    fecharModal(); await carregarMesas();
  }catch(e){console.error(e);avisar(e.message||'Não foi possível fechar a mesa.','err');}
}

async function cancelarMesa(){
  if(!mesaAtual)return;
  if(!confirm(`Cancelar a mesa ${mesaAtual.numero}? Os itens desta mesa serão descartados.`))return;
  await updateDoc(doc(db,'mesas',mesaAtual.id),{status:'LIVRE',cliente:'',itens:[],total:0,canceladaEm:serverTimestamp(),atualizadaEm:serverTimestamp()});
  fecharModal(); await carregarMesas(); avisar(`Mesa ${mesaAtual.numero} liberada.`);
}

async function configurarQuantidade(){
  const atual=mesas.length;
  const valor=prompt(`Quantidade de mesas (1 a 100). Atualmente: ${atual}`,String(atual));
  if(valor===null)return;
  const quantidade=Math.floor(Number(valor));
  if(!Number.isFinite(quantidade)||quantidade<1||quantidade>100){alert('Informe uma quantidade entre 1 e 100.');return;}
  const ocupadas=mesas.filter(m=>m.status==='ABERTA' && m.numero>quantidade);
  if(ocupadas.length){alert('Não é possível reduzir a quantidade enquanto houver mesas ocupadas nessa faixa.');return;}
  await setDoc(doc(db,'configuracoes','mesas'),{quantidade,atualizadoEm:serverTimestamp()},{merge:true});
  await carregarMesas(); avisar(`Configuração atualizada para ${quantidade} mesas.`);
}

function configurarFiltros(){
  document.querySelectorAll('[data-filtro-mesa]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-filtro-mesa]').forEach(x=>x.classList.remove('active'));b.classList.add('active');filtro=b.dataset.filtroMesa;renderMesas();});
}

$('clienteMesa')?.addEventListener('change',salvarCliente);
$('buscaProdutoMesa')?.addEventListener('input',renderProdutosModal);
$('categoriaProdutoMesa')?.addEventListener('change',renderProdutosModal);
$('btnFecharMesaModal')?.addEventListener('click',fecharModal);
$('btnSalvarCliente')?.addEventListener('click',salvarCliente);
$('btnAbrirMesa')?.addEventListener('click',abrirMesaSeLivre);
$('btnFecharMesa')?.addEventListener('click',fecharMesa);
$('btnCancelarMesa')?.addEventListener('click',cancelarMesa);
$('btnConfigMesas')?.addEventListener('click',configurarQuantidade);
$('mesaModal')?.addEventListener('click',e=>{if(e.target.id==='mesaModal')fecharModal();});
configurarFiltros();

await Promise.all([carregarProdutos(),carregarMesas()]);
