import { db } from './firebase.js';
import { collection, getDocs, query, orderBy, limit, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const $ = id => document.getElementById(id);
const lista = $('lista'), busca = $('busca'), modal = $('modal'), form = $('formCliente');
let clientes = [], editId = null;
const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const data = v => { if (!v) return '-'; const d = v?.toDate ? v.toDate() : new Date(v); return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR'); };
const normalizar = v => String(v ?? '').trim().toLowerCase();

function render(){
  const termo = normalizar(busca.value);
  const rows = clientes.filter(c => !termo || [c.nome,c.telefone,c.email,c.documento].some(v => normalizar(v).includes(termo)));
  lista.innerHTML = rows.length ? rows.map(c => `
    <tr>
      <td><div class="client-name">${esc(c.nome || 'Sem nome')}</div>${c.documento ? `<small class="muted">${esc(c.documento)}</small>` : ''}</td>
      <td>${esc(c.telefone || '-')}</td><td>${esc(c.email || '-')}</td><td>${data(c.criadoEm)}</td>
      <td><div class="actions"><button class="table-btn" title="Editar" data-edit="${c.id}"><i class="bi bi-pencil"></i></button><button class="table-btn" title="Histórico" data-history="${c.id}"><i class="bi bi-clock-history"></i></button><button class="table-btn danger" title="Excluir" data-delete="${c.id}"><i class="bi bi-trash3"></i></button></div></td>
    </tr>`).join('') : '<tr><td colspan="5" class="empty">Nenhum cliente encontrado.</td></tr>';
  lista.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>abrir(b.dataset.edit));
  lista.querySelectorAll('[data-history]').forEach(b=>b.onclick=()=>abrirHistorico(b.dataset.history));
  lista.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>excluir(b.dataset.delete));
  $('statTotal').textContent = clientes.length;
  $('statTelefone').textContent = clientes.filter(c=>String(c.telefone||'').trim()).length;
  const limite = Date.now()-30*24*60*60*1000;
  $('statRecentes').textContent = clientes.filter(c=>{const d=c.criadoEm?.toDate?c.criadoEm.toDate().getTime():new Date(c.criadoEm||0).getTime(); return d>=limite;}).length;
}

async function carregar(){
  lista.innerHTML='<tr><td colspan="5" class="empty">Carregando clientes...</td></tr>';
  try{
    const snap=await getDocs(query(collection(db,'clientes'),orderBy('nome','asc'),limit(500)));
    clientes=snap.docs.map(d=>({id:d.id,...d.data()})); render();
  }catch(e){
    console.error(e); lista.innerHTML='<tr><td colspan="5" class="empty">Não foi possível carregar os clientes.</td></tr>';
    alert('Não foi possível carregar os clientes. Verifique sua conexão e as regras do Firebase.');
  }
}

function limpar(){ form.reset(); editId=null; $('modalTitulo').textContent='Novo cliente'; $('btnSalvar').textContent='Salvar cliente'; $('historicoCliente').innerHTML=''; }
function abrir(id=null){
  limpar(); editId=id;
  if(id){ const c=clientes.find(x=>x.id===id); if(!c)return; $('modalTitulo').textContent='Editar cliente'; $('btnSalvar').textContent='Salvar alterações'; $('nome').value=c.nome||''; $('telefone').value=c.telefone||''; $('email').value=c.email||''; $('documento').value=c.documento||''; $('endereco').value=c.endereco||''; $('bairro').value=c.bairro||''; $('observacoes').value=c.observacoes||''; }
  modal.hidden=false; $('nome').focus();
}
function fechar(){modal.hidden=true; limpar();}

async function salvar(e){
  e.preventDefault();
  const dados={nome:$('nome').value.trim(),telefone:$('telefone').value.trim(),email:$('email').value.trim(),documento:$('documento').value.trim(),endereco:$('endereco').value.trim(),bairro:$('bairro').value.trim(),observacoes:$('observacoes').value.trim(),atualizadoEm:serverTimestamp()};
  if(!dados.nome){alert('Informe o nome do cliente.');return;}
  const btn=$('btnSalvar'); btn.disabled=true;
  try{
    if(editId) await updateDoc(doc(db,'clientes',editId),dados);
    else await addDoc(collection(db,'clientes'),{...dados,criadoEm:serverTimestamp()});
    fechar(); await carregar();
  }catch(e){console.error(e);alert('Não foi possível salvar o cliente.');}
  finally{btn.disabled=false;}
}

async function excluir(id){
  const c=clientes.find(x=>x.id===id); if(!c)return;
  if(!confirm(`Excluir o cliente "${c.nome}"?`))return;
  try{await deleteDoc(doc(db,'clientes',id)); await carregar();}catch(e){console.error(e);alert('Não foi possível excluir o cliente.');}
}

async function abrirHistorico(id){
  const c=clientes.find(x=>x.id===id); if(!c)return;
  abrir(id); $('historicoCliente').innerHTML='<h3>Histórico</h3><div class="history-item">Carregando...</div>';
  try{
    const [comSnap,histSnap] = await Promise.all([
      getDocs(query(collection(db,'comandas'),where('clienteId','==',id),limit(50))),
      getDocs(query(collection(db,'historico'),where('clienteId','==',id),limit(50)))
    ]);
    const itens=[...comSnap.docs.map(d=>({tipo:'Comanda',...d.data()})),...histSnap.docs.map(d=>({tipo:'Histórico',...d.data()}))].sort((a,b)=>{
      const ta=(a.criadoEm?.toDate?a.criadoEm.toDate():new Date(a.criadoEm||0)).getTime();
      const tb=(b.criadoEm?.toDate?b.criadoEm.toDate():new Date(b.criadoEm||0)).getTime(); return tb-ta;
    });
    $('historicoCliente').innerHTML='<h3>Histórico</h3>'+(itens.length?`<div class="history-list">${itens.slice(0,30).map(x=>`<div class="history-item"><strong>#${esc(x.numero||x.numeroComanda||'-')}</strong>${esc(x.produto||x.tipo||'Movimentação')} · ${x.total!=null?'R$ '+Number(x.total).toFixed(2).replace('.',','):x.valor!=null?'R$ '+Number(x.valor).toFixed(2).replace('.',','):''} · ${esc(x.status||'')}</div>`).join('')}</div>`:'<div class="history-item">Ainda não há comandas ou históricos vinculados a este cliente.</div>');
  }catch(e){console.error(e);$('historicoCliente').innerHTML='<h3>Histórico</h3><div class="history-item">Não foi possível carregar o histórico.</div>';}
}

$('btnNovo').onclick=()=>abrir(); $('btnAtualizar').onclick=carregar; busca.addEventListener('input',render); form.addEventListener('submit',salvar); $('fecharModal').onclick=fechar; $('cancelarModal').onclick=fechar; modal.addEventListener('click',e=>{if(e.target===modal)fechar();});
carregar();
