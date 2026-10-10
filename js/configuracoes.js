import { db } from "./firebase.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const campos = {
    nomeRestaurante: document.getElementById("nomeRestaurante"),
    precoPadrao: document.getElementById("precoPadrao"),
    impressora: document.getElementById("impressora"),
    larguraPapel: document.getElementById("larguraPapel"),
    modeloBalanca: document.getElementById("modeloBalanca"),
    modoImpressao: document.getElementById("modoImpressao"),
    servidorImpressao: document.getElementById("servidorImpressao"),
    chaveServidorImpressao: document.getElementById("chaveServidorImpressao"),
    ipImpressora: document.getElementById("ipImpressora"),
    portaImpressora: document.getElementById("portaImpressora"),
    mensagemComanda: document.getElementById("mensagemComanda"),
    temaQuiosque: document.getElementById("temaQuiosque")
};

const botaoSalvar = document.getElementById("btnSalvarConfiguracao");
const iniciarPesagem = document.getElementById("iniciarPesagem");
const btnTestarImpressora = document.getElementById("btnTestarImpressora");

function obterDadosFormulario() {
    const preco = campos.precoPadrao.value.trim();
    return {
        restaurante: campos.nomeRestaurante.value.trim(),
        precoKg: preco === "" ? 0 : Number(preco),
        impressora: campos.impressora.value.trim(),
        larguraPapel: campos.larguraPapel.value || "80",
        balanca: campos.modeloBalanca.value.trim(),
        modoImpressao: campos.modoImpressao.value || "navegador",
        servidorImpressao: campos.servidorImpressao.value.trim(),
        chaveServidorImpressao: campos.chaveServidorImpressao.value.trim(),
        ipImpressora: campos.ipImpressora.value.trim(),
        portaImpressora: Math.min(65535, Math.max(1, Number(campos.portaImpressora.value || 9100))),
        mensagem: campos.mensagemComanda.value.trim(),
        temaQuiosque: campos.temaQuiosque.value,
        atualizadoEm: new Date()
    };
}

async function salvarConfiguracao() {
    const dados = obterDadosFormulario();
    if (!Number.isFinite(dados.precoKg) || dados.precoKg < 0) {
        alert("Informe um preço por kg válido.");
        campos.precoPadrao.focus();
        return;
    }

    botaoSalvar.disabled = true;
    const textoOriginal = botaoSalvar.innerHTML;
    botaoSalvar.textContent = "Salvando...";

    try {
        await setDoc(doc(db, "configuracoes", "principal"), dados, { merge: true });
        localStorage.setItem("neoscale-tema-quiosque", dados.temaQuiosque);
        alert("Configurações salvas!");
    } catch (erro) {
        console.error("Não foi possível salvar as configurações:", erro);
        alert("Não foi possível salvar as configurações. Verifique sua conexão e tente novamente.");
    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.innerHTML = textoOriginal;
    }
}

async function carregarConfiguracao() {
    try {
        const resultado = await getDoc(doc(db, "configuracoes", "principal"));
        const dados = resultado.exists() ? resultado.data() : {};
        campos.nomeRestaurante.value = dados.restaurante || "";
        campos.precoPadrao.value = dados.precoKg ?? "";
        campos.impressora.value = dados.impressora || "";
        campos.larguraPapel.value = String(dados.larguraPapel || "80");
        campos.modeloBalanca.value = dados.balanca || "";
        campos.modoImpressao.value = dados.modoImpressao || "navegador";
        campos.servidorImpressao.value = dados.servidorImpressao || "";
        campos.chaveServidorImpressao.value = dados.chaveServidorImpressao || "";
        campos.ipImpressora.value = dados.ipImpressora || "";
        campos.portaImpressora.value = dados.portaImpressora || 9100;
        campos.mensagemComanda.value = dados.mensagem || "";
        campos.temaQuiosque.value = dados.temaQuiosque || localStorage.getItem("neoscale-tema-quiosque") || "azul";
    } catch (erro) {
        console.error("Não foi possível carregar as configurações:", erro);
    }
}

botaoSalvar?.addEventListener("click", salvarConfiguracao);
campos.temaQuiosque?.addEventListener("change", () => localStorage.setItem("neoscale-tema-quiosque", campos.temaQuiosque.value));
iniciarPesagem?.addEventListener("click", () => window.location.assign("pesagem.html"));
btnTestarImpressora?.addEventListener("click", async () => {
    const botao = btnTestarImpressora;
    const original = botao.innerHTML;
    try {
        botao.disabled = true;
        botao.textContent = "Preparando teste...";
        window.imprimirReciboVenda?.({
            teste: true,
            total: 10.00,
            pagamento: "Dinheiro",
            recebido: 20.00,
            troco: 10.00,
            numeroComanda: "TESTE",
            itens: [{ nome: "Teste de impressão", quantidade: 1, preco: 10.00 }]
        });
    } catch (erro) {
        console.error(erro);
        alert("Não foi possível iniciar o teste de impressão.");
    } finally {
        setTimeout(() => { botao.disabled = false; botao.innerHTML = original; }, 800);
    }
});
carregarConfiguracao();

