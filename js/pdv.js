import { buscarComanda, finalizarComanda, criarComandaProvisoria } from "./comandas.js";
import { registrarCupomFiscal } from "./fiscal.js";
import { caixaAberto, registrarMovimento } from "./caixa.js";
import { db } from "./firebase.js";
import {
  collection, getDocs, addDoc, updateDoc, doc, serverTimestamp, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = id => document.getElementById(id);
const input = $("codigoComanda");
const btnBuscar = $("btnBuscar");
const ticket = $("ticket");
const empty = $("ticketEmpty");
const finalizar = $("finalizar");
const mensagem = $("mensagem");
const trocoBox = $("trocoBox");
const recebido = $("valorRecebido");

let comandaAtual = null;
let pagamento = null;
let caixaAtual = null;
let produtos = [];
let itensProdutos = [];
let categoriaAtual = "Todos";
let vendaFinalizadaPendenteFiscal = null;
let modoVenda = "comanda";

const moeda = v => Number(v || 0).toLocaleString("pt-BR", {style:"currency",currency:"BRL"});
const peso = v => `${Number(v || 0).toFixed(3).replace(".", ",")} kg`;

function avisar(texto,tipo="err"){ mensagem.textContent=texto; mensagem.className=`message show ${tipo}`; }
function limparAviso(){ mensagem.textContent=""; mensagem.className="message"; }

function resetPagamento(){
  pagamento=null; recebido.value=""; $("troco").textContent=moeda(0); trocoBox.classList.remove("show");
  document.querySelectorAll(".pay-btn").forEach(b=>b.classList.remove("selected"));
  finalizar.disabled=true;
  sincronizarBotaoFinalizarRodape();
}

function sincronizarBotaoFinalizarRodape(){
  const btn=$("btnFinalizarRodape");
  if(!btn) return;
  btn.disabled=finalizar.disabled;
}

function totalProdutos(){ return itensProdutos.reduce((s,i)=>s+(Number(i.preco||0)*Number(i.quantidade||0)),0); }
function totalVenda(){ return Number(comandaAtual?.total||0)+totalProdutos(); }

function renderItens(){
  const tbody=$("itensVenda");
  if(!tbody) return;
  let html="";
  const itensComanda=Array.isArray(comandaAtual?.itens)?comandaAtual.itens:[];
  itensComanda.forEach((item)=>{
    const tipo=item.tipo||"UNIDADE";
    const quantidade=Number(item.quantidade||1);
    const totalItem=Number(item.total ?? (Number(item.preco||0)*quantidade));
    const ehPeso=tipo==="PESO";
    html+=`<tr>
      <td><strong>${item.nome||item.produto||"Produto"}</strong><br><small>${ehPeso?"Pesagem":"Produto"}</small></td>
      <td>${quantidade}</td>
      <td class="weight-value">${ehPeso?peso(item.peso):"—"}</td>
      <td class="price-value">${ehPeso?`${moeda(item.precoKg)}/kg`:`${moeda(item.preco)}/un`}</td>
      <td class="weight-value">${moeda(totalItem)}</td>
    </tr>`;
  });
  itensProdutos.forEach((item,index)=>{
    html+=`<tr class="pending-line">
      <td><strong>${item.nome}</strong><br><small>Pendente</small></td>
      <td><span class="qty-control"><button type="button" data-minus="${index}">−</button>${item.quantidade}<button type="button" data-plus="${index}">+</button></span></td>
      <td>—</td><td class="price-value">${moeda(item.preco)}/un</td>
      <td class="weight-value">${moeda(item.preco*item.quantidade)} <button class="product-line-remove" type="button" data-remove="${index}" title="Remover"><i class="bi bi-x-circle"></i></button></td>
    </tr>`;
  });
  if(!html) html='<tr><td colspan="5" style="text-align:center;color:#64748b;padding:28px">Nenhum item adicionado.</td></tr>';
  tbody.innerHTML=html;
  tbody.querySelectorAll("[data-minus]").forEach(b=>b.onclick=()=>alterarQuantidade(Number(b.dataset.minus),-1));
  tbody.querySelectorAll("[data-plus]").forEach(b=>b.onclick=()=>alterarQuantidade(Number(b.dataset.plus),1));
  tbody.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{itensProdutos.splice(Number(b.dataset.remove),1);atualizarResumo();renderItensSemLoop();});
  atualizarResumo();
}

