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
function imprimirRelatorioDelivery(caixa,movs,resumo,contado){
 const agora=new Date();
 const dataHora=d=>d?new Date(d).toLocaleString('pt-BR'):'—';
 const dataItem=v=>v?.toDate?dataHora(v.toDate()):v?dataHora(v):'—';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const vendas=vendasLocais();
 const totalVendas=vendas.reduce((a,v)=>a+Number(v.total||0),0);
 const recebDin=vendas.filter(v=>v.pagamento==='Dinheiro').reduce((a,v)=>a+Number(v.total||0),0);
 const emEntregadores=vendas.filter(v=>v.pagamento==='Dinheiro'&&v.recebimento==='ENTREGA'&&v.entregador).reduce((a,v)=>a+Number(v.total||0),0);
 const aReceber=vendas.filter(v=>v.status!=='CONCLUIDO').reduce((a,v)=>a+Number(v.total||0),0);
 const plataformas={IFOOD:0,'99FOOD':0,'ANOTA AI':0,BALCÃO:0};
 cfgOrders().filter(o=>['CONCLUIDO','ENTREGA','PRONTO','PREPARO','NOVO'].includes(o.status)).forEach(o=>{
   const raw=String(o.plataforma||o.platform||o.origem||o.canal||o.source||'BALCÃO').toUpperCase();
   const k=raw.includes('99')?'99FOOD':raw.includes('ANOTA')?'ANOTA AI':raw.includes('IFOOD')?'IFOOD':'BALCÃO';
   plataformas[k]+=Number(o.total||o.valor||0);
 });
 const porForma={DINHEIRO:0,PIX:0,'CRÉDITO':0,'DÉBITO':0,ONLINE:0,OUTROS:0};
 vendas.forEach(v=>{const k=String(v.pagamento||'Outros').toUpperCase(); porForma[k]=(porForma[k]||0)+Number(v.total||0);});
 const dif=Number(contado||0)-Number(resumo.esperado||0);
 const linha=(label,value)=>`<div class="row"><span>${esc(label)}</span><span>${money(value)}</span></div>`;
 const linhasPlataforma=Object.entries(plataformas).map(([k,v])=>linha(k,v)).join('');
 const linhasForma=Object.entries(porForma).map(([k,v])=>linha(k,v)).join('');
 const popup=window.open('','_blank','width=520,height=850');
 if(!popup){alert('O navegador bloqueou o relatório. Permita pop-ups para o NeoScale.');return;}
 popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NeoScale — Fechamento Caixa Delivery</title><style>
 *{box-sizing:border-box}body{margin:0;background:#e9e9e9;color:#000;font-family:"Courier New",Courier,monospace;font-size:13px;font-weight:700}.sheet{width:80mm;min-height:100vh;margin:16px auto;background:#fff;padding:12px 10px 20px;box-shadow:0 2px 10px #0002}.center{text-align:center}.brand{font-size:19px;font-weight:900;letter-spacing:.4px}.title{font-size:12px;font-weight:900;margin-top:3px}.sep{border-top:1px dashed #000;margin:8px 0}.section{font-weight:900;font-size:13px;margin:6px 0 4px}.row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;line-height:1.35;margin:2px 0}.row span:last-child{text-align:right;white-space:nowrap}.total{font-weight:900;font-size:14px}.signature{margin-top:48px;padding-top:10px;min-height:125px;text-align:center}.signature-line{border-top:1.5px solid #000;margin:0 3px;padding-top:7px}.signature .name{margin-top:10px}.signature .date{margin-top:8px}.actions{position:fixed;right:20px;top:20px;display:flex;gap:8px}.actions button{border:0;border-radius:8px;padding:9px 12px;background:#008f70;color:#fff;font-weight:800;cursor:pointer}.actions .close{background:#222}@media(max-width:700px){.sheet{margin:0;width:80mm;box-shadow:none}.actions{position:sticky;top:0;justify-content:center;background:#fff;padding:8px;margin:0 -10px 8px}.actions button{font-family:Arial,sans-serif}}@media print{body{background:#fff}.sheet{margin:0;box-shadow:none;width:80mm;padding:0 8px 20px}.actions{display:none!important}}
 </style></head><body><div class="sheet"><div class="actions no-print"><button onclick="window.print()">IMPRIMIR</button><button class="close" onclick="window.close()">FECHAR</button></div>
 <div class="center"><div class="brand">NEOSCALE</div><div class="title">RELATÓRIO DE FECHAMENTO — CAIXA DELIVERY</div></div>
 <div class="sep"></div><div>GERADO: ${esc(dataHora(agora))}</div><div>OPERADOR: ${esc(caixa.operador||'OPERADOR')}</div><div>ABERTURA: ${esc(dataItem(caixa.abertoEm))}</div><div>FECHAMENTO: ${esc(dataHora(agora))}</div>
 <div class="sep"></div><div class="section">RESUMO</div>${linha('Pedidos',vendas.length)}${linha('Vendas',totalVendas)}${linha('Recebido',totalVendas)}${linha('Em posse entregadores',emEntregadores)}${linha('A receber',aReceber)}
 <div class="sep"></div><div class="section">VENDAS POR PLATAFORMA</div>${linhasPlataforma}<div class="sep"></div><div class="row total"><span>TOTAL</span><span>${money(totalVendas)}</span></div>
 <div class="sep"></div><div class="section">RECEBIMENTOS</div>${linhasForma}<div class="sep"></div><div class="row total"><span>TOTAL</span><span>${money(totalVendas)}</span></div>
 <div class="sep"></div><div class="section">CONFERÊNCIA</div>${linha('Esperado',resumo.esperado)}${linha('Contado',contado)}<div class="row total"><span>DIFERENÇA</span><span>${money(dif)}</span></div>
 <div class="sep"></div><div class="row total"><span>TOTAL DO CAIXA DELIVERY</span><span>${money(totalVendas)}</span></div>
 <div class="signature"><div class="signature-line">ASSINATURA DO OPERADOR</div><div class="name">Nome: ${esc(caixa.operador||'OPERADOR')}</div><div class="date">Data: ____/____/________</div></div>
 </div></body></html>`);
 popup.document.close();
}
async function fechar(){
 if(!atual)return;
 const r=resumo(), contado=Number($("valorContado").value||0);
 if(contado<0)return;
 if(!confirm(`Fechar Caixa Delivery?\nEsperado: ${br(r.esperado)}\nContado: ${br(contado)}\nDiferença: ${br(contado-r.esperado)}`))return;
 await updateDoc(doc(db,CAIXAS,atual.id),{status:"FECHADO",valorContado:contado,valorEsperadoDinheiro:r.esperado,diferenca:contado-r.esperado,observacao:$("observacaoFechamento").value.trim(),totalVendas:r.vendas,fechadoEm:serverTimestamp()});
 imprimirRelatorioDelivery(atual,movimentos,r,contado); alert("Caixa Delivery fechado com sucesso."); $("valorContado").value=""; $("observacaoFechamento").value=""; atual=null; await carregar();
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
  const aberto=!!atual; $("btnAbrir").hidden=aberto; $("btnFechar").hidden=!aberto; const btnFecharPainel=$("btnFecharPainel"); if(btnFecharPainel){btnFecharPainel.hidden=!aberto;btnFecharPainel.disabled=!aberto;}
  $("statusBadge").className="cd-status"+(aberto?" open":""); $("statusBadge").innerHTML=`<i class="bi bi-circle-fill"></i> ${aberto?"CAIXA ABERTO":"CAIXA FECHADO"}`;
  $("movForm").hidden=!aberto;
  render(); await historico();
 }catch(e){console.error(e);$("msg").innerHTML=`<div class="alert err">Não foi possível acessar o Caixa Delivery. <small>${esc(e?.message||"Erro desconhecido")}</small></div>`}
}
$("btnAbrir").onclick=async()=>{try{await abrir();await carregar()}catch(e){alert(e.message||"Não foi possível abrir o caixa.")}};
$("btnFechar").onclick=fechar; const btnFecharPainel=$("btnFecharPainel"); if(btnFecharPainel) btnFecharPainel.onclick=fechar; $("btnMov").onclick=()=>$("movForm").hidden=!$("movForm").hidden; $("btnSalvarMov").onclick=salvarMov; $("valorContado").oninput=render;
carregar();
