/* NeoScale - impressão térmica: navegador + impressão direta ESC/POS */
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

function semAcentos(texto) {
    return String(texto ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ç/g, "c").replace(/Ç/g, "C");
}

function dinheiro(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function bytesParaBase64(bytes) {
    let bin = "";
    const passo = 0x8000;
    for (let i = 0; i < bytes.length; i += passo) bin += String.fromCharCode(...bytes.subarray(i, i + passo));
    return btoa(bin);
}

function textoEscPos(texto) {
    // UTF-8 não é suportado por várias térmicas. A remoção de acentos evita caracteres quebrados.
    return new TextEncoder().encode(semAcentos(texto));
}

function concatenarBytes(...partes) {
    const total = partes.reduce((n, p) => n + p.length, 0);
    const saida = new Uint8Array(total);
    let pos = 0;
    for (const parte of partes) { saida.set(parte, pos); pos += parte.length; }
    return saida;
}

function escPosTextoLinha(texto = "") {
    return concatenarBytes(textoEscPos(texto), Uint8Array.from([0x0A]));
}

function montarEscPosBase() {
    return {
        init: Uint8Array.from([0x1B, 0x40]),
        center: Uint8Array.from([0x1B, 0x61, 0x01]),
        left: Uint8Array.from([0x1B, 0x61, 0x00]),
        boldOn: Uint8Array.from([0x1B, 0x45, 0x01]),
        boldOff: Uint8Array.from([0x1B, 0x45, 0x00]),
        big: Uint8Array.from([0x1D, 0x21, 0x11]),
        normal: Uint8Array.from([0x1D, 0x21, 0x00]),
        cut: Uint8Array.from([0x1D, 0x56, 0x00]),
        feed: Uint8Array.from([0x0A, 0x0A, 0x0A])
    };
}

function comandoBarrasCode128(codigo) {
    const valor = semAcentos(codigo).replace(/[^\x20-\x7E]/g, "");
    if (!valor) return new Uint8Array();
    const data = new TextEncoder().encode(valor);
    // GS k m n data — CODE128 com modo B. n é o tamanho do payload.
    return concatenarBytes(
        Uint8Array.from([0x1D, 0x48, 0x00]), // sem texto abaixo
        Uint8Array.from([0x1D, 0x77, 0x02]), // largura
        Uint8Array.from([0x1D, 0x68, 0x50]), // altura
        Uint8Array.from([0x1D, 0x6B, 0x49, data.length + 1, 0x7B, 0x42]),
        data,
        Uint8Array.from([0x0A])
    );
}

function montarComandaEscPos(comanda, frase, teste = false) {
    const e = montarEscPosBase();
    const peso = Number(comanda.peso || 0).toFixed(3).replace(".", ",");
    const precoKg = dinheiro(comanda.precoKg);
    const total = dinheiro(comanda.total);
    const codigo = comanda.codigoBarras || "";
    const largura = 42;
    const linha = "-".repeat(largura);
    const produto = semAcentos(comanda.produto || "Refeicao");

    return concatenarBytes(
        e.init, e.center, e.boldOn, e.big, escPosTextoLinha(RESTAURANTE.nome),
        e.normal, e.boldOff,
        escPosTextoLinha(RESTAURANTE.endereco),
        escPosTextoLinha(RESTAURANTE.cidade),
        e.boldOn, escPosTextoLinha(`COMANDA No ${comanda.numero}`), e.boldOff,
        teste ? escPosTextoLinha("COMANDA DE TESTE") : new Uint8Array(),
        e.left, escPosTextoLinha(`Data: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`),
        escPosTextoLinha(linha),
        escPosTextoLinha(`Produto: ${produto}`),
        escPosTextoLinha(`Preco/kg: R$ ${precoKg}`),
        escPosTextoLinha(`Peso: ${peso} kg`),
        escPosTextoLinha(linha),
        e.center, e.boldOn, e.big, escPosTextoLinha(`TOTAL: R$ ${total}`), e.normal, e.boldOff,
        comandoBarrasCode128(codigo),
        escPosTextoLinha(codigo),
        escPosTextoLinha(`"${frase.frase}"`),
        escPosTextoLinha(frase.autor || "NeoScale"),
        escPosTextoLinha(""),
        escPosTextoLinha("Apresente esta comanda no caixa."),
        escPosTextoLinha("Obrigado pela preferencia!"),
        e.feed, e.cut
    );
}

function montarReciboEscPos(venda, teste = false) {
    const e = montarEscPosBase();
    const itens = Array.isArray(venda.itens) ? venda.itens : [];
    const linhas = [];
    for (const item of itens) {
        const qtd = Number(item.quantidade || 0);
        const valor = Number(item.preco || 0) * qtd;
        linhas.push(`${semAcentos(item.nome || "Produto")} x${qtd}  R$ ${dinheiro(valor)}`);
    }
    const largura = 42;
    const separador = "-".repeat(largura);
    const pagamento = semAcentos(venda.pagamento || "Nao informado");
    const comanda = semAcentos(venda.numeroComanda || "Venda direta");
    const total = dinheiro(venda.total);

    return concatenarBytes(
        e.init, e.center, e.boldOn, e.big, escPosTextoLinha(RESTAURANTE.nome), e.normal, e.boldOff,
        escPosTextoLinha("Frente de Loja"),
        e.boldOn, escPosTextoLinha("COMPROVANTE DE VENDA"), e.boldOff,
        teste ? escPosTextoLinha("TESTE") : new Uint8Array(),
        e.left, escPosTextoLinha(`Data: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`),
        escPosTextoLinha(`Atendimento: ${comanda}`), escPosTextoLinha(separador),
        ...(linhas.length ? linhas.map(escPosTextoLinha) : [escPosTextoLinha("Venda de refeicao")]),
        escPosTextoLinha(separador), e.center, e.boldOn, e.big,
        escPosTextoLinha(`TOTAL: R$ ${total}`), e.normal, e.boldOff,
        escPosTextoLinha(`Pagamento: ${pagamento}`),
        ...(venda.pagamento === "Dinheiro" ? [escPosTextoLinha(`Recebido: R$ ${dinheiro(venda.recebido)}`), escPosTextoLinha(`Troco: R$ ${dinheiro(venda.troco)}`)] : []),
        escPosTextoLinha(""), escPosTextoLinha("Obrigado pela preferencia!"), escPosTextoLinha("NeoScale - Gestao Inteligente"),
        e.feed, e.cut
    );
}

async function carregarConfiguracaoImpressao() {
    try {
        const { db } = await import("./firebase.js");
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const snap = await getDoc(doc(db, "configuracoes", "principal"));
        return snap.exists() ? snap.data() : {};
    } catch (_) { return {}; }
}

async function imprimirDireto(bytes, config) {
    const servidor = String(config.servidorImpressao || "").trim();
    if (!servidor) throw new Error("Configure o servidor de impressão em Configurações.");
    const url = servidor.endsWith("/print") ? servidor : `${servidor.replace(/\/$/, "")}/print`;
    const resposta = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/octet-stream",
            "X-Printer-IP": String(config.ipImpressora || ""),
            "X-Printer-Port": String(config.portaImpressora || 9100)
        },
        body: bytes
    });
    if (!resposta.ok) throw new Error(`Servidor de impressão respondeu HTTP ${resposta.status}.`);
    return true;
}