function atualizarResumo(){
  const total=totalVenda();
  $("subtotal").textContent=moeda(total);
  $("totalGrande").textContent=moeda(total);
  const itensPersistidos=(Array.isArray(comandaAtual?.itens)?comandaAtual.itens:[]).reduce((s,i)=>s+Number(i.quantidade||1),0);
  $("kpiItens").textContent=String(itensPersistidos+itensProdutos.reduce((s,i)=>s+i.quantidade,0));
  $("kpiValor").textContent=moeda(total);
  if(pagamento==="Dinheiro") calcularTroco();
  else finalizar.disabled=!(total>0 && pagamento);
  sincronizarBotaoFinalizarRodape();
  atualizarResumoEntrega();
}

function alterarQuantidade(index,delta){
  const item=itensProdutos[index]; if(!item)return;
  item.quantidade+=delta;
  if(item.quantidade<=0) itensProdutos.splice(index,1);
  atualizarResumo(); renderItensSemLoop();
}
function renderItensSemLoop(){
  const tbody=$("itensVenda"); if(!tbody)return;
  // Reaproveita a renderização completa sem perder o estado.
  renderItens();
}

function limparVenda(){
  comandaAtual=null; modoVenda="comanda"; itensProdutos=[]; resetPagamento(); ticket.classList.remove("show"); empty.style.display="flex";
  $("kpiComanda").textContent="—"; $("kpiItens").textContent="0"; $("kpiValor").textContent=moeda(0);
  $("subtotal").textContent=moeda(0); $("totalGrande").textContent=moeda(0); $("horaVenda").textContent="Aguardando comanda";
  input.value=""; input.focus(); renderProdutos();
  ["deliveryCliente","deliveryTelefone","deliveryEndereco","deliveryNumero","deliveryComplemento","deliveryBairro","deliveryReferencia","deliveryObservacao"].forEach(id=>{const el=$(id);if(el)el.value="";});
  if($("deliveryTaxa"))$("deliveryTaxa").value="0";
  if($("deliveryPagamento"))$("deliveryPagamento").value="";
  if($("deliveryRecebimento"))$("deliveryRecebimento").value="ENTREGA";
  atualizarResumoEntrega();
}

function mostrarComanda(c){
  const itemPeso=(Array.isArray(c.itens)?c.itens:[]).find(i=>i.tipo==="PESO");
  $("numeroComanda").textContent=c.numero||"—";
  $("produtoComanda").textContent=c.tipo==="PROVISORIA"?"Comanda provisória":(itemPeso?.nome||c.produto||"Buffet por quilo");
  $("pesoComanda").textContent=itemPeso?peso(itemPeso.peso):"—";
  $("precoComanda").textContent=itemPeso?`${moeda(itemPeso.precoKg)}/kg`:"—";
  $("totalComanda").textContent=moeda(c.total);
  $("statusComanda").textContent=c.status||"ABERTA";
  $("kpiComanda").textContent=c.numero||"—";
  $("horaVenda").textContent=c.tipo==="PROVISORIA"?"Comanda provisória carregada":"Comanda carregada";
  ticket.classList.add("show"); empty.style.display="none";
  renderItens();
}


async function atualizarCaixa(){
  try{
    caixaAtual=await caixaAberto();
    const aberto=!!caixaAtual;
    $("statusCaixa").textContent=aberto?"ABERTO":"FECHADO";
    $("statusDot").classList.toggle("closed",!aberto);
    if(aberto)$("operadorNome").textContent=caixaAtual.operador||"Operador";
  }catch(e){ $("statusCaixa").textContent="indisponível"; $("statusDot").classList.add("closed"); }
}

async function buscar(){
  const codigo=input.value.trim(); if(!codigo)return;
  limparAviso();
  try{
    const c=await buscarComanda(codigo);
    if(!c){ avisar("Comanda não encontrada. Confira o código ou número."); return; }
    if(c.status==="FINALIZADA"){ avisar(`A comanda ${c.numero} já foi finalizada.`); return; }
    comandaAtual=c; itensProdutos=[]; mostrarComanda(c); resetPagamento();
    avisar(`Comanda ${c.numero} carregada. Você pode adicionar produtos à mesma venda.`,`ok`);
  }catch(e){console.error(e);avisar("Erro ao consultar a comanda. Verifique a conexão com o Firebase.");}
}


