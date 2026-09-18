import { listarCaixas, listarMovimentos, calcularCaixa } from './caixa.js';
import { db } from './firebase.js';
import { collection, addDoc, serverTimestamp, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const $=id=>document.getElementById(id);
const br=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const data=v=>v?.toDate?v.toDate().toLocaleString('pt-BR'):v?new Date(v).toLocaleString('pt-BR'):'—';
let caixas=[];
let caixaAtual=null;
let valoresSistema={dinheiro:0,pix:0,debito:0,credito:0};
let historicoFechados=[];
let filtroHistorico='todos';

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
  caixas=await listarCaixas(); let vendas=0,ent=0,sai=0; const rows=[]; historicoFechados=[];
  for(const c of caixas){
   const ms=await listarMovimentos(c.id);
   const venda=ms.filter(m=>m.tipo==='VENDA').reduce((a,m)=>a+Number(m.valor||0),0);
   const x=calcularCaixa(c,ms); vendas+=venda;ent+=x.entrada;sai+=x.saida;
   const d=c.status==='FECHADO'?Number(c.valorContado||0)-x.esperado:0, fechado=c.status==='FECHADO';
   rows.push(`<tr><td>${c.operador||'—'}</td><td>${data(c.abertoEm)}</td><td>${data(c.fechadoEm)}</td><td><span class="status-badge ${fechado?'status-fechado':'status-aberto'}"><i class="bi ${fechado?'bi-check-circle':'bi-clock'}"></i>${fechado?'Fechado':'Aberto'}</span></td><td>${br(c.valorInicial)}</td><td>${fechado?br(c.valorContado):'—'}</td><td class="${Math.abs(d)<0.005?'dif-ok':'dif-bad'}">${fechado?br(d):'—'}</td></tr>`);
   if(fechado) historicoFechados.push({id:c.id,operador:c.operador||'Operador',abertoEm:c.abertoEm,fechadoEm:c.fechadoEm,venda,valorInicial:Number(c.valorInicial||0),valorContado:Number(c.valorContado||0),diferenca:d});
  }
  $('qtd').textContent=caixas.length;$('vendas').textContent=br(vendas);$('entradas').textContent=br(ent);$('saidas').textContent=br(sai);
  $('tbody').innerHTML=rows.length?rows.join(''):`<tr><td colspan="7" class="vazio"><i class="bi bi-inbox"></i><br>Nenhum caixa registrado ainda.</td></tr>`;
  renderHistoricoFechados();
  preencherCaixas();
 }catch(e){console.error(e);$('tbody').innerHTML=`<tr><td colspan="7" class="vazio">Não foi possível carregar os caixas.</td></tr>`;}
}

async function carregarHistoricoDelivery(){
 try{
  const snap=await getDocs(collection(db,'caixasDelivery'));
  const lista=snap.docs.map(d=>({id:d.id,...d.data()})).filter(c=>c.status==='FECHADO');
  lista.sort((a,b)=>(dataObj(b.fechadoEm)?.getTime()||0)-(dataObj(a.fechadoEm)?.getTime()||0));
  const tbody=$('tbodyHistoricoDelivery'); if(!tbody)return;
  const totalVendas=lista.reduce((a,c)=>a+Number(c.totalVendas||0),0);
  const totalContado=lista.reduce((a,c)=>a+Number(c.valorContado||0),0);
  const totalDif=lista.reduce((a,c)=>a+Number(c.diferenca||0),0);
  $('deliveryQtdFechados').textContent=lista.length; $('deliveryTotalVendas').textContent=br(totalVendas); $('deliveryTotalContado').textContent=br(totalContado);
  const difEl=$('deliveryTotalDiferenca'); difEl.textContent=br(totalDif); difEl.className=Math.abs(totalDif)<0.005?'dif-ok':'dif-bad';
  if(!lista.length){tbody.innerHTML='<tr><td colspan="9" class="vazio"><i class="bi bi-bicycle"></i><br>Nenhum Caixa Delivery fechado encontrado.</td></tr>';return;}
  tbody.innerHTML=lista.map(c=>{const dif=Number(c.diferenca||0);return `<tr><td><span class="status-badge status-fechado"><i class="bi bi-bicycle"></i> Delivery</span></td><td>${c.operador||'—'}</td><td>${data(c.abertoEm)}</td><td>${data(c.fechadoEm)}</td><td>${br(c.totalVendas||0)}</td><td>${br(c.valorInicial||0)}</td><td>${br(c.valorContado||0)}</td><td class="${Math.abs(dif)<0.005?'dif-ok':'dif-bad'}">${br(dif)}</td><td><span class="status-badge status-fechado"><i class="bi bi-check-circle"></i> Fechado</span></td></tr>`;}).join('');
 }catch(e){console.error('Erro ao carregar histórico do Caixa Delivery:',e);const tbody=$('tbodyHistoricoDelivery');if(tbody)tbody.innerHTML='<tr><td colspan="9" class="vazio">Não foi possível carregar os caixas Delivery.</td></tr>';}
}