async function imprimirUsbSerial(bytes) {
    if (!navigator.serial) throw new Error("Seu navegador não oferece impressão USB/Serial via Web Serial.");
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    const writer = port.writable.getWriter();
    try { await writer.write(bytes); } finally { writer.releaseLock(); await port.close(); }
}

async function imprimirDiretoSeguro(bytes, config) {
    if (config.tipoConexaoImpressora === "usb") return imprimirUsbSerial(bytes);
    return imprimirDireto(bytes, config);
}

function gerarHtmlComanda(comanda, teste = false, frase) {
    const agora = new Date();
    const peso = Number(comanda.peso || 0).toFixed(3).replace(".", ",");
    const precoKg = dinheiro(comanda.precoKg);
    const total = dinheiro(comanda.total);
    const codigo = escaparHtml(comanda.codigoBarras || "");
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comanda ${escaparHtml(comanda.numero)}</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script><style>
@page{size:80mm auto;margin:0}*{box-sizing:border-box}html,body{width:80mm;margin:0;padding:0}body{width:72mm;margin:0 auto;background:#fff;color:#111;font-family:"Lucida Console",Consolas,"Courier New",monospace;font-size:12px}.centro{text-align:center}.empresa{padding:3mm 0 4mm;line-height:1.4}.empresa strong{display:block;font-size:21px}.titulo{font-size:22px;font-weight:700;margin-bottom:3mm}.data{font-size:11px;margin-bottom:2mm}.linha{border-top:2px dashed #111;margin:2mm 0}table{width:100%;border-collapse:collapse}th,td{padding:2mm 1mm;border-bottom:1px dashed #111;text-align:left}th{text-align:center}td:nth-child(n+2),th:nth-child(n+2){text-align:right}.total{margin:5mm 0;font-size:23px;font-weight:700;text-align:center}.barcode{text-align:center;margin:4mm 0 2mm}.barcode svg{width:64mm;height:17mm}.numero-barra{font-size:12px;letter-spacing:1px}.frase{line-height:1.4;margin:3mm;font-size:11px}.frase strong{display:block}.rodape{text-align:center;margin:4mm 0;font-size:11px}</style></head><body>
<header class="empresa centro"><strong>${RESTAURANTE.nome}</strong><span>${RESTAURANTE.endereco}</span><br><span>${RESTAURANTE.cidade}</span></header>
<div class="titulo centro">COMANDA No ${escaparHtml(comanda.numero)}${teste ? '<div style="font-size:10px">COMANDA DE TESTE</div>' : ''}</div>
<div class="data">Data: ${agora.toLocaleDateString("pt-BR")} ${agora.toLocaleTimeString("pt-BR")}</div><div class="linha"></div>
<table><thead><tr><th>Produto</th><th>R$/kg</th><th>Peso</th><th>Total</th></tr></thead><tbody><tr><td>${escaparHtml(comanda.produto || "Refeição")}</td><td>R$ ${precoKg}</td><td>${peso} kg</td><td>R$ ${total}</td></tr></tbody></table>
<div class="total">TOTAL: R$ ${total}</div><div class="barcode"><svg id="codigo"></svg><div class="numero-barra">${codigo}</div></div><div class="frase centro">"${escaparHtml(frase.frase)}"<strong>${escaparHtml(frase.autor || "NeoScale")}</strong></div><div class="rodape">Apresente esta comanda no caixa.<br>Obrigado pela preferência!</div>
<script>window.onload=function(){try{JsBarcode("#codigo","${codigo}",{format:"CODE128",displayValue:false,margin:0,height:55,width:2});}catch(e){};setTimeout(()=>window.print(),250)}<\/script></body></html>`;
}

async function imprimirComanda(opcoes = {}) {
    const comanda = opcoes.comanda;
    if (!comanda) { alert("Nenhuma comanda foi gerada."); return; }
    const frase = await buscarFraseDaComanda();
    const config = await carregarConfiguracaoImpressao();
    if (config.modoImpressao === "direta") {
        try {
            await imprimirDiretoSeguro(montarComandaEscPos(comanda, frase, Boolean(opcoes.teste)), config);
            window.NeoVoice?.vozComanda?.();
            return { direta: true };
        } catch (erro) {
            console.error("Impressão direta falhou:", erro);
            if (!opcoes.silencioso) alert(`Impressão direta não disponível.\n\n${erro.message}\n\nO NeoScale abrirá a impressão do navegador como alternativa.`);
        }
    }
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden","true"); frame.style.cssText="position:fixed;width:0;height:0;border:0;right:0;bottom:0";
    document.body.appendChild(frame);
    const documento=frame.contentWindow.document; documento.open(); documento.write(gerarHtmlComanda(comanda,Boolean(opcoes.teste),frase)); documento.close();
    window.setTimeout(()=>frame.remove(),1800); window.NeoVoice?.vozComanda?.();
    return { direta: false };
}
window.imprimirComanda = imprimirComanda;

function gerarHtmlReciboVenda(venda, teste = false) {
    const agora = new Date();
    const total = dinheiro(venda.total), recebido = dinheiro(venda.recebido), troco = dinheiro(venda.troco);
    const pagamento = escaparHtml(venda.pagamento || "Não informado"), comanda = escaparHtml(venda.numeroComanda || "Venda direta");
    const itens = Array.isArray(venda.itens) ? venda.itens : [];
    const linhas = itens.map(item => { const qtd=Number(item.quantidade||0); const valor=dinheiro(Number(item.preco||0)*qtd); return `<tr><td>${escaparHtml(item.nome||"Produto")}</td><td>${qtd}</td><td>R$ ${valor}</td></tr>`; }).join("");
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Recibo NeoScale</title><style>@page{size:${String(venda.larguraPapel||"80")}mm auto;margin:0}*{box-sizing:border-box}html,body{width:${String(venda.larguraPapel||"80")}mm;margin:0;padding:0}body{width:calc(${String(venda.larguraPapel||"80")}mm - 8mm);margin:0 auto;color:#111;font-family:"Lucida Console",Consolas,"Courier New",monospace;font-size:12px}.centro{text-align:center}.empresa{padding:3mm 0 4mm;line-height:1.4}.empresa strong{display:block;font-size:20px}.titulo{font-size:19px;font-weight:700;margin-bottom:3mm}.linha{border-top:2px dashed #111;margin:2mm 0}table{width:100%;border-collapse:collapse}th,td{padding:2mm 1mm;border-bottom:1px dashed #111;text-align:left}th:nth-child(n+2),td:nth-child(n+2){text-align:right}.total{margin:5mm 0;font-size:22px;font-weight:700;text-align:center}.pagamento{text-align:center;line-height:1.6}.rodape{text-align:center;margin:5mm 0;font-size:11px;line-height:1.5}</style></head><body><header class="empresa centro"><strong>NEOSCALE RESTAURANTE</strong><span>Frente de Loja</span></header><div class="titulo centro">COMPROVANTE DE VENDA${teste?'<div style="font-size:10px">TESTE</div>':''}</div><div>Data: ${agora.toLocaleDateString("pt-BR")} ${agora.toLocaleTimeString("pt-BR")}</div><div>Atendimento: ${comanda}</div><div class="linha"></div><table><thead><tr><th>Produto</th><th>Qtd</th><th>Total</th></tr></thead><tbody>${linhas||'<tr><td colspan="3">Venda de refeição</td></tr>'}</tbody></table><div class="total">TOTAL: R$ ${total}</div><div class="pagamento">Pagamento: <strong>${pagamento}</strong>${venda.pagamento==="Dinheiro"?`<br>Recebido: R$ ${recebido}<br>Troco: R$ ${troco}`:""}</div><div class="rodape">Obrigado pela preferência!<br>NeoScale • Gestão Inteligente</div><script>window.onload=function(){setTimeout(()=>window.print(),200)}<\/script></body></html>`;
}

async function imprimirReciboVenda(venda = {}) {
    if (!venda || !Number(venda.total || 0)) return;
    const config = await carregarConfiguracaoImpressao();
    venda = {...venda, larguraPapel:String(config.larguraPapel||venda.larguraPapel||"80")};
    if (config.modoImpressao === "direta") {
        try { await imprimirDiretoSeguro(montarReciboEscPos(venda,Boolean(venda.teste)),config); return {direta:true}; }
        catch (erro) { console.error("Impressão direta do recibo falhou:",erro); alert(`Impressão direta não disponível.\n\n${erro.message}\n\nO NeoScale abrirá a impressão do navegador como alternativa.`); }
    }
    const frame=document.createElement("iframe"); frame.setAttribute("aria-hidden","true"); frame.style.cssText="position:fixed;width:0;height:0;border:0;right:0;bottom:0"; document.body.appendChild(frame);
    const documento=frame.contentWindow.document; documento.open(); documento.write(gerarHtmlReciboVenda(venda,Boolean(venda.teste))); documento.close(); window.setTimeout(()=>frame.remove(),1800); return {direta:false};
}
window.imprimirReciboVenda = imprimirReciboVenda;

async function buscarFraseDaComanda() {
    let frase;
    if (window.NeoFrases?.buscarFrase) { try { frase=await window.NeoFrases.buscarFrase(); } catch (_) {} }
    if (!frase?.frase || frase.frase===ultimaFrase) { const opcoes=FRASES_RESERVA.filter(x=>x.frase!==ultimaFrase); frase=opcoes[Math.floor(Math.random()*opcoes.length)]||FRASES_RESERVA[0]; }
    ultimaFrase=frase.frase; return frase;
}