async function criarComandaNoPDV(){
  try{
    const caixa=await caixaAberto();
    if(!caixa){ avisar("Abra o caixa antes de criar uma comanda.","err"); return; }
    const c=await criarComandaProvisoria();
    comandaAtual=c;
    itensProdutos=[];
    mostrarComanda(c);
    resetPagamento();
    avisar(`Comanda provisória #${c.numero} criada. Adicione os produtos e finalize quando estiver pronto.`,"ok");
    $("buscaProdutoPDV")?.focus();
  }catch(e){ console.error(e); avisar(e?.message||"Não foi possível criar a comanda.","err"); }
}

async function abrirComandaNoPDV(){
  const modal=$("modalAbrirComanda");
  const lista=$("listaComandasPDV");
  if(!modal||!lista)return;
  lista.innerHTML='<div class="command-loading"><i class="bi bi-arrow-repeat"></i> Carregando comandas...</div>';
  modal.classList.add("show");
  try{
    const snap=await getDocs(query(collection(db,"comandas"),where("status","==","ABERTA")));
    const rows=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>Number(a.numero||0)-Number(b.numero||0));
    if(!rows.length){ lista.innerHTML='<div class="command-empty"><i class="bi bi-receipt"></i><strong>Nenhuma comanda aberta</strong><span>Crie uma comanda provisória ou faça uma pesagem.</span></div>'; return; }
    lista.innerHTML=rows.map(c=>{
      const qtd=(Array.isArray(c.itens)?c.itens:[]).reduce((s,i)=>s+Number(i.quantidade||1),0);
      const tipo=c.tipo==="PROVISORIA"?"PROVISÓRIA":"PESAGEM";
      return `<button type="button" class="command-option" data-command-id="${c.id}"><span class="command-option-main"><strong>#${c.numero}</strong><small>${tipo} · ${qtd} item(ns)</small></span><span class="command-option-total">${moeda(c.total)}</span><i class="bi bi-chevron-right"></i></button>`;
    }).join("");
    lista.querySelectorAll("[data-command-id]").forEach(btn=>btn.onclick=()=>{
      const c=rows.find(x=>x.id===btn.dataset.commandId);
      if(!c)return;
      comandaAtual=c; itensProdutos=[]; modal.classList.remove("show"); mostrarComanda(c); resetPagamento(); avisar(`Comanda #${c.numero} aberta no caixa.`,"ok");
    });
  }catch(e){ console.error(e); lista.innerHTML='<div class="command-empty"><strong>Não foi possível carregar as comandas.</strong><span>Verifique a conexão com o Firebase.</span></div>'; }
}

function configurarAbas(){
  const tabs=document.querySelectorAll(".pdv-tab");
  const comanda=$("painelComandaPDV"), produtosPainel=$("painelProdutosPDV"), entregaPainel=$("painelEntregaPDV");
  tabs.forEach(tab=>tab.addEventListener("click",()=>{
    tabs.forEach(t=>t.classList.remove("active")); tab.classList.add("active");
    modoVenda=tab.dataset.tab;
    const entregaAtiva=modoVenda==="entrega";
    // Na Frente de Loja, comanda e produtos ficam visíveis juntos para agilizar o atendimento.
    // A aba apenas muda o foco. Entrega é o único modo que troca o conteúdo principal.
    comanda?.classList.toggle("pdv-tab-panel-hidden",entregaAtiva);
    produtosPainel?.classList.toggle("pdv-tab-panel-hidden",entregaAtiva);
    entregaPainel?.classList.toggle("pdv-tab-panel-hidden",!entregaAtiva);
    if(modoVenda==="produtos") $("buscaProdutoPDV")?.focus();
    else if(entregaAtiva){atualizarResumoEntrega();$("deliveryCliente")?.focus();}
    else input.focus();
  }));
}

