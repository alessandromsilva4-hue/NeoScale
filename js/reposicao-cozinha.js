import { db } from './firebase.js';
import { collection, query, orderBy, limit, onSnapshot, updateDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
let pedidos=[];
let somAtivo=localStorage.getItem('neoscale_cozinha_som')!=='0';
let audioAlerta=null;
let alertaPendente=false;
let alertaEmExecucao=false;
let ultimoAlerta='';
const AUDIO_ALERTA_URL='som-reposicao-cozinha.mp3';
const $=id=>document.getElementById(id);
function dt(v){return v?.toDate?v.toDate():v?.seconds?new Date(v.seconds*1000):new Date(v||Date.now())}
function prepararAudio(){
  if(audioAlerta)return audioAlerta;
  audioAlerta=new Audio(AUDIO_ALERTA_URL);
  audioAlerta.preload='auto';
  audioAlerta.volume=1;
  audioAlerta.loop=true;
  audioAlerta.addEventListener('ended',()=>{if(alertaEmExecucao){try{audioAlerta.currentTime=0;audioAlerta.play().catch(()=>{})}catch(e){}}});
  return audioAlerta;
}
function atualizarBotaoSom(){const b=$('btnSom');if(!b)return;b.classList.toggle('active',somAtivo);b.innerHTML=somAtivo?'<i class="bi bi-volume-up-fill"></i> Som ativo':'<i class="bi bi-volume-mute-fill"></i> Ativar som';}
function liberarAudio(){
  if(!somAtivo)return;
  const a=prepararAudio();
  try{
    const p=a.play();
    if(p&&p.then)p.then(()=>{a.pause();a.currentTime=0;if(alertaPendente)iniciarAlerta()}).catch(()=>{});
  }catch(e){}
}
function ativarSom(){
  somAtivo=true;localStorage.setItem('neoscale_cozinha_som','1');atualizarBotaoSom();liberarAudio();
  if(pedidos.some(x=>x.status==='NOVO'))iniciarAlerta();
}
function desativarSom(){somAtivo=false;localStorage.setItem('neoscale_cozinha_som','0');pararAlerta();atualizarBotaoSom();}
function iniciarAlerta(){
  if(!somAtivo||!pedidos.some(x=>x.status==='NOVO'))return;
  const a=prepararAudio();
  alertaEmExecucao=true;alertaPendente=false;
  try{const p=a.play();if(p&&p.catch)p.catch(()=>{alertaPendente=true})}catch(e){alertaPendente=true}
}
function pararAlerta(){alertaEmExecucao=false;alertaPendente=false;if(!audioAlerta)return;try{audioAlerta.pause();audioAlerta.currentTime=0}catch(e){}}
function card(x){const itens=(x.itens||[]).map(i=>`<div class="rep-card-item"><b>${i.quantidade}x</b><span>${i.nome}</span></div>`).join('');const proximo=x.status==='NOVO'?'PREPARO':x.status==='PREPARO'?'PRONTO':'ENTREGUE';const label=x.status==='NOVO'?'Aceitar e iniciar preparo':x.status==='PREPARO'?'Marcar como pronto':'Marcar como entregue';return `<article class="rep-ticket ${x.status==='NOVO'?'is-new':''}"><header><div><span class="rep-ticket-label">${x.status==='NOVO'?'NOVA SOLICITAÇÃO':'REPOSIÇÃO'}</span><h3>${x.local||'Buffet'}</h3></div><time>${dt(x.criadoEm).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time></header><div class="rep-ticket-items">${itens}</div><button class="rep-action" data-id="${x.id}" data-next="${proximo}">${label}</button></article>`}
function render(){const grupos={NOVO:[],PREPARO:[],PRONTO:[]};pedidos.forEach(x=>{if(grupos[x.status])grupos[x.status].push(x)});[['NOVO','listaNovo','countNovo'],['PREPARO','listaPreparo','countPreparo'],['PRONTO','listaPronto','countPronto']].forEach(([s,l,c])=>{$(l).innerHTML=grupos[s].map(card).join('')||'<div class="rep-empty">Nenhuma solicitação nesta etapa.</div>';$(c).textContent=grupos[s].length});$('kpiNovos').textContent=grupos.NOVO.length;$('kpiPreparo').textContent=grupos.PREPARO.length;$('kpiProntos').textContent=grupos.PRONTO.length;if(grupos.NOVO.length){if(ultimoAlerta!==grupos.NOVO.map(x=>x.id).join(',')){ultimoAlerta=grupos.NOVO.map(x=>x.id).join(',');iniciarAlerta()}}else{ultimoAlerta='';pararAlerta()}}
$('btnSom').addEventListener('click',()=>{somAtivo?desativarSom():ativarSom()});
document.addEventListener('pointerdown',liberarAudio,{passive:true});
document.addEventListener('keydown',liberarAudio,{passive:true});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-id][data-next]');if(!b)return;try{pararAlerta();await updateDoc(doc(db,'reposicoesBuffet',b.dataset.id),{status:b.dataset.next,atualizadoEm:serverTimestamp()})}catch(err){console.error(err);alert('Não foi possível atualizar a solicitação.')}});
const q=query(collection(db,'reposicoesBuffet'),orderBy('criadoEm','desc'),limit(100));onSnapshot(q,s=>{pedidos=s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.status&&x.status!=='ENTREGUE');render()},e=>{console.error(e);$('listaNovo').innerHTML='<div class="rep-empty">Não foi possível carregar as solicitações.</div>'});
prepararAudio();atualizarBotaoSom();
