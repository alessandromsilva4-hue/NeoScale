import { db } from './firebase.js';
import {
  collection, getDocs, setDoc, updateDoc, doc, query, orderBy, limit,
  runTransaction, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const $ = id => document.getElementById(id);
const modal = $('modal');
const body = $('modalBody');
let state = { produtos: [], req: [], cot: [], forn: [], ped: [] };
let formType = '';
let currentId = null;

const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m]));
const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const money = v => `R$ ${num(v).toFixed(2).replace('.', ',')}`;
const dateBR = v => { if (!v) return '-'; const d = v?.toDate ? v.toDate() : new Date(v); return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR'); };
const status = (s, labels={}) => `<span class="status-pill status-${esc(s)}">${esc(labels[s] || String(s || '').replaceAll('_',' '))}</span>`;
const priority = s => `<span class="priority-pill priority-${esc(s)}">${esc(s)}</span>`;

function openModal(title, sub, type, id=null, html='') {
  formType = type; currentId = id;
  $('modalTitulo').textContent = title;
  $('modalSubtitulo').textContent = sub || '';
  body.innerHTML = html;
  modal.hidden = false;
}
function closeModal(){ modal.hidden = true; body.innerHTML=''; formType=''; currentId=null; }
function opts(arr, placeholder='Selecione') { return `<option value="">${placeholder}</option>` + arr.map(x => `<option value="${esc(x.id)}">${esc(x.nome || x.razaoSocial || x.empresa || x.nomeFantasia || '')}</option>`).join(''); }
function productOptions(selected=''){ return `<option value="">Selecione o produto</option>` + state.produtos.map(x => `<option value="${esc(x.id)}" ${x.id===selected?'selected':''}>${esc(x.nome)}</option>`).join(''); }

function itemEditor(items=[], cls='item-row') {
  const rows = items.length ? items : [{}];
  return `<div class="items-editor"><table><thead><tr><th style="width:34%">Produto</th><th>Quantidade</th><th>Unidade</th><th>Observação</th><th></th></tr></thead><tbody id="editorItens">${rows.map(i => itemRow(i, cls)).join('')}</tbody></table></div><button type="button" class="btn-secondary small" id="addItem" style="margin-top:8px"><i class="bi bi-plus"></i> Adicionar item</button>`;
}
function itemRow(i={}, cls='item-row') {
  const tipo = i.tipoVenda || 'unidade';
  return `<tr class="${cls}" data-received="${num(i.recebido)}"><td><select class="i-prod">${productOptions(i.produtoId || '')}</select></td><td><input class="i-qtd" type="number" min="0.001" step="any" value="${num(i.quantidade)||1}"></td><td class="i-un">${tipo==='peso'?'kg':'un.'}</td><td><input class="i-obs" value="${esc(i.observacao||'')}" placeholder="Opcional"></td><td><button type="button" class="action-btn remove-row" title="Remover"><i class="bi bi-trash3"></i></button></td></tr>`;
}
function addItemRow(i={}) { $('editorItens').insertAdjacentHTML('beforeend', itemRow(i)); const tr=$('editorItens').lastElementChild; if(i.produtoId) tr.querySelector('.i-prod').value=i.produtoId; updateUnit(tr); }
function collectItems() {
  return [...document.querySelectorAll('#editorItens .item-row')].map(tr => {
    const pid=tr.querySelector('.i-prod').value, p=state.produtos.find(x=>x.id===pid), q=num(tr.querySelector('.i-qtd').value);
    if(!p || q<=0) throw new Error('Preencha todos os itens com produto e quantidade válida.');
    return { produtoId:pid, produtoNome:p.nome, tipoVenda:p.tipoVenda||'unidade', quantidade:q, observacao:tr.querySelector('.i-obs')?.value.trim()||'', recebido:num(tr.dataset.received) };
  });
}
function updateUnit(tr){ const p=state.produtos.find(x=>x.id===tr.querySelector('.i-prod')?.value); if(tr.querySelector('.i-un')) tr.querySelector('.i-un').textContent=p?.tipoVenda==='peso'?'kg':'un.'; }

function reqForm(r={}) {
  openModal(r.id?'Editar requisição':'Nova requisição','Solicite os produtos necessários antes de iniciar a cotação.','req',r.id,
  `<div class="form-grid"><div><label>Solicitante *</label><input class="form-control" name="solicitante" required value="${esc(r.solicitante||'')}"></div><div><label>Prioridade</label><select class="form-control" name="prioridade"><option>BAIXA</option><option>NORMAL</option><option>ALTA</option><option>URGENTE</option></select></div><div><label>Data necessária</label><input class="form-control" type="date" name="dataNecessaria" value="${esc(r.dataNecessaria||'')}"></div><div><label>Centro de custo / setor</label><input class="form-control" name="centroCusto" placeholder="Ex.: Cozinha" value="${esc(r.centroCusto||'')}"></div><div class="full"><label>Justificativa</label><textarea class="form-control" name="justificativa" placeholder="Por que esta compra é necessária?">${esc(r.justificativa||'')}</textarea></div><div class="full"><label>Itens solicitados *</label>${itemEditor(r.itens||[])}</div></div>`);
  if(r.prioridade) body.querySelector('[name=prioridade]').value=r.prioridade;
}
function fornecedorForm(f={}) {
  openModal(f.id?'Editar fornecedor':'Novo fornecedor','Digite o CNPJ e o NeoScale preencherá automaticamente os dados cadastrais disponíveis.','fornecedor',f.id,
  `<div class="cnpj-lookup-box"><div class="form-grid"><div class="full"><label>CNPJ</label><div class="input-with-action"><input class="form-control" name="documento" id="fornecedorCnpj" inputmode="numeric" maxlength="18" placeholder="00.000.000/0000-00" value="${esc(f.documento||'')}"><span id="cnpjStatus" class="cnpj-status">Digite o CNPJ para consultar</span></div></div></div></div>
  <div class="form-grid"><div><label>Razão social *</label><input class="form-control" name="razaoSocial" required value="${esc(f.razaoSocial||f.nome||'')}"></div><div><label>Nome fantasia</label><input class="form-control" name="nomeFantasia" value="${esc(f.nomeFantasia||'')}"></div><div><label>Situação cadastral</label><input class="form-control" name="situacaoCadastral" value="${esc(f.situacaoCadastral||'')}" readonly></div><div><label>Data de abertura</label><input class="form-control" name="dataAbertura" value="${esc(f.dataAbertura||'')}" readonly></div><div><label>Contato comercial</label><input class="form-control" name="contato" value="${esc(f.contato||'')}"></div><div><label>Telefone</label><input class="form-control" name="telefone" value="${esc(f.telefone||'')}"></div><div><label>E-mail</label><input class="form-control" name="email" type="email" value="${esc(f.email||'')}"></div><div><label>CEP</label><input class="form-control" name="cep" value="${esc(f.cep||'')}"></div><div><label>Endereço</label><input class="form-control" name="endereco" value="${esc(f.endereco||'')}"></div><div><label>Número</label><input class="form-control" name="numeroEndereco" value="${esc(f.numeroEndereco||'')}"></div><div><label>Complemento</label><input class="form-control" name="complemento" value="${esc(f.complemento||'')}"></div><div><label>Bairro</label><input class="form-control" name="bairro" value="${esc(f.bairro||'')}"></div><div><label>Cidade</label><input class="form-control" name="cidade" value="${esc(f.cidade||'')}"></div><div><label>UF</label><input class="form-control" name="uf" maxlength="2" value="${esc(f.uf||'')}"></div><div><label>Natureza jurídica</label><input class="form-control" name="naturezaJuridica" value="${esc(f.naturezaJuridica||'')}" readonly></div><div><label>Porte</label><input class="form-control" name="porte" value="${esc(f.porte||'')}" readonly></div><div><label>Capital social</label><input class="form-control" name="capitalSocial" value="${esc(f.capitalSocial||'')}" readonly></div><div><label>CNAE principal</label><input class="form-control" name="cnaePrincipal" value="${esc(f.cnaePrincipal||'')}" readonly></div><div><label>Condição de pagamento</label><input class="form-control" name="condicaoPagamento" placeholder="Ex.: 28 dias" value="${esc(f.condicaoPagamento||'')}"></div><div><label>Prazo médio de entrega</label><input class="form-control" name="prazoEntrega" placeholder="Ex.: 3 dias" value="${esc(f.prazoEntrega||'')}"></div><div class="full"><label>Observações</label><textarea class="form-control" name="observacoes">${esc(f.observacoes||'')}</textarea></div></div>`);
  const cnpj=$('fornecedorCnpj');
  if(cnpj){ cnpj.addEventListener('input',()=>{ cnpj.value=formatCnpj(cnpj.value); scheduleCnpjLookup(); }); cnpj.addEventListener('blur',()=>lookupCnpj(true)); }
  if((f.documento||'').replace(/\D/g,'').length===14) setTimeout(()=>lookupCnpj(true),100);
}

let cnpjTimer=null;
function formatCnpj(v){ const d=String(v||'').replace(/\D/g,'').slice(0,14); return d.length<=2?d:d.length<=5?`${d.slice(0,2)}.${d.slice(2)}`:d.length<=8?`${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`:d.length<=12?`${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`:`${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`; }
function scheduleCnpjLookup(){ clearTimeout(cnpjTimer); const digits=$('fornecedorCnpj')?.value.replace(/\D/g,''); if(digits.length===14) cnpjTimer=setTimeout(()=>lookupCnpj(false),450); else if($('cnpjStatus')) $('cnpjStatus').textContent='Digite o CNPJ completo para consultar'; }
function setField(name,value){ const el=body.querySelector(`[name="${name}"]`); if(el && value!==undefined && value!==null && String(value).trim()!=='') el.value=value; }
async function lookupCnpj(force=false){
  const input=$('fornecedorCnpj'); if(!input) return; const cnpj=input.value.replace(/\D/g,''); if(cnpj.length!==14) return;
  const statusEl=$('cnpjStatus'); if(statusEl) statusEl.textContent='Consultando CNPJ...';
  try{
    const res=await fetch(`https://brasilapi.com.br/cnpj/v1/${cnpj}`,{headers:{Accept:'application/json'}});
    if(!res.ok) throw new Error(res.status===404?'CNPJ não encontrado.':res.status===400?'CNPJ inválido.':'Não foi possível consultar agora.');
    const d=await res.json();
    setField('razaoSocial',d.razao_social); setField('nomeFantasia',d.nome_fantasia);
    setField('telefone',[d.ddd_telefone_1,d.ddd_telefone_2].filter(Boolean).join(' / ')); setField('email',d.email||d.correio_eletronico);
    setField('cep',d.cep); setField('endereco',[d.descricao_tipo_logradouro,d.logradouro].filter(Boolean).join(' ')); setField('numeroEndereco',d.numero);
    setField('complemento',d.complemento); setField('bairro',d.bairro); setField('cidade',d.municipio); setField('uf',d.uf);
    setField('situacaoCadastral',d.descricao_situacao_cadastral||d.situacao_cadastral); setField('dataAbertura',d.data_inicio_atividade||d.data_situacao_cadastral);
    setField('naturezaJuridica',d.natureza_juridica); setField('porte',d.porte); setField('capitalSocial',d.capital_social);
    const cnae=d.cnae_fiscal_principal; const cnaeDesc=d.cnae_fiscal_descricao; setField('cnaePrincipal',cnae ? `${cnae}${cnaeDesc?' - '+cnaeDesc:''}` : '');
    if(statusEl){ statusEl.textContent=`✓ Empresa encontrada${d.descricao_situacao_cadastral?` · ${d.descricao_situacao_cadastral}`:''}`; statusEl.classList.add('success'); }
  }catch(err){ if(statusEl){ statusEl.textContent=err.message||'Não foi possível consultar o CNPJ.'; statusEl.classList.remove('success'); } if(force) console.warn('Consulta de CNPJ:',err); }
}
function cotForm(c={}) {
  openModal(c.id?'Editar cotação':'Nova cotação','Compare uma proposta de fornecedor para uma requisição.','cot',c.id,
  `<div class="form-grid"><div><label>Requisição *</label><select class="form-control" name="reqId" required>${opts(state.req,'Selecione a requisição')}</select></div><div><label>Validade da proposta</label><input class="form-control" type="date" name="validade" value="${esc(c.validade||'')}"></div><div><label>Fornecedor *</label><select class="form-control" name="fornecedorId" required>${opts(state.forn,'Selecione o fornecedor')}</select></div><div><label>Valor dos produtos *</label><input class="form-control" name="valor" type="number" min="0" step="0.01" required value="${num(c.valor)||''}"></div><div><label>Frete</label><input class="form-control" name="frete" type="number" min="0" step="0.01" value="${num(c.frete)||0}"></div><div><label>Prazo de entrega</label><input class="form-control" name="prazoEntrega" placeholder="Ex.: 2 dias" value="${esc(c.prazoEntrega||'')}"></div><div><label>Condição de pagamento</label><input class="form-control" name="condicaoPagamento" value="${esc(c.condicaoPagamento||'')}"></div><div class="full"><label>Observações</label><textarea class="form-control" name="observacoes">${esc(c.observacoes||'')}</textarea></div></div>`);
  if(c.reqId) body.querySelector('[name=reqId]').value=c.reqId;
  if(c.fornecedorId) body.querySelector('[name=fornecedorId]').value=c.fornecedorId;
}
function pedForm(p={}) {
  const quote = p.cotId ? state.cot.find(x=>x.id===p.cotId) : null;
  const req = quote?.reqId ? state.req.find(x=>x.id===quote.reqId) : null;
  const itens = p.itens || req?.itens || [];
  openModal(p.id?'Editar pedido':'Novo pedido','Formalize a compra e informe o que deverá ser recebido no estoque.','ped',p.id,
  `<div class="form-grid"><div><label>Fornecedor *</label><select class="form-control" name="fornecedorId" required>${opts(state.forn,'Selecione o fornecedor')}</select></div><div><label>Origem</label><select class="form-control" name="origem"><option value="MANUAL">Manual</option><option value="COTACAO">Cotação</option><option value="REQUISICAO">Requisição</option></select></div><div><label>Cotação</label><select class="form-control" name="cotId"><option value="">Nenhuma</option>${state.cot.map(x=>`<option value="${esc(x.id)}">${esc(x.numero||x.id.slice(0,8))} · ${esc(x.fornecedorNome||'')}</option>`).join('')}</select></div><div><label>Previsão de entrega</label><input class="form-control" type="date" name="dataPrevista" value="${esc(p.dataPrevista||'')}"></div><div><label>Total da compra *</label><input class="form-control" name="total" type="number" min="0" step="0.01" required value="${num(p.total||quote?.valor+quote?.frete)||''}"></div><div><label>Pedido / documento do fornecedor</label><input class="form-control" name="documento" value="${esc(p.documento||'')}"></div><div class="full"><label>Itens do pedido *</label>${itemEditor(itens)}</div><div class="full"><label>Observações</label><textarea class="form-control" name="observacoes">${esc(p.observacoes||'')}</textarea></div></div>`);
  if(p.fornecedorId) body.querySelector('[name=fornecedorId]').value=p.fornecedorId; else if(quote?.fornecedorId) body.querySelector('[name=fornecedorId]').value=quote.fornecedorId;
  if(p.origem) body.querySelector('[name=origem]').value=p.origem; else if(quote) body.querySelector('[name=origem]').value='COTACAO';
  if(p.cotId) body.querySelector('[name=cotId]').value=p.cotId;
  body.querySelectorAll('#editorItens .item-row').forEach(updateUnit);
}
function receiveForm(p) {
  const itens=(p.itens||[]).filter(i=>num(i.quantidade)-num(i.recebido)>0);
  if(!itens.length){ alert('Este pedido não possui itens pendentes de recebimento.'); return; }
  openModal(`Receber ${p.numero||''}`,'Informe quanto chegou. O estoque será atualizado somente após confirmar o recebimento.','receive',p.id,
  `<div class="receive-summary"><div><strong>${esc(p.fornecedorNome||'Fornecedor')}</strong><span>Pedido ${esc(p.numero||'-')}</span></div><div><strong>${money(p.total)}</strong><span>Total do pedido</span></div></div><div class="items-editor"><table><thead><tr><th>Produto</th><th>Pedido</th><th>Já recebido</th><th>Receber agora</th><th>Unidade</th></tr></thead><tbody id="receiveItens">${itens.map(i=>`<tr class="receive-row" data-prod="${esc(i.produtoId)}" data-name="${esc(i.produtoNome)}" data-unit="${esc(i.tipoVenda||'unidade')}"><td>${esc(i.produtoNome)}</td><td>${num(i.quantidade)}</td><td>${num(i.recebido)}</td><td><input class="r-qtd" type="number" min="0" max="${num(i.quantidade)-num(i.recebido)}" step="any" value="${num(i.quantidade)-num(i.recebido)}"></td><td>${i.tipoVenda==='peso'?'kg':'un.'}</td></tr>`).join('')}</tbody></table></div><div class="receive-note"><i class="bi bi-info-circle"></i> O estoque só será alterado quando você confirmar o recebimento.</div>`);
}

function renderReq(){
  const t=($('buscaReq').value||'').toLowerCase(), f=$('filtroReq').value;
  const rows=state.req.filter(x=>(!f||x.status===f)&&(!t||[x.numero,x.solicitante,...(x.itens||[]).map(i=>i.produtoNome)].join(' ').toLowerCase().includes(t)));
  $('listaReq').innerHTML=rows.length?rows.map(x=>`<tr><td><strong>${esc(x.numero||x.id.slice(0,8))}</strong></td><td>${dateBR(x.criadoEm)}</td><td>${esc(x.solicitante||'-')}</td><td>${(x.itens||[]).length}</td><td>${priority(x.prioridade||'NORMAL')}</td><td>${status(x.status||'ABERTA',{ABERTA:'Aberta',EM_COTACAO:'Em cotação',ATENDIDA:'Atendida',CANCELADA:'Cancelada'})}</td><td><button class="action-btn" data-action="req-edit" data-id="${x.id}" title="Editar"><i class="bi bi-pencil"></i></button> <button class="action-btn" data-action="req-cot" data-id="${x.id}" title="Criar cotação"><i class="bi bi-chat-square-text"></i></button></td></tr>`).join(''):'<tr><td colspan="7" class="empty">Nenhuma requisição encontrada.</td></tr>';
}
function renderCot(){
  const t=($('buscaCot').value||'').toLowerCase(), f=$('filtroCot').value;
  const rows=state.cot.filter(x=>(!f||x.status===f)&&(!t||[x.numero,x.reqNumero,x.fornecedorNome].join(' ').toLowerCase().includes(t)));
  $('listaCot').innerHTML=rows.length?rows.map(x=>`<tr><td><strong>${esc(x.numero||x.id.slice(0,8))}</strong></td><td>${esc(x.reqNumero||'-')}</td><td>${esc(x.fornecedorNome||'-')}</td><td><strong>${money(x.valor)}</strong></td><td>${money(x.frete)}</td><td>${esc(x.prazoEntrega||'-')}</td><td>${status(x.status||'ABERTA',{ABERTA:'Aberta',EM_ANALISE:'Em análise',APROVADA:'Aprovada',RECUSADA:'Recusada'})}</td><td><button class="action-btn" data-action="cot-edit" data-id="${x.id}" title="Editar"><i class="bi bi-pencil"></i></button> ${x.status!=='APROVADA'&&x.status!=='RECUSADA'?`<button class="action-btn" data-action="cot-aprovar" data-id="${x.id}" title="Aprovar"><i class="bi bi-check2"></i></button>`:''} ${x.status==='APROVADA'?`<button class="action-btn" data-action="cot-ped" data-id="${x.id}" title="Criar pedido"><i class="bi bi-cart-plus"></i></button>`:''}</td></tr>`).join(''):'<tr><td colspan="8" class="empty">Nenhuma cotação encontrada.</td></tr>';
}
function renderForn(){
  const t=($('buscaForn').value||'').toLowerCase(); const rows=state.forn.filter(x=>[x.razaoSocial,x.nomeFantasia,x.documento,x.contato,x.telefone].join(' ').toLowerCase().includes(t));
  $('listaForn').innerHTML=rows.length?rows.map(x=>`<tr><td><strong>${esc(x.razaoSocial||x.nome)}</strong><div class="muted">${esc(x.nomeFantasia||'')}</div></td><td>${esc(x.documento||'-')}</td><td>${esc(x.contato||'-')}</td><td>${esc(x.telefone||'-')}</td><td>${esc(x.condicaoPagamento||'-')}</td><td>${esc(x.prazoEntrega||'-')}</td><td>${status(x.ativo===false?'INATIVO':'ATIVO',{ATIVO:'Ativo',INATIVO:'Inativo'})}</td><td><button class="action-btn" data-action="forn-edit" data-id="${x.id}" title="Editar"><i class="bi bi-pencil"></i></button></td></tr>`).join(''):'<tr><td colspan="8" class="empty">Nenhum fornecedor cadastrado.</td></tr>';
}
function renderPed(){
  const t=($('buscaPed').value||'').toLowerCase(), f=$('filtroPed').value; const rows=state.ped.filter(x=>(!f||x.status===f)&&(!t||[x.numero,x.fornecedorNome,x.documento].join(' ').toLowerCase().includes(t)));
  $('listaPed').innerHTML=rows.length?rows.map(x=>`<tr><td><strong>${esc(x.numero||x.id.slice(0,8))}</strong></td><td>${dateBR(x.criadoEm)}</td><td>${esc(x.fornecedorNome||'-')}</td><td>${esc(x.origem||'-')}</td><td>${money(x.total)}</td><td>${dateBR(x.dataPrevista)}</td><td>${status(x.status||'APROVADO')}</td><td><button class="action-btn" data-action="ped-edit" data-id="${x.id}" title="Editar"><i class="bi bi-pencil"></i></button> <button class="action-btn" data-action="ped-next" data-id="${x.id}" title="Avançar etapa"><i class="bi bi-arrow-right"></i></button> ${x.status!=='ENTREGUE'&&x.status!=='CANCELADO'?`<button class="action-btn" data-action="ped-receber" data-id="${x.id}" title="Receber mercadoria"><i class="bi bi-box-seam"></i></button>`:''}</td></tr>`).join(''):'<tr><td colspan="8" class="empty">Nenhum pedido encontrado.</td></tr>';
}
function renderTracking(){
  const rows=state.ped.filter(x=>!['ENTREGUE','CANCELADO'].includes(x.status)); const steps=['APROVADO','ENVIADO','EM_TRANSITO','RECEBIMENTO_PARCIAL','ENTREGUE'];
  $('trackingGrid').innerHTML=rows.length?rows.map(x=>{const idx=Math.max(0,steps.indexOf(x.status||'APROVADO')); return `<article class="tracking-card"><h4>${esc(x.numero||x.id.slice(0,8))} · ${esc(x.fornecedorNome||'-')}</h4><div class="muted">Entrega prevista: ${dateBR(x.dataPrevista)} · Total: ${money(x.total)}</div><div class="timeline">${steps.map((s,i)=>`<div class="timeline-step ${i<idx?'done':''} ${i===idx?'current':''}">${s==='RECEBIMENTO_PARCIAL'?'Recebimento parcial':s.replace('_',' ')}</div>`).join('')}</div><div class="tracking-actions"><button class="btn-secondary small" data-action="ped-next" data-id="${x.id}"><i class="bi bi-arrow-right"></i> Avançar etapa</button><button class="btn-primary small" data-action="ped-receber" data-id="${x.id}"><i class="bi bi-box-seam"></i> Receber mercadoria</button></div></article>`}).join(''):'<div class="empty">Não há compras em andamento. Os pedidos entregues continuam registrados em Pedidos de compra.</div>';
}
function setText(id,value){ const el=$(id); if(el) el.textContent=value; }
function renderStats(){
  const reqPend=state.req.filter(x=>!['ATENDIDA','CANCELADA'].includes(x.status));
  const cotOpen=state.cot.filter(x=>!['APROVADA','RECUSADA'].includes(x.status));
  const pedAtivos=state.ped.filter(x=>!['ENTREGUE','CANCELADO'].includes(x.status));
  const fornAtivos=state.forn.filter(x=>x.ativo!==false);
  setText('statReq',reqPend.length); setText('statCot',cotOpen.length); setText('statPed',pedAtivos.length);
  setText('statEnt',state.ped.filter(x=>['APROVADO','ENVIADO','EM_TRANSITO','RECEBIMENTO_PARCIAL'].includes(x.status)).length);
  setText('statForn',fornAtivos.length); setText('statValor',money(pedAtivos.reduce((s,x)=>s+num(x.total),0)));
  setText('statReqUrg',reqPend.filter(x=>['ALTA','URGENTE'].includes(x.prioridade)).length);
  setText('statReqCot',state.req.filter(x=>x.status==='EM_COTACAO').length); setText('statReqDone',state.req.filter(x=>x.status==='ATENDIDA').length);
  setText('statCotOpen',state.cot.filter(x=>x.status==='ABERTA').length); setText('statCotAnalise',state.cot.filter(x=>x.status==='EM_ANALISE').length); setText('statCotAprov',state.cot.filter(x=>x.status==='APROVADA').length);
  setText('statCotForn',new Set(state.cot.map(x=>x.fornecedorId).filter(Boolean)).size);
  setText('statFornContato',fornAtivos.filter(x=>x.telefone||x.contato||x.responsavel).length); setText('statFornPrazo',fornAtivos.filter(x=>x.prazoEntrega||x.prazo).length); setText('statFornTotal',state.forn.length);
  setText('statPedTrans',state.ped.filter(x=>['EM_TRANSITO','ENVIADO'].includes(x.status)).length); setText('statPedParcial',state.ped.filter(x=>x.status==='RECEBIMENTO_PARCIAL').length);
  setText('statTrackParcial',state.ped.filter(x=>x.status==='RECEBIMENTO_PARCIAL').length); setText('statTrackDone',state.ped.filter(x=>x.status==='ENTREGUE').length);
}
function renderAll(){renderReq();renderCot();renderForn();renderPed();renderTracking();renderStats();}

async function load(){
  const [p,r,c,f,pe]=await Promise.all([
    getDocs(collection(db,'produtos')),
    getDocs(query(collection(db,'requisicoesCompra'),orderBy('criadoEm','desc'),limit(200))),
    getDocs(query(collection(db,'cotacoesCompra'),orderBy('criadoEm','desc'),limit(200))),
    getDocs(query(collection(db,'fornecedores'),orderBy('razaoSocial'),limit(200))),
    getDocs(query(collection(db,'pedidosCompra'),orderBy('criadoEm','desc'),limit(200)))
  ]);
  state.produtos=p.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.ativo!==false);
  state.req=r.docs.map(d=>({id:d.id,...d.data()})); state.cot=c.docs.map(d=>({id:d.id,...d.data()})); state.forn=f.docs.map(d=>({id:d.id,...d.data()})); state.ped=pe.docs.map(d=>({id:d.id,...d.data()}));
  renderAll();
}