async function carregarProdutos(){
  const el=$("listaProdutosPDV"); if(!el)return;
  try{
    const snap=await getDocs(collection(db,"produtos"));
    produtos=snap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.ativo!==false);
    const cats=["Todos",...new Set(produtos.map(p=>p.categoria).filter(Boolean))];
    $("categoriasPDV").innerHTML=cats.map(c=>`<button class="category-btn ${c===categoriaAtual?"active":""}" data-category="${c}" type="button">${c}</button>`).join("");
    $("categoriasPDV").querySelectorAll(".category-btn").forEach(b=>b.onclick=()=>{categoriaAtual=b.dataset.category;renderProdutos();});
    renderProdutos();
  }catch(e){console.error(e);el.innerHTML='<div class="products-empty">Não foi possível carregar os produtos.</div>';}
}

function precoProduto(p){ return Number(p.precoUnit ?? p.preco ?? p.precoKg ?? 0); }
function unidadeProduto(p){ return p.tipoVenda==="peso" ? "kg" : "un"; }

function renderProdutos(){
  const el=$("listaProdutosPDV"); if(!el)return;
  const busca=($("buscaProdutoPDV")?.value||"").trim().toLowerCase();
  const lista=produtos.filter(p=>(categoriaAtual==="Todos"||p.categoria===categoriaAtual)&&(!busca||String(p.nome||"").toLowerCase().includes(busca)));
  if(!lista.length){el.innerHTML='<div class="products-empty">Nenhum produto encontrado.</div>';return;}
  el.innerHTML=lista.map(p=>{
    const imagem=p.imagem||p.image||p.foto||p.imageUrl||p.urlImagem||"";
    const visual=imagem
      ? `<div class="product-image"><img src="${imagem}" alt="${p.nome||"Produto"}" loading="lazy"></div>`
      : `<div class="product-image"><i class="bi bi-basket2"></i></div>`;
    return `<button type="button" class="product-card" data-product="${p.id}">
      ${visual}
      <strong>${p.nome||"Produto"}</strong>
      <span>${moeda(precoProduto(p))}</span>
      <small>${unidadeProduto(p)==="kg"?"por kg":"por unidade"}${p.categoria?" · "+p.categoria:""}</small>
    </button>`;
  }).join("");
  el.querySelectorAll("[data-product]").forEach(b=>b.onclick=()=>adicionarProduto(b.dataset.product));
}

function adicionarProduto(id){
  const p=produtos.find(x=>x.id===id); if(!p)return;
  if(unidadeProduto(p)==="kg"){
    avisar("Este produto está cadastrado por peso. Para ele, use a Pesagem/comanda.","err"); return;
  }
  const existente=itensProdutos.find(i=>i.id===id);
  if(existente)existente.quantidade++;
  else itensProdutos.push({id,nome:p.nome||"Produto",preco:precoProduto(p),quantidade:1});
  mostrarItensVenda(); avisar(`${p.nome} adicionado à venda.`,"ok");
}

function mostrarItensVenda(){
  ticket.classList.add("show"); empty.style.display="none";
  if(!comandaAtual){ $("numeroComanda").textContent="VENDA DIRETA"; $("statusComanda").textContent="ABERTA"; $("produtoComanda").textContent="Produtos"; $("pesoComanda").textContent="—"; $("precoComanda").textContent="—"; $("totalComanda").textContent="—"; $("kpiComanda").textContent="Direta"; $("horaVenda").textContent="Venda de produtos"; }
  renderItens();
}


