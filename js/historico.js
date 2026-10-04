/* ==========================================
   NeoScale - HISTÓRICO DE COMANDAS
   Filtro por data com período inclusivo
========================================== */

import { db } from "./firebase.js";
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const tabela = document.getElementById("tabelaHistorico");
const dataInicio = document.getElementById("dataInicio");
const dataFim = document.getElementById("dataFim");
const resumo = document.getElementById("historicoResumo");
const botoesPeriodo = [...document.querySelectorAll("[data-periodo]")];
const limparFiltro = document.getElementById("limparFiltro");

let registros = [];

function paraData(v) {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate();
  if (v.seconds) return new Date(v.seconds * 1000);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatarData(v) {
  const d = paraData(v);
  if (!d) return "-";
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit"});
}

function hojeISO() {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d.toISOString().slice(0,10);
}

function isoDiasAtras(n) {
  const d = new Date();
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0,10);
}

function aplicarPeriodo(tipo) {
  botoesPeriodo.forEach(b => b.classList.toggle("ativo", b.dataset.periodo === tipo));
  if (tipo === "hoje") {
    dataInicio.value = hojeISO();
    dataFim.value = hojeISO();
  } else if (tipo === "7") {
    dataInicio.value = isoDiasAtras(6);
    dataFim.value = hojeISO();
  } else if (tipo === "30") {
    dataInicio.value = isoDiasAtras(29);
    dataFim.value = hojeISO();
  } else {
    dataInicio.value = "";
    dataFim.value = "";
  }
  renderizar();
}

function dentroDoPeriodo(v) {
  const d = paraData(v);
  if (!d) return false;
  const inicio = dataInicio.value ? new Date(dataInicio.value + "T00:00:00") : null;
  const fim = dataFim.value ? new Date(dataFim.value + "T23:59:59.999") : null;
  if (inicio && d < inicio) return false;
  if (fim && d > fim) return false;
  return true;
}

function renderizar() {
  if (!tabela) return;
  const filtrados = registros.filter(x => dentroDoPeriodo(x.data));
  tabela.innerHTML = filtrados.map(dados => `
    <tr>
      <td>${formatarData(dados.data)}</td>
      <td>${Number(dados.peso || 0).toFixed(3)} kg</td>
      <td>R$ ${Number(dados.valor || 0).toLocaleString("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
      <td>${dados.frase || "-"}</td>
    </tr>
  `).join("") || `<tr><td colspan="4" class="historico-vazio">Nenhum registro encontrado para o período.</td></tr>`;

  const total = filtrados.reduce((s,x) => s + Number(x.valor || 0), 0);
  if (resumo) resumo.textContent = `${filtrados.length} registro${filtrados.length === 1 ? "" : "s"} encontrado${filtrados.length === 1 ? "" : "s"} • Total R$ ${total.toLocaleString("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2})}`;
}

async function carregarHistorico() {
  if (!tabela) return;
  tabela.innerHTML = `<tr><td colspan="4" class="historico-vazio">Carregando histórico...</td></tr>`;
  try {
    const consulta = query(collection(db, "historico"), orderBy("data", "desc"));
    const resultado = await getDocs(consulta);
    registros = resultado.docs.map(d => ({ id:d.id, ...d.data() }));
    aplicarPeriodo("hoje");
  } catch (e) {
    console.error(e);
    tabela.innerHTML = `<tr><td colspan="4" class="historico-vazio">Não foi possível carregar o histórico.</td></tr>`;
    if (resumo) resumo.textContent = "Erro ao carregar histórico";
  }
}

dataInicio?.addEventListener("change", () => {
  botoesPeriodo.forEach(b => b.classList.remove("ativo"));
  renderizar();
});
dataFim?.addEventListener("change", () => {
  botoesPeriodo.forEach(b => b.classList.remove("ativo"));
  renderizar();
});
botoesPeriodo.forEach(b => b.addEventListener("click", () => aplicarPeriodo(b.dataset.periodo)));
limparFiltro?.addEventListener("click", () => aplicarPeriodo("todos"));

carregarHistorico();
