import { db, auth } from "./firebase.js";
import { collection, addDoc, getDocs, query, orderBy, limit, doc, getDoc, setDoc, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const el=id=>document.getElementById(id);
const dinheiro=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
let documentos=[];
let filtro="todos";

const campos=["razaoSocial","nomeFantasia","cnpj","ie","uf","municipio","endereco","ambiente","serie","numeroAtual","idToken","csc"];

async function carregarConfiguracao(){
    try{
        const snap=await getDoc(doc(db,"configuracoes","fiscal"));
        if(!snap.exists()) return atualizarStatus();
        const d=snap.data();
        campos.forEach(id=>{if(el(id) && d[id]!==undefined) el(id).value=d[id];});
        atualizarStatus();
    }catch(e){console.warn("Configuração fiscal indisponível",e);}
}

function atualizarStatus(){
    const cnpj=(el("cnpj")?.value||"").replace(/\D/g,"");
    const ie=(el("ie")?.value||"").trim();
    const uf=(el("uf")?.value||"").trim();
    const status=el("fiscalStatus");
    if(cnpj.length===14 && ie && uf){status.textContent="Dados fiscais preenchidos";status.className="fiscal-status status-ok";}
    else {status.textContent="Configuração pendente";status.className="fiscal-status status-config";}
}

async function salvar(){
    const dados={};
    ["razaoSocial","nomeFantasia","cnpj","ie","uf","municipio","endereco","ambiente","serie","numeroAtual","idToken"].forEach(id=>dados[id]=el(id)?.value?.trim?.() ?? el(id)?.value ?? "");
    dados.serie=Number(dados.serie||1); dados.numeroAtual=Number(dados.numeroAtual||1);
    dados.cscConfigurado=Boolean((el("csc")?.value||"").trim());
    dados.atualizadoEm=serverTimestamp(); dados.atualizadoPor=auth.currentUser?.uid||null;
    try{await setDoc(doc(db,"configuracoes","fiscal"),dados,{merge:true}); atualizarStatus(); alert("Configuração fiscal salva.");}
    catch(e){console.error(e);alert("Não foi possível salvar a configuração fiscal.");}
}

function statusLabel(s){return s==="AUTORIZADA"?"autorizada":s==="REJEITADA"?"rejeitada":s==="CANCELADA"?"cancelada":"pendente";}
function render(){
    const lista=documentos.filter(d=>filtro==="todos" || statusLabel(d.status)===filtro);
    el("listaDocumentos").innerHTML=lista.length?lista.map(d=>`<tr><td>${d.numero??"—"}</td><td>${d.serie??"—"}</td><td>#${d.vendaNumero??"—"}</td><td>${formatarData(d.criadoEm)}</td><td>${dinheiro(d.valor)}</td><td>${d.ambiente==="producao"?"Produção":"Homologação"}</td><td><span class="badge-status badge-${statusLabel(d.status)}">${d.status||"PENDENTE"}</span></td><td><button class="acao-fiscal" type="button" data-id="${d.id}" title="Ver detalhes"><i class="bi bi-eye"></i></button></td></tr>`).join(""):'<tr><td colspan="8" class="empty">Nenhum documento encontrado.</td></tr>';
    document.querySelectorAll(".acao-fiscal").forEach(b=>b.addEventListener("click",()=>abrirDetalhe(b.dataset.id)));
}
function formatarData(v){if(!v)return "—";const d=v.toDate?v.toDate():new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleString("pt-BR");}
async function carregarDocumentos(){
    try{const snap=await getDocs(query(collection(db,"documentosFiscais"),orderBy("criadoEm","desc"),limit(200)));documentos=snap.docs.map(d=>({id:d.id,...d.data()}));render();}
    catch(e){console.warn("Histórico fiscal indisponível",e);el("listaDocumentos").innerHTML='<tr><td colspan="8" class="empty">Não foi possível carregar o histórico fiscal.</td></tr>';}
}
function abrirDetalhe(id){
    const d=documentos.find(x=>x.id===id);if(!d)return;
    el("conteudoFiscal").innerHTML=`<div class="fiscal-detail"><span class="kicker">DOCUMENTO FISCAL</span><h3>NFC-e ${d.numero||"—"}</h3><div class="detail-grid"><div class="detail-box"><small>Status</small><strong>${d.status||"PENDENTE"}</strong></div><div class="detail-box"><small>Valor</small><strong>${dinheiro(d.valor)}</strong></div><div class="detail-box"><small>Venda</small><strong>#${d.vendaNumero||"—"}</strong></div><div class="detail-box"><small>Ambiente</small><strong>${d.ambiente||"homologacao"}</strong></div></div><div class="detail-note">${d.mensagem||"Documento registrado pelo NeoScale. A autorização real da SEFAZ ainda depende da integração fiscal configurada."}</div></div>`;
    el("modalFiscal").hidden=false;
}

document.querySelectorAll(".filtro").forEach(b=>b.addEventListener("click",()=>{filtro=b.dataset.filtro;document.querySelectorAll(".filtro").forEach(x=>x.classList.remove("active"));b.classList.add("active");render();}));
el("btnSalvarFiscal")?.addEventListener("click",salvar);
el("fecharFiscal")?.addEventListener("click",()=>el("modalFiscal").hidden=true);
el("modalFiscal")?.addEventListener("click",e=>{if(e.target===el("modalFiscal"))el("modalFiscal").hidden=true;});
el("btnSair")?.addEventListener("click",async()=>{try{await auth.signOut();location.href="index.html";}catch(e){console.error(e);}});
["cnpj","ie","uf"].forEach(id=>el(id)?.addEventListener("input",atualizarStatus));
carregarConfiguracao();carregarDocumentos();


/** Registra a intenção de emissão da NFC-e após uma venda finalizada.
 * A autorização real da SEFAZ continua dependendo do backend fiscal.
 */
export async function registrarCupomFiscal(venda = {}) {
    const configSnap = await getDoc(doc(db, "configuracoes", "fiscal"));
    const config = configSnap.exists() ? configSnap.data() : {};
    const serie = Number(config.serie || 1);

    const numero = await runTransaction(db, async (transaction) => {
        const ref = doc(db, "configuracoes", "fiscal");
        const snap = await transaction.get(ref);
        const dados = snap.exists() ? snap.data() : {};
        const atual = Number(dados.numeroAtual || 1);
        transaction.set(ref, { numeroAtual: atual + 1, atualizadoEm: serverTimestamp() }, { merge: true });
        return atual;
    });

    const ref = await addDoc(collection(db, "documentosFiscais"), {
        tipo: "NFC-e",
        modelo: 65,
        numero,
        serie,
        vendaNumero: venda.numeroComanda || venda.numeroVenda || null,
        vendaId: venda.vendaId || venda.comandaId || null,
        valor: Number(venda.total || 0),
        pagamento: venda.pagamento || null,
        itens: Array.isArray(venda.itens) ? venda.itens : [],
        ambiente: config.ambiente || "homologacao",
        status: "PENDENTE",
        criadoEm: serverTimestamp(),
        mensagem: "Cupom solicitado pelo cliente. A autorização real depende da integração fiscal com a SEFAZ."
    });

    return { id: ref.id, numero, serie, ambiente: config.ambiente || "homologacao", status: "PENDENTE" };
}