async function save(){
  const data=Object.fromEntries(new FormData($('modalForm')).entries());
  const btn=$('modalSalvar'); btn.disabled=true;
  try{
    if(formType==='req'){
      const itens=collectItems(); const ref=currentId?doc(db,'requisicoesCompra',currentId):doc(collection(db,'requisicoesCompra')); const old=currentId?state.req.find(x=>x.id===currentId):null;
      await setDoc(ref,{...data,itens,numero:old?.numero||`RC-${Date.now().toString().slice(-6)}`,status:old?.status||'ABERTA',criadoEm:old?.criadoEm||serverTimestamp(),atualizadoEm:serverTimestamp()},{merge:true});
    } else if(formType==='fornecedor'){
      const ref=currentId?doc(db,'fornecedores',currentId):doc(collection(db,'fornecedores')); await setDoc(ref,{...data,razaoSocial:data.razaoSocial,nome:data.razaoSocial,ativo:true,criadoEm:currentId?(state.forn.find(x=>x.id===currentId)?.criadoEm||serverTimestamp()):serverTimestamp(),atualizadoEm:serverTimestamp()},{merge:true});
    } else if(formType==='cot'){
      const req=state.req.find(x=>x.id===data.reqId), forn=state.forn.find(x=>x.id===data.fornecedorId), old=currentId?state.cot.find(x=>x.id===currentId):null; const ref=currentId?doc(db,'cotacoesCompra',currentId):doc(collection(db,'cotacoesCompra'));
      await setDoc(ref,{...data,valor:num(data.valor),frete:num(data.frete),numero:old?.numero||`COT-${Date.now().toString().slice(-6)}`,reqNumero:req?.numero||'',fornecedorNome:forn?.razaoSocial||forn?.nome||'',status:old?.status||'ABERTA',criadoEm:old?.criadoEm||serverTimestamp(),atualizadoEm:serverTimestamp()},{merge:true});
      if(req && req.status==='ABERTA') await updateDoc(doc(db,'requisicoesCompra',req.id),{status:'EM_COTACAO',atualizadoEm:serverTimestamp()});
    } else if(formType==='ped'){
      const itens=collectItems(); const forn=state.forn.find(x=>x.id===data.fornecedorId), old=currentId?state.ped.find(x=>x.id===currentId):null, ref=currentId?doc(db,'pedidosCompra',currentId):doc(collection(db,'pedidosCompra'));
      await setDoc(ref,{...data,itens,total:num(data.total),numero:old?.numero||`PC-${Date.now().toString().slice(-6)}`,fornecedorNome:forn?.razaoSocial||forn?.nome||'',status:old?.status||'APROVADO',criadoEm:old?.criadoEm||serverTimestamp(),atualizadoEm:serverTimestamp()},{merge:true});
    } else if(formType==='receive') {
      await receivePurchase(currentId);
    }
    closeModal(); await load();
  } catch(e){ console.error(e); alert(e.message || 'Não foi possível salvar. Verifique os campos e as permissões do Firebase.'); }
  finally{ btn.disabled=false; }
}