function atualizarResumoEntrega(){
  const subtotal=totalProdutos();
  const taxa=Math.max(0,Number($("deliveryTaxa")?.value||0));
  const total=subtotal+taxa;
  if($("deliverySubtotal"))$("deliverySubtotal").textContent=moeda(subtotal);
  if($("deliveryTaxaResumo"))$("deliveryTaxaResumo").textContent=moeda(taxa);
  if($("deliveryTotal"))$("deliveryTotal").textContent=moeda(total);
}
function pedidosDeliveryLocais(){
  try{return JSON.parse(localStorage.getItem("neoscale_delivery_orders")||"[]")}catch{return[]}
}
function salvarPedidosDeliveryLocais(rows){
  localStorage.setItem("neoscale_delivery_orders",JSON.stringify(rows));
}
function gerarIdDelivery(){
  const n=Date.now().toString().slice(-8);
  return "PDV-"+n;
}
function dadosEntregaValidos(){
  const cliente=$("deliveryCliente")?.value.trim();
  const telefone=$("deliveryTelefone")?.value.trim();
  const endereco=$("deliveryEndereco")?.value.trim();
  const bairro=$("deliveryBairro")?.value.trim();
  const pagamento=$("deliveryPagamento")?.value;
  if(!cliente)return "Informe o nome do cliente.";
  if(!telefone)return "Informe o telefone do cliente.";
  if(!endereco)return "Informe o endereço de entrega.";
  if(!bairro)return "Informe o bairro.";
  if(totalProdutos()<=0)return "Adicione pelo menos um produto ao pedido.";
  if(!pagamento)return "Selecione a forma de pagamento.";
  return "";
}
async function criarPedidoEntrega(){
  const erro=dadosEntregaValidos();
  if(erro){avisar(erro,"err");return;}
  const btn=$("btnCriarPedidoEntrega"); btn.disabled=true; btn.innerHTML='<i class="bi bi-arrow-repeat"></i> CRIANDO...';
  try{
    const taxa=Math.max(0,Number($("deliveryTaxa").value||0));
    const subtotal=totalProdutos();
    const total=subtotal+taxa;
    const pagamento=$("deliveryPagamento").value;
    const recebimento=$("deliveryRecebimento").value;
    const pedido={
      id:gerarIdDelivery(),
      source:"PDV",
      origem:"PDV",
      customer:$("deliveryCliente").value.trim(),
      telefone:$("deliveryTelefone").value.trim(),
      endereco:{
        rua:$("deliveryEndereco").value.trim(),
        numero:$("deliveryNumero").value.trim(),
        complemento:$("deliveryComplemento").value.trim(),
        bairro:$("deliveryBairro").value.trim(),
        referencia:$("deliveryReferencia").value.trim()
      },
      address:`${$("deliveryEndereco").value.trim()}${$("deliveryNumero").value.trim()?", "+$("deliveryNumero").value.trim():""}${$("deliveryComplemento").value.trim()?" - "+$("deliveryComplemento").value.trim():""} - ${$("deliveryBairro").value.trim()}`,
      items:itensProdutos.map(i=>({id:i.id,name:i.nome,quantity:i.quantidade,price:i.preco})),
      subtotal,taxaEntrega:taxa,total,
      pagamento,formaPagamento:pagamento,paymentMethod:pagamento,
      recebimento,observacao:$("deliveryObservacao").value.trim(),
      status:"NOVO",
      criadoEm:new Date().toISOString(),
      origemLocal:true
    };
    const rows=pedidosDeliveryLocais();
    rows.unshift(pedido);
    salvarPedidosDeliveryLocais(rows);
    avisar(`Pedido ${pedido.id} criado e enviado para a Central de Delivery.`,"ok");
    window.dispatchEvent(new CustomEvent("neoscale:delivery-created",{detail:pedido}));
    setTimeout(()=>limparVenda(),900);
  }catch(e){
    console.error(e);avisar("Não foi possível criar o pedido para entrega.","err");
  }finally{
    btn.disabled=false;btn.innerHTML='<i class="bi bi-bicycle"></i> CRIAR PEDIDO PARA ENTREGA';
  }
}
function calcularTroco(){
  if(pagamento!=="Dinheiro")return;
  const valor=Number(recebido.value||0), total=totalVenda(), troco=valor-total;
  $("troco").textContent=moeda(Math.max(0,troco)); finalizar.disabled=!(total>0&&valor>=total); sincronizarBotaoFinalizarRodape();
}

document.querySelectorAll(".pay-btn").forEach(btn=>btn.addEventListener("click",()=>{
  if(totalVenda()<=0)return;
  pagamento=btn.dataset.pay;
  document.querySelectorAll(".pay-btn").forEach(b=>b.classList.remove("selected"));btn.classList.add("selected");
  trocoBox.classList.toggle("show",pagamento==="Dinheiro");
  if(pagamento!=="Dinheiro")finalizar.disabled=false; else calcularTroco();
  sincronizarBotaoFinalizarRodape();
}));
recebido.addEventListener("input",calcularTroco);

