import { auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { caixaAberto,abrirCaixa,fecharCaixa,listarMovimentos,calcularCaixa,registrarMovimento } from './caixa.js';
const $=id=>document.getElementById(id), br=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); let atual=null; let tipoMov='SANGRIA'; let movimentosAtuais=[];
function formaNormalizada(v){ const x=String(v||'').trim().toLowerCase(); if(x==='dinheiro')return'Dinheiro'; if(x==='pix')return'PIX'; if(x==='débito'||x==='debito')return'Débito'; if(x==='crédito'||x==='credito')return'Crédito'; return'Outros'; }
function resumoPagamentos(movs){ const r={Dinheiro:0,PIX:0,'Débito':0,'Crédito':0,Outros:0}; movs.filter(m=>m.tipo==='VENDA').forEach(m=>{r[formaNormalizada(m.forma)]+=Number(m.valor||0);}); return r; }
function resumoDinheiro(c,movs){ const r=resumoPagamentos(movs); const supr=movs.filter(m=>m.tipo==='SUPRIMENTO').reduce((a,m)=>a+Number(m.valor||0),0); const sang=movs.filter(m=>m.tipo==='SANGRIA').reduce((a,m)=>a+Number(m.valor||0),0); return Number(c?.valorInicial||0)+r.Dinheiro+supr-sang; }
function renderPagamentos(movs){
 const r=resumoPagamentos(movs);
 $('totalDinheiro').textContent=br(r.Dinheiro); $('totalPix').textContent=br(r.PIX); $('totalDebito').textContent=br(r['Débito']); $('totalCredito').textContent=br(r['Crédito']); $('totalOutros').textContent=br(r.Outros);
 const old={}; document.querySelectorAll('#conferenciaPagamento input[data-forma]').forEach(i=>{old[i.dataset.forma]=i.value;});
 const ap=atual?.valoresApurados||{};
 const valor=(k)=>old[k]!==undefined?old[k]:(ap[k]!==undefined?ap[k]:'');
 const esperado={DINHEIRO:resumoDinheiro(atual,movs),PIX:r.PIX,DEBITO:r['Débito'],CREDITO:r['Crédito'],OUTROS:r.Outros};
 const labels={DINHEIRO:'Dinheiro contado',PIX:'PIX recebido',DEBITO:'Débito recebido',CREDITO:'Crédito recebido',OUTROS:'Outros recebidos'};
 $('conferenciaPagamento').innerHTML=Object.entries(esperado).map(([k,v])=>`<div class="conferencia-item conferencia-editavel"><div><span>${labels[k]}</span><small>Esperado no sistema: ${br(v)}</small></div><label class="apuracao-input"><span>R$</span><input data-forma="${k}" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00" value="${valor(k)}" aria-label="${labels[k]}"></label><strong class="conferencia-diferenca" data-diff="${k}">Diferença: ${br(Number(valor(k)||0)-Number(v||0))}</strong></div>`).join('');
 document.querySelectorAll('#conferenciaPagamento input[data-forma]').forEach(input=>input.addEventListener('input',()=>atualizarApuracao()));
 atualizarApuracao();
}
function obterApuracoes(){
 const get=k=>{const el=document.querySelector(`#conferenciaPagamento input[data-forma="${k}"]`); return el&&el.value!==''?Number(el.value):null;};
 return {DINHEIRO:get('DINHEIRO'),PIX:get('PIX'),DEBITO:get('DEBITO'),CREDITO:get('CREDITO'),OUTROS:get('OUTROS')};
}
function atualizarApuracao(){
 if(!atual)return;
 const m=movimentosAtuais||[], r=resumoPagamentos(m), esperado={DINHEIRO:resumoDinheiro(atual,m),PIX:r.PIX,DEBITO:r['Débito'],CREDITO:r['Crédito'],OUTROS:r.Outros};
 const a=obterApuracoes();
 const cash=document.getElementById('valorContado'); if(cash && a.DINHEIRO!==null && cash.value!==String(a.DINHEIRO)) cash.value=a.DINHEIRO;
 Object.entries(esperado).forEach(([k,v])=>{const el=document.querySelector(`[data-diff="${k}"]`);if(el){const val=a[k]===null?0:a[k];el.textContent=`Diferença: ${br(val-v)}`;}});
 const cont=a.DINHEIRO===null?0:a.DINHEIRO, dif=cont-esperado.DINHEIRO;
 if($('fechDiferenca'))$('fechDiferenca').textContent=br(dif); if($('fechDiferenca2'))$('fechDiferenca2').textContent=br(dif); if($('fechContado'))$('fechContado').textContent=br(cont); if($('diferenca'))$('diferenca').textContent=br(dif);
}