async function advance(id){
  const p=state.ped.find(x=>x.id===id); if(!p)return; const flow=['APROVADO','ENVIADO','EM_TRANSITO','RECEBIMENTO_PARCIAL','ENTREGUE']; const i=flow.indexOf(p.status||'APROVADO'); const next=flow[Math.min(i+1,flow.length-1)]; if(next===p.status)return;
  await updateDoc(doc(db,'pedidosCompra',id),{status:next,atualizadoEm:serverTimestamp()}); await load();
}
async function approveCot(id){
  const c=state.cot.find(x=>x.id===id); if(!c)return; await updateDoc(doc(db,'cotacoesCompra',id),{status:'APROVADA',atualizadoEm:serverTimestamp()}); if(c.reqId) await updateDoc(doc(db,'requisicoesCompra',c.reqId),{status:'ATENDIDA',atualizadoEm:serverTimestamp()}); await load();
}
async function receivePurchase(id){
  const p=state.ped.find(x=>x.id===id); if(!p)throw new Error('Pedido não encontrado.');
  const rows=[...document.querySelectorAll('#receiveItens .receive-row')]; if(!rows.length)throw new Error('Não há itens para receber.');
  await runTransaction(db,async transaction=>{
    const reads=[];
    for(const row of rows){
      const qty=num(row.querySelector('.r-qtd').value); const item=(p.itens||[]).find(i=>i.produtoId===row.dataset.prod); const pending=Math.max(0,num(item?.quantidade)-num(item?.recebido));
      if(qty<0 || qty>pending) throw new Error(`Quantidade recebida inválida para ${row.dataset.name}.`);
      reads.push({row,item,qty,pending,ref:doc(db,'produtos',row.dataset.prod)});
    }
    const snaps=[]; for(const r of reads) snaps.push(await transaction.get(r.ref));
    let allDelivered=true;
    const updated=(p.itens||[]).map(i=>{
      const r=reads.find(x=>x.row.dataset.prod===i.produtoId); const recebidoAgora=r? r.qty:0; const recebido=num(i.recebido)+recebidoAgora;
      if(recebido<num(i.quantidade)) allDelivered=false; return {...i,recebido};
    });
    for(let idx=0;idx<reads.length;idx++){
      const r=reads[idx], snap=snaps[idx]; if(!snap.exists()) throw new Error(`Produto não encontrado: ${r.row.dataset.name}`); if(r.qty===0) continue;
      const d=snap.data(), saldo=num(d.estoqueAtual), novoSaldo=saldo+r.qty;
      transaction.update(r.ref,{estoqueAtual:novoSaldo,atualizadoEm:serverTimestamp()});
      const movRef=doc(collection(db,'estoqueMovimentos')); transaction.set(movRef,{produtoId:r.row.dataset.prod,produtoNome:d.nome||r.row.dataset.name,tipo:'entrada',quantidade:r.qty,saldoAnterior:saldo,saldoNovo:novoSaldo,observacao:`Recebimento do pedido ${p.numero||id}`,origem:'compra',pedidoCompraId:id,criadoEm:serverTimestamp()});
    }
    transaction.update(doc(db,'pedidosCompra',id),{itens:updated,status:allDelivered?'ENTREGUE':'RECEBIMENTO_PARCIAL',atualizadoEm:serverTimestamp(),recebidoEm:allDelivered?serverTimestamp():null});
  });
}


