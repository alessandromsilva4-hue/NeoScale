/* NeoScale - terminal de pesagem */
import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { criarComanda } from "./comandas.js";

let precoKg = 89.90;
let pesoAtual = 0;
let portaBalanca = null;
let leitorAtivo = false;
let comandaEmProcessamento = false;
let precisaZerarBalanca = false;
let leiturasRecentes = [];
let ultimaComanda = null;

const pesoDisplay = document.getElementById("pesoDisplay");
const valorDisplay = document.getElementById("valorDisplay");
const precoKgDisplay = document.getElementById("precoKgDisplay");
const iniciar = document.getElementById("iniciarPesagem");
const emitir = document.getElementById("emitirComanda");
const emitirTeste = document.getElementById("emitirComandaTeste");
const statusBalanca = document.querySelector(".status-balanca");
const previewStatus = document.querySelector(".preview-status");
const botaoTelaCheia = document.getElementById("alternarTelaCheia");

const formatarMoeda = (valor) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatarPeso = (peso) => `${peso.toFixed(3).replace(".", ",")} kg`;

function atualizarStatus(texto, ativo = false) {
    if (!statusBalanca) return;
    statusBalanca.innerHTML = `<i></i> ${texto}`;
    statusBalanca.classList.toggle("ativo", ativo);
}

async function carregarConfiguracao() {
    try {
        const dados = await getDoc(doc(db, "configuracoes", "principal"));
        if (dados.exists()) precoKg = Number(dados.data().precoKg || precoKg);
    } catch (erro) {
        console.error("Não foi possível carregar o preço por kg.", erro);
    }
    if (precoKgDisplay) precoKgDisplay.textContent = formatarMoeda(precoKg);
}

function atualizarLeitura(peso) {
    pesoAtual = peso;
    const valor = pesoAtual * precoKg;
    if (pesoDisplay) pesoDisplay.textContent = formatarPeso(pesoAtual);
    if (valorDisplay) valorDisplay.textContent = formatarMoeda(valor);
}

async function concluirPesagemAutomatica() {
    if (comandaEmProcessamento || precisaZerarBalanca || pesoAtual <= 0.02) return;

    comandaEmProcessamento = true;
    precisaZerarBalanca = true;
    atualizarStatus("Peso confirmado — gerando comanda", true);
    if (previewStatus) previewStatus.textContent = "Gravando comanda";

    try {
        const total = pesoAtual * precoKg;
        const comanda = await criarComanda({
            peso: pesoAtual,
            precoKg,
            total,
            produto: "Buffet por quilo"
        });

        ultimaComanda = comanda;
        window.imprimirComanda?.({ comanda });

        if (previewStatus) previewStatus.textContent = `Comanda ${comanda.numero} emitida`;
        atualizarStatus(`Comanda ${comanda.numero} emitida — retire o prato`, false);
        if (typeof window.mostrarComandaGerada === "function") {
            window.mostrarComandaGerada(comanda);
        }
    } catch (erro) {
        console.error("Erro ao gerar a comanda.", erro);
        if (previewStatus) previewStatus.textContent = "Erro ao gerar comanda";
        atualizarStatus("Falha ao salvar a comanda", false);
        precisaZerarBalanca = false;
    } finally {
        comandaEmProcessamento = false;
    }
}

function receberPeso(peso) {
    if (!Number.isFinite(peso) || peso < 0) return;
    atualizarLeitura(peso);

    if (peso <= 0.02) {
        precisaZerarBalanca = false;
        leiturasRecentes = [];
        atualizarStatus("Pronta para pesar", true);
        if (previewStatus) previewStatus.textContent = "Aguardando";
        return;
    }

    leiturasRecentes.push(peso);
    if (leiturasRecentes.length > 4) leiturasRecentes.shift();
    if (leiturasRecentes.length < 4 || precisaZerarBalanca) return;

    const variacao = Math.max(...leiturasRecentes) - Math.min(...leiturasRecentes);
    if (variacao <= 0.003) concluirPesagemAutomatica();
}

function extrairPeso(texto) {
    const encontrado = String(texto).replace(",", ".").match(/-?\d+(?:\.\d+)?/);
    if (!encontrado) return null;
    let peso = Number(encontrado[0]);
    if (peso > 10) peso /= 1000;
    return peso;
}

async function lerBalanca() {
    const decoder = new TextDecoder();
    let buffer = "";
    while (portaBalanca?.readable && leitorAtivo) {
        const reader = portaBalanca.readable.getReader();
        try {
            while (leitorAtivo) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const linhas = buffer.split(/[\r\n]+/);
                buffer = linhas.pop() || "";
                linhas.forEach((linha) => {
                    const peso = extrairPeso(linha);
                    if (peso !== null) receberPeso(peso);
                });
            }
        } finally {
            reader.releaseLock();
        }
    }
}

async function conectarBalanca() {
    if (!("serial" in navigator)) {
        alert("Use o Google Chrome ou Microsoft Edge para conectar a balança por USB/serial.");
        return;
    }
    try {
        portaBalanca = await navigator.serial.requestPort();
        await portaBalanca.open({ baudRate: 9600 });
        leitorAtivo = true;
        if (iniciar) {
            iniciar.textContent = "Balança conectada";
            iniciar.disabled = true;
        }
        atualizarStatus("Aguardando prato", true);
        lerBalanca();
    } catch (erro) {
        console.error("Erro ao conectar a balança.", erro);
        atualizarStatus("Não foi possível conectar", false);
    }
}

async function alternarTelaCheia() {
    try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
    } catch (erro) {
        console.error("Não foi possível alternar a tela cheia.", erro);
    }
}

document.addEventListener("fullscreenchange", () => {
    if (botaoTelaCheia) {
        botaoTelaCheia.textContent = document.fullscreenElement ? "⛶ Sair da tela cheia" : "⛶ Tela cheia";
    }
});

iniciar?.addEventListener("click", conectarBalanca);
botaoTelaCheia?.addEventListener("click", alternarTelaCheia);

emitir?.addEventListener("click", () => {
    if (pesoAtual <= 0.02) {
        alert("Coloque um peso sobre a balança antes de emitir a comanda.");
        return;
    }
    concluirPesagemAutomatica();
});

emitirTeste?.addEventListener("click", () => {
    window.imprimirComanda?.({ teste: true, comanda: {
        numero: "TESTE",
        codigoBarras: "2000000000",
        peso: pesoAtual || 0.500,
        precoKg,
        total: (pesoAtual || 0.500) * precoKg,
        produto: "Buffet por quilo"
    }});
});

carregarConfiguracao();