function msg(t,ok=false){$('msg').innerHTML=`<div class="alert ${ok?'ok':'err'}">${t}</div>`}
function clearMsg(){ $('msg').innerHTML=''; }
function setStatus(aberto){
 const badge=$('badgeStatus');
 if(badge){
   badge.innerHTML=`<i class="bi bi-circle-fill"></i> ${aberto?'CAIXA ABERTO':'CAIXA FECHADO'}`;
   badge.className=aberto?'cx-status open':'cx-status';
 }
}
async function render(){
 try{
  atual=await caixaAberto(); const aberto=!!atual; setStatus(aberto); $('abrir').classList.toggle('hidden',aberto);
  $('fechar').classList.remove('hidden');
  $('movimentacoesPanel').classList.remove('hidden');
  const btnMov=$('btnMovimentar'); if(btnMov) btnMov.disabled=!aberto;
  const btnAbrir=$('btnAbrir'); if(btnAbrir){btnAbrir.hidden=aberto;btnAbrir.disabled=aberto;}
  const btnFechar=$('btnFechar'); if(btnFechar){btnFechar.hidden=!aberto;btnFechar.disabled=!aberto;}
  const btnFecharPainel=$('btnFecharPainel'); if(btnFecharPainel){btnFecharPainel.hidden=!aberto;btnFecharPainel.disabled=!aberto;}
  const valorContado=$('valorContado'); if(valorContado) valorContado.disabled=!aberto;
  if(!aberto){
    $('inicial').textContent=br(0); $('esperado').textContent=br(0); $('dinheiroEsperado').textContent=br(0); $('diferenca').textContent=br(0); $('entradas').textContent=br(0); $('saidas').textContent=br(0); $('caixaId').textContent='Nenhum caixa aberto';
    $('totalDinheiro').textContent=br(0); $('totalPix').textContent=br(0); $('totalDebito').textContent=br(0); $('totalCredito').textContent=br(0); $('totalOutros').textContent=br(0);
    $('conferenciaPagamento').innerHTML='<div class="conferencia-empty"><i class="bi bi-info-circle"></i> Abra um caixa para iniciar a conferência do fechamento.</div>';
    $('fechEsperado').textContent=br(0); $('fechContado').textContent=br(0); $('fechDiferenca2').textContent=br(0); $('fechDiferenca').textContent=br(0); $('operadorAtual').textContent='—';
    return;
  }
  const m=await listarMovimentos(atual.id), c=calcularCaixa(atual,m); movimentosAtuais=m; const dinheiro=resumoDinheiro(atual,m); $('inicial').textContent=br(atual.valorInicial); $('esperado').textContent=br(c.esperado); $('dinheiroEsperado').textContent=br(dinheiro); $('diferenca').textContent=br(Number($('valorContado').value||0)-dinheiro); if($('fechDiferenca'))$('fechDiferenca').textContent=br(Number($('valorContado').value||0)-dinheiro); if($('fechDiferenca2'))$('fechDiferenca2').textContent=br(Number($('valorContado').value||0)-dinheiro); if($('fechContado'))$('fechContado').textContent=br(Number($('valorContado').value||0)); $('entradas').textContent=br(c.entrada); $('saidas').textContent=br(c.saida); $('caixaId').textContent=atual.id.slice(0,10)+'…'; $('operadorAtual').textContent=atual.operador||'Operador'; renderPagamentos(m); await carregarMovimentos(m);
 }catch(e){ console.error(e); msg('Não foi possível acessar o Caixa no Firebase. Se você já entrou no sistema, verifique as regras do Firestore para permitir acesso aos usuários autenticados.'); }
}
$('btnAbrir').onclick=async()=>{clearMsg(); try{const op=$('operador').value.trim()||'Operador'; await abrirCaixa($('valorInicial').value,op); msg('Caixa aberto com sucesso. O PDV já poderá registrar as vendas neste caixa.',true); await render();}catch(e){console.error(e);msg(e.message||'Não foi possível abrir o caixa.')}};
function imprimirRelatorioVendas(caixa,movs,calculo,apurados,dinheiroEsperado,popupExistente=null){
 const valorContado=Number(apurados?.DINHEIRO||0);
 // RELATORIO DO CAIXA NORMAL: somente movimentos do caixa normal.
 // Delivery usa colecoes separadas (caixasDelivery/movimentosCaixaDelivery) e nunca entra aqui.
 const ehDelivery = m => {
   const texto = [m?.origem,m?.tipoCaixa,m?.caixaTipo,m?.referencia,m?.forma,m?.descricao].map(v=>String(v||'').trim().toLowerCase()).join(' ');
   return /delivery|caixa delivery|ifood|99food|anota ai|anota aí|entregador/.test(texto);
 };
 const movimentosNormais = movs.filter(m => !ehDelivery(m));
 const vendas=movimentosNormais.filter(m=>m.tipo==='VENDA');

 const sangrias=movimentosNormais.filter(m=>m.tipo==='SANGRIA');
 const suprimentos=movimentosNormais.filter(m=>m.tipo==='SUPRIMENTO');
 const despesas=movimentosNormais.filter(m=>m.tipo==='DESPESA');
 const totalVendas=vendas.reduce((a,m)=>a+Number(m.valor||0),0);
 const porForma={"CRÉDITO":0,"DÉBITO":0,"DINHEIRO":0,"PIX":0,"OUTROS":0};
 const formaRelatorio=v=>{
   const raw=String(v||'').trim().toUpperCase();
   if(raw.includes('CREDITO')||raw.includes('CRÉDITO'))return'CRÉDITO';
   if(raw.includes('DEBITO')||raw.includes('DÉBITO'))return'DÉBITO';
   if(raw.includes('DINHEIRO'))return'DINHEIRO';
   if(raw.includes('PIX'))return'PIX';
   return'OUTROS';
 };
 vendas.forEach(v=>porForma[formaRelatorio(v.forma)]+=Number(v.valor||0));
 const ticket=vendas.length?totalVendas/vendas.length:0;
 const diferencaDinheiro=Number(valorContado||0)-Number(dinheiroEsperado||0);
 const agora=new Date();
 const dataHora=d=>d?new Date(d).toLocaleString('pt-BR'): '—';
 const firestoreDate=v=>{try{return v?.toDate?v.toDate():v?new Date(v):null}catch{return null}};
 const abertura=firestoreDate(caixa.abertoEm);
 const fechamento=agora;
 const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const num=v=>Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
 const linha=(label,value)=>`<div class="row"><span>${esc(label)}</span><span>${money(value)}</span></div>`;
 const linhaApurada=(label,system,apurado)=>{const dif=Number(apurado||0)-Number(system||0);return `<div class="row three"><span>${esc(label)}</span><span>${money(apurado)}</span><span class="dif ${Math.abs(dif)<0.005?'ok':''}">${money(dif)}</span></div>`;};
 const linhasForma=Object.entries(porForma).map(([k,v])=>`<div class="row"><span>${esc(k)}</span><span>${money(v)}</span></div>`).join('');
 const linhasApuradas=Object.entries(porForma).map(([k,v])=>{
   const mapa={DINHEIRO:'DINHEIRO',PIX:'PIX',DEBITO:'DÉBITO',CREDITO:'CRÉDITO',OUTROS:'OUTROS'};
   const chave=mapa[k]||k;
   const ap=apurados?.[chave]!==undefined && apurados?.[chave]!==null ? Number(apurados[chave]) : Number(v||0);
   return linhaApurada(k,v,ap);
 }).join('');
 const movimentos=[...sangrias,...suprimentos,...despesas];
 const linhasMov=movimentos.length?movimentos.map(m=>`<div class="row"><span>${esc(m.tipo)} ${m.descricao?'- '+esc(m.descricao):''}</span><span>${money(m.valor)}</span></div>`).join(''):'<div class="muted">NENHUMA MOVIMENTAÇÃO</div>';
 const produtos=vendas.map(v=>({descricao:v.descricao||'Venda',qtd:1,valor:Number(v.valor||0)}));
 const linhasProdutos=produtos.length?produtos.map(v=>`<div class="row"><span>${esc(v.descricao)} <b>x${v.qtd}</b></span><span>${money(v.valor)}</span></div>`).join(''):'<div class="muted">NENHUM PRODUTO REGISTRADO</div>';
 const popup=popupExistente || window.open('','_blank','width=520,height=900');
 if(!popup){msg('Caixa fechado, mas o navegador bloqueou o relatório. Permita pop-ups para visualizar o relatório.',false);return;}
 popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NeoScale — Fechamento de Caixa</title><style>
 *{box-sizing:border-box}body{margin:0;background:#e9e9e9;color:#000;font-family:"Courier New",Courier,monospace;font-size:13px;font-weight:600}.sheet{width:80mm;min-height:100vh;margin:16px auto;background:#fff;padding:12px 10px 28px;box-shadow:0 2px 10px #0002}.center{text-align:center}.brand{font-size:20px;font-weight:900;letter-spacing:.4px}.title{font-size:14px;font-weight:900;margin-top:3px}.sub{font-size:11px;font-weight:700}.sep{border-top:1px dashed #000;margin:9px 0}.sep2{border-top:2px solid #000;margin:10px 0}.section{font-weight:900;font-size:13px;margin:7px 0 4px}.row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;line-height:1.32;margin:1px 0}.row span:last-child{text-align:right;white-space:nowrap}.three{grid-template-columns:minmax(0,1fr) 74px 74px}.three span:nth-child(2),.three span:nth-child(3){text-align:right}.muted{font-size:11px;color:#000;font-weight:700}.total{font-size:14px;font-weight:900}.signature{margin-top:34px;padding-top:18px;text-align:center;min-height:135px}.signature-line{border-top:1.5px solid #000;margin:0 5px;padding-top:7px;font-weight:900}.signature .name{margin-top:10px}.signature .date{margin-top:9px}.actions{position:fixed;right:20px;top:20px;display:flex;gap:8px}.actions button{border:0;border-radius:8px;padding:9px 12px;background:#008f70;color:#fff;font-weight:800;cursor:pointer}.actions .close{background:#222}@media(max-width:700px){.sheet{margin:0;width:80mm;box-shadow:none}.actions{position:sticky;top:0;justify-content:center;background:#fff;padding:8px;margin:0 -10px 8px}.actions button{font-family:Arial,sans-serif}}@media print{body{background:#fff}.sheet{margin:0;box-shadow:none;width:80mm;padding:0 8px 28px}.actions{display:none!important}}
 </style></head><body><div class="sheet"><div class="actions no-print"><button onclick="window.print()">IMPRIMIR</button><button class="close" onclick="window.close()">FECHAR</button></div>
 <div class="center"><div class="brand">NEOSCALE</div><div class="title">RELATÓRIO DE FECHAMENTO DE CAIXA</div><div class="sub">GERADO: ${esc(dataHora(fechamento))}</div></div>
 <div class="sep"></div>
 <div>OPERADOR: ${esc(caixa.operador||'OPERADOR')}</div><div>ABERTURA: ${esc(dataHora(abertura))}</div><div>FECHAMENTO: ${esc(dataHora(fechamento))}</div>
 <div class="sep"></div><div class="section">RESUMO DO CAIXA</div>
 <div class="row"><span>Valor inicial</span><span>${money(caixa.valorInicial||0)}</span></div><div class="row"><span>Total de vendas</span><span>${money(totalVendas)}</span></div><div class="row"><span>Entradas</span><span>${money(Number(calculo?.entrada||totalVendas))}</span></div><div class="row"><span>Saídas</span><span>${money(Number(calculo?.saida||0))}</span></div><div class="row total"><span>Total esperado</span><span>${money(Number(caixa.valorInicial||0)+Number(calculo?.entrada||totalVendas)-Number(calculo?.saida||0))}</span></div>
 <div class="sep"></div><div class="section">RELATÓRIO REAL DO CAIXA</div><div class="muted">Valor calculado pelo sistema</div><div class="sep"></div>
 <div class="row"><b>FORMA DE PAGAMENTO</b><b>VALOR TOTAL</b></div>${linhasForma}<div class="sep"></div><div class="row total"><span>TOTAL</span><span>${money(totalVendas)}</span></div>
 <div class="sep"></div><div class="section">RELATÓRIO APURADO DO CAIXA</div><div class="muted">Valor informado pelo operador</div><div class="sep"></div>
 <div class="row three"><b>FORMA</b><b>APURADO</b><b>DIF.</b></div>${linhasApuradas}<div class="sep"></div><div class="row total"><span>TOTAL APURADO</span><span>${money(Object.values(apurados||{}).reduce((a,v)=>a+Number(v||0),0))}</span></div>
 <div class="sep"></div><div class="section">CONFERÊNCIA</div><div class="row"><span>Valor esperado</span><span>${money(dinheiroEsperado)}</span></div><div class="row"><span>Valor contado</span><span>${money(valorContado)}</span></div><div class="row total"><span>DIFERENÇA</span><span>${money(diferencaDinheiro)}</span></div>
 <div class="sep"></div><div class="section">MOVIMENTAÇÕES</div>${linhasMov}
 <div class="sep"></div><div class="section">VENDAS DO CAIXA</div><div class="row"><span>Quantidade de vendas</span><span>${vendas.length}</span></div>${linhasProdutos}
 <div class="sep2"></div><div class="row total"><span>TOTAL DO CAIXA</span><span>${money(totalVendas)}</span></div>
 <div class="signature"><div class="signature-line">ASSINATURA DO OPERADOR</div><div class="name">Nome: ${esc(caixa.operador||'OPERADOR')}</div><div class="date">Data: ____/____/________</div></div>
 </div></body></html>`);
 popup.document.close();
 setTimeout(()=>{try{popup.focus();popup.print();}catch(e){}},350);
}
async function fecharAtual(){
 if(!atual)return; clearMsg();
 try{
  const m=await listarMovimentos(atual.id), c=calcularCaixa(atual,m), r=resumoPagamentos(m), dinheiro=resumoDinheiro(atual,m), a=obterApuracoes();
  if(Object.values(a).some(v=>v===null || Number.isNaN(v) || v<0)){msg('Preencha os valores recebidos de Dinheiro, PIX, Débito, Crédito e Outros para fechar o caixa.');return;}
  const difDinheiro=Number(a.DINHEIRO)-dinheiro;
  const difPix=Number(a.PIX)-r.PIX, difDebito=Number(a.DEBITO)-r['Débito'], difCredito=Number(a.CREDITO)-r['Crédito'], difOutros=Number(a.OUTROS)-r.Outros;
  const totalSistema=r.Dinheiro+r.PIX+r['Débito']+r['Crédito']+r.Outros;
  const totalApurado=Number(a.DINHEIRO)+Number(a.PIX)+Number(a.DEBITO)+Number(a.CREDITO)+Number(a.OUTROS);
  const difTotal=totalApurado-totalSistema;
  if(!confirm(`Conferência do caixa\n\nDinheiro: esperado ${br(dinheiro)} | contado ${br(a.DINHEIRO)}\nPIX: esperado ${br(r.PIX)} | informado ${br(a.PIX)}\nDébito: esperado ${br(r['Débito'])} | informado ${br(a.DEBITO)}\nCrédito: esperado ${br(r['Crédito'])} | informado ${br(a.CREDITO)}\nOutros: esperado ${br(r.Outros)} | informado ${br(a.OUTROS)}\n\nDiferença total: ${br(difTotal)}\n\nConfirma o fechamento?`))return;
  // Abrir a janela dentro do clique do operador evita bloqueio de pop-up após o await.
  const popupRelatorio=window.open('','_blank','width=520,height=900');
  if(!popupRelatorio){msg('O navegador bloqueou o relatório. Permita pop-ups para este site e tente novamente.',false);return;}
  popupRelatorio.document.write('<html><head><title>NeoScale - Gerando fechamento...</title></head><body style="font-family:Arial;padding:30px;text-align:center">Gerando relatório de fechamento...</body></html>');
  popupRelatorio.document.close();
  try{
    await fecharCaixa(atual.id,Number(a.DINHEIRO),{valorEsperadoDinheiro:dinheiro,diferenca:difDinheiro,valoresApurados:a,diferencasPorForma:{DINHEIRO:difDinheiro,PIX:difPix,DEBITO:difDebito,CREDITO:difCredito,OUTROS:difOutros},totalSistema,totalApurado,diferencaTotal:difTotal});
    imprimirRelatorioVendas(atual,m,c,a,dinheiro,popupRelatorio);
  }catch(e){try{popupRelatorio.close();}catch{} throw e;}
  msg(`Caixa fechado com sucesso. Diferença total: ${br(difTotal)}. Relatório de vendas aberto para impressão.`,true); await render();
 }catch(e){console.error(e);msg(e.message||'Não foi possível fechar o caixa.');}
}
const campoContado=$('valorContado'); if(campoContado){campoContado.addEventListener('input',()=>{ if(!atual)return; const input=document.querySelector('#conferenciaPagamento input[data-forma="DINHEIRO"]'); if(input && input.value!==campoContado.value) input.value=campoContado.value; atualizarApuracao();});}
$('btnFechar').onclick=fecharAtual;const btnFecharPainel=$('btnFecharPainel');if(btnFecharPainel)btnFecharPainel.onclick=fecharAtual;
onAuthStateChanged(auth,user=>{
 if(!user){window.location.href='index.html';return;}
 const nomeUsuario=(user.displayName||user.email||'Operador').trim();
 const campoOperador=$('operador');
 if(campoOperador && (!campoOperador.value.trim() || campoOperador.value.trim()==='Operador')) campoOperador.value=nomeUsuario;
 render();
});

function atualizarAbaMov(){
 document.querySelectorAll('.mov-tab').forEach(b=>{const active=b.dataset.tipo===tipoMov;b.classList.toggle('active',active);});
 const btn=$('btnMovimentar'),hint=$('movHint');
 btn.innerHTML=tipoMov==='SANGRIA'?'<i class="bi bi-arrow-down-left"></i> Registrar sangria':'<i class="bi bi-arrow-up-right"></i> Registrar suprimento';
 btn.classList.toggle('btn-suprimento',tipoMov==='SUPRIMENTO');
 hint.innerHTML=tipoMov==='SANGRIA'?'<i class="bi bi-info-circle"></i> A sangria reduz o valor esperado do caixa.':'<i class="bi bi-info-circle"></i> O suprimento aumenta o valor esperado do caixa.';
}
async function carregarMovimentos(m){
 const lista=$('movList'); if(!lista)return;
 const itens=m.filter(x=>['SANGRIA','SUPRIMENTO'].includes(x.tipo));
 if(!itens.length){lista.innerHTML='<div class="mov-empty">Nenhuma sangria ou suprimento registrado neste caixa.</div>';return;}
 lista.innerHTML=itens.map(x=>`<div class="mov-item"><div><strong class="mov-${String(x.tipo).toLowerCase()}">${x.tipo==='SANGRIA'?'Sangria':'Suprimento'}</strong><span>${x.descricao||'Sem descrição'}</span></div><b>${br(x.valor)}</b></div>`).join('');
}
document.querySelectorAll('.mov-tab').forEach(b=>b.addEventListener('click',()=>{tipoMov=b.dataset.tipo;atualizarAbaMov();}));
$('btnMovimentar').onclick=async()=>{
 if(!atual){msg('Abra um caixa antes de registrar uma movimentação.');return;}
 const valor=Number($('movValor').value||0), descricao=$('movDescricao').value.trim();
 if(valor<=0){msg('Informe um valor maior que zero.');$('movValor').focus();return;}
 clearMsg();
 try{await registrarMovimento({caixaId:atual.id,tipo:tipoMov,valor,forma:'Dinheiro',descricao});$('movValor').value='';$('movDescricao').value='';msg(`${tipoMov==='SANGRIA'?'Sangria':'Suprimento'} registrada com sucesso.`,true);await render();}
 catch(e){console.error(e);msg(e.message||'Não foi possível registrar a movimentação.');}
};
atualizarAbaMov();
