/* Comanda térmica para Elgin i9 Full (bobina de 80 mm). */
const RESTAURANTE = {
    nome: "NEOSCALE RESTAURANTE",
    endereco: "Sistema de pesagem inteligente",
    cidade: "Buffet por quilo"
};

const FRASES_RESERVA = [
    { frase: "Que a sua refeição seja um momento especial.", autor: "NeoScale" },
    { frase: "Sabores que tornam o dia melhor.", autor: "NeoScale" },
    { frase: "Boa comida, bons momentos.", autor: "NeoScale" },
    { frase: "Aproveite cada sabor do seu dia.", autor: "NeoScale" },
    { frase: "Uma pausa gostosa faz toda a diferença.", autor: "NeoScale" },
    { frase: "Comer bem é cuidar de você.", autor: "NeoScale" },
    { frase: "Uma refeição feita para ser aproveitada.", autor: "NeoScale" },
    { frase: "Que não faltem bons sabores no seu dia.", autor: "NeoScale" },
    { frase: "O melhor tempero é estar bem acompanhado.", autor: "NeoScale" },
    { frase: "Seu momento de recarregar as energias chegou.", autor: "NeoScale" },
    { frase: "A vida fica melhor com uma boa refeição.", autor: "NeoScale" },
    { frase: "Saboreie o presente, prato por prato.", autor: "NeoScale" },
    { frase: "Que seu almoço seja leve, saboroso e feliz.", autor: "NeoScale" },
    { frase: "Boas escolhas começam com uma boa refeição.", autor: "NeoScale" },
    { frase: "Aprecie com calma cada detalhe do seu prato.", autor: "NeoScale" },
    { frase: "Hoje é um ótimo dia para comer bem.", autor: "NeoScale" },
    { frase: "Alimente seus planos com bons momentos.", autor: "NeoScale" },
    { frase: "Sabor que combina com o seu dia.", autor: "NeoScale" },
    { frase: "Que a sua pausa seja deliciosa.", autor: "NeoScale" },
    { frase: "Uma boa refeição começa com bons ingredientes.", autor: "NeoScale" }
];

let ultimaFrase = "";

function textoDoElemento(id, padrao) {
    return document.getElementById(id)?.textContent.trim() || padrao;
}

function proximaSequencia() {
    const chave = "neoscale-sequencia-comanda";
    const sequencia = Number(localStorage.getItem(chave) || "0") + 1;
    localStorage.setItem(chave, String(sequencia));
    return String(sequencia).padStart(5, "0");
}

function escaparHtml(texto) {
    return String(texto).replace(/[&<>"']/g, (caractere) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
    }[caractere]));
}

async function buscarFraseDaComanda() {
    let frase;
    const usarFraseDoBanco = window.NeoFrases?.buscarFrase && Math.random() < 0.5;
    if (usarFraseDoBanco) {
        frase = await window.NeoFrases.buscarFrase();
        if (frase?.frase === ultimaFrase) frase = await window.NeoFrases.buscarFrase();
    }
    if (!frase?.frase || frase.frase === ultimaFrase) {
        const opcoes = FRASES_RESERVA.filter((item) => item.frase !== ultimaFrase);
        frase = opcoes[Math.floor(Math.random() * opcoes.length)] || FRASES_RESERVA[0];
    }
    ultimaFrase = frase.frase;
    return frase;
}

