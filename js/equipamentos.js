/* NeoScale - equipamentos e estações de trabalho
   Arquitetura escalável: impressoras independentes + estações que apontam para elas.
   Compatível com a configuração legada em configuracoes/principal.
*/
import { db } from "./firebase.js";
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CONFIG_ID = "principal";
const ESTACAO_KEY = "neoscale-estacao-id";

export const tiposEstacao = [
    { value: "balanca", label: "Balança" },
    { value: "caixa", label: "Caixa / PDV" },
    { value: "cozinha", label: "Cozinha" },
    { value: "atendimento", label: "Atendimento" },
    { value: "outro", label: "Outro" }
];

export function idSeguro(texto) {
    return String(texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

export async function listarImpressoras() {
    const snap = await getDocs(query(collection(db, "configuracoes", CONFIG_ID, "impressoras"), orderBy("nome")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function salvarImpressora(dados, id = null) {
    const nome = String(dados.nome || "").trim();
    if (!nome) throw new Error("Informe o nome da impressora.");
    const ref = id ? doc(db, "configuracoes", CONFIG_ID, "impressoras", id) : doc(collection(db, "configuracoes", CONFIG_ID, "impressoras"));
    await setDoc(ref, {
        nome,
        ip: String(dados.ip || "").trim(),
        porta: Math.min(65535, Math.max(1, Number(dados.porta || 9100))),
        servidor: String(dados.servidor || "").trim(),
        modo: dados.modo === "navegador" ? "navegador" : "direta",
        larguraPapel: String(dados.larguraPapel || "80"),
        ativa: dados.ativa !== false,
        atualizadoEm: new Date()
    }, { merge: true });
    return { id: ref.id, nome };
}

export async function removerImpressora(id) {
    await deleteDoc(doc(db, "configuracoes", CONFIG_ID, "impressoras", id));
}

export async function listarEstacoes() {
    const snap = await getDocs(query(collection(db, "configuracoes", CONFIG_ID, "estacoes"), orderBy("nome")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function salvarEstacao(dados, id = null) {
    const nome = String(dados.nome || "").trim();
    if (!nome) throw new Error("Informe o nome da estação.");
    const ref = id ? doc(db, "configuracoes", CONFIG_ID, "estacoes", id) : doc(collection(db, "configuracoes", CONFIG_ID, "estacoes"));
    await setDoc(ref, {
        nome,
        tipo: String(dados.tipo || "outro"),
        impressoraId: String(dados.impressoraId || ""),
        baudRate: Number(dados.baudRate || 9600),
        ativa: dados.ativa !== false,
        atualizadoEm: new Date()
    }, { merge: true });
    return { id: ref.id, nome };
}

export async function removerEstacao(id) {
    await deleteDoc(doc(db, "configuracoes", CONFIG_ID, "estacoes", id));
    if (localStorage.getItem(ESTACAO_KEY) === id) localStorage.removeItem(ESTACAO_KEY);
}

export function definirEstacaoAtual(id) {
    if (id) localStorage.setItem(ESTACAO_KEY, id); else localStorage.removeItem(ESTACAO_KEY);
}

export function obterEstacaoAtualId() {
    return localStorage.getItem(ESTACAO_KEY) || "";
}

export async function obterEstacaoAtual() {
    const id = obterEstacaoAtualId();
    if (!id) return null;
    const snap = await getDoc(doc(db, "configuracoes", CONFIG_ID, "estacoes", id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function carregarConfiguracaoImpressaoPorEstacao(estacaoId = "") {
    const principal = await getDoc(doc(db, "configuracoes", CONFIG_ID));
    const legado = principal.exists() ? principal.data() : {};
    const id = estacaoId || obterEstacaoAtualId();
    if (!id) return legado;

    const estacaoSnap = await getDoc(doc(db, "configuracoes", CONFIG_ID, "estacoes", id));
    if (!estacaoSnap.exists()) return legado;
    const estacao = estacaoSnap.data();
    let impressora = {};
    if (estacao.impressoraId) {
        const impSnap = await getDoc(doc(db, "configuracoes", CONFIG_ID, "impressoras", estacao.impressoraId));
        if (impSnap.exists()) impressora = impSnap.data();
    }
    return {
        ...legado,
        estacaoId: id,
        estacaoNome: estacao.nome || "",
        tipoEstacao: estacao.tipo || "outro",
        modoImpressao: impressora.modo || legado.modoImpressao || "navegador",
        servidorImpressao: impressora.servidor || legado.servidorImpressao || "",
        ipImpressora: impressora.ip || legado.ipImpressora || "",
        portaImpressora: impressora.porta || legado.portaImpressora || 9100,
        larguraPapel: impressora.larguraPapel || legado.larguraPapel || "80",
        baudRate: estacao.baudRate || 9600
    };
}

window.NeoEquipamentos = { listarImpressoras, salvarImpressora, removerImpressora, listarEstacoes, salvarEstacao, removerEstacao, definirEstacaoAtual, obterEstacaoAtualId, obterEstacaoAtual };