const PAGE_AREAS = {
  'compras':'overview',
  'requisicoes':'requisicoes',
  'cotacoes':'cotacoes',
  'fornecedores':'fornecedores',
  'pedidos-compra':'pedidos',
  'acompanhamento':'acompanhamento'
};
const CURRENT_AREA = PAGE_AREAS[paginaAtual()] || 'overview';

function navegarArea(area, params=''){
  const urls={
    requisicoes:'requisicoes.html',
    cotacoes:'cotacoes.html',
    fornecedores:'fornecedores.html',
    pedidos:'pedidos-compra.html',
    acompanhamento:'acompanhamento.html',
    overview:'compras.html'
  };
  location.href=(urls[area]||urls.overview)+(params?`?${params}`:'');
}
function areaAtual(){ return CURRENT_AREA; }
function activateTab(tab){ if(tab && tab!==CURRENT_AREA) navegarArea(tab); }
function quick(tab){ navegarArea(tab); }

document.querySelectorAll('[data-stat-tab]').forEach(b=>b.onclick=()=>quick(b.dataset.statTab));
document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>quick(b.dataset.quick));

const btnNovaAcao=$('btnNovaAcao');
if(btnNovaAcao) btnNovaAcao.onclick=()=>{
  const a=areaAtual();
  a==='requisicoes'?reqForm():a==='cotacoes'?cotForm():a==='fornecedores'?fornecedorForm():a==='pedidos'?pedForm():reqForm();
};
$('btnNovaReq')?.addEventListener('click',()=>reqForm());
$('btnNovaCot')?.addEventListener('click',()=>cotForm());
$('btnNovoFornecedor')?.addEventListener('click',()=>fornecedorForm());
$('btnNovoPedido')?.addEventListener('click',()=>pedForm());
$('btnAtualizar')?.addEventListener('click',load);

