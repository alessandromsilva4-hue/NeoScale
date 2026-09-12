import { listarCaixas, listarMovimentos, calcularCaixa } from './caixa.js';
import { db } from './firebase.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const $=id=>document.getElementById(id);
const br=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const data=v=>v?.toDate?v.toDate().toLocaleString('pt-BR'):v?new Date(v).toLocaleString('pt-BR'):'—';
let caixas=[];
let caixaAtual=null;
let valoresSistema={dinheiro:0,pix:0,debito:0,credito:0};

function formaKey(v){
  const s=String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(s.includes('dinheiro')) return 'dinheiro';
  if(s.includes('pix')) return 'pix';
  if(s.includes('debito')) return 'debito';
  if(s.includes('credito')) return 'credito';
  return null;
}
function valorInput(id){ return Math.max(0,Number($(id)?.value||0)); }
function setDiff(id,sys,conf){
  const d=conf-sys, el=$(id); if(!el)return; el.textContent=br(d);
  el.className=d===0?'conc-ok':'conc-divergente';
}
function atualizarConciliacao(){
  const map=[['dinheiro','sysDinheiro','maqDinheiro','difDinheiro'],['pix','sysPix','maqPix','difPix'],['debito','sysDebito','maqDebito','difDebito'],['credito','sysCredito','maqCredito','difCredito']];
  let totalS=0,totalC=0;
  for(const [k,si,mi,di] of map){ const sys=valoresSistema[k]||0, conf=valorInput(mi); totalS+=sys; totalC+=conf; $(si).textContent=br(sys); setDiff(di,sys,conf); }
  $('concTotalSistema').textContent=br(totalS); $('concTotalMaquina').textContent=br(totalC);
  const dif=totalC-totalS, status=$('statusConc');
  status.textContent=Math.abs(dif)<0.005?'CAIXA CONCILIADO':'DIVERGÊNCIA ENCONTRADA';
  $('resultadoConc').classList.toggle('conciliado',Math.abs(dif)<0.005);
}

async function carregarDados(){
 try{
  caixas=await listarCaixas(); let vendas=0,ent=0,sai=0; const rows=[];
  for(const c of caixas){
   const ms=await listarMovimentos(c.id);
   const venda=ms.filter(m=>m.tipo==='VENDA').reduce((a,m)=>a+Number(m.valor||0),0);
   const x=calcularCaixa(c,ms); vendas+=venda;ent+=x.entrada;sai+=x.saida;
   const d=c.status==='FECHADO'?Number(c.valorContado||0)-x.esperado:0, fechado=c.status==='FECHADO';
   rows.push(`<tr><td>${c.operador||'—'}</td><td>${data(c.abertoEm)}</td><td>${data(c.fechadoEm)}</td><td><span class="status-badge ${fechado?'status-fechado':'status-aberto'}"><i class="bi ${fechado?'bi-check-circle':'bi-clock'}"></i>${fechado?'Fechado':'Aberto'}</span></td><td>${br(c.valorInicial)}</td><td>${fechado?br(c.valorContado):'—'}</td><td class="${Math.abs(d)<0.005?'dif-ok':'dif-bad'}">${fechado?br(d):'—'}</td></tr>`);
  }
  $('qtd').textContent=caixas.length;$('vendas').textContent=br(vendas);$('entradas').textContent=br(ent);$('saidas').textContent=br(sai);
  $('tbody').innerHTML=rows.length?rows.join(''):`<tr><td colspan="7" class="vazio"><i class="bi bi-inbox"></i><br>Nenhum caixa registrado ainda.</td></tr>`;
  preencherCaixas();
 }catch(e){console.error(e);$('tbody').innerHTML=`<tr><td colspan="7" class="vazio">Não foi possível carregar os caixas.</td></tr>`;}
}

function preencherCaixas(){
 const sel=$('caixaConciliacao'); if(!sel)return;
 sel.innerHTML=caixas.filter(c=>c.status==='FECHADO').map(c=>`<option value="${c.id}">${c.operador||'Operador'} — ${data(c.fechadoEm)} — ${br(c.valorContado)}</option>`).join('');
 if(!sel.options.length){sel.innerHTML='<option value="">Nenhum caixa fechado</option>';$('carregarConciliacao').disabled=true;return;}
 $('carregarConciliacao').disabled=false;
}

async function prepararConciliacao(){
 const id=$('caixaConciliacao').value; caixaAtual=caixas.find(c=>c.id===id);
 if(!caixaAtual){$('concAlerta').innerHTML='<i class="bi bi-exclamation-circle"></i> Não há caixa fechado disponível para conciliar.';return;}
 try{
  const ms=await listarMovimentos(id); valoresSistema={dinheiro:0,pix:0,debito:0,credito:0};
  ms.filter(m=>m.tipo==='VENDA').forEach(m=>{const k=formaKey(m.forma);if(k)valoresSistema[k]+=Number(m.valor||0);});
  ['dinheiro','pix','debito','credito'].forEach(k=>{const id='maq'+k.charAt(0).toUpperCase()+k.slice(1);$(id).value=k==='dinheiro'?Number(caixaAtual.valorContado||0):'';});
  $('concAlerta').innerHTML='<i class="bi bi-check-circle"></i> Caixa selecionado. Informe os valores do fechamento do dinheiro e dos relatórios de PIX/maquininhas para conferir.';
  atualizarConciliacao();
 }catch(e){console.error(e);$('concAlerta').innerHTML='<i class="bi bi-exclamation-triangle"></i> Não foi possível carregar os movimentos deste caixa.';}
}

async function salvarConciliacao(){
 if(!caixaAtual){alert('Selecione um caixa fechado primeiro.');return;}
 atualizarConciliacao();
 const conferencia={dinheiro:valorInput('maqDinheiro'),pix:valorInput('maqPix'),debito:valorInput('maqDebito'),credito:valorInput('maqCredito')};
 const observacao=String($('obsConciliacao')?.value||'').trim();
 const sistema={...valoresSistema}; const totalSistema=Object.values(sistema).reduce((a,b)=>a+b,0); const totalConferido=Object.values(conferencia).reduce((a,b)=>a+b,0);
 const diferenca=totalConferido-totalSistema;
 if(Math.abs(diferenca)>=0.005 && !observacao){ alert('Informe uma observação/justificativa para salvar uma conciliação com divergência.'); $('obsConciliacao')?.focus(); return; }
 try{
  await addDoc(collection(db,'conciliacoesCaixa'),{caixaId:caixaAtual.id,operador:caixaAtual.operador||'Operador',sistema,conferencia,totalSistema,totalConferido,diferenca,status:Math.abs(diferenca)<0.005?'CONCILIADO':'DIVERGENTE',observacao,criadoEm:serverTimestamp()});
  $('concAlerta').innerHTML='<i class="bi bi-check-circle-fill"></i> Conciliação salva no Firestore com sucesso.';
 }catch(e){console.error(e);alert('Não foi possível salvar a conciliação.');}
}

$('atualizar').onclick=carregarDados;
$('carregarConciliacao').onclick=prepararConciliacao;
$('salvarConciliacao').onclick=salvarConciliacao;
['maqDinheiro','maqPix','maqDebito','maqCredito'].forEach(id=>$(id)?.addEventListener('input',atualizarConciliacao));
$('obsConciliacao')?.addEventListener('input',()=>{ $('contadorObs').textContent=String($('obsConciliacao').value.length); });
carregarDados();
