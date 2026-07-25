import { db } from "./firebase.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const campos = {
    nomeRestaurante: document.getElementById("nomeRestaurante"),
    precoPadrao: document.getElementById("precoPadrao"),
    impressora: document.getElementById("impressora"),
    modeloBalanca: document.getElementById("modeloBalanca"),
    mensagemComanda: document.getElementById("mensagemComanda"),
    temaQuiosque: document.getElementById("temaQuiosque")
};

const botaoSalvar = document.getElementById("btnSalvarConfiguracao");
const iniciarPesagem = document.getElementById("iniciarPesagem");

function obterDadosFormulario() {
    const preco = campos.precoPadrao.value.trim();
    return {
        restaurante: campos.nomeRestaurante.value.trim(),
        precoKg: preco === "" ? 0 : Number(preco),
        impressora: campos.impressora.value.trim(),
        balanca: campos.modeloBalanca.value.trim(),
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
        campos.modeloBalanca.value = dados.balanca || "";
        campos.mensagemComanda.value = dados.mensagem || "";
        campos.temaQuiosque.value = dados.temaQuiosque || localStorage.getItem("neoscale-tema-quiosque") || "azul";
    } catch (erro) {
        console.error("Não foi possível carregar as configurações:", erro);
    }
}

botaoSalvar?.addEventListener("click", salvarConfiguracao);
campos.temaQuiosque?.addEventListener("change", () => localStorage.setItem("neoscale-tema-quiosque", campos.temaQuiosque.value));
iniciarPesagem?.addEventListener("click", () => window.location.assign("pesagem.html"));
carregarConfiguracao();