function gerarHtmlComanda(teste = false, frase) {
    const agora = new Date();
    const sequencia = proximaSequencia();
    const peso = textoDoElemento("pesoDisplay", "0,000 kg");
    const semSimboloMoeda = (texto) => texto.replace(/^R\$\s*/i, "").trim();
    const precoKg = semSimboloMoeda(textoDoElemento("precoKgDisplay", "R$ 0,00"));
    const total = semSimboloMoeda(textoDoElemento("valorDisplay", "R$ 0,00"));
    const pesoNumero = peso.replace(/\s*kg/i, "");

    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comanda ${sequencia}</title><style>
@page{size:80mm auto;margin:0}*{box-sizing:border-box}html,body{width:80mm;margin:0;padding:0}body{width:72mm;margin:0 auto;background:#fff;color:#111;font-family:"Lucida Console",Consolas,"Courier New",monospace;font-size:12px;font-weight:400;letter-spacing:.1px}.centro{text-align:center}.empresa{padding:3mm 0 4mm;line-height:1.4}.empresa strong{display:block;font-size:22px;font-weight:700;letter-spacing:-.8px}.empresa span{font-size:13px}.titulo{font-size:23px;font-weight:700;margin-bottom:4mm}.teste{display:block;margin-top:2mm;font-size:11px}.data{text-align:left;font-size:12px;margin-bottom:2mm}.linha{border-top:2px dashed #111;margin:2mm 0}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px}th,td{height:10mm;padding:1mm .5mm;border-bottom:1px dashed #111;text-align:left;vertical-align:middle;white-space:nowrap}th{height:8mm;text-align:center;border-top:1px dashed #111;font-size:12px;font-weight:700}th:first-child,td:first-child{width:43%}td:first-child{font-size:13px}th:nth-child(2),td:nth-child(2){width:21%;text-align:center}th:nth-child(3),td:nth-child(3){width:17%;text-align:center}th:nth-child(4),td:nth-child(4){width:19%;text-align:right}.total{margin:5mm 0;font-size:25px;font-weight:700;text-align:center}.frase{line-height:1.4;margin:0 3mm 4mm;font-size:12px}.frase strong{display:block;text-align:center;font-weight:700}.rodape{margin:3mm 0;text-align:center;font-size:12px}.site{margin:4mm 0 2mm;text-align:center;font-size:11px;font-weight:400}
</style></head><body>
<header class="empresa centro"><strong>${RESTAURANTE.nome}</strong><span>${RESTAURANTE.endereco}</span><br><span>${RESTAURANTE.cidade}</span></header>
<div class="titulo centro">Comanda N.${Number(sequencia)}${teste ? "<small class=\"teste\">COMANDA DE TESTE</small>" : ""}</div>
<div class="data">Data: ${agora.toLocaleDateString("pt-BR")} ${agora.toLocaleTimeString("pt-BR")}</div><div class="linha"></div>
<table><thead><tr><th>Produto</th><th>R$/kg</th><th>Peso</th><th>Total</th></tr></thead><tbody><tr><td>Refeição</td><td>${precoKg}</td><td>${pesoNumero}</td><td>${total}</td></tr><tr><td>Refrigerante / Suco</td><td></td><td></td><td></td></tr><tr><td>Doces</td><td></td><td></td><td></td></tr></tbody></table>
<div class="total">TOTAL: R$ ${total}</div><div class="frase centro">"${escaparHtml(frase.frase)}"<strong>${escaparHtml(frase.autor || "NeoScale")}</strong></div><div class="rodape">Obrigado pela preferência, volte sempre!</div><div class="site">neoscale.com.br</div>
</body></html>`;
}

async function imprimirComanda(opcoes = {}) {
    const frase = await buscarFraseDaComanda();
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
    document.body.appendChild(frame);

    let impresso = false;
    const imprimir = () => {
        if (impresso) return;
        impresso = true;
        frame.contentWindow.focus();
        frame.contentWindow.print();
        window.setTimeout(() => frame.remove(), 1000);
    };
    frame.onload = imprimir;
    const documento = frame.contentWindow.document;
    documento.open();
    documento.write(gerarHtmlComanda(Boolean(opcoes.teste), frase));
    documento.close();
    window.setTimeout(imprimir, 300);
    window.NeoVoice?.vozComanda();
}

window.imprimirComanda = imprimirComanda;
document.addEventListener("DOMContentLoaded", () => document.getElementById("btnImprimir")?.addEventListener("click", imprimirComanda));