async function concluirVendaComOpcaoFiscal(emitirFiscal){
  const venda=vendaFinalizadaPendenteFiscal;
  if(!venda) return;
  const modalFiscal=$("modalFiscalVenda");
  $("simCupomFiscal").disabled=true; $("naoCupomFiscal").disabled=true;
  try{
    if(emitirFiscal){
      const docFiscal=await registrarCupomFiscal(venda);
      avisar(`Venda finalizada. NFC-e ${docFiscal.numero} registrada para emissão.`,"ok");
    }else{
      avisar("Venda finalizada sem cupom fiscal.","ok");
    }
  }catch(e){
    console.error(e);
    avisar(`Venda finalizada, mas não foi possível registrar o cupom fiscal: ${e.message||"erro"}.`,"err");
  }finally{
    modalFiscal.hidden=true;
    $("simCupomFiscal").disabled=false; $("naoCupomFiscal").disabled=false;
    vendaFinalizadaPendenteFiscal=null;
    finalizar.innerHTML='<i class="bi bi-check-circle"></i> VENDA FINALIZADA';
    setTimeout(limparVenda,1200);
  }
}

$("simCupomFiscal")?.addEventListener("click",()=>concluirVendaComOpcaoFiscal(true));
$("naoCupomFiscal")?.addEventListener("click",()=>concluirVendaComOpcaoFiscal(false));

finalizar.addEventListener("click",async()=>{
  if(totalVenda()<=0||!pagamento)return;
  if(!caixaAtual){await atualizarCaixa();if(!caixaAtual){avisar("Nenhum caixa está aberto. Abra o caixa antes de vender.");return;}}
  if(pagamento==="Dinheiro"&&Number(recebido.value||0)<totalVenda()){avisar("O valor recebido é menor que o total.");return;}
  finalizar.disabled=true;sincronizarBotaoFinalizarRodape();finalizar.innerHTML='<i class="bi bi-arrow-repeat"></i> FINALIZANDO...';
  try{
    const totalFinal = totalVenda();
    const recebidoValor = pagamento === "Dinheiro" ? Number(recebido.value || 0) : 0;
    const trocoValor = pagamento === "Dinheiro" ? Math.max(0, recebidoValor - totalFinal) : 0;
    const itensRecibo = [];

    if(comandaAtual){
      await finalizarComanda(comandaAtual.id,pagamento);
      itensRecibo.push({nome: comandaAtual.produto || "Refeição por peso", quantidade: 1, preco: Number(comandaAtual.total || 0)});
      if(itensProdutos.length){
        const vendaRef=await addDoc(collection(db,"vendasProdutos"),{tipo:"PRODUTOS",comandaId:comandaAtual.id,numeroComanda:comandaAtual.numero,itens:itensProdutos,total:totalProdutos(),pagamento,criadoEm:serverTimestamp()});
        await registrarMovimento({caixaId:caixaAtual.id,tipo:"VENDA",valor:totalProdutos(),forma:pagamento,descricao:`Produtos da comanda ${comandaAtual.numero}`,referencia:vendaRef.id});
        itensRecibo.push(...itensProdutos);
      }
    }else{
      const vendaRef=await addDoc(collection(db,"vendasProdutos"),{tipo:"PRODUTOS",itens:itensProdutos,total:totalProdutos(),pagamento,criadoEm:serverTimestamp()});
      await registrarMovimento({caixaId:caixaAtual.id,tipo:"VENDA",valor:totalProdutos(),forma:pagamento,descricao:"Venda direta de produtos",referencia:vendaRef.id});
      itensRecibo.push(...itensProdutos);
    }

    window.imprimirReciboVenda?.({
      numeroComanda: comandaAtual?.numero || "Venda direta",
      itens: itensRecibo,
      total: totalFinal,
      pagamento,
      recebido: recebidoValor,
      troco: trocoValor
    });
    $("statusComanda").textContent="FINALIZADA";
    vendaFinalizadaPendenteFiscal={
      numeroComanda: comandaAtual?.numero || "Venda direta",
      comandaId: comandaAtual?.id || null,
      itens: itensRecibo,
      total: totalFinal,
      pagamento
    };
    $("fiscalVendaTotal").textContent=moeda(totalFinal);
    $("modalFiscalVenda").hidden=false;
  }catch(e){console.error(e);finalizar.disabled=false;sincronizarBotaoFinalizarRodape();finalizar.innerHTML='<i class="bi bi-check-circle"></i> FINALIZAR VENDA';avisar(e.message||"Não foi possível finalizar a venda.");}
});

