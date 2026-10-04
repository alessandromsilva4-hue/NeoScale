import { db } from './firebase.js';
import { doc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
const app=document.getElementById('app'); const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const num=v=>Number.isFinite(Number(v))?Number(v):0; const money=v=>`R$ ${num(v).toFixed(2).replace('.',',')}`;
const token=new URLSearchParams(location.search).get('token'); let proposta=null;
function tela(html){app.innerHTML=html}
async function carregar(){
 if(!token){tela('<div class="card"><div class="alert error">Link de cotação inválido.</div></div>');return;}
 try{const snap=await getDoc(doc(db,'cotacoesFornecedores',token)); if(!snap.exists()){tela('<div class="card"><div class="alert error">Esta solicitação de cotação não foi encontrada ou o link expirou.</div></div>');return;} proposta={id:snap.id,...snap.data()};
 document.getElementById('titulo').textContent=`Cotação ${proposta.cotacaoNumero||''}`; document.getElementById('subtitulo').textContent=`Fornecedor: ${proposta.fornecedorNome||'-'} · Requisição: ${proposta.reqNumero||'-'}`;
 render();
 }catch(e){console.error(e);tela('<div class="card"><div class="alert error">Não foi possível carregar a cotação. Tente novamente.</div></div>')}
}
function render(){
 if(proposta.status==='APROVADA'){tela('<div class="card"><div class="alert ok"><strong>Proposta aprovada.</strong><br>Obrigado. Esta cotação já foi escolhida pelo NeoScale.</div></div>');return;}
 const readonly=proposta.status==='RESPONDIDA'?'readonly':'';
 tela(`<div class="card"><div class="alert">Informe o <strong>preço unitário</strong> de cada produto. O NeoScale fará a comparação com outros fornecedores.</div><div class="table-scroll" style="margin-top:16px"><table class="items"><thead><tr><th>Produto</th><th>Quantidade</th><th>Unidade</th><th>Preço unitário</th><th>Subtotal</th></tr></thead><tbody>${(proposta.itens||[]).map((i,n)=>`<tr><td><strong>${esc(i.produtoNome)}</strong></td><td>${num(i.quantidade)}</td><td>${esc(i.unidade||'un.')}</td><td><input class="input price" type="number" min="0" step="0.01" data-price="${n}" value="${num(i.precoUnitario)||''}" ${readonly}></td><td id="sub-${n}">${money(num(i.quantidade)*num(i.precoUnitario))}</td></tr>`).join('')}</tbody></table></div></div>
 <div class="card"><div class="grid"><div class="full"><label>Observações</label><input class="input" id="obs" value="${esc(proposta.observacoes||'')}" ${readonly}></div></div><div class="summary" style="margin-top:20px"><div class="sum"><span>Total dos produtos</span><strong id="valorProdutos">R$ 0,00</strong></div><div class="sum"><span>Total da proposta</span><strong id="totalFinal">R$ 0,00</strong></div></div>${proposta.status==='RESPONDIDA'?'<div class="winner-note">Você já enviou esta proposta. Se precisar corrigir algum valor, entre em contato com o NeoScale.</div>':'<button class="btn" id="enviar" style="margin-top:20px"><i class="bi bi-send"></i> Enviar proposta</button>'}<div id="msg" style="margin-top:12px"></div></div>`);
 recalcular(); document.querySelectorAll('[data-price]').forEach(x=>x.addEventListener('input',recalcular)); document.getElementById('enviar')?.addEventListener('click',enviar);
}
function recalcular(){let total=0; document.querySelectorAll('[data-price]').forEach((el,n)=>{const sub=num(proposta.itens[n]?.quantidade)*num(el.value);total+=sub;const out=document.getElementById(`sub-${n}`);if(out)out.textContent=money(sub)});document.getElementById('valorProdutos')?.replaceChildren(document.createTextNode(money(total)));document.getElementById('totalFinal')?.replaceChildren(document.createTextNode(money(total)));}
async function enviar(){
 const btn=document.getElementById('enviar');btn.disabled=true; const itens=(proposta.itens||[]).map((i,n)=>{const pu=num(document.querySelector(`[data-price="${n}"]`)?.value);return {...i,precoUnitario:pu,subtotal:num(i.quantidade)*pu}}); if(itens.some(i=>i.precoUnitario<=0)){document.getElementById('msg').innerHTML='<div class="alert error">Informe um preço válido para todos os produtos.</div>';btn.disabled=false;return;}
 const valorProdutos=itens.reduce((s,i)=>s+i.subtotal,0), totalFinal=valorProdutos;
 try{await updateDoc(doc(db,'cotacoesFornecedores',token),{itens,valorProdutos,frete:0,totalFinal,prazoEntrega:'',observacoes:document.getElementById('obs').value.trim(),status:'RESPONDIDA',respondidaEm:serverTimestamp(),atualizadoEm:serverTimestamp()});proposta={...proposta,itens,valorProdutos,frete,totalFinal,status:'RESPONDIDA'};document.getElementById('msg').innerHTML='<div class="alert ok"><strong>Proposta enviada com sucesso.</strong><br>O NeoScale já pode comparar seu preço com os demais fornecedores.</div>';document.getElementById('enviar').remove();document.querySelectorAll('[data-price],#obs').forEach(x=>x.disabled=true);}catch(e){console.error(e);document.getElementById('msg').innerHTML='<div class="alert error">Não foi possível enviar a proposta. Tente novamente.</div>';btn.disabled=false;}
}
carregar();
