/* ==========================================
   NeoScale - COMANDAS
   Fluxo: pesagem -> comanda -> PDV -> pagamento
========================================== */
import { db } from "./firebase.js";
import { caixaAberto, registrarMovimento } from "./caixa.js";
import {
    doc, getDoc, runTransaction, collection, addDoc,
    query, where, getDocs, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CONTADOR = "configuracoes/contadorComandas";
const MOV = "movimentosCaixa";

export async function proximaComanda() {
    // Sequência EXCLUSIVA das comandas geradas pela pesagem: 0001, 0002...
    return runTransaction(db, async (transaction) => {
        const ref = doc(db, "configuracoes", "contadorComandas");
        const snap = await transaction.get(ref);
        const atual = Number(snap.exists() ? snap.data().valor || 0 : 0);
        const proximo = atual + 1;
        if (proximo > 9999) {
            throw new Error("A sequência de comandas de pesagem atingiu o limite de 9999.");
        }
        transaction.set(ref, { valor: proximo, atualizadoEm: serverTimestamp() }, { merge: true });
        return String(proximo).padStart(4, "0");
    });
}

export async function proximaComandaProvisoria() {
    // Sequência EXCLUSIVA das comandas provisórias: cinco dígitos.
    // Começa em 10001 para ficar visualmente separada da sequência da pesagem.
    return runTransaction(db, async (transaction) => {
        const ref = doc(db, "configuracoes", "contadorComandasProvisorias");
        const snap = await transaction.get(ref);
        const atual = Number(snap.exists() ? snap.data().valor || 10000 : 10000);
        const proximo = atual + 1;
        if (proximo > 99999) {
            throw new Error("A sequência de comandas provisórias atingiu o limite de 99999.");
        }
        transaction.set(ref, { valor: proximo, atualizadoEm: serverTimestamp() }, { merge: true });
        return String(proximo).padStart(5, "0");
    });
}

export async function criarComanda({ peso, precoKg, total, produto = "Buffet por quilo" }) {
    let numero = await proximaComanda();
    // Números de comandas de balcão podem estar ocupados. A pesagem usa o próximo número livre.
    for (let tentativa = 0; tentativa < 100; tentativa++) {
        const ocupada = await getDocs(query(
            collection(db, "comandas"),
            where("numero", "==", numero),
            where("status", "==", "ABERTA")
        ));
        if (ocupada.empty) break;
        numero = await proximaComanda();
    }
    const codigoBarras = `2${numero}${Date.now().toString().slice(-9)}`;

    const itemPeso = {
        tipo: "PESO",
        produtoId: null,
        nome: produto,
        peso: Number(peso),
        precoKg: Number(precoKg),
        preco: Number(total),
        quantidade: 1,
        total: Number(total)
    };

    const ref = await addDoc(collection(db, "comandas"), {
        numero,
        codigoBarras,
        tipo: "PESO",
        produto,
        peso: Number(peso),
        precoKg: Number(precoKg),
        total: Number(total),
        itens: [itemPeso],
        status: "ABERTA",
        pagamento: null,
        criadoEm: serverTimestamp(),
        finalizadoEm: null
    });

    // Mantém o histórico existente compatível com o projeto.
    await addDoc(collection(db, "historico"), {
        comandaId: ref.id,
        numeroComanda: numero,
        codigoBarras,
        produto,
        peso: Number(peso),
        precoKg: Number(precoKg),
        valor: Number(total),
        status: "ABERTA",
        data: serverTimestamp()
    });

    return { id: ref.id, numero, codigoBarras, peso, precoKg, total, produto };
}


export async function criarComandaProvisoria() {
    // Comanda provisória usa uma sequência independente de 5 dígitos.
    // A sequência da pesagem continua sendo 0001, 0002...
    const numero = await proximaComandaProvisoria();
    const codigoBarras = `2${numero}${Date.now().toString().slice(-9)}`;

    const ref = await addDoc(collection(db, "comandas"), {
        numero,
        codigoBarras,
        tipo: "PROVISORIA",
        produto: null,
        peso: null,
        precoKg: null,
        total: 0,
        itens: [],
        status: "ABERTA",
        pagamento: null,
        criadoEm: serverTimestamp(),
        finalizadoEm: null
    });

    return { id: ref.id, numero, codigoBarras, tipo: "PROVISORIA", total: 0, itens: [] };
}

export async function adicionarItemComanda(id, { produtoId = null, nome, preco, quantidade = 1, tipo = "UNIDADE" }) {
    const quantidadeNum = Number(quantidade);
    const precoNum = Number(preco);
    if (!id || !nome || !Number.isFinite(precoNum) || precoNum < 0 || !Number.isFinite(quantidadeNum) || quantidadeNum <= 0) {
        throw new Error("Item inválido para a comanda.");
    }

    const ref = doc(db, "comandas", id);
    let atualizada;
    await runTransaction(db, async transaction => {
        const snap = await transaction.get(ref);
        if (!snap.exists()) throw new Error("Comanda não encontrada.");
        const c = snap.data();
        if (c.status !== "ABERTA") throw new Error("A comanda não está aberta.");

        const itens = Array.isArray(c.itens) ? c.itens.map(item => ({ ...item })) : [];
        const idx = itens.findIndex(item => item.produtoId === produtoId && item.tipo === tipo);
        if (idx >= 0) itens[idx].quantidade = Number(itens[idx].quantidade || 0) + quantidadeNum;
        else itens.push({ produtoId, nome, preco: precoNum, quantidade: quantidadeNum, tipo, total: precoNum * quantidadeNum });
        itens.forEach(item => { item.total = Number(item.preco || 0) * Number(item.quantidade || 0); });

        const totalBase = c.tipo === "PESO" ? Number(c.total || 0) - (Array.isArray(c.itens) ? c.itens.filter(i => i.tipo !== "UNIDADE").reduce((s,i)=>s+Number(i.total||0),0) : 0) : 0;
        const totalItensUnidade = itens.filter(i => i.tipo === "UNIDADE").reduce((s,i) => s + Number(i.total || 0), 0);
        const total = c.tipo === "PESO" ? totalBase + totalItensUnidade : totalItensUnidade;

        transaction.update(ref, { itens, total, atualizadoEm: serverTimestamp() });
        atualizada = { ...c, itens, total };
    });
    return atualizada;
}

export async function transferirItensComanda(origemId, destinoId) {
    if (!origemId || !destinoId || origemId === destinoId) throw new Error("Selecione duas comandas diferentes.");
    const origemRef = doc(db, "comandas", origemId);
    const destinoRef = doc(db, "comandas", destinoId);
    let resultado;

    await runTransaction(db, async transaction => {
        const [origemSnap, destinoSnap] = await Promise.all([transaction.get(origemRef), transaction.get(destinoRef)]);
        if (!origemSnap.exists() || !destinoSnap.exists()) throw new Error("Comanda de origem ou destino não encontrada.");
        const origem = origemSnap.data();
        const destino = destinoSnap.data();
        if (origem.status !== "ABERTA") throw new Error("A comanda de origem não está aberta.");
        if (destino.status !== "ABERTA") throw new Error("A comanda de destino não está aberta.");
        if (origem.tipo !== "PROVISORIA") throw new Error("Somente uma comanda provisória pode ser transferida.");
        if (destino.tipo !== "PESO") throw new Error("A comanda de destino precisa ser uma comanda de pesagem.");

        const itensOrigem = Array.isArray(origem.itens) ? origem.itens : [];
        if (!itensOrigem.length) throw new Error("A comanda provisória não possui itens para transferir.");

        const itensDestino = Array.isArray(destino.itens) ? destino.itens.map(item => ({ ...item })) : [];
        for (const item of itensOrigem) {
            const idx = itensDestino.findIndex(x => x.produtoId === item.produtoId && x.tipo === item.tipo);
            if (idx >= 0) itensDestino[idx].quantidade = Number(itensDestino[idx].quantidade || 0) + Number(item.quantidade || 0);
            else itensDestino.push({ ...item });
        }
        itensDestino.forEach(item => {
            if (item.tipo === "UNIDADE") item.total = Number(item.preco || 0) * Number(item.quantidade || 0);
        });

        const bebidas = itensDestino.filter(i => i.tipo === "UNIDADE").reduce((s,i)=>s+Number(i.total||0),0);
        const totalPeso = Number(destino.itens?.find(i => i.tipo === "PESO")?.total ?? destino.total ?? 0);
        const novoTotal = totalPeso + bebidas;

        transaction.update(destinoRef, { itens: itensDestino, total: novoTotal, atualizadoEm: serverTimestamp(), recebeuDe: origem.numero, recebeuItensEm: serverTimestamp() });
        transaction.update(origemRef, { status: "TRANSFERIDA", total: 0, itens: [], transferidaPara: destino.numero, transferidaParaId: destinoRef.id, transferidaEm: serverTimestamp(), atualizadoEm: serverTimestamp() });
        resultado = { origemNumero: origem.numero, destinoNumero: destino.numero, total: novoTotal, itens: itensDestino };
    });
    return resultado;
}

export async function buscarComanda(codigo) {
    const valor = String(codigo || "").replace(/\D/g, "");
    if (!valor) return null;

    let resultado = await getDocs(
        query(collection(db, "comandas"), where("codigoBarras", "==", valor))
    );

    if (resultado.empty) {
        resultado = await getDocs(
            query(collection(db, "comandas"), where("numero", "==", valor.padStart(4, "0")))
        );
    }

    if (resultado.empty) return null;
    const docs = resultado.docs.map(d => ({ id: d.id, ...d.data() }));
    const aberta = docs.find(c => c.status === "ABERTA");
    if (aberta) return aberta;
    docs.sort((a, b) => {
        const ta = a.criadoEm?.toMillis?.() || 0;
        const tb = b.criadoEm?.toMillis?.() || 0;
        return tb - ta;
    });
    return docs[0];
}

export async function finalizarComanda(id, pagamento) {
    const caixa = await caixaAberto();
    if (!caixa) throw new Error("Nenhum caixa está aberto. Abra o caixa antes de finalizar vendas.");
    const comandaRef = doc(db, "comandas", id);
    let venda;

    // A atualização da comanda e o lançamento no caixa acontecem juntas.
    // Assim, dois PDVs não conseguem finalizar/cobrar a mesma comanda.
    await runTransaction(db, async (transaction) => {
        const comandaSnap = await transaction.get(comandaRef);
        if (!comandaSnap.exists()) throw new Error("Comanda não encontrada.");

        venda = comandaSnap.data();
        if (venda.status !== "ABERTA") {
            throw new Error(`A comanda ${venda.numero || ""} já foi finalizada ou cancelada.`);
        }

        const movimentoRef = doc(collection(db, MOV));
        transaction.update(comandaRef, {
            status: "FINALIZADA",
            pagamento,
            finalizadoEm: serverTimestamp()
        });
        transaction.set(movimentoRef, {
            caixaId: caixa.id,
            tipo: "VENDA",
            valor: Number(venda.total || 0),
            forma: pagamento,
            descricao: `Comanda ${venda.numero}`,
            referencia: id,
            criadoEm: serverTimestamp()
        });
    });

    // O histórico é atualizado pelo ID da comanda.
    const resultado = await getDocs(
        query(collection(db, "historico"), where("comandaId", "==", id))
    );
    await Promise.all(resultado.docs.map((item) =>
        updateDoc(item.ref, { status: "FINALIZADA", pagamento, valor: Number(venda.total || 0), finalizadoEm: serverTimestamp() })
    ));
}
