import { db } from './firebase.js';
import { collection, addDoc, query, where, onSnapshot, updateDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const itensBase=['Arroz','Feijão','Estrogonofe','Frango ao molho','Frango','Carne','Peixe','Batata','Legumes','Salada','Macarrão','Farofa','Molho','Sobremesa'];
const customKey='neoscale_buffet_pratos_custom';
let itensCustom=[];
try{itensCustom=JSON.parse(localStorage.getItem(customKey)||'[]').filter(Boolean)}catch(e){itensCustom=[]}
const itens=[...itensBase,...itensCustom];
const selecionados=new Map(); const $=id=>document.getElementById(id);
const deviceKey='neoscale_buffet_device'; let deviceId=localStorage.getItem(deviceKey); if(!deviceId){deviceId=crypto.randomUUID?.()||String(Date.now());localStorage.setItem(deviceKey,deviceId)}
let audioPronto=null; let somAtivo=localStorage.getItem('neoscale_buffet_som_pronto')!=='0'; let primeiraCarga=true; let alertaPendente=false; const statusAnterior=new Map();
const AUDIO_PRONTO_URL='som-reposicao-pronto.mp3';
function atualizarBotaoSom(){const b=$('btnSomPronto');if(!b)return;b.classList.toggle('active',somAtivo);b.innerHTML=somAtivo?'<i class=\"bi bi-volume-up-fill\"></i> Alerta ativo':'<i class=\"bi bi-volume-mute-fill\"></i> Alerta desativado';}
function ativarSom(){try{audioPronto=audioPronto||new Audio(AUDIO_PRONTO_URL);audioPronto.preload='auto';audioPronto.volume=1;audioPronto.loop=true;audioPronto.play().then(()=>{audioPronto.pause();audioPronto.currentTime=0}).catch(()=>{});somAtivo=true;localStorage.setItem('neoscale_buffet_som_pronto','1');atualizarBotaoSom();}catch(e){console.error(e)}}
function desativarSom(){somAtivo=false;pararAlertaPronto();localStorage.setItem('neoscale_buffet_som_pronto','0');atualizarBotaoSom();}
function alternarSom(){somAtivo?desativarSom():ativarSom()}
function tocarAlertaPronto(){if(!somAtivo)return;try{audioPronto=audioPronto||new Audio(AUDIO_PRONTO_URL);audioPronto.loop=true;audioPronto.volume=1;audioPronto.currentTime=0;const p=audioPronto.play();if(p&&p.catch)p.catch(e=>{alertaPendente=true;console.warn('Áudio aguardando interação do usuário:',e)});else alertaPendente=false;}catch(e){console.error(e)}}
function pararAlertaPronto(){alertaPendente=false;if(!audioPronto)return;audioPronto.pause();audioPronto.currentTime=0;}
function abrirCadastroPrato(){
  if(document.getElementById('modalNovoPrato'))return;
  const modal=document.createElement('div');
  modal.id='modalNovoPrato';
  modal.className='prato-modal-backdrop';
  modal.innerHTML=`<div class="prato-modal" role="dialog" aria-modal="true"><div class="prato-modal-head"><div><span>NOVA OPÇÃO</span><h3>Adicionar prato</h3></div><button type="button" class="prato-modal-close" data-fechar><i class="bi bi-x-lg"></i></button></div><p>Cadastre um prato que ainda não aparece na lista de reposição.</p><label>Nome do prato<input id="novoPratoNome" maxlength=60 autocomplete="off" placeholder="Ex.: Lasanha de frango"></label><div class="prato-modal-actions"><button type="button" class="btn-cancelar-prato" data-fechar>Cancelar</button><button type="button" class="btn-salvar-prato" id="salvarNovoPrato"><i class="bi bi-plus-lg"></i> Adicionar prato</button></div></div>`;
  document.body.appendChild(modal);
  const input=document.getElementById('novoPratoNome');
  setTimeout(()=>input?.focus(),50);
  const fechar=()=>modal.remove();
  modal.querySelectorAll('[data-fechar]').forEach(b=>b.addEventListener('click',fechar));
  modal.addEventListener('click',e=>{if(e.target===modal)fechar()});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();document.getElementById('salvarNovoPrato')?.click()}});
  document.getElementById('salvarNovoPrato').addEventListener('click',()=>{
    const nome=input.value.trim();
    if(!nome){input.focus();return}
    const existe=itens.some(x=>x.toLocaleLowerCase('pt-BR')===nome.toLocaleLowerCase('pt-BR'));
    if(existe){alert('Esse prato já está na lista.');input.focus();return}
    itensCustom.push(nome);
    localStorage.setItem(customKey,JSON.stringify(itensCustom));
    itens.push(nome);
    render();
    fechar();
    const indice=itens.length-1;
    selecionados.set(nome,1);
    render();
  });
}

