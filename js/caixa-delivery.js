import { db } from "./firebase.js";
import { collection, addDoc, query, where, orderBy, limit, getDocs, updateDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CAIXAS="caixasDelivery", MOV="movimentosCaixaDelivery", ACERTOS="acertosEntregadores";
const $=id=>document.getElementById(id);
const br=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
let atual=null, movimentos=[], orders=[], entregadores=[];

function data(v){return v?.toDate?v.toDate():v?new Date(v):null}
function esc(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]))}
function form(v){let x=String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");if(x.includes("dinheiro"))return"Dinheiro";if(x.includes("pix"))return"PIX";if(x.includes("debito"))return"Débito";if(x.includes("credito"))return"Crédito";if(x.includes("online"))return"Online";return"Outros"}
function cfgOrders(){try{return JSON.parse(localStorage.getItem("neoscale_delivery_orders")||"[]")}catch{return[]}}
async function caixaAberto(){
 const q=query(collection(db,CAIXAS),where("status","==","ABERTO"));
 const s=await getDocs(q);
 if(s.empty)return null;
 const rows=s.docs.map(d=>({id:d.id,...d.data()}));
 rows.sort((a,b)=>(data(b.abertoEm)?.getTime()||0)-(data(a.abertoEm)?.getTime()||0));
 return rows[0];
}
async function abrir(){
 if(await caixaAberto()) throw new Error("Já existe um Caixa Delivery aberto.");
 const valor=Math.max(0,Number(prompt("Saldo inicial do Caixa Delivery:","0")||0));
 const operador=prompt("Operador responsável:","Operador")||"Operador";
 const r=await addDoc(collection(db,CAIXAS),{tipo:"DELIVERY",operador,valorInicial:valor,status:"ABERTO",abertoEm:serverTimestamp(),fechadoEm:null});
 atual={id:r.id,tipo:"DELIVERY",operador,valorInicial:valor,status:"ABERTO"};
}
async function movs(){
 if(!atual)return[];
 const q=query(collection(db,MOV),where("caixaId","==",atual.id));
 const s=await getDocs(q);
 const rows=s.docs.map(d=>({id:d.id,...d.data()}));
 rows.sort((a,b)=>(data(b.criadoEm)?.getTime()||0)-(data(a.criadoEm)?.getTime()||0));
 return rows;
}
function vendasLocais(){
 return cfgOrders().filter(o=>["CONCLUIDO","ENTREGA","PRONTO","PREPARO","NOVO"].includes(o.status)).map(o=>({
   id:o.id, total:Number(o.total||o.valor||0), pagamento:form(o.pagamento||o.formaPagamento||o.paymentMethod),
   status:o.status, entregador:o.entregador?.nome||o.entregador||"", recebimento:o.recebimento||((form(o.pagamento||o.formaPagamento)==="Dinheiro")?"ENTREGA":"ONLINE")
 }));
}
function resumo(){
 const vendas=vendasLocais();
 const pay={Dinheiro:0,PIX:0,"Débito":0,"Crédito":0,Online:0,Outros:0};
 vendas.forEach(v=>pay[v.pagamento]=(pay[v.pagamento]||0)+v.total);
 const entrada=movimentos.filter(m=>["VENDA","SUPRIMENTO","AJUSTE"].includes(m.tipo)).reduce((a,m)=>a+Number(m.valor||0),0);
 const saida=movimentos.filter(m=>["SANGRIA","DESPESA"].includes(m.tipo)).reduce((a,m)=>a+Number(m.valor||0),0);
 const vendasMov=movimentos.filter(m=>m.tipo==="VENDA").reduce((a,m)=>a+Number(m.valor||0),0);
 const sourceVendas=vendas.length?vendas.reduce((a,v)=>a+v.total,0):vendasMov;
 const dinheiro=vendas.length?pay.Dinheiro:movimentos.filter(m=>m.tipo==="VENDA"&&form(m.forma)==="Dinheiro").reduce((a,m)=>a+Number(m.valor||0),0);
 const online=vendas.length?vendas.filter(v=>["PIX","Online","Débito","Crédito"].includes(v.pagamento)).reduce((a,v)=>a+v.total,0):0;
 const emEnt= v=>vendas.filter(x=>x.pagamento==="Dinheiro" && x.recebimento==="ENTREGA" && x.entregador).reduce((a,x)=>a+x.total,0);
 return {pay,entrada,saida,vendas:sourceVendas,dinheiro,online,emEnt:emEnt(),esperado:Number(atual?.valorInicial||0)+dinheiro+movimentos.filter(m=>m.tipo==="SUPRIMENTO").reduce((a,m)=>a+Number(m.valor||0),0)-movimentos.filter(m=>m.tipo==="SANGRIA"||m.tipo==="DESPESA").reduce((a,m)=>a+Number(m.valor||0),0)}
}
function render(){
 const r=resumo();
 $("saldoInicial").textContent=br(atual?.valorInicial);
 $("totalVendas").textContent=br(r.vendas); $("totalEntradas").textContent=br(r.entrada); $("totalSaidas").textContent=br(r.saida);
 $("dinheiroEsperado").textContent=br(r.esperado); $("emEntregadores").textContent=br(r.emEnt);
 $("payDinheiro").textContent=br(r.pay.Dinheiro); $("payPix").textContent=br(r.pay.PIX); $("payDebito").textContent=br(r.pay["Débito"]); $("payCredito").textContent=br(r.pay["Crédito"]); $("payOnline").textContent=br(r.pay.Online); $("payOutros").textContent=br(r.pay.Outros);
 $("recOnline").textContent=br(r.online);
 $("recEntrega").textContent=br(vendasLocais().filter(v=>v.recebimento==="ENTREGA").reduce((a,v)=>a+v.total,0));
 $("recRetirada").textContent=br(vendasLocais().filter(v=>v.recebimento==="RETIRADA").reduce((a,v)=>a+v.total,0));
 $("recAberto").textContent=br(vendasLocais().filter(v=>v.status!=="CONCLUIDO").reduce((a,v)=>a+v.total,0));
 $("fechEsperado").textContent=br(r.esperado);
 const contado=Number($("valorContado").value||0), dif=contado-r.esperado; $("fechDiferenca").textContent=br(dif); $("fechDiferenca").className=dif===0?"positive":dif<0?"negative":"positive";
 renderMov(); renderEntregadores();
}
function renderMov(){
 const body=$("tabelaMov"); if(!movimentos.length){body.innerHTML='<tr><td colspan="4" class="empty">Nenhuma movimentação.</td></tr>';return}
 body.innerHTML=movimentos.slice(0,30).map(m=>`<tr><td>${esc(m.tipo)}</td><td>${esc(m.descricao||"—")}</td><td>${esc(m.forma||"—")}</td><td>${br(m.valor)}</td></tr>`).join("");
}
function renderEntregadores(){
 const map={}; vendasLocais().filter(v=>v.entregador).forEach(v=>{const n=v.entregador;map[n]??={pedidos:0,din:0,pix:0};map[n].pedidos++;if(v.pagamento==="Dinheiro")map[n].din+=v.total;if(v.pagamento==="PIX")map[n].pix+=v.total});
 const body=$("tabelaEntregadores"); const rows=Object.entries(map);
 if(!rows.length){body.innerHTML='<tr><td colspan="6" class="empty">Nenhum valor pendente.</td></tr>';return}
 body.innerHTML=rows.map(([n,x])=>{const ac=x.din;return `<tr><td><strong>${esc(n)}</strong></td><td>${x.pedidos}</td><td>${br(x.din)}</td><td>${br(x.pix)}</td><td><strong>${br(ac)}</strong></td><td>${ac?`<button class="settle" data-ent="${esc(n)}" data-val="${ac}">Acertar ${br(ac)}</button>`:"—"}</td></tr>`}).join("");
 body.querySelectorAll(".settle").forEach(b=>b.onclick=()=>acertar(b.dataset.ent,Number(b.dataset.val)));
}
async function acertar(nome,valor){
 if(!atual)return;
 if(!confirm(`Confirmar acerto de ${br(valor)} com ${nome}?`))return;
 await addDoc(collection(db,ACERTOS),{caixaId:atual.id,entregador:nome,valor,forma:"Dinheiro",responsavel:atual.operador,criadoEm:serverTimestamp()});
 await addDoc(collection(db,MOV),{caixaId:atual.id,tipo:"VENDA",valor,forma:"Dinheiro",descricao:`Acerto entregador ${nome}`,referencia:"ACERTO",criadoEm:serverTimestamp()});
 alert("Acerto registrado.");
 await carregar();
}
async function salvarMov(){
 if(!atual){alert("Abra o Caixa Delivery primeiro.");return}
 const valor=Number($("movValor").value||0); if(valor<=0){alert("Informe um valor válido.");return}
 await addDoc(collection(db,MOV),{caixaId:atual.id,tipo:$("movTipo").value,forma:$("movForma").value,valor,descricao:$("movDescricao").value.trim(),criadoEm:serverTimestamp()});
 $("movValor").value="";$("movDescricao").value="";await carregar();
}
async function fechar(){
 if(!atual)return;
 const r=resumo(), contado=Number($("valorContado").value||0);
 if(contado<0)return;
 if(!confirm(`Fechar Caixa Delivery?\nEsperado: ${br(r.esperado)}\nContado: ${br(contado)}\nDiferença: ${br(contado-r.esperado)}`))return;
 await updateDoc(doc(db,CAIXAS,atual.id),{status:"FECHADO",valorContado:contado,diferenca:contado-r.esperado,observacao:$("observacaoFechamento").value.trim(),totalVendas:r.vendas,fechadoEm:serverTimestamp()});
 alert("Caixa Delivery fechado com sucesso."); $("valorContado").value=""; $("observacaoFechamento").value=""; atual=null; await carregar();
}
async function historico(){
 const q=query(collection(db,CAIXAS),where("tipo","==","DELIVERY")); const s=await getDocs(q);
 const body=$("historicoCaixas"); if(s.empty){body.innerHTML='<tr><td colspan="6" class="empty">Nenhum fechamento registrado.</td></tr>';return}
 const rows=s.docs.map(d=>({id:d.id,...d.data()}));
 rows.sort((a,b)=>(data(b.abertoEm)?.getTime()||0)-(data(a.abertoEm)?.getTime()||0));
 body.innerHTML=rows.slice(0,30).map(c=>`<tr><td>${esc(data(c.abertoEm)?.toLocaleString("pt-BR")||"—")}</td><td>${esc(data(c.fechadoEm)?.toLocaleString("pt-BR")||"—")}</td><td>${esc(c.operador||"—")}</td><td>${br(c.totalVendas||0)}</td><td>${br(c.valorContado||0)}</td><td>${esc(c.status||"—")}</td></tr>`).join("");
}
async function carregar(){
 try{
  atual=await caixaAberto(); movimentos=await movs();
  const aberto=!!atual; $("btnAbrir").hidden=aberto; $("btnFechar").hidden=!aberto;
  $("statusBadge").className="cd-status"+(aberto?" open":""); $("statusBadge").innerHTML=`<i class="bi bi-circle-fill"></i> ${aberto?"CAIXA ABERTO":"CAIXA FECHADO"}`;
  $("movForm").hidden=!aberto;
  render(); await historico();
 }catch(e){console.error(e);$("msg").innerHTML=`<div class="alert err">Não foi possível acessar o Caixa Delivery. <small>${esc(e?.message||"Erro desconhecido")}</small></div>`}
}
$("btnAbrir").onclick=async()=>{try{await abrir();await carregar()}catch(e){alert(e.message||"Não foi possível abrir o caixa.")}};
$("btnFechar").onclick=fechar; $("btnMov").onclick=()=>$("movForm").hidden=!$("movForm").hidden; $("btnSalvarMov").onclick=salvarMov; $("valorContado").oninput=render;
carregar();
