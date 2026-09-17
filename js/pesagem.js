/* NeoScale - terminal de pesagem */
import { db } from "./firebase.js";
import {
    doc, getDoc, getDocs, collection
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { criarComanda } from "./comandas.js";

let precoKg = 89.90;
let pesoAtual = 0;
let portaBalanca = null;
let leitorAtivo = false;
let comandaEmProcessamento = false;
let precisaZerarBalanca = false;
let leiturasRecentes = [];
let ultimaComanda = null;
let produtosPeso = [];
let produtoSelecionado = null;

const pesoDisplay = document.getElementById("pesoDisplay");
const valorDisplay = document.getElementById("valorDisplay");
const precoKgDisplay = document.getElementById("precoKgDisplay");
const precoSelecionadoDisplay = document.getElementById("precoSelecionadoDisplay");
const produtoPesagem = document.getElementById("produtoPesagem");
const iniciar = document.getElementById("iniciarPesagem");
const emitir = document.getElementById("emitirComanda");
const emitirTeste = document.getElementById("emitirComandaTeste");
const statusBalanca = document.querySelector(".status-balanca");
const previewStatus = document.getElementById("previewStatus");
const botaoTelaCheia = document.getElementById("alternarTelaCheia");

const formatarMoeda = (valor) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatarPeso = (peso) => `${Number(peso || 0).toFixed(3).replace(".", ",")} kg`;

function atualizarStatus(texto, ativo = false) {
    if (!statusBalanca) return;
    statusBalanca.innerHTML = `<i></i> ${texto}`;
    statusBalanca.classList.toggle("ativo", ativo);
}

function atualizarPrecoSelecionado() {
    const preco = Number(produtoSelecionado?.precoKg ?? precoKg ?? 0);
    precoKg = preco;
    if (precoKgDisplay) precoKgDisplay.textContent = formatarMoeda(preco);
    if (precoSelecionadoDisplay) precoSelecionadoDisplay.textContent = `${formatarMoeda(preco)}/kg`;
    atualizarLeitura(pesoAtual);
}

function selecionarProduto(id) {
    produtoSelecionado = produtosPeso.find(p => p.id === id) || null;
    if (!produtoSelecionado) {
        precoKg = 89.90;
    }
    atualizarPrecoSelecionado();
    leiturasRecentes = [];
    precisaZerarBalanca = pesoAtual > 0.02;
    if (previewStatus) previewStatus.textContent = produtoSelecionado ? `Produto selecionado: ${produtoSelecionado.nome}` : "Selecione um produto por peso";
}

async function carregarProdutosPesagem() {
    if (!produtoPesagem) return;
    try {
        const consulta = await getDocs(collection(db, "produtos"));
        produtosPeso = [];
        consulta.forEach(snap => {
            const p = snap.data() || {};
            const tipoPeso = p.tipoVenda === "peso" || (!p.tipoVenda && p.precoKg != null);
            if (p.ativo !== false && tipoPeso && Number.isFinite(Number(p.precoKg))) {
                produtosPeso.push({
                    id: snap.id,
                    nome: p.nome || "Produto por peso",
                    categoria: p.categoria || "",
                    precoKg: Number(p.precoKg)
                });
            }
        });
        produtosPeso.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        produtoPesagem.innerHTML = "";

        if (!produtosPeso.length) {
            produtoPesagem.innerHTML = '<option value="">Nenhum produto por peso cadastrado</option>';
            produtoSelecionado = null;
            const config = await getDoc(doc(db, "configuracoes", "principal"));
            if (config.exists()) precoKg = Number(config.data().precoKg || precoKg);
            atualizarPrecoSelecionado();
            return;
        }

        produtosPeso.forEach(p => {
            const option = document.createElement("option");
            option.value = p.id;
            option.textContent = `${p.nome} — ${formatarMoeda(p.precoKg)}/kg`;
            produtoPesagem.appendChild(option);
        });
        selecionarProduto(produtosPeso[0].id);
    } catch (erro) {
        console.error("Não foi possível carregar os produtos para pesagem.", erro);
        produtoPesagem.innerHTML = '<option value="">Erro ao carregar produtos</option>';
        const config = await getDoc(doc(db, "configuracoes", "principal")).catch(() => null);
        if (config?.exists()) precoKg = Number(config.data().precoKg || precoKg);
        atualizarPrecoSelecionado();
    }
}

async function carregarConfiguracao() {
    try {
        const dados = await getDoc(doc(db, "configuracoes", "principal"));
        if (dados.exists()) precoKg = Number(dados.data().precoKg || precoKg);
    } catch (erro) {
        console.warn("Não foi possível carregar o preço padrão por kg.", erro);
    }
    atualizarPrecoSelecionado();
}

function atualizarLeitura(peso) {
    pesoAtual = Number(peso) || 0;
    const valor = pesoAtual * precoKg;
    if (pesoDisplay) pesoDisplay.textContent = formatarPeso(pesoAtual);
    if (valorDisplay) valorDisplay.textContent = formatarMoeda(valor);
}

async function concluirPesagemAutomatica() {
    if (comandaEmProcessamento || precisaZerarBalanca || pesoAtual <= 0.02) return;
    if (!produtoSelecionado) {
        alert("Cadastre e selecione um produto por peso antes de emitir a comanda.");
        return;
    }

    comandaEmProcessamento = true;
    precisaZerarBalanca = true;
    atualizarStatus("Peso confirmado — gerando comanda", true);
    if (previewStatus) previewStatus.textContent = "Gravando comanda...";
    if (emitir) emitir.disabled = true;

    try {
        const pesoConfirmado = pesoAtual;
        const precoConfirmado = Number(produtoSelecionado.precoKg);
        const total = pesoConfirmado * precoConfirmado;
        const comanda = await criarComanda({
            peso: pesoConfirmado,
            precoKg: precoConfirmado,
            total,
            produto: produtoSelecionado.nome
        });

        ultimaComanda = comanda;
        window.imprimirComanda?.({ comanda });
        if (previewStatus) previewStatus.textContent = `Comanda ${comanda.numero} emitida • ${produtoSelecionado.nome}`;
        atualizarStatus(`Comanda ${comanda.numero} emitida — retire o prato`, false);
        if (typeof window.mostrarComandaGerada === "function") window.mostrarComandaGerada(comanda);
    } catch (erro) {
        console.error("Erro ao gerar a comanda.", erro);
        if (previewStatus) previewStatus.textContent = "Erro ao gerar comanda";
        atualizarStatus("Falha ao salvar a comanda", false);
        precisaZerarBalanca = false;
    } finally {
        comandaEmProcessamento = false;
        if (emitir) emitir.disabled = false;
    }
}

function receberPeso(peso) {
    if (!Number.isFinite(peso) || peso < 0) return;
    atualizarLeitura(peso);

    if (peso <= 0.02) {
        precisaZerarBalanca = false;
        leiturasRecentes = [];
        atualizarStatus("Pronta para pesar", true);
        if (previewStatus) previewStatus.textContent = "Aguardando prato";
        return;
    }

    if (!produtoSelecionado) {
        if (previewStatus) previewStatus.textContent = "Selecione um produto por peso";
        return;
    }

    leiturasRecentes.push(peso);
    if (leiturasRecentes.length > 5) leiturasRecentes.shift();
    if (previewStatus && leiturasRecentes.length < 5) previewStatus.textContent = `Estabilizando peso... ${leiturasRecentes.length}/5`;
    if (leiturasRecentes.length < 5 || precisaZerarBalanca) return;

    const variacao = Math.max(...leiturasRecentes) - Math.min(...leiturasRecentes);
    if (variacao <= 0.003) {
        atualizarStatus("Peso estável", true);
        concluirPesagemAutomatica();
    } else if (previewStatus) {
        previewStatus.textContent = `Peso oscilando • variação ${variacao.toFixed(3).replace(".", ",")} kg`;
    }
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
                linhas.forEach(linha => {
                    const peso = extrairPeso(linha);
                    if (peso !== null) receberPeso(peso);
                });
            }
        } catch (erro) {
            console.error("Erro durante a leitura da balança.", erro);
            atualizarStatus("Leitura da balança interrompida", false);
            if (previewStatus) previewStatus.textContent = "Verifique o cabo e a porta serial.";
        } finally {
            try { reader.releaseLock(); } catch (_) {}
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
        precisaZerarBalanca = false;
        leiturasRecentes = [];
        if (iniciar) {
            iniciar.textContent = "Balança conectada";
            iniciar.disabled = true;
        }
        atualizarStatus("Aguardando prato", true);
        if (previewStatus) previewStatus.textContent = "Balança conectada • aguardando prato";
        lerBalanca();
    } catch (erro) {
        console.error("Erro ao conectar a balança.", erro);
        atualizarStatus("Não foi possível conectar", false);
        if (previewStatus) previewStatus.textContent = "Conexão cancelada ou indisponível.";
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
    if (botaoTelaCheia) botaoTelaCheia.textContent = document.fullscreenElement ? "⛶ Sair da tela cheia" : "⛶ Tela cheia";
});

produtoPesagem?.addEventListener("change", () => selecionarProduto(produtoPesagem.value));
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
    const produto = produtoSelecionado || { nome: "Buffet por quilo", precoKg };
    window.imprimirComanda?.({ teste: true, comanda: {
        numero: "TESTE",
        codigoBarras: "2000000000",
        peso: pesoAtual || 0.500,
        precoKg: Number(produto.precoKg),
        total: (pesoAtual || 0.500) * Number(produto.precoKg),
        produto: produto.nome
    }});
});

(async function iniciarTelaPesagem() {
    await carregarConfiguracao();
    await carregarProdutosPesagem();
})();