function render(){ $('itensGrid').innerHTML=itens.map((nome,i)=>{const qtd=selecionados.get(nome)||0;return `<div class="rep-item ${qtd?'selected':''}" data-item="${i}"><div class="rep-item-top"><i class="bi ${qtd?'bi-check-circle-fill':'bi-plus-circle'}"></i><strong>${nome}</strong></div><span>${qtd} unidade(s)</span><div class="rep-qty"><button type="button" class="qty-btn minus" data-qty="minus" data-item="${i}" ${qtd<=0?'disabled':''}><i class="bi bi-dash"></i></button><b>${qtd}</b><button type="button" class="qty-btn plus" data-qty="plus" data-item="${i}"><i class="bi bi-plus"></i></button></div></div>`}).join(''); atualizarResumo(); }
function atualizarResumo(){const n=selecionados.size,total=[...selecionados.values()].reduce((a,b)=>a+b,0);$('resumoCount').textContent=`${total} unidade(s) em ${n} ${n===1?'item':'itens'}`;$('resumoTexto').textContent=n?'Revise os itens e envie para a cozinha.':'Nenhum item selecionado.';$('btnSolicitar').disabled=!n;}
$('itensGrid').addEventListener('click',e=>{const b=e.target.closest('[data-qty]');if(b){e.stopPropagation();const nome=itens[Number(b.dataset.item)];const qtd=selecionados.get(nome)||0;if(b.dataset.qty==='minus'){if(qtd<=1)selecionados.delete(nome);else selecionados.set(nome,qtd-1)}else if(qtd<99){selecionados.set(nome,qtd+1)}render();return;}const card=e.target.closest('[data-item]');if(!card)return;const nome=itens[Number(card.dataset.item)];const qtd=selecionados.get(nome)||0;if(qtd<99)selecionados.set(nome,qtd+1);render()});
$('btnAdicionarPrato')?.addEventListener('click',abrirCadastroPrato);
$('btnSolicitar').addEventListener('click',async()=>{const btn=$('btnSolicitar');btn.disabled=true;try{const local=$('buffetLocal').value;const lista=[...selecionados.entries()].map(([nome,quantidade])=>({nome,quantidade}));await addDoc(collection(db,'reposicoesBuffet'),{local,itens:lista,status:'NOVO',origem:'BUFFET',dispositivoId:deviceId,criadoEm:serverTimestamp(),atualizadoEm:serverTimestamp()});selecionados.clear();render();alert('Solicitação enviada para a cozinha.');}catch(e){console.error(e);alert('Não foi possível enviar a solicitação.');btn.disabled=false}});
function data(v){return v?.toDate?v.toDate():v?.seconds?new Date(v.seconds*1000):new Date(v||Date.now())}
function historico(){const q=query(collection(db,'reposicoesBuffet'),where('dispositivoId','==',deviceId));onSnapshot(q,s=>{const docs=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>data(b.criadoEm)-data(a.criadoEm));let tocou=false;let existePronto=false;docs.forEach(x=>{const anterior=statusAnterior.get(x.id);if(x.status==='PRONTO')existePronto=true;if(x.status==='PRONTO'&&((anterior&&anterior!=='PRONTO'&&anterior!=='ENTREGUE')||(!anterior&&!primeiraCarga)))tocou=true;statusAnterior.set(x.id,x.status)});if((tocou||existePronto)&&somAtivo)tocarAlertaPronto();$('historicoRep').innerHTML=docs.slice(0,20).map(x=>{const status={NOVO:'Solicitado',PREPARO:'Em preparo',PRONTO:'PRONTO — RETIRAR NO BUFFET',ENTREGUE:'Entregue'}[x.status]||x.status;return `<div class="rep-history-card ${x.status==='PRONTO'?'is-pronto':''}"><div><strong>${x.local||'Buffet'}</strong><span>${(x.itens||[]).map(i=>`${i.quantidade}x ${i.nome}`).join(' · ')}</span></div><b class="status ${String(x.status||'').toLowerCase()}">${status}</b><div class="rep-history-side"><time>${data(x.criadoEm).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time>${x.status==='PRONTO'?'<button type="button" class="btn-retirar-reposicao" data-retirar-id="'+x.id+'"><i class="bi bi-check2-circle"></i> Retirei a reposição</button>':''}</div></div>`}).join('')||'<div class="rep-empty">Nenhuma solicitação ainda.</div>';primeiraCarga=false},e=>{console.error('Erro ao acompanhar reposições:',e);$('historicoRep').innerHTML='<div class="rep-empty">Não foi possível acompanhar as solicitações. Verifique a conexão.</div>'})}
$('btnSomPronto')?.addEventListener('click',alternarSom);
document.addEventListener('click',async e=>{
  const btn=e.target.closest('[data-retirar-id]');
  if(!btn)return;
  const id=btn.dataset.retirarId;
  btn.disabled=true;
  btn.innerHTML='<i class="bi bi-hourglass-split"></i> Registrando...';
  try{
    await updateDoc(doc(db,'reposicoesBuffet',id),{status:'ENTREGUE',retiradoEm:serverTimestamp(),atualizadoEm:serverTimestamp()});
  }catch(err){
    console.error('Erro ao registrar retirada:',err);
    btn.disabled=false;
    btn.innerHTML='<i class="bi bi-check2-circle"></i> Retirei a reposição';
    alert('Não foi possível registrar a retirada. Verifique a conexão.');
  }
});
audioPronto=new Audio(AUDIO_PRONTO_URL);audioPronto.preload='auto';audioPronto.loop=true;audioPronto.volume=1;
// O navegador pode bloquear autoplay. Assim que o operador tocar/clicar na tela, liberamos o áudio e repetimos o alerta pendente.
const liberarAudio=()=>{if(!somAtivo)return;try{audioPronto.play().then(()=>{audioPronto.pause();audioPronto.currentTime=0;if(alertaPendente)tocarAlertaPronto()}).catch(()=>{});}catch(e){}};
document.addEventListener('pointerdown',liberarAudio,{passive:true});
document.addEventListener('keydown',liberarAudio,{passive:true});
atualizarBotaoSom();
render();historico();
