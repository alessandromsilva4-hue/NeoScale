/* ==========================================
   NeoScale - Produtos
   Cadastro + edição + ativação/desativação
========================================== */

import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const nomeProduto = document.getElementById("nomeProduto");
const precoProduto = document.getElementById("precoProduto");
const categoriaProduto = document.getElementById("categoriaProduto");
const tipoVendaProduto = document.getElementById("tipoVendaProduto");
const labelPreco = document.getElementById("labelPrecoProduto");
const botaoSalvar = document.getElementById("btnSalvarProduto");
const botaoCancelar = document.getElementById("btnCancelarEdicao");
const tituloFormulario = document.getElementById("tituloFormularioProduto");
const tabela = document.getElementById("listaProdutos");

let produtoEditandoId = null;

function atualizarRotulo() {
  const peso = tipoVendaProduto.value === "peso";
  labelPreco.textContent = peso ? "Preço por Kg" : "Preço por unidade";
  precoProduto.placeholder = peso ? "89.90" : "22.00";
}

tipoVendaProduto?.addEventListener("change", atualizarRotulo);
atualizarRotulo();

function escaparHTML(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatarPreco(valor, peso) {
  const preco = Number(valor || 0);
  return `R$ ${preco.toFixed(2).replace(".", ",")}${peso ? "/kg" : ""}`;
}

function limparFormulario() {
  produtoEditandoId = null;
  nomeProduto.value = "";
  precoProduto.value = "";
  categoriaProduto.value = "";
  tipoVendaProduto.value = "unidade";
  atualizarRotulo();

  tituloFormulario.textContent = "Novo Produto";
  botaoSalvar.innerHTML = '<i class="bi bi-plus-circle"></i> Salvar Produto';
  botaoCancelar.hidden = true;
}

function preencherFormulario(id, produto) {
  produtoEditandoId = id;
  nomeProduto.value = produto.nome || "";
  categoriaProduto.value = produto.categoria || "";

  const peso = produto.tipoVenda === "peso" || (!produto.tipoVenda && produto.precoKg != null);
  tipoVendaProduto.value = peso ? "peso" : "unidade";
  precoProduto.value = peso
    ? Number(produto.precoKg ?? 0)
    : Number(produto.precoUnit ?? produto.preco ?? 0);

  atualizarRotulo();
  tituloFormulario.textContent = "Editar Produto";
  botaoSalvar.innerHTML = '<i class="bi bi-check-circle"></i> Salvar Alterações';
  botaoCancelar.hidden = false;

  document.querySelector(".form-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  nomeProduto.focus();
}

async function salvarProduto() {
  const nome = nomeProduto.value.trim();
  const preco = Number(precoProduto.value);
  const categoria = categoriaProduto.value.trim();
  const tipo = tipoVendaProduto.value;

  if (!nome) {
    alert("Informe o nome do produto.");
    nomeProduto.focus();
    return;
  }

  if (!Number.isFinite(preco) || preco < 0) {
    alert("Informe um preço válido.");
    precoProduto.focus();
    return;
  }

  botaoSalvar.disabled = true;

  try {
    const dados = {
      nome,
      categoria,
      ativo: true,
      tipoVenda: tipo,
      atualizadoEm: serverTimestamp()
    };

    if (tipo === "peso") {
      dados.precoKg = preco;
      dados.precoUnit = null;
    } else {
      dados.precoUnit = preco;
      dados.precoKg = null;
    }

    if (produtoEditandoId) {
      await updateDoc(doc(db, "produtos", produtoEditandoId), dados);
      alert("Produto atualizado com sucesso!");
    } else {
      dados.criadoEm = serverTimestamp();
      await addDoc(collection(db, "produtos"), dados);
      alert("Produto cadastrado com sucesso!");
    }

    limparFormulario();
    await carregarProdutos();
  } catch (error) {
    console.error("Erro ao salvar produto:", error);
    alert("Erro ao salvar o produto. Verifique a conexão e as permissões do Firebase.");
  } finally {
    botaoSalvar.disabled = false;
  }
}

async function alternarStatusProduto(id, ativo) {
  const novoStatus = !ativo;
  const acao = novoStatus ? "ativar" : "desativar";

  if (!confirm(`Deseja ${acao} este produto?`)) return;

  try {
    await updateDoc(doc(db, "produtos", id), {
      ativo: novoStatus,
      atualizadoEm: serverTimestamp()
    });
    await carregarProdutos();
  } catch (error) {
    console.error("Erro ao alterar status:", error);
    alert("Não foi possível alterar o status do produto.");
  }
}

async function excluirProduto(id, nome) {
  const confirmacao = confirm(
    `Excluir o produto "${nome}"?\n\nEssa ação remove o cadastro do produto do Firestore.`
  );
  if (!confirmacao) return;

  try {
    await deleteDoc(doc(db, "produtos", id));
    if (produtoEditandoId === id) limparFormulario();
    await carregarProdutos();
  } catch (error) {
    console.error("Erro ao excluir produto:", error);
    alert("Não foi possível excluir o produto.");
  }
}

function editarProduto(id) {
  const produto = window.__neoScaleProdutos?.find(item => item.id === id);
  if (!produto) return;
  preencherFormulario(id, produto.data);
}

async function carregarProdutos() {
  if (!tabela) return;

  tabela.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';

  try {
    const consulta = await getDocs(collection(db, "produtos"));
    const produtos = [];

    consulta.forEach(d => produtos.push({ id: d.id, data: d.data() }));
    window.__neoScaleProdutos = produtos;

    tabela.innerHTML = "";

    if (!produtos.length) {
      tabela.innerHTML = '<tr><td colspan="6">Nenhum produto cadastrado.</td></tr>';
      return;
    }

    produtos.sort((a, b) => String(a.data.nome || "").localeCompare(String(b.data.nome || ""), "pt-BR"));

    produtos.forEach(({ id, data: p }) => {
      const peso = p.tipoVenda === "peso" || (!p.tipoVenda && p.precoKg != null);
      const preco = Number(peso ? p.precoKg : (p.precoUnit ?? p.preco ?? 0));
      const ativo = p.ativo !== false;
      const nome = escaparHTML(p.nome || "-");

      const linha = document.createElement("tr");
      linha.innerHTML = `
        <td>${nome}</td>
        <td>${escaparHTML(p.categoria || "-")}</td>
        <td>${peso ? "Por peso" : "Por unidade"}</td>
        <td>${formatarPreco(preco, peso)}</td>
        <td><span class="status-${ativo ? "ativo" : "inativo"}">${ativo ? "Ativo" : "Inativo"}</span></td>
        <td class="acoes-produto">
          <button type="button" class="acao-btn editar" data-acao="editar" data-id="${id}" title="Editar">
            <i class="bi bi-pencil"></i>
          </button>
          <button type="button" class="acao-btn ${ativo ? "desativar" : "ativar"}" data-acao="status" data-id="${id}" data-ativo="${ativo}" title="${ativo ? "Desativar" : "Ativar"}">
            <i class="bi bi-${ativo ? "pause-circle" : "play-circle"}"></i>
          </button>
          <button type="button" class="acao-btn excluir" data-acao="excluir" data-id="${id}" title="Excluir">
            <i class="bi bi-trash"></i>
          </button>
        </td>`;

      tabela.appendChild(linha);
    });
  } catch (error) {
    console.error("Erro ao carregar produtos:", error);
    tabela.innerHTML = '<tr><td colspan="6">Erro ao carregar produtos.</td></tr>';
  }
}

tabela?.addEventListener("click", async event => {
  const botao = event.target.closest("button[data-acao]");
  if (!botao) return;

  const id = botao.dataset.id;
  const produto = window.__neoScaleProdutos?.find(item => item.id === id)?.data;
  if (!produto) return;

  if (botao.dataset.acao === "editar") {
    editarProduto(id);
  } else if (botao.dataset.acao === "status") {
    await alternarStatusProduto(id, botao.dataset.ativo === "true");
  } else if (botao.dataset.acao === "excluir") {
    await excluirProduto(id, produto.nome || "produto");
  }
});

botaoSalvar?.addEventListener("click", salvarProduto);
botaoCancelar?.addEventListener("click", limparFormulario);

carregarProdutos();