function dataObj(v){
 const d=v?.toDate?v.toDate():(v?new Date(v):null);
 return d&&!Number.isNaN(d.getTime())?d:null;
}
function renderHistoricoFechados(){
 const tbody=$('tbodyHistoricoCaixas'); if(!tbody)return;
 const agora=new Date(); agora.setHours(0,0,0,0);
 let lista=historicoFechados.slice();
 if(filtroHistorico!=='todos'){
  const dias=Number(filtroHistorico);
  const limite=new Date(agora); limite.setDate(limite.getDate()-dias+1);
  lista=lista.filter(c=>{const d=dataObj(c.fechadoEm); return d&&d>=limite;});
 }
 lista.sort((a,b)=>(dataObj(b.fechadoEm)?.getTime()||0)-(dataObj(a.fechadoEm)?.getTime()||0));
 const totalContado=lista.reduce((a,c)=>a+c.valorContado,0);
 const totalVendas=lista.reduce((a,c)=>a+c.venda,0);
 const totalDif=lista.reduce((a,c)=>a+c.diferenca,0);
 $('histQtdFechados').textContent=lista.length; $('histTotalContado').textContent=br(totalContado); $('histTotalVendas').textContent=br(totalVendas);
 const difEl=$('histTotalDiferenca'); difEl.textContent=br(totalDif); difEl.className=Math.abs(totalDif)<0.005?'dif-ok':'dif-bad';
 if(!lista.length){tbody.innerHTML='<tr><td colspan="8" class="vazio"><i class="bi bi-clock-history"></i><br>Nenhum caixa fechado encontrado neste período.</td></tr>';return;}
 tbody.innerHTML=lista.map(c=>`<tr class="linha-caixa-clicavel" data-caixa-id="${c.id}" tabindex="0" role="button" aria-label="Abrir detalhes do caixa de ${c.operador}"><td><span class="operador-clicavel"><i class="bi bi-box-arrow-up-right"></i>${c.operador}</span></td><td>${data(c.abertoEm)}</td><td>${data(c.fechadoEm)}</td><td>${br(c.venda)}</td><td>${br(c.valorInicial)}</td><td>${br(c.valorContado)}</td><td class="${Math.abs(c.diferenca)<0.005?'dif-ok':'dif-bad'}">${br(c.diferenca)}</td><td><span class="status-badge status-fechado"><i class="bi bi-check-circle"></i>Fechado</span></td></tr>`).join('');
 tbody.querySelectorAll('.linha-caixa-clicavel').forEach(row=>{
   row.addEventListener('click',()=>abrirDetalheCaixa(row.dataset.caixaId));
   row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();abrirDetalheCaixa(row.dataset.caixaId);}});
 });
}

