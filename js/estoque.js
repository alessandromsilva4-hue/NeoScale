/* NeoScale - Controle de Estoque */
import { db } from './firebase.js';
import {
  collection, getDocs, doc, runTransaction, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const tabela = document.getElementById('listaEstoque');
const busca = document.getElementById('buscaEstoque');
const btnAtualizar = document.getElementById('btnAtualizarEstoque');
const totalProdutos = document.getElementById('totalProdutos');
const totalOk = document.getElementById('totalOk');
const totalBaixo = document.getElementById('totalBaixo');
const totalZerado = document.getElementById('totalZerado');
const modal = document.getElementById('modalMovimentoEstoque');
const fechar = document.getElementById('fecharMovimentoEstoque');
const cancelar = document.getElementById('cancelarMovimentoEstoque');
const salvar = document.getElementById('salvarMovimentoEstoque');
const nomeMovimento = document.getElementById('produtoMovimentoNome');
const tipoMovimento = document.getElementById('tipoMovimentoEstoque');
const quantidadeMovimento = document.getElementById('quantidadeMovimento');
const observacaoMovimento = document.getElementById('observacaoMovimento');

let produtos = [];
let produtoSelecionado = null;

function escapar(valor) {
  return String(valor ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function numero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function formatarQuantidade(valor, tipoVenda) {
  const casas = tipoVenda === 'peso' ? 3 : 0;
  return `${numero(valor).toFixed(casas).replace('.', ',')} ${tipoVenda === 'peso' ? 'kg' : 'un.'}`;
}

function statusEstoque(saldo, minimo) {
  if (saldo <= 0) return ['zerado','Sem estoque'];
  if (saldo <= minimo) return ['baixo','Estoque baixo'];
  return ['ok','Normal'];
}

function fecharModal() {
  modal.hidden = true;
  produtoSelecionado = null;
  quantidadeMovimento.value = '';
  observacaoMovimento.value = '';
  tipoMovimento.value = 'entrada';
}

function abrirModal(id) {
  const item = produtos.find(p => p.id === id);
  if (!item) return;
  produtoSelecionado = item;
  nomeMovimento.textContent = `${item.nome} • saldo atual: ${formatarQuantidade(item.estoqueAtual, item.tipoVenda)}`;
  quantidadeMovimento.value = '';
  observacaoMovimento.value = '';
  tipoMovimento.value = 'entrada';
  modal.hidden = false;
  quantidadeMovimento.focus();
}

function renderizar() {
  const termo = busca.value.trim().toLocaleLowerCase('pt-BR');
  const lista = produtos.filter(p => `${p.nome} ${p.categoria}`.toLocaleLowerCase('pt-BR').includes(termo));

  totalProdutos.textContent = produtos.length;
  totalOk.textContent = produtos.filter(p => statusEstoque(p.estoqueAtual,p.estoqueMinimo)[0] === 'ok').length;
  totalBaixo.textContent = produtos.filter(p => statusEstoque(p.estoqueAtual,p.estoqueMinimo)[0] === 'baixo').length;
  totalZerado.textContent = produtos.filter(p => statusEstoque(p.estoqueAtual,p.estoqueMinimo)[0] === 'zerado').length;

  if (!lista.length) {
    tabela.innerHTML = `<tr><td colspan="7" class="empty-estoque">${produtos.length ? 'Nenhum produto encontrado.' : 'Nenhum produto cadastrado. Cadastre os produtos primeiro.'}</td></tr>`;
    return;
  }

  tabela.innerHTML = lista.map(p => {
    const [classe, label] = statusEstoque(p.estoqueAtual, p.estoqueMinimo);
    return `<tr>
      <td><strong>${escapar(p.nome || '-')}</strong></td>
      <td>${escapar(p.categoria || '-')}</td>
      <td>${p.tipoVenda === 'peso' ? 'Por peso' : 'Por unidade'}</td>
      <td>${formatarQuantidade(p.estoqueAtual,p.tipoVenda)}</td>
      <td>${formatarQuantidade(p.estoqueMinimo,p.tipoVenda)}</td>
      <td><span class="status-estoque status-${classe}">${label}</span></td>
      <td><div class="acoes-estoque"><button class="acao-estoque" type="button" data-movimento="${p.id}" title="Movimentar estoque"><i class="bi bi-arrow-left-right"></i></button></div></td>
    </tr>`;
  }).join('');
}

async function carregar() {
  tabela.innerHTML = '<tr><td colspan="7" class="empty-estoque">Carregando estoque...</td></tr>';
  try {
    const snap = await getDocs(collection(db,'produtos'));
    produtos = [];
    snap.forEach(d => {
      const p = d.data();
      if (p.ativo === false) return;
      produtos.push({
        id:d.id,
        nome:p.nome || '',
        categoria:p.categoria || '',
        tipoVenda:p.tipoVenda === 'peso' ? 'peso' : 'unidade',
        estoqueAtual:numero(p.estoqueAtual),
        estoqueMinimo:numero(p.estoqueMinimo)
      });
    });
    produtos.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
    renderizar();
  } catch (e) {
    console.error('Erro ao carregar estoque:', e);
    tabela.innerHTML = '<tr><td colspan="7" class="empty-estoque">Não foi possível carregar o estoque. Verifique sua conexão e as permissões do Firebase.</td></tr>';
  }
}

async function salvarMovimento() {
  if (!produtoSelecionado) return;
  const quantidade = numero(quantidadeMovimento.value);
  if (quantidade <= 0) { alert('Informe uma quantidade maior que zero.'); quantidadeMovimento.focus(); return; }

  const tipo = tipoMovimento.value;
  const produtoId = produtoSelecionado.id;
  const produtoRef = doc(db,'produtos',produtoId);
  const novoSaldoEsperado = produtoSelecionado.estoqueAtual + (tipo === 'entrada' ? quantidade : -quantidade);
  if (novoSaldoEsperado < 0) { alert('A saída não pode deixar o estoque negativo.'); return; }

  salvar.disabled = true;
  try {
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(produtoRef);
      if (!snap.exists()) throw new Error('Produto não encontrado.');
      const dados = snap.data();
      const saldoAtual = numero(dados.estoqueAtual);
      const novoSaldo = saldoAtual + (tipo === 'entrada' ? quantidade : -quantidade);
      if (novoSaldo < 0) throw new Error('SALDO_INSUFICIENTE');
      transaction.update(produtoRef, { estoqueAtual: novoSaldo, atualizadoEm: serverTimestamp() });
      const movimentoRef = doc(collection(db,'estoqueMovimentos'));
      transaction.set(movimentoRef, {
        produtoId,
        produtoNome: dados.nome || produtoSelecionado.nome,
        tipo,
        quantidade,
        saldoAnterior: saldoAtual,
        saldoNovo: novoSaldo,
        observacao: observacaoMovimento.value.trim(),
        criadoEm: serverTimestamp()
      });
    });
    fecharModal();
    await carregar();
  } catch (e) {
    console.error('Erro ao movimentar estoque:', e);
    alert(e.message === 'SALDO_INSUFICIENTE' ? 'Estoque insuficiente para essa saída.' : 'Não foi possível salvar o movimento. Verifique as permissões do Firebase.');
  } finally { salvar.disabled = false; }
}


tabela.addEventListener('click', e => {
  const btn = e.target.closest('[data-movimento]');
  if (btn) abrirModal(btn.dataset.movimento);
});
busca.addEventListener('input', renderizar);
btnAtualizar.addEventListener('click', carregar);
fechar.addEventListener('click', fecharModal);
cancelar.addEventListener('click', fecharModal);
salvar.addEventListener('click', salvarMovimento);
modal.addEventListener('click', e => { if (e.target === modal) fecharModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) fecharModal(); });

carregar();
