import { caixaAberto, registrarMovimento, listarMovimentos } from "./caixa.js";

const $ = (id) => document.getElementById(id);
const moeda = (valor) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
let caixa = null;
let movimentos = [];

function escaparHtml(valor) {
  return String(valor ?? "").replace(/[&<>'"]/g, (caractere) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[caractere]));
}
function dataMovimento(valor) { return valor?.toDate ? valor.toDate() : (valor ? new Date(valor) : null); }
function tipoVisual(tipo) {
  const chave = String(tipo || "").toLowerCase();
  const saida = ["despesa", "sangria"].includes(chave);
  return `<span class="tipo-badge tipo-${chave}"><i class="bi bi-${saida ? "arrow-up-right" : "arrow-down-left"}"></i>${escaparHtml(tipo || "—")}</span>`;
}
function filtrarMovimentos() {
  const busca = $("buscarMovimentacao").value.trim().toLowerCase();
  const periodo = $("periodoMovimentacao").value;
  const agora = new Date();
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const limite = periodo === "todos" ? null : new Date(inicioHoje);
  if (periodo !== "todos" && periodo !== "hoje") limite.setDate(limite.getDate() - Number(periodo) + 1);
  return movimentos.filter((movimento) => {
    const data = dataMovimento(movimento.criadoEm);
    const texto = `${movimento.tipo || ""} ${movimento.forma || ""} ${movimento.descricao || ""}`.toLowerCase();
    return (!busca || texto.includes(busca)) && (!limite || (data && data >= limite));
  });
}
function renderizarTabela() {
  const lista = filtrarMovimentos();
  $("resultadoInfo").textContent = lista.length === 1 ? "1 movimentação encontrada" : `${lista.length} movimentações encontradas`;
  if (!lista.length) {
    $("lista").innerHTML = '<table class="table"><tbody><tr><td class="vazio" colspan="5"><i class="bi bi-inbox"></i>Nenhuma movimentação encontrada para este filtro.</td></tr></tbody></table>';
    return;
  }
  $("lista").innerHTML = `<table class="table"><thead><tr><th>Data e hora</th><th>Tipo</th><th>Forma</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>${lista.slice(0, 100).map((movimento) => {
    const saida = ["DESPESA", "SANGRIA"].includes(movimento.tipo);
    const data = dataMovimento(movimento.criadoEm);
    return `<tr><td>${data ? data.toLocaleString("pt-BR") : "—"}</td><td>${tipoVisual(movimento.tipo)}</td><td>${escaparHtml(movimento.forma || "—")}</td><td>${escaparHtml(movimento.descricao || "Sem descrição")}</td><td class="${saida ? "valor-saida" : "valor-entrada"}">${saida ? "− " : "+ "}${moeda(movimento.valor)}</td></tr>`;
  }).join("")}</tbody></table>`;
}
async function carregar() {
  const status = $("financeiroStatus");
  try {
    status.innerHTML = '<i class="bi bi-arrow-repeat"></i> Atualizando dados';
    caixa = await caixaAberto();
    movimentos = await listarMovimentos();
    let receitas = 0, despesas = 0, pix = 0;
    movimentos.forEach((movimento) => {
      const valor = Number(movimento.valor || 0);
      if (["VENDA", "SUPRIMENTO"].includes(movimento.tipo)) receitas += valor; else despesas += valor;
      if (movimento.forma === "PIX" && movimento.tipo === "VENDA") pix += valor;
    });
    $("receitas").textContent = moeda(receitas); $("despesas").textContent = moeda(despesas); $("pix").textContent = moeda(pix); $("saldo").textContent = moeda(receitas - despesas);
    renderizarTabela(); status.innerHTML = '<i class="bi bi-check-circle-fill"></i> Dados atualizados';
  } catch (erro) {
    console.error("Erro ao carregar o financeiro.", erro);
    $("resultadoInfo").textContent = "Não foi possível carregar os dados";
    $("lista").innerHTML = '<table class="table"><tbody><tr><td class="vazio" colspan="5"><i class="bi bi-exclamation-circle"></i>Verifique sua conexão com o Firebase e tente novamente.</td></tr></tbody></table>';
    status.innerHTML = '<i class="bi bi-exclamation-triangle-fill"></i> Falha ao atualizar';
  }
}
$("nova").addEventListener("click", () => { if (!caixa) { alert("Abra o caixa antes de registrar uma movimentação."); return; } $("formBox").classList.toggle("hidden"); if (!$("formBox").classList.contains("hidden")) $("valor").focus(); });
$("cancelarMovimentacao").addEventListener("click", () => $("formBox").classList.add("hidden"));
$("salvar").addEventListener("click", async () => {
  const valor = Number($("valor").value);
  if (!caixa || !Number.isFinite(valor) || valor <= 0) { alert("Informe um valor maior que zero."); $("valor").focus(); return; }
  const botao = $("salvar"); botao.disabled = true;
  try { await registrarMovimento({ caixaId: caixa.id, tipo: $("tipo").value, valor, forma: $("forma").value, descricao: $("descricao").value.trim() }); $("valor").value = ""; $("descricao").value = ""; $("formBox").classList.add("hidden"); await carregar(); }
  catch (erro) { console.error(erro); alert("Não foi possível salvar a movimentação."); }
  finally { botao.disabled = false; }
});
$("atualizar").addEventListener("click", carregar);
$("buscarMovimentacao").addEventListener("input", renderizarTabela);
$("periodoMovimentacao").addEventListener("change", renderizarTabela);
carregar();
