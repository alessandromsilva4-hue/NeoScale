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
    return runTransaction(db, async (transaction) => {
        const ref = doc(db, "configuracoes", "contadorComandas");
        const snap = await transaction.get(ref);
        const atual = Number(snap.exists() ? snap.data().valor || 0 : 0);
        const proximo = atual + 1;
        transaction.set(ref, { valor: proximo, atualizadoEm: serverTimestamp() }, { merge: true });
        return String(proximo).padStart(6, "0");
    });
}

export async function criarComanda({ peso, precoKg, total, produto = "Buffet por quilo" }) {
    const numero = await proximaComanda();
    const codigoBarras = `2${numero}000`; // número interno único e estável para leitura no PDV

    const ref = await addDoc(collection(db, "comandas"), {
        numero,
        codigoBarras,
        produto,
        peso: Number(peso),
        precoKg: Number(precoKg),
        total: Number(total),
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

export async function buscarComanda(codigo) {
    const valor = String(codigo || "").replace(/\D/g, "");
    if (!valor) return null;

    let resultado = await getDocs(
        query(collection(db, "comandas"), where("codigoBarras", "==", valor))
    );

    if (resultado.empty) {
        resultado = await getDocs(
            query(collection(db, "comandas"), where("numero", "==", valor.padStart(6, "0")))
        );
    }

    if (resultado.empty) return null;
    const item = resultado.docs[0];
    return { id: item.id, ...item.data() };
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
        updateDoc(item.ref, { status: "FINALIZADA", pagamento, finalizadoEm: serverTimestamp() })
    ));
}
