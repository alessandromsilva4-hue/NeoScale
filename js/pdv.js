import { buscarComanda, finalizarComanda } from "./comandas.js";
import { registrarCupomFiscal } from "./fiscal.js";
import { caixaAberto, registrarMovimento } from "./caixa.js";
import { db } from "./firebase.js";
import {
  collection, getDocs, addDoc, serverTimestamp
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
const DELIVERY_LOCAL_KEY = "neoscale_pdv_delivery_orders";
const CUSTOMERS_LOCAL_KEY = "neoscale_delivery_customers";

const moeda = v => Number(v || 0).toLocaleString("pt-BR", {style:"currency",currency:"BRL"});
const peso = v => `${Number(v || 0).toFixed(3).replace(".", ",")} kg`;

function avisar(texto,tipo="err"){ mensagem.textContent=texto; mensagem.className=`message show ${tipo}`; }
function limparAviso(){ mensagem.textContent=""; mensagem.className="message"; }

function resetPagamento(){
  pagamento=null; recebido.value=""; $("troco").textContent=moeda(0); trocoBox.classList.remove("show");
  document.querySelectorAll(".pay-btn").forEach(b=>b.classList.remove("selected"));
  finalizar.disabled=true;
}

function totalProdutos(){ return itensProdutos.reduce((s,i)=>s+(Number(i.preco||0)*Number(i.quantidade||0)),0); }
function totalVenda(){ return Number(comandaAtual?.total||0)+totalProdutos(); }

function renderItens(){
  const tbody=$("itensVenda");
  if(!tbody) return;
  let html="";
  if(comandaAtual){
    html+=`<tr>
      <td>${comandaAtual.produto||"Buffet por quilo"}</td><td>1</td>
      <td class="weight-value">${peso(comandaAtual.peso)}</td>
      <td class="price-value">${moeda(comandaAtual.precoKg)}/kg</td>
      <td class="weight-value">${moeda(comandaAtual.total)}</td>
    </tr>`;
  }
  itensProdutos.forEach((item,index)=>{
    html+=`<tr>
      <td><strong>${item.nome}</strong><br><small>Produto</small></td>
      <td><span class="qty-control"><button type="button" data-minus="${index}">−</button>${item.quantidade}<button type="button" data-plus="${index}">+</button></span></td>
      <td>—</td><td class="price-value">${moeda(item.preco)}/un</td>
      <td class="weight-value">${moeda(item.preco*item.quantidade)} <button class="product-line-remove" type="button" data-remove="${index}" title="Remover"><i class="bi bi-x-circle"></i></button></td>
    </tr>`;
  });
  if(!html) html='<tr><td colspan="5" style="text-align:center;color:#64748b;padding:28px">Nenhum item adicionado.</td></tr>';
  tbody.innerHTML=html;
  tbody.querySelectorAll("[data-minus]").forEach(b=>b.onclick=()=>alterarQuantidade(Number(b.dataset.minus),-1));
  tbody.querySelectorAll("[data-plus]").forEach(b=>b.onclick=()=>alterarQuantidade(Number(b.dataset.plus),1));
  tbody.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{itensProdutos.splice(Number(b.dataset.remove),1);atualizarResumo();});
  atualizarResumo();
}

function atualizarResumo(){
  const total=totalVenda();
  $("subtotal").textContent=moeda(total);
  $("totalGrande").textContent=moeda(total);
  $("kpiItens").textContent=String((comandaAtual?1:0)+itensProdutos.reduce((s,i)=>s+i.quantidade,0));
  $("kpiValor").textContent=moeda(total);
  if(pagamento==="Dinheiro") calcularTroco();
  else finalizar.disabled=!(total>0 && pagamento);
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
  comandaAtual=null; itensProdutos=[]; resetPagamento(); ticket.classList.remove("show"); empty.style.display="flex";
  $("kpiComanda").textContent="—"; $("kpiItens").textContent="0"; $("kpiValor").textContent=moeda(0);
  $("subtotal").textContent=moeda(0); $("totalGrande").textContent=moeda(0); $("horaVenda").textContent="Aguardando comanda";
  input.value=""; input.focus(); renderProdutos();
}