$("btnFinalizarRodape")?.addEventListener("click",()=>{
  if(finalizar.disabled){
    const resumo=document.querySelector(".summary");
    document.querySelector(".summary")?.scrollIntoView({behavior:"smooth",block:"center"});
    if(totalVenda()<=0) avisar("Adicione um produto ou carregue uma comanda antes de finalizar.","err");
    else if(!pagamento) avisar("Selecione a forma de pagamento para finalizar a compra.","err");
    else if(pagamento==="Dinheiro") avisar("Informe o valor recebido para finalizar a compra.","err");
    return;
  }
  finalizar.click();
});

$("buscaProdutoPDV")?.addEventListener("input",renderProdutos);
btnBuscar.addEventListener("click",buscar);
$("btnCriarComandaPDV")?.addEventListener("click",criarComandaNoPDV);
$("btnAbrirComandaPDV")?.addEventListener("click",abrirComandaNoPDV);
$("fecharModalAbrirComanda")?.addEventListener("click",()=>$("modalAbrirComanda")?.classList.remove("show"));
input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();buscar();}});
$("btnLimpar").addEventListener("click",limparVenda);
$("btnLimparTopo")?.addEventListener("click",limparVenda);
const modal=$("modalCancel");
$("btnCancelar")?.addEventListener("click",()=>{
  if(comandaAtual||itensProdutos.length) modal.classList.add("show");
});
$("fecharModal")?.addEventListener("click",()=>modal.classList.remove("show"));
$("confirmarCancelar")?.addEventListener("click",async()=>{
  const btn=$("confirmarCancelar");
  if(!comandaAtual){
    modal.classList.remove("show");
    limparVenda();
    avisar("Venda limpa do atendimento.","ok");
    return;
  }
  const motivo=prompt(`Informe o motivo do cancelamento da comanda #${comandaAtual.numero||""}:`,"");
  if(motivo===null) return;
  const texto=motivo.trim();
  if(!texto){ avisar("Informe o motivo do cancelamento."); return; }
  try{
    btn.disabled=true;
    btn.textContent="Cancelando...";
    const caixa=await caixaAberto();
    await updateDoc(doc(db,"comandas",comandaAtual.id),{
      status:"CANCELADA",
      canceladaEm:serverTimestamp(),
      cancelamentoMotivo:texto,
      canceladaPor:caixa?.operador||"Operador",
      caixaId:caixa?.id||comandaAtual.caixaId||null,
      ocultarAposFechamento:false
    });
    modal.classList.remove("show");
    limparVenda();
    avisar(`Comanda #${comandaAtual.numero||""} cancelada com sucesso.` ,"ok");
  }catch(e){
    console.error(e);
    avisar(e?.message||"Não foi possível cancelar a comanda.");
  }finally{
    btn.disabled=false;
    btn.textContent="Cancelar venda";
  }
});
window.addEventListener("keydown",e=>{
  if(e.key==="F2"){e.preventDefault();input.focus();input.select();}
  if(e.key==="F6"){e.preventDefault();document.querySelector(".pay-btn")?.focus();}
  if(e.key==="Escape"){if($("modalFiscalVenda")?.hidden===false){$("modalFiscalVenda").hidden=true; concluirVendaComOpcaoFiscal(false); return;} modal.classList.remove("show");limparVenda();}
  if(e.key==="F8"){e.preventDefault();if(comandaAtual||itensProdutos.length)modal.classList.add("show");}
});
$("deliveryTaxa")?.addEventListener("input",atualizarResumoEntrega);
$("btnCriarPedidoEntrega")?.addEventListener("click",criarPedidoEntrega);
function relogio(){$("relogio").textContent=new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});}
relogio();setInterval(relogio,1000);configurarAbas();atualizarCaixa();carregarProdutos();input.focus();
