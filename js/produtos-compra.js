import { db } from './firebase.js';
import { collection, getDocs, setDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const $=id=>document.getElementById(id);
const modal=$('modal'), body=$('modalBody');
let produtos=[]; let currentId=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const money=v=>`R$ ${num(v).toFixed(2).replace('.',',')}`;
function openModal(p={}){
  currentId=p.id||null;
  $('modalTitulo').textContent=currentId?'Editar produto para compra':'Novo produto para compra';
  $('modalSubtitulo').textContent='Este cadastro fica separado dos produtos vendidos no Frente de Loja.';
  body.innerHTML=`<div class="form-grid">
    <div class="full"><label>Nome do produto *</label><input class="form-control" name="nome" required value="${esc(p.nome||'')}" placeholder="Ex.: Arroz agulhinha 5 kg"></div>
    <div><label>Código interno</label><input class="form-control" name="codigo" value="${esc(p.codigo||'')}" placeholder="Ex.: MP-0001"></div>
    <div><label>Categoria</label><input class="form-control" name="categoria" value="${esc(p.categoria||'')}" placeholder="Ex.: Mercearia"></div>
    <div><label>Unidade de compra *</label><select class="form-control" name="unidadeCompra" required><option value="un">Unidade</option><option value="kg">Kg</option><option value="g">Grama</option><option value="l">Litro</option><option value="ml">Mililitro</option><option value="cx">Caixa</option><option value="pct">Pacote</option><option value="fardo">Fardo</option><option value="saco">Saco</option><option value="unidade">Unidade</option></select></div>
    <div><label>Custo médio</label><input class="form-control" name="custoMedio" type="number" min="0" step="0.01" value="${num(p.custoMedio)||''}" placeholder="0,00"></div>
    <div><label>Estoque mínimo</label><input class="form-control" name="estoqueMinimo" type="number" min="0" step="any" value="${num(p.estoqueMinimo)||0}"></div>
    <div><label>Fornecedor padrão</label><input class="form-control" name="fornecedorPadrao" value="${esc(p.fornecedorPadrao||'')}" placeholder="Opcional"></div>
    <div><label>Status</label><select class="form-control" name="ativo"><option value="true">Ativo</option><option value="false">Inativo</option></select></div>
    <div class="full"><label>Observações</label><textarea class="form-control" name="observacoes" placeholder="Informações para compras, marca, embalagem, especificação...">${esc(p.observacoes||'')}</textarea><div class="form-note">Produtos desta tela não aparecem como produtos de venda no PDV.</div></div>
  </div>`;
  body.querySelector('[name=unidadeCompra]').value=p.unidadeCompra||'un';
  body.querySelector('[name=ativo]').value=p.ativo===false?'false':'true';
  modal.hidden=false; body.querySelector('[name=nome]').focus();
}
function closeModal(){modal.hidden=true;body.innerHTML='';currentId=null;}
function render(){
 const q=($('buscaProdutoCompra').value||'').trim().toLocaleLowerCase('pt-BR'), f=$('filtroStatusProdutoCompra').value||'';
 const rows=produtos.filter(p=>(!f||(f==='ATIVO'?p.ativo!==false:p.ativo===false))&&`${p.nome} ${p.categoria} ${p.codigo}`.toLocaleLowerCase('pt-BR').includes(q));
 $('listaProdutosCompra').innerHTML=rows.length?rows.map(p=>`<article class="produto-compra-card"><div class="produto-compra-top"><div style="display:flex;gap:10px;align-items:center"><div class="produto-compra-icon"><i class="bi bi-box-seam"></i></div><div><h4>${esc(p.nome)}</h4><div class="produto-compra-meta">${esc(p.categoria||'Sem categoria')}${p.codigo?` · ${esc(p.codigo)}`:''}</div></div></div><span class="${p.ativo===false?'status-inativo':'status-ativo'}">${p.ativo===false?'INATIVO':'ATIVO'}</span></div><div class="produto-compra-info"><div><small>Unidade</small><strong>${esc(p.unidadeCompra||'un')}</strong></div><div><small>Custo médio</small><strong>${money(p.custoMedio)}</strong></div><div><small>Estoque atual</small><strong>${num(p.estoqueAtual)}</strong></div><div><small>Estoque mínimo</small><strong>${num(p.estoqueMinimo)}</strong></div></div><div class="produto-compra-actions"><button class="btn-secondary small" data-edit="${esc(p.id)}"><i class="bi bi-pencil"></i> Editar</button></div></article>`).join(''):`<div class="produto-compra-empty"><i class="bi bi-box-seam"></i><strong>Nenhum produto encontrado.</strong><div>Cadastre o primeiro item para usar nas requisições e pedidos de compra.</div></div>`;
}
async function load(){
 const snap=await getDocs(collection(db,'produtosCompra')); produtos=snap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>String(p.nome||'').trim()).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')); render();
}
async function save(){
 const data=Object.fromEntries(new FormData($('modalForm')).entries()); if(!String(data.nome||'').trim())return;
 const ref=currentId?doc(db,'produtosCompra',currentId):doc(collection(db,'produtosCompra')); const old=currentId?produtos.find(p=>p.id===currentId):null;
 const payload={...data,nome:String(data.nome).trim(),codigo:String(data.codigo||'').trim(),categoria:String(data.categoria||'').trim(),unidadeCompra:data.unidadeCompra||'un',custoMedio:num(data.custoMedio),estoqueMinimo:num(data.estoqueMinimo),estoqueAtual:num(old?.estoqueAtual),ativo:data.ativo!=='false',criadoEm:old?.criadoEm||serverTimestamp(),atualizadoEm:serverTimestamp()};
 const btn=$('modalSalvar');btn.disabled=true;try{await setDoc(ref,payload,{merge:true});closeModal();await load();}catch(e){console.error(e);alert('Não foi possível salvar o produto para compra. Verifique as permissões do Firebase.');}finally{btn.disabled=false;}
}
$('btnNovoProdutoCompra').onclick=()=>openModal(); $('btnVoltar').onclick=()=>location.href='compras.html'; $('btnAtualizar')?.addEventListener('click',load);
$('buscaProdutoCompra').addEventListener('input',render); $('filtroStatusProdutoCompra').addEventListener('change',render);
$('listaProdutosCompra').addEventListener('click',e=>{const b=e.target.closest('[data-edit]');if(b)openModal(produtos.find(p=>p.id===b.dataset.edit)||{});});
$('modalX').onclick=closeModal;$('modalCancelar').onclick=closeModal;$('modalForm').addEventListener('submit',e=>{e.preventDefault();save()});$('modal').addEventListener('click',e=>{if(e.target===modal)closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)closeModal()});
load().catch(e=>{console.error(e);$('listaProdutosCompra').innerHTML='<div class="produto-compra-empty"><i class="bi bi-exclamation-circle"></i>Não foi possível carregar os produtos para compra.</div>';});