async function abrirDetalheCaixa(id){
 const caixa=caixas.find(c=>c.id===id);
 if(!caixa)return;
 const modal=$('modalDetalheCaixa');
 modal?.classList.add('show');
 modal?.setAttribute('aria-hidden','false');
 $('tituloDetalheCaixa').textContent=`Caixa de ${caixa.operador||'Operador'}`;
 $('subtituloDetalheCaixa').textContent=`Fechado em ${data(caixa.fechadoEm)} • ${caixa.id}`;
 $('detalheKpis').innerHTML='<div class="detalhe-kpi carregando-kpi"><i class="bi bi-arrow-repeat"></i> Carregando detalhes...</div>';
 $('detalheDadosCaixa').innerHTML=''; $('detalhePagamentos').innerHTML=''; $('tbodyDetalheMovimentos').innerHTML='';
 try{
  const ms=await listarMovimentos(id);
  const calc=calcularCaixa(caixa,ms);
  const vendaMov=ms.filter(m=>m.tipo==='VENDA');
  const pagamentos={dinheiro:0,pix:0,debito:0,credito:0,outros:0};
  vendaMov.forEach(m=>{const k=formaKey(m.forma); pagamentos[k||'outros']+=Number(m.valor||0);});
  const diferenca=Number(caixa.valorContado||0)-calc.esperado;
  const entrada=calc.entrada, saida=calc.saida;
  $('detalheKpis').innerHTML=`
   <div class="detalhe-kpi"><span>Vendas</span><strong>${br(vendaMov.reduce((a,m)=>a+Number(m.valor||0),0))}</strong><small>${vendaMov.length} venda(s)</small></div>
   <div class="detalhe-kpi"><span>Valor esperado</span><strong>${br(calc.esperado)}</strong><small>Inicial + entradas − saídas</small></div>
   <div class="detalhe-kpi"><span>Valor contado</span><strong>${br(caixa.valorContado)}</strong><small>Informado no fechamento</small></div>
   <div class="detalhe-kpi ${Math.abs(diferenca)<0.005?'ok':'bad'}"><span>Diferença</span><strong>${br(diferenca)}</strong><small>${Math.abs(diferenca)<0.005?'Caixa conferido':'Sobra / falta'}</small></div>`;
  $('detalheDadosCaixa').innerHTML=`
   <div><span>Operador</span><strong>${caixa.operador||'—'}</strong></div>
   <div><span>Abertura</span><strong>${data(caixa.abertoEm)}</strong></div>
   <div><span>Fechamento</span><strong>${data(caixa.fechadoEm)}</strong></div>
   <div><span>Valor inicial</span><strong>${br(caixa.valorInicial)}</strong></div>
   <div><span>Entradas</span><strong>${br(entrada)}</strong></div>
   <div><span>Saídas</span><strong>${br(saida)}</strong></div>`;
  const nomes={dinheiro:'Dinheiro',pix:'PIX',debito:'Débito',credito:'Crédito',outros:'Outros'};
  $('detalhePagamentos').innerHTML=Object.entries(pagamentos).filter(([,v])=>v>0).map(([k,v])=>`<div><span><i class="bi ${k==='dinheiro'?'bi-cash-stack':k==='pix'?'bi-qr-code':'bi-credit-card'}"></i>${nomes[k]}</span><strong>${br(v)}</strong></div>`).join('')||'<div class="detalhe-vazio">Nenhuma venda registrada.</div>';
  $('tbodyDetalheMovimentos').innerHTML=ms.length?ms.map(m=>`<tr><td>${data(m.criadoEm)}</td><td><span class="mov-badge mov-${String(m.tipo||'').toLowerCase()}">${m.tipo||'—'}</span></td><td>${m.descricao||'—'}</td><td>${m.forma||'—'}</td><td class="${['SANGRIA','DESPESA'].includes(m.tipo)?'dif-bad':''}">${br(m.valor)}</td></tr>`).join(''):'<tr><td colspan="5" class="vazio">Nenhuma movimentação registrada neste caixa.</td></tr>';
 }catch(e){console.error(e);$('detalheKpis').innerHTML='<div class="detalhe-erro"><i class="bi bi-exclamation-triangle"></i> Não foi possível carregar os detalhes deste caixa.</div>';$('tbodyDetalheMovimentos').innerHTML='<tr><td colspan="5" class="vazio">Erro ao carregar movimentações.</td></tr>';}
}
function fecharDetalheCaixa(){const m=$('modalDetalheCaixa');m?.classList.remove('show');m?.setAttribute('aria-hidden','true');}
function configurarDetalheCaixa(){
 $('fecharDetalheCaixa')?.addEventListener('click',fecharDetalheCaixa);
 $('btnFecharDetalheFinal')?.addEventListener('click',fecharDetalheCaixa);
 document.querySelector('[data-fechar-detalhe]')?.addEventListener('click',fecharDetalheCaixa);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')fecharDetalheCaixa();});
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
$('atualizarDelivery')?.addEventListener('click',carregarHistoricoDelivery);
$('carregarConciliacao').onclick=prepararConciliacao;
$('salvarConciliacao').onclick=salvarConciliacao;
['maqDinheiro','maqPix','maqDebito','maqCredito'].forEach(id=>$(id)?.addEventListener('input',atualizarConciliacao));
$('obsConciliacao')?.addEventListener('input',()=>{ $('contadorObs').textContent=String($('obsConciliacao').value.length); });
configurarDetalheCaixa();
carregarDados();
carregarHistoricoDelivery();


document.querySelectorAll('.filtro-caixa').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.filtro-caixa').forEach(b=>b.classList.remove('ativo'));btn.classList.add('ativo');filtroHistorico=btn.dataset.filtro;renderHistoricoFechados();}));


// Conciliação Caixa Delivery — independente da conciliação da Loja
function atualizarConciliacaoDelivery(){
 const sistema=Math.max(0,Number($('deliveryConcSistema')?.value||0));
 const conferido=Math.max(0,Number($('deliveryConcConferido')?.value||0));
 const taxas=Math.max(0,Number($('deliveryConcTaxas')?.value||0));
 const totalSistema=sistema-taxas; const dif=conferido-totalSistema;
 if($('deliveryConcTotalSistema'))$('deliveryConcTotalSistema').textContent=br(totalSistema);
 if($('deliveryConcTotalConferido'))$('deliveryConcTotalConferido').textContent=br(conferido);
 if($('deliveryConcDiferenca'))$('deliveryConcDiferenca').textContent=br(dif);
 $('deliveryConcResultado')?.classList.toggle('conciliado',Math.abs(dif)<0.005);
}
['deliveryConcSistema','deliveryConcConferido','deliveryConcTaxas'].forEach(id=>$(id)?.addEventListener('input',atualizarConciliacaoDelivery));
$('salvarConciliacaoDelivery')?.addEventListener('click',async()=>{
 atualizarConciliacaoDelivery();
 const sistema=Math.max(0,Number($('deliveryConcSistema')?.value||0));
 const conferido=Math.max(0,Number($('deliveryConcConferido')?.value||0));
 const taxas=Math.max(0,Number($('deliveryConcTaxas')?.value||0));
 const observacao=String($('deliveryConcObs')?.value||'').trim();
 const totalSistema=sistema-taxas,diferenca=conferido-totalSistema;
 if(Math.abs(diferenca)>=0.005&&!observacao){alert('Informe uma observação/justificativa para salvar uma divergência no Delivery.');return;}
 try{await addDoc(collection(db,'conciliacoesDelivery'),{sistema,conferido,taxas,totalSistema,diferenca,status:Math.abs(diferenca)<0.005?'CONCILIADO':'DIVERGENTE',observacao,criadoEm:serverTimestamp()});alert('Conciliação Caixa Delivery salva com sucesso.');}
 catch(e){console.error(e);alert('Não foi possível salvar a conciliação do Delivery.');}
});
