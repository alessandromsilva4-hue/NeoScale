/* Leitura automática da balança e emissão da comanda. */
import { db } from "./firebase.js";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let precoKg = 89.90;
let pesoAtual = 0;
let portaBalanca = null;
let leitorAtivo = false;
let comandaEmProcessamento = false;
let precisaZerarBalanca = false;
let leiturasRecentes = [];

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
        if (dados.exists()) precoKg = dados.data().precoKg || precoKg;
    } catch (erro) {
        console.error("Não foi possível carregar o preço por kg.", erro);
    }
    if (precoKgDisplay) precoKgDisplay.textContent = formatarMoeda(precoKg);
}

async function gerarPreview(valor) {
    let frase = { frase: "Uma boa refeição transforma momentos.", autor: "NeoScale" };
    if (window.NeoFrases) frase = await window.NeoFrases.buscarFrase();

    document.getElementById("previewComanda").textContent =
        `NEOSCALE\nBuffet por quilo\n\nPeso: ${formatarPeso(pesoAtual)}\nValor: ${formatarMoeda(valor)}\n\n“${frase.frase}”\n— ${frase.autor}`;
}

function atualizarLeitura(peso) {
    pesoAtual = peso;
    const valor = pesoAtual * precoKg;
    pesoDisplay.textContent = formatarPeso(pesoAtual);
    valorDisplay.textContent = formatarMoeda(valor);
    gerarPreview(valor);
}

async function salvarPesagem() {
    if (pesoAtual <= 0) return false;
    await addDoc(collection(db, "historico"), {
        produto: "Buffet Almoço",
        peso: pesoAtual,
        valor: pesoAtual * precoKg,
        data: serverTimestamp()
    });
    return true;
}

async function concluirPesagemAutomatica() {
    if (comandaEmProcessamento || precisaZerarBalanca || pesoAtual <= 0.02) return;

    comandaEmProcessamento = true;
    precisaZerarBalanca = true;
    atualizarStatus("Peso confirmado — emitindo comanda", true);
    if (previewStatus) previewStatus.textContent = "Emitindo automaticamente";

    try {
        await salvarPesagem();
        window.imprimirComanda?.();
        if (previewStatus) previewStatus.textContent = "Comanda emitida";
        atualizarStatus("Aguarde retirar o prato", false);
    } catch (erro) {
        console.error("Erro ao emitir a comanda.", erro);
        if (previewStatus) previewStatus.textContent = "Erro ao emitir";
        atualizarStatus("Falha ao salvar a pesagem", false);
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
    const encontrado = texto.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
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
        iniciar.textContent = "Balança conectada";
        iniciar.disabled = true;
        atualizarStatus("Aguardando prato", true);
        lerBalanca();
    } catch (erro) {
        console.error("Erro ao conectar a balança.", erro);
        atualizarStatus("Não foi possível conectar", false);
    }
}

async function alternarTelaCheia() {
    try {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
        } else {
            await document.documentElement.requestFullscreen();
        }
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
        window.imprimirComanda?.({ teste: true });
        return;
    }
    concluirPesagemAutomatica();
});
emitirTeste?.addEventListener("click", () => window.imprimirComanda?.({ teste: true }));
carregarConfiguracao();
