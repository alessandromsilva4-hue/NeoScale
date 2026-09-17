import { auth, db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const ROTAS_POR_PERFIL = {
    ADMINISTRADOR: ["dashboard", "pesagem", "pdv", "caixa", "financeiro", "fechamento", "produtos", "historico", "configuracoes", "fiscal", "delivery", "cozinha"],
    CAIXA: ["dashboard", "pdv", "caixa", "historico", "delivery", "cozinha"],
    OPERADOR: ["dashboard", "pesagem", "historico", "delivery", "cozinha"]
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
            const funcao = perfil?.funcao || "ADMINISTRADOR";
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
