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
