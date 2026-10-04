import { auth, db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const ROTAS_POR_PERFIL = {
    ADMINISTRADOR: ["dashboard", "central", "clientes", "mesas", "comandas", "ficha-tecnica", "pesagem", "pdv", "caixa", "caixa-delivery", "financeiro", "fechamento", "produtos", "historico", "configuracoes", "usuarios", "fiscal", "delivery", "cozinha", "estoque", "compras", "relatorios", "quiosque", "garcom", "reposicao-buffet", "reposicao-cozinha"],
    CAIXA: ["dashboard", "central", "clientes", "comandas", "pdv", "caixa", "caixa-delivery", "historico", "delivery", "cozinha", "garcom", "reposicao-buffet", "reposicao-cozinha"],
    OPERADOR: ["dashboard", "central", "pesagem", "comandas", "historico", "delivery", "cozinha", "reposicao-buffet", "reposicao-cozinha"],
    GARCOM: ["dashboard", "central", "garcom", "comandas"],
    REPOSITOR: ["dashboard", "central", "reposicao-buffet", "reposicao-cozinha"]
};

async function obterPerfil(uid) {
    const perfil = await getDoc(doc(db, "usuarios", uid));
    return perfil.exists() ? perfil.data() : null;
}

export function protegerPagina(pagina) {
    onAuthStateChanged(auth, async (usuario) => {
        if (!usuario) {
            window.location.replace("index.html");
            return;
        }

        try {
            const perfil = await obterPerfil(usuario.uid);
            // Durante a migração, os usuários já existentes continuam operando.
            // Ao publicar as novas regras, crie o perfil de cada usuário no Firestore.
            if (perfil && perfil.ativo === false) {
                await signOut(auth);
                alert("Este acesso está desativado. Procure o administrador do restaurante.");
                window.location.replace("index.html");
                return;
            }
            // Aceita perfis antigos e novos (ex.: GARCOM, GARÇOM, garcom, "Garçom").
            // O valor armazenado no Firestore é normalizado antes da checagem de rotas.
            const valorFuncao = perfil?.funcao ?? perfil?.perfil ?? perfil?.role ?? "ADMINISTRADOR";
            const funcao = String(valorFuncao)
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^A-Za-z0-9]/g, "")
                .toUpperCase();

            if (!(ROTAS_POR_PERFIL[funcao] || []).includes(pagina)) {
                alert("Seu perfil não tem permissão para acessar esta tela.");
                window.location.replace("dashboard.html");
            }
        } catch (erro) {
            console.error("Não foi possível validar a sessão.", erro);
            window.location.replace("index.html");
        }
    });

    document.querySelectorAll(".sidebar-footer button").forEach((botao) => {
        botao.addEventListener("click", (evento) => {
            evento.preventDefault();
            evento.stopImmediatePropagation();
            encerrarSessao().catch((erro) => console.error("Não foi possível encerrar a sessão.", erro));
        }, true);
    });

    document.querySelectorAll(".sidebar-footer button").forEach((botao) => {
        botao.addEventListener("click", (evento) => {
            evento.preventDefault();
            encerrarSessao().catch((erro) => console.error("Não foi possível encerrar a sessão.", erro));
        });
    });
}

export async function encerrarSessao() {
    await signOut(auth);
    window.location.replace("index.html");
}
