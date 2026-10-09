import { db } from './firebase.js';
import { collection, query, orderBy, limit, onSnapshot, updateDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const TEMPO_LIMITE_MS = 10 * 60 * 1000;
const $ = id => document.getElementById(id);
let pedidos = [];
let atualizandoAutomaticamente = new Set();

function dt(v){
  return v?.toDate ? v.toDate() : v?.seconds ? new Date(v.seconds * 1000) : new Date(v || Date.now());
}

function tempoDecorrido(v){
  const ms = Math.max(0, Date.now() - dt(v).getTime());
  const total = Math.floor(ms / 1000);
  return { segundos: total, texto: `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`, atrasado: ms >= TEMPO_LIMITE_MS };
}

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function card(x){
  const t = tempoDecorrido(x.criadoEm);
  const itens = (x.itens || []).map(i => `<div class="rep-tv-item"><b>${escapeHtml(i.quantidade)}x</b><span>${escapeHtml(i.nome)}</span></div>`).join('');
  const classe = t.atrasado ? 'is-atrasado' : 'is-preparo';
  const status = t.atrasado ? 'ATRASADO' : 'EM PREPARO';
  return `<article class="rep-tv-ticket ${classe}" data-ticket-id="${escapeHtml(x.id)}">
    <header>
      <div><span>REPOSIÇÃO</span><h3>${escapeHtml(x.local || 'Buffet')}</h3></div>
      <time>${dt(x.criadoEm).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time>
    </header>
    <div class="rep-tv-items">${itens}</div>
    <div class="rep-tv-timer">
      <div class="rep-tv-status"><i></i><strong>${status}</strong></div>
      <div class="rep-tv-clock"><b>${t.texto}</b><span>${t.atrasado ? 'TEMPO EXCEDIDO' : 'TEMPO DECORRIDO'}</span></div>
    </div>
  </article>`;
}

function render(){
  const novos = pedidos.filter(x => x.status === 'NOVO');
  const preparo = pedidos.filter(x => x.status === 'PREPARO');
  const entregues = pedidos.filter(x => x.status === 'ENTREGUE');

  $('kpiNovos').textContent = novos.length;
  $('kpiPreparo').textContent = preparo.length;
  $('kpiEntregues').textContent = entregues.length;
  $('countNovo').textContent = novos.length;
  $('countPreparo').textContent = preparo.length;
  $('countEntregue').textContent = entregues.length;

  $('listaNovo').innerHTML = novos.map(card).join('') || '<div class="rep-tv-empty">Aguardando solicitação.</div>';
  $('listaPreparo').innerHTML = preparo.map(card).join('') || '<div class="rep-tv-empty">Nenhuma reposição em preparo.</div>';
  $('listaEntregue').innerHTML = entregues.slice(0,8).map(x => `<article class="rep-tv-ticket entregue"><header><div><span>ENTREGUE</span><h3>${escapeHtml(x.local || 'Buffet')}</h3></div><time>${dt(x.atualizadoEm || x.criadoEm).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time></header><div class="rep-tv-items">${(x.itens||[]).map(i=>`<div class="rep-tv-item"><b>${escapeHtml(i.quantidade)}x</b><span>${escapeHtml(i.nome)}</span></div>`).join('')}</div><div class="rep-tv-delivered"><i class="bi bi-check2-circle"></i> Reposição entregue</div></article>`).join('') || '<div class="rep-tv-empty">Nenhuma solicitação entregue.</div>';
}

async function aceitarAutomaticamente(){
  const novos = pedidos.filter(x => x.status === 'NOVO');
  for(const pedido of novos){
    if(atualizandoAutomaticamente.has(pedido.id)) continue;
    atualizandoAutomaticamente.add(pedido.id);
    try{
      await updateDoc(doc(db,'reposicoesBuffet',pedido.id), { status:'PREPARO', atualizadoEm:serverTimestamp() });
    }catch(err){
      console.error('Erro no aceite automático da reposição:', err);
      atualizandoAutomaticamente.delete(pedido.id);
    }
  }
}

function atualizarCronometros(){
  document.querySelectorAll('[data-ticket-id]').forEach(el => {
    const pedido = pedidos.find(x => x.id === el.dataset.ticketId);
    if(!pedido || pedido.status !== 'PREPARO') return;
    const t = tempoDecorrido(pedido.criadoEm);
    el.classList.toggle('is-atrasado', t.atrasado);
    el.classList.toggle('is-preparo', !t.atrasado);
    const strong = el.querySelector('.rep-tv-status strong');
    const clock = el.querySelector('.rep-tv-clock b');
    const label = el.querySelector('.rep-tv-clock span');
    if(strong) strong.textContent = t.atrasado ? 'ATRASADO' : 'EM PREPARO';
    if(clock) clock.textContent = t.texto;
    if(label) label.textContent = t.atrasado ? 'TEMPO EXCEDIDO' : 'TEMPO DECORRIDO';
  });
}

const q = query(collection(db,'reposicoesBuffet'), orderBy('criadoEm','desc'), limit(100));
onSnapshot(q, snapshot => {
  pedidos = snapshot.docs.map(d => ({id:d.id, ...d.data()})).filter(x => x.status);
  render();
  aceitarAutomaticamente();
}, error => {
  console.error(error);
  $('listaNovo').innerHTML = '<div class="rep-tv-empty">Não foi possível carregar as solicitações.</div>';
  $('listaPreparo').innerHTML = '<div class="rep-tv-empty">Verifique a conexão com o Firebase.</div>';
});

setInterval(() => {
  atualizarCronometros();
}, 1000);
