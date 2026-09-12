/* NeoScale - impressão da comanda térmica */
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
    { frase: "Comer bem é cuidar de você.", autor: "NeoScale" }
];
let ultimaFrase = "";

function escaparHtml(texto) {
    return String(texto).replace(/[&<>"']/g, (c) => ({
        "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
    }[c]));
}

async function buscarFraseDaComanda() {
    let frase;
    if (window.NeoFrases?.buscarFrase) {
        try { frase = await window.NeoFrases.buscarFrase(); } catch (_) {}
    }
    if (!frase?.frase || frase.frase === ultimaFrase) {
        const opcoes = FRASES_RESERVA.filter(x => x.frase !== ultimaFrase);
        frase = opcoes[Math.floor(Math.random() * opcoes.length)] || FRASES_RESERVA[0];
    }
    ultimaFrase = frase.frase;
    return frase;
}

function gerarHtmlComanda(comanda, teste = false, frase) {
    const agora = new Date();
    const peso = Number(comanda.peso || 0).toFixed(3).replace(".", ",");
    const precoKg = Number(comanda.precoKg || 0).toLocaleString("pt-BR",{minimumFractionDigits:2});
    const total = Number(comanda.total || 0).toLocaleString("pt-BR",{minimumFractionDigits:2});
    const codigo = escaparHtml(comanda.codigoBarras || "");

    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Comanda ${escaparHtml(comanda.numero)}</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
<style>
@page{size:80mm auto;margin:0}*{box-sizing:border-box}html,body{width:80mm;margin:0;padding:0}
body{width:72mm;margin:0 auto;background:#fff;color:#111;font-family:"Lucida Console",Consolas,"Courier New",monospace;font-size:12px}
.centro{text-align:center}.empresa{padding:3mm 0 4mm;line-height:1.4}.empresa strong{display:block;font-size:21px}
.titulo{font-size:22px;font-weight:700;margin-bottom:3mm}.data{font-size:11px;margin-bottom:2mm}
.linha{border-top:2px dashed #111;margin:2mm 0}table{width:100%;border-collapse:collapse}
th,td{padding:2mm 1mm;border-bottom:1px dashed #111;text-align:left}th{text-align:center}
td:nth-child(n+2),th:nth-child(n+2){text-align:right}.total{margin:5mm 0;font-size:23px;font-weight:700;text-align:center}
.barcode{text-align:center;margin:4mm 0 2mm}.barcode svg{width:64mm;height:17mm}.numero-barra{font-size:12px;letter-spacing:1px}
.frase{line-height:1.4;margin:3mm;font-size:11px}.frase strong{display:block}.rodape{text-align:center;margin:4mm 0;font-size:11px}
</style></head><body>
<header class="empresa centro"><strong>${RESTAURANTE.nome}</strong><span>${RESTAURANTE.endereco}</span><br><span>${RESTAURANTE.cidade}</span></header>
<div class="titulo centro">COMANDA Nº ${escaparHtml(comanda.numero)}${teste ? '<div style="font-size:10px">COMANDA DE TESTE</div>' : ''}</div>
<div class="data">Data: ${agora.toLocaleDateString("pt-BR")} ${agora.toLocaleTimeString("pt-BR")}</div>
<div class="linha"></div>
<table><thead><tr><th>Produto</th><th>R$/kg</th><th>Peso</th><th>Total</th></tr></thead>
<tbody><tr><td>${escaparHtml(comanda.produto || "Refeição")}</td><td>R$ ${precoKg}</td><td>${peso} kg</td><td>R$ ${total}</td></tr></tbody></table>
<div class="total">TOTAL: R$ ${total}</div>
<div class="barcode"><svg id="codigo"></svg><div class="numero-barra">${codigo}</div></div>
<div class="frase centro">"${escaparHtml(frase.frase)}"<strong>${escaparHtml(frase.autor || "NeoScale")}</strong></div>
<div class="rodape">Apresente esta comanda no caixa.<br>Obrigado pela preferência!</div>
<script>
window.onload=function(){try{JsBarcode("#codigo","${codigo}",{format:"CODE128",displayValue:false,margin:0,height:55,width:2});}catch(e){console.error(e)};setTimeout(()=>window.print(),250);}
<\/script></body></html>`;
}

async function imprimirComanda(opcoes = {}) {
    const comanda = opcoes.comanda;
    if (!comanda) {
        alert("Nenhuma comanda foi gerada.");
        return;
    }
    const frase = await buscarFraseDaComanda();
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden","true");
    frame.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
    document.body.appendChild(frame);

    const documento = frame.contentWindow.document;
    documento.open();
    documento.write(gerarHtmlComanda(comanda, Boolean(opcoes.teste), frase));
    documento.close();

    window.setTimeout(() => frame.remove(), 1800);
    window.NeoVoice?.vozComanda?.();
}

window.imprimirComanda = imprimirComanda;