// =========================================================
// GERENCIAMENTO DE IMPRESSORAS E BALANÇAS
// =========================================================
const listaImpressorasConfig = document.getElementById("listaImpressorasConfig");
const listaBalancasConfig = document.getElementById("listaBalancasConfig");
const btnAdicionarImpressora = document.getElementById("btnAdicionarImpressora");
const btnAdicionarBalanca = document.getElementById("btnAdicionarBalanca");

let impressorasConfig = [];
let balancasConfig = [];

async function carregarEquipamentos() {
    try {
        const snap = await getDoc(doc(db, "configuracoes", "equipamentos"));
        const dados = snap.exists() ? snap.data() : {};
        impressorasConfig = Array.isArray(dados.impressoras) ? dados.impressoras : [];
        balancasConfig = Array.isArray(dados.balancas) ? dados.balancas : [];
    } catch (e) {
        console.error("Erro ao carregar equipamentos:", e);
        impressorasConfig = [];
        balancasConfig = [];
    }
    renderEquipamentos();
}

function renderEquipamentos() {
    if (listaImpressorasConfig) {
        listaImpressorasConfig.innerHTML = impressorasConfig.length ? impressorasConfig.map((x,i)=>`
            <div class="device-row" data-index="${i}">
                <div><label>Nome</label><input data-field="nome" value="${esc(x.nome)}" placeholder="Impressora 01"></div>
                <div><label>IP</label><input data-field="ip" value="${esc(x.ip)}" placeholder="192.168.1.100"></div>
                <div><label>Porta</label><input data-field="porta" type="number" min="1" max="65535" value="${Number(x.porta)||9100}"></div>
                <div><label>Status</label><select data-field="ativa"><option value="true" ${x.ativa!==false?'selected':''}>Ativa</option><option value="false" ${x.ativa===false?'selected':''}>Inativa</option></select></div>
                <div class="device-actions"><button class="device-save" type="button" data-save-printer="${i}"><i class="bi bi-check2"></i> Salvar</button><button class="device-delete" type="button" data-delete-printer="${i}"><i class="bi bi-trash"></i></button></div>
            </div>`).join("") : '<div class="device-empty">Nenhuma impressora cadastrada. Clique em “Adicionar impressora”.</div>';
    }
    if (listaBalancasConfig) {
        listaBalancasConfig.innerHTML = balancasConfig.length ? balancasConfig.map((x,i)=>`
            <div class="device-row scale" data-index="${i}">
                <div><label>Nome</label><input data-field="nome" value="${esc(x.nome)}" placeholder="Balança 01"></div>
                <div><label>Modelo / conexão</label><input data-field="modelo" value="${esc(x.modelo)}" placeholder="Toledo / USB / Serial"></div>
                <div><label>Status</label><select data-field="ativa"><option value="true" ${x.ativa!==false?'selected':''}>Ativa</option><option value="false" ${x.ativa===false?'selected':''}>Inativa</option></select></div>
                <div class="device-actions"><button class="device-save" type="button" data-save-scale="${i}"><i class="bi bi-check2"></i> Salvar</button><button class="device-delete" type="button" data-delete-scale="${i}"><i class="bi bi-trash"></i></button></div>
            </div>`).join("") : '<div class="device-empty">Nenhuma balança cadastrada. Clique em “Adicionar balança”.</div>';
    }
}

function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

async function salvarEquipamentos(){
    await setDoc(doc(db,"configuracoes","equipamentos"),{impressoras:impressorasConfig,balancas:balancasConfig,atualizadoEm:new Date()},{merge:true});
    renderEquipamentos();
}

btnAdicionarImpressora?.addEventListener("click",()=>{impressorasConfig.push({nome:`Impressora ${String(impressorasConfig.length+1).padStart(2,"0")}`,ip:"",porta:9100,ativa:true});renderEquipamentos();});
btnAdicionarBalanca?.addEventListener("click",()=>{balancasConfig.push({nome:`Balança ${String(balancasConfig.length+1).padStart(2,"0")}`,modelo:"",ativa:true});renderEquipamentos();});

listaImpressorasConfig?.addEventListener("click",async e=>{
    const save=e.target.closest("[data-save-printer]"), del=e.target.closest("[data-delete-printer]");
    if(save){const i=Number(save.dataset.savePrinter), row=save.closest(".device-row"); impressorasConfig[i]={nome:row.querySelector('[data-field="nome"]').value.trim(),ip:row.querySelector('[data-field="ip"]').value.trim(),porta:Number(row.querySelector('[data-field="porta"]').value)||9100,ativa:row.querySelector('[data-field="ativa"]').value==="true"}; await salvarEquipamentos();}
    if(del){impressorasConfig.splice(Number(del.dataset.deletePrinter),1);await salvarEquipamentos();}
});

listaBalancasConfig?.addEventListener("click",async e=>{
    const save=e.target.closest("[data-save-scale]"), del=e.target.closest("[data-delete-scale]");
    if(save){const i=Number(save.dataset.saveScale), row=save.closest(".device-row"); balancasConfig[i]={nome:row.querySelector('[data-field="nome"]').value.trim(),modelo:row.querySelector('[data-field="modelo"]').value.trim(),ativa:row.querySelector('[data-field="ativa"]').value==="true"}; await salvarEquipamentos();}
    if(del){balancasConfig.splice(Number(del.dataset.deleteScale),1);await salvarEquipamentos();}
});

carregarEquipamentos();