function mostrarComanda(c){
  $("numeroComanda").textContent=c.numero||"—";
  $("produtoComanda").textContent=c.produto||"Buffet por quilo";
  $("pesoComanda").textContent=peso(c.peso);
  $("precoComanda").textContent=`${moeda(c.precoKg)}/kg`;
  $("totalComanda").textContent=moeda(c.total);
  $("statusComanda").textContent=c.status||"ABERTA";
  $("kpiComanda").textContent=c.numero||"—";
  $("horaVenda").textContent="Comanda carregada";
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
    comandaAtual=c; mostrarComanda(c); resetPagamento();
    avisar(`Comanda ${c.numero} carregada. Você pode adicionar produtos à mesma venda.`,`ok`);
  }catch(e){console.error(e);avisar("Erro ao consultar a comanda. Verifique a conexão com o Firebase.");}
}


function configurarAbas(){
  const tabs=document.querySelectorAll(".pdv-tab");
  const comanda=$("painelComandaPDV"), produtosPainel=$("painelProdutosPDV"), entregaPainel=$("painelEntregaPDV");
  tabs.forEach(tab=>tab.addEventListener("click",()=>{
    tabs.forEach(t=>t.classList.remove("active")); tab.classList.add("active");
    const produtosAtivo=tab.dataset.tab==="produtos";
    const entregaAtivo=tab.dataset.tab==="entrega";
    comanda?.classList.toggle("pdv-tab-panel-hidden",produtosAtivo||entregaAtivo);
    produtosPainel?.classList.toggle("pdv-tab-panel-hidden",!produtosAtivo);
    entregaPainel?.classList.toggle("pdv-tab-panel-hidden",!entregaAtivo);
    if(produtosAtivo) $("buscaProdutoPDV")?.focus(); else if(entregaAtivo) $("telefoneClienteEntrega")?.focus(); else input.focus();
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
  el.innerHTML=lista.map(p=>`<button type="button" class="product-card" data-product="${p.id}">
    <strong>${p.nome||"Produto"}</strong>
    <span>${moeda(precoProduto(p))}</span>
    <small>${unidadeProduto(p)==="kg"?"por kg":"por unidade"}${p.categoria?" · "+p.categoria:""}</small>
  </button>`).join("");
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


function readJSON(key, fallback=[]){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}}
function saveJSON(key,value){localStorage.setItem(key,JSON.stringify(value))}
function limparTelefone(v){return String(v||"").replace(/\D/g,"")}
function itensParaDelivery(){
  const items=[];
  if(comandaAtual) items.push({name:comandaAtual.produto||"Refeição por peso",quantity:1,unitPrice:Number(comandaAtual.total||0),total:Number(comandaAtual.total||0),notes:"Comanda por peso"});
  itensProdutos.forEach(i=>items.push({name:i.nome,quantity:Number(i.quantidade||0),unitPrice:Number(i.preco||0),total:Number(i.preco||0)*Number(i.quantidade||0)}));
  return items;
}
function subtotalDelivery(){return itensParaDelivery().reduce((s,i)=>s+Number(i.total||0),0)}
function renderEntregaResumo(){
  const sub=subtotalDelivery(), taxa=Math.max(0,Number($("taxaEntregaPDV")?.value||0)), total=sub+taxa;
  const qtd=itensParaDelivery().reduce((s,i)=>s+Number(i.quantity||0),0);
  if($("entregaItensResumo")) $("entregaItensResumo").textContent=`${qtd} ${qtd===1?"item":"itens"}`;
  if($("entregaSubtotal")) $("entregaSubtotal").textContent=moeda(sub);
  if($("entregaTaxaResumo")) $("entregaTaxaResumo").textContent=moeda(taxa);
  if($("entregaTotalResumo")) $("entregaTotalResumo").textContent=moeda(total);
  return {sub,taxa,total};
}
function preencherClienteEntrega(c){
  $("nomeClienteEntrega").value=c.nome||""; $("whatsappClienteEntrega").value=c.whatsapp||c.telefone||"";
  $("telefoneClienteEntrega").value=c.telefone||c.whatsapp||""; $("cepClienteEntrega").value=c.cep||"";
  $("enderecoClienteEntrega").value=c.endereco||""; $("numeroClienteEntrega").value=c.numero||"";
  $("complementoClienteEntrega").value=c.complemento||""; $("bairroClienteEntrega").value=c.bairro||"";
  $("referenciaClienteEntrega").value=c.referencia||""; $("clienteEncontradoEntrega").innerHTML=`<i class="bi bi-person-check"></i> Cliente encontrado: <strong>${c.nome}</strong>`;
}
function dadosClienteEntrega(){return {nome:$("nomeClienteEntrega").value.trim(),telefone:$("telefoneClienteEntrega").value.trim(),whatsapp:$("whatsappClienteEntrega").value.trim(),cep:$("cepClienteEntrega").value.trim(),endereco:$("enderecoClienteEntrega").value.trim(),numero:$("numeroClienteEntrega").value.trim(),complemento:$("complementoClienteEntrega").value.trim(),bairro:$("bairroClienteEntrega").value.trim(),referencia:$("referenciaClienteEntrega").value.trim()}}
function salvarClienteEntrega(silencioso=false){
  const c=dadosClienteEntrega(), tel=limparTelefone(c.telefone||c.whatsapp);
  if(!c.nome){if(!silencioso) avisarEntrega("Informe o nome do cliente.");return null}
  if(!tel){if(!silencioso) avisarEntrega("Informe o telefone do cliente.");return null}
  let list=readJSON(CUSTOMERS_LOCAL_KEY,[]); const idx=list.findIndex(x=>limparTelefone(x.telefone||x.whatsapp)===tel);
  const obj={...c,telefone:c.telefone||c.whatsapp,atualizadoEm:new Date().toISOString()};
  if(idx>=0) list[idx]={...list[idx],...obj}; else list.unshift({...obj,criadoEm:new Date().toISOString()});
  saveJSON(CUSTOMERS_LOCAL_KEY,list.slice(0,500)); if(!silencioso) avisarEntrega("Cliente salvo no cadastro.","ok"); return obj;
}
function avisarEntrega(texto,tipo="err"){const el=$("mensagemEntrega");if(!el)return;el.textContent=texto;el.className=`message show ${tipo}`}
function buscarClienteEntrega(){
  const tel=limparTelefone($("telefoneClienteEntrega").value); if(!tel){avisarEntrega("Digite o telefone para buscar.");return}
  const list=readJSON(CUSTOMERS_LOCAL_KEY,[]); const c=list.find(x=>limparTelefone(x.telefone||x.whatsapp)===tel);
  if(!c){$("clienteEncontradoEntrega").innerHTML='<i class="bi bi-person-plus"></i> Cliente não cadastrado. Preencha os dados e salve.'; avisarEntrega("Cliente não encontrado. Você pode cadastrá-lo agora.","ok");return}
  preencherClienteEntrega(c); avisarEntrega("Cadastro carregado. Confira o endereço antes de enviar.","ok");
}
function criarPedidoEntrega(){
  const c=salvarClienteEntrega(true); if(!c){avisarEntrega("Preencha nome e telefone do cliente antes de criar o pedido.");return}
  const itens=itensParaDelivery(); if(!itens.length){avisarEntrega("Adicione pelo menos um produto ou carregue uma comanda.");return}
  const {sub,taxa,total}=renderEntregaResumo();
  const pagamentoEntrega=$("pagamentoEntregaPDV").value==='sim';
  const forma=$("formaPagamentoEntregaPDV").value;
  const seq=Number(localStorage.getItem("neoscale_delivery_sequence")||0)+1; localStorage.setItem("neoscale_delivery_sequence",String(seq));
  const id=`PDV-${String(seq).padStart(5,"0")}`;
  const order={id,source:"PDV",status:"NOVO",customer:c.nome,customerPhone:c.telefone||c.whatsapp,address:{cep:c.cep,endereco:c.endereco,numero:c.numero,complemento:c.complemento,bairro:c.bairro,referencia:c.referencia},items:itens,subtotal:sub,deliveryFee:taxa,total,paymentMethod:pagamentoEntrega?"Pagamento na entrega":forma,paymentAtDelivery:pagamentoEntrega,notes:$("observacaoEntregaPDV").value.trim(),createdAt:new Date().toISOString(),origin:"PDV"};
  const orders=readJSON(DELIVERY_LOCAL_KEY,[]); orders.unshift(order); saveJSON(DELIVERY_LOCAL_KEY,orders.slice(0,1000));
  avisarEntrega(`Pedido ${id} criado e enviado para a Central de Delivery.`,"ok");
  if(window.open){ const msg=`Olá, ${c.nome}! Seu pedido ${id} foi recebido. Total ${moeda(total)}. Estamos preparando seu pedido.`; const wa=limparTelefone(c.whatsapp||c.telefone); if(wa) setTimeout(()=>window.open(`https://wa.me/55${wa}?text=${encodeURIComponent(msg)}`,"_blank"),150); }
  setTimeout(()=>{limparVenda(); document.querySelector('[data-tab="entrega"]')?.click();},700);
}
function configurarDeliveryPDV(){
  $("btnBuscarClienteEntrega")?.addEventListener("click",buscarClienteEntrega);
  $("telefoneClienteEntrega")?.addEventListener("keydown",e=>{if(e.key==='Enter'){e.preventDefault();buscarClienteEntrega()}});
  $("btnSalvarClienteEntrega")?.addEventListener("click",()=>salvarClienteEntrega(false));
  $("btnCriarPedidoEntrega")?.addEventListener("click",criarPedidoEntrega);
  $("taxaEntregaPDV")?.addEventListener("input",renderEntregaResumo);
  ["nomeClienteEntrega","whatsappClienteEntrega","enderecoClienteEntrega","numeroClienteEntrega","complementoClienteEntrega","bairroClienteEntrega","referenciaClienteEntrega","observacaoEntregaPDV"].forEach(id=>$(id)?.addEventListener("input",renderEntregaResumo));
  renderEntregaResumo();
}

function calcularTroco(){
  if(pagamento!=="Dinheiro")return;
  const valor=Number(recebido.value||0), total=totalVenda(), troco=valor-total;
  $("troco").textContent=moeda(Math.max(0,troco)); finalizar.disabled=!(total>0&&valor>=total);
}

document.querySelectorAll(".pay-btn").forEach(btn=>btn.addEventListener("click",()=>{
  if(totalVenda()<=0)return;
  pagamento=btn.dataset.pay;
  document.querySelectorAll(".pay-btn").forEach(b=>b.classList.remove("selected"));btn.classList.add("selected");
  trocoBox.classList.toggle("show",pagamento==="Dinheiro");
  if(pagamento!=="Dinheiro")finalizar.disabled=false; else calcularTroco();
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
  finalizar.disabled=true;finalizar.innerHTML='<i class="bi bi-arrow-repeat"></i> FINALIZANDO...';
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
  }catch(e){console.error(e);finalizar.disabled=false;finalizar.innerHTML='<i class="bi bi-check-circle"></i> FINALIZAR VENDA';avisar(e.message||"Não foi possível finalizar a venda.");}
});

$("buscaProdutoPDV")?.addEventListener("input",renderProdutos);
btnBuscar.addEventListener("click",buscar);
input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();buscar();}});
$("btnLimpar").addEventListener("click",limparVenda);
const modal=$("modalCancel");
$("btnCancelar").addEventListener("click",()=>{if(comandaAtual||itensProdutos.length)modal.classList.add("show");});
$("fecharModal").addEventListener("click",()=>modal.classList.remove("show"));
$("confirmarCancelar").addEventListener("click",()=>{modal.classList.remove("show");limparVenda();avisar("Venda limpa do atendimento.","ok");});
window.addEventListener("keydown",e=>{
  if(e.key==="F2"){e.preventDefault();input.focus();input.select();}
  if(e.key==="F6"){e.preventDefault();document.querySelector(".pay-btn")?.focus();}
  if(e.key==="Escape"){if($("modalFiscalVenda")?.hidden===false){$("modalFiscalVenda").hidden=true; concluirVendaComOpcaoFiscal(false); return;} modal.classList.remove("show");limparVenda();}
  if(e.key==="F8"){e.preventDefault();if(comandaAtual||itensProdutos.length)modal.classList.add("show");}
});
function relogio(){$("relogio").textContent=new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});}
relogio();setInterval(relogio,1000);configurarAbas();configurarDeliveryPDV();atualizarCaixa();carregarProdutos();input.focus();
