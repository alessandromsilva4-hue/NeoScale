import { auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { caixaAberto,abrirCaixa,fecharCaixa,listarMovimentos,calcularCaixa,registrarMovimento } from './caixa.js';
const $=id=>document.getElementById(id), br=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); let atual=null; let tipoMov='SANGRIA';
function msg(t,ok=false){$('msg').innerHTML=`<div class="alert ${ok?'ok':'err'}">${t}</div>`}
function clearMsg(){ $('msg').innerHTML=''; }
function setStatus(aberto){ $('status').textContent=aberto?'ABERTO':'FECHADO'; $('status').className=aberto?'ok':'bad'; $('badgeStatus').textContent=aberto?'CAIXA ABERTO':'CAIXA FECHADO'; $('dot').classList.toggle('off',!aberto); }
async function render(){
 try{
  atual=await caixaAberto(); const aberto=!!atual; setStatus(aberto); $('abrir').classList.toggle('hidden',aberto); $('fechar').classList.toggle('hidden',!aberto);
  $('movimentacoesPanel').classList.toggle('hidden',!aberto);
  if(!aberto){ $('inicial').textContent=br(0); $('esperado').textContent=br(0); $('diferenca').textContent=br(0); $('entradas').textContent=br(0); $('saidas').textContent=br(0); $('caixaId').textContent='—'; return; }
  const m=await listarMovimentos(atual.id), c=calcularCaixa(atual,m); $('inicial').textContent=br(atual.valorInicial); $('esperado').textContent=br(c.esperado); $('diferenca').textContent=br(Number($('valorContado').value||0)-c.esperado); $('entradas').textContent=br(c.entrada); $('saidas').textContent=br(c.saida); $('caixaId').textContent=atual.id.slice(0,10)+'…'; $('operadorAtual').textContent=atual.operador||'Operador'; await carregarMovimentos(m);
 }catch(e){ console.error(e); msg('Não foi possível acessar o Caixa no Firebase. Se você já entrou no sistema, verifique as regras do Firestore para permitir acesso aos usuários autenticados.'); }
}
$('btnAbrir').onclick=async()=>{clearMsg(); try{const op=$('operador').value.trim()||'Operador'; await abrirCaixa($('valorInicial').value,op); msg('Caixa aberto com sucesso. O PDV já poderá registrar as vendas neste caixa.',true); await render();}catch(e){console.error(e);msg(e.message||'Não foi possível abrir o caixa.')}};
function imprimirRelatorioVendas(caixa,movs,calculo,valorContado){
 const vendas=movs.filter(m=>m.tipo==='VENDA');
 const sangrias=movs.filter(m=>m.tipo==='SANGRIA');
 const suprimentos=movs.filter(m=>m.tipo==='SUPRIMENTO');
 const totalVendas=vendas.reduce((a,m)=>a+Number(m.valor||0),0);
 const porForma={Dinheiro:0,PIX:0,Débito:0,Crédito:0};
 vendas.forEach(v=>{const k=Object.keys(porForma).find(x=>String(v.forma||'').toLowerCase()===x.toLowerCase());if(k)porForma[k]+=Number(v.valor||0);});
 const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
 const dataHora=new Date().toLocaleString('pt-BR');
 const dataItem=v=>v?.toDate?v.toDate().toLocaleString('pt-BR'):v?new Date(v).toLocaleString('pt-BR'):'—';
 const linha=(m,classe='')=>`<tr class=\"${classe}\"><td>${esc(dataItem(m.criadoEm))}</td><td>${esc(m.descricao||'Venda')}</td><td>${esc(m.forma||'—')}</td><td class=\"valor\">${br(m.valor)}</td></tr>`;
 const popup=window.open('','_blank','width=900,height=900');
 if(!popup){msg('Caixa fechado, mas o navegador bloqueou a janela do relatório. Permita pop-ups para imprimir o relatório.',false);return;}
 popup.document.write(`<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><title>Relatório de Vendas - Caixa ${esc(caixa.id.slice(0,10))}</title><style>
 body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px;font-size:13px}h1{margin:0 0 4px;font-size:24px}h2{margin:24px 0 10px;font-size:16px;border-bottom:2px solid #111;padding-bottom:6px}.sub{color:#555;margin-bottom:18px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}.card{border:1px solid #ddd;padding:12px;border-radius:8px}.card span{display:block;color:#666;font-size:11px}.card strong{font-size:17px;display:block;margin-top:4px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}th{background:#f2f4f7;font-size:11px}.valor{text-align:right}.totais{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:15px}.total{border:1px solid #ddd;padding:10px;display:flex;justify-content:space-between}.ok{color:#087f3d;font-weight:700}.div{color:#b42318;font-weight:700}.assin{margin-top:50px;display:grid;grid-template-columns:1fr 1fr;gap:50px}.assin div{border-top:1px solid #333;padding-top:6px;text-align:center}@media print{body{margin:12mm}.no-print{display:none!important}}
</style></head><body>
 <h1>NeoScale — Relatório de Vendas</h1><div class=\"sub\">Fechamento de caixa • Emitido em ${esc(dataHora)}</div>
 <div class=\"grid\"><div class=\"card\"><span>Operador</span><strong>${esc(caixa.operador||'Operador')}</strong></div><div class=\"card\"><span>Abertura</span><strong>${esc(dataItem(caixa.abertoEm))}</strong></div><div class=\"card\"><span>Fechamento</span><strong>${esc(dataHora)}</strong></div><div class=\"card\"><span>Total de vendas</span><strong>${br(totalVendas)}</strong></div></div>
 <h2>Vendas realizadas</h2>${vendas.length?`<table><thead><tr><th>Data/Hora</th><th>Descrição</th><th>Pagamento</th><th class=\"valor\">Valor</th></tr></thead><tbody>${vendas.map(v=>linha(v)).join('')}</tbody><tfoot><tr><th colspan=\"3\">TOTAL DE VENDAS</th><th class=\"valor\">${br(totalVendas)}</th></tr></tfoot></table>`:'<p>Nenhuma venda registrada neste caixa.</p>'}
 <h2>Vendas por forma de pagamento</h2><table><thead><tr><th>Forma</th><th class=\"valor\">Total</th></tr></thead><tbody>${Object.entries(porForma).map(([k,v])=>`<tr><td>${k}</td><td class=\"valor\">${br(v)}</td></tr>`).join('')}</tbody><tfoot><tr><th>Total</th><th class=\"valor\">${br(totalVendas)}</th></tr></tfoot></table>
 <h2>Movimentações de caixa</h2><table><thead><tr><th>Data/Hora</th><th>Tipo</th><th>Descrição</th><th class=\"valor\">Valor</th></tr></thead><tbody>${[...suprimentos.map(x=>({...x,_tipo:'Suprimento'})),...sangrias.map(x=>({...x,_tipo:'Sangria'}))].sort((a,b)=>String(a.criadoEm?.seconds||0).localeCompare(String(b.criadoEm?.seconds||0))).map(x=>`<tr><td>${esc(dataItem(x.criadoEm))}</td><td>${x._tipo}</td><td>${esc(x.descricao||'—')}</td><td class=\"valor\">${br(x.valor)}</td></tr>`).join('')||'<tr><td colspan=\"4\">Nenhuma movimentação.</td></tr>'}</tbody></table>
 <div class=\"totais\"><div class=\"total\"><span>Valor inicial</span><strong>${br(caixa.valorInicial)}</strong></div><div class=\"total\"><span>Valor esperado</span><strong>${br(calculo.esperado)}</strong></div><div class=\"total\"><span>Valor contado</span><strong>${br(valorContado)}</strong></div><div class=\"total\"><span>Diferença</span><strong class=\"${Math.abs(valorContado-calculo.esperado)<0.005?'ok':'div'}\">${br(valorContado-calculo.esperado)}</strong></div></div>
 <div class=\"assin\"><div>Operador</div><div>Responsável pelo fechamento</div></div>
 <script>window.onload=()=>{setTimeout(()=>window.print(),250)};<\/script></body></html>`);
 popup.document.close();
}

$('btnFechar').onclick=async()=>{if(!atual)return;clearMsg();try{const m=await listarMovimentos(atual.id),c=calcularCaixa(atual,m),cont=Number($('valorContado').value||0);await fecharCaixa(atual.id,cont);imprimirRelatorioVendas(atual,m,c,cont);msg(`Caixa fechado com sucesso. Diferença apurada: ${br(cont-c.esperado)}. Relatório de vendas aberto para impressão.`,true);await render();}catch(e){console.error(e);msg(e.message||'Não foi possível fechar o caixa.')}};
$('valorContado').oninput=()=>{if(!atual)return; listarMovimentos(atual.id).then(m=>{const c=calcularCaixa(atual,m);$('diferenca').textContent=br(Number($('valorContado').value||0)-c.esperado)}).catch(()=>{});};
onAuthStateChanged(auth,user=>{if(!user){window.location.href='index.html';return;} render();});

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