$('modalX')?.addEventListener('click',closeModal);
$('modalCancelar')?.addEventListener('click',closeModal);
$('modalForm')?.addEventListener('submit',e=>{e.preventDefault();save()});
$('modal')?.addEventListener('click',e=>{if(e.target===modal)closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape' && $('modal') && !modal.hidden)closeModal()});

$('modalBody')?.addEventListener('click',e=>{
  if(e.target.closest('#addItem'))addItemRow();
  const r=e.target.closest('.remove-row');
  if(r){
    const rows=document.querySelectorAll('#editorItens .item-row');
    if(rows.length>1)r.closest('tr').remove();
  }
});
$('modalBody')?.addEventListener('change',e=>{
  if(e.target.matches('.i-prod'))updateUnit(e.target.closest('tr'));
  if(e.target.matches('[name=cotId]')){
    const c=state.cot.find(x=>x.id===e.target.value);
    if(c){const forn=body.querySelector('[name=fornecedorId]');if(forn&&c.fornecedorId)forn.value=c.fornecedorId;}
  }
});

$('listaReq')?.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(!b)return;
  const x=state.req.find(x=>x.id===b.dataset.id);
  if(b.dataset.action==='req-edit')reqForm(x);
  if(b.dataset.action==='req-cot')location.href=`cotacoes.html?novo=1&reqId=${encodeURIComponent(x.id)}`;
});
$('listaCot')?.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(!b)return;
  const x=state.cot.find(x=>x.id===b.dataset.id);
  if(b.dataset.action==='cot-edit')cotForm(x);
  if(b.dataset.action==='cot-aprovar')approveCot(x.id);
  if(b.dataset.action==='cot-ped')location.href=`pedidos-compra.html?novo=1&cotId=${encodeURIComponent(x.id)}&fornecedorId=${encodeURIComponent(x.fornecedorId||'')}`;
});
$('listaForn')?.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');
  if(b)fornecedorForm(state.forn.find(x=>x.id===b.dataset.id));
});
$('listaPed')?.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(!b)return;
  const x=state.ped.find(x=>x.id===b.dataset.id);
  if(b.dataset.action==='ped-edit')pedForm(x);
  if(b.dataset.action==='ped-next')advance(x.id);
  if(b.dataset.action==='ped-receber')receiveForm(x);
});
$('trackingGrid')?.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(!b)return;
  if(b.dataset.action==='ped-next')advance(b.dataset.id);
  if(b.dataset.action==='ped-receber')receiveForm(state.ped.find(x=>x.id===b.dataset.id));
});

['buscaReq','filtroReq','buscaCot','filtroCot','buscaForn','buscaPed','filtroPed']
  .forEach(id=>$(id)?.addEventListener('input',()=>renderAll()));

function renderAll(){
  if($('listaReq')) renderReq();
  if($('listaCot')) renderCot();
  if($('listaForn')) renderForn();
  if($('listaPed')) renderPed();
  if($('trackingGrid')) renderTracking();
  if($('statReq')) renderStats();
}

load().then(()=>{
  const params=new URLSearchParams(location.search);
  if(params.get('novo')==='1'){
    const id=params.get('reqId'), cotId=params.get('cotId'), forn=params.get('fornecedorId');
    if(CURRENT_AREA==='cotacoes') cotForm(id?{reqId:id}:{});
    else if(CURRENT_AREA==='pedidos') pedForm(cotId?{cotId,fornecedorId:forn||''}:{});
  }
}).catch(e=>{console.error(e);alert('Não foi possível carregar o módulo de Compras. Verifique sua conexão e permissões do Firebase.')});
