/* NeoScale - cadastro de produtos */
import { db } from "./firebase.js";
import { collection, addDoc, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const nomeProduto=document.getElementById("nomeProduto");
const precoProduto=document.getElementById("precoProduto");
const categoriaProduto=document.getElementById("categoriaProduto");
const tipoVendaProduto=document.getElementById("tipoVendaProduto");
const labelPreco=document.getElementById("labelPrecoProduto");
const botaoSalvar=document.getElementById("btnSalvarProduto");
const tabela=document.getElementById("listaProdutos");

function atualizarRotulo(){
  const peso=tipoVendaProduto.value==="peso";
  labelPreco.textContent=peso?"Preço por Kg":"Preço por unidade";
  precoProduto.placeholder=peso?"89.90":"22.00";
}
tipoVendaProduto?.addEventListener("change",atualizarRotulo);
atualizarRotulo();

async function salvarProduto(){
  const nome=nomeProduto.value.trim();
  const preco=Number(precoProduto.value);
  const categoria=categoriaProduto.value.trim();
  const tipo=tipoVendaProduto.value;
  if(!nome||!preco||preco<0){alert("Informe nome e preço do produto.");return;}
  try{
    const dados={nome,categoria,ativo:true,tipoVenda:tipo,criadoEm:serverTimestamp()};
    if(tipo==="peso") dados.precoKg=preco;
    else dados.precoUnit=preco;
    await addDoc(collection(db,"produtos"),dados);
    alert("Produto cadastrado com sucesso!");
    nomeProduto.value="";precoProduto.value="";categoriaProduto.value="";
    carregarProdutos();
  }catch(error){console.error(error);alert("Erro ao salvar produto.");}
}

async function carregarProdutos(){
  if(!tabela)return;
  tabela.innerHTML='<tr><td colspan="5">Carregando...</td></tr>';
  try{
    const consulta=await getDocs(collection(db,"produtos"));
    tabela.innerHTML="";
    if(consulta.empty){tabela.innerHTML='<tr><td colspan="5">Nenhum produto cadastrado.</td></tr>';return;}
    consulta.forEach(d=>{
      const p=d.data();
      const peso=p.tipoVenda==="peso" || (!p.tipoVenda && p.precoKg!=null);
      const preco=Number(peso?p.precoKg:(p.precoUnit??p.preco??0));
      tabela.innerHTML+=`<tr>
        <td>${p.nome||"-"}</td>
        <td>${p.categoria||"-"}</td>
        <td>${peso?"Por peso":"Por unidade"}</td>
        <td>R$ ${preco.toFixed(2).replace(".",",")}${peso?"/kg":""}</td>
        <td><span class="status-ativo">Ativo</span></td>
      </tr>`;
    });
  }catch(error){console.error(error);tabela.innerHTML='<tr><td colspan="5">Erro ao carregar produtos.</td></tr>';}
}
botaoSalvar?.addEventListener("click",salvarProduto);
document.addEventListener("DOMContentLoaded",carregarProdutos);
