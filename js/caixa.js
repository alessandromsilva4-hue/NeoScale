import { db } from './firebase.js';
import { collection, addDoc, query, where, orderBy, limit, getDocs, updateDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const CAIXAS='caixas', MOV='movimentosCaixa';
export async function caixaAberto(){
 const q=query(collection(db,CAIXAS),where('status','==','ABERTO'),orderBy('abertoEm','desc'),limit(1));
 const s=await getDocs(q); if(s.empty)return null; return {id:s.docs[0].id,...s.docs[0].data()};
}
export async function abrirCaixa(valorInicial, operador='Operador'){
 if(await caixaAberto()) throw new Error('Já existe um caixa aberto.');
 const ref=await addDoc(collection(db,CAIXAS),{operador,valorInicial:Number(valorInicial||0),status:'ABERTO',abertoEm:serverTimestamp(),fechadoEm:null});
 return {id:ref.id};
}
export async function registrarMovimento({caixaId,tipo,valor,forma='Dinheiro',descricao='',referencia=null}){
 return addDoc(collection(db,MOV),{caixaId,tipo,valor:Number(valor||0),forma,descricao,referencia,criadoEm:serverTimestamp()});
}
export async function fecharCaixa(caixaId, valorContado){
 const ref=doc(db,CAIXAS,caixaId); await updateDoc(ref,{status:'FECHADO',valorContado:Number(valorContado||0),fechadoEm:serverTimestamp()});
}
export async function listarCaixas(){
 const q=query(collection(db,CAIXAS),orderBy('abertoEm','desc')); const s=await getDocs(q); return s.docs.map(d=>({id:d.id,...d.data()}));
}
export async function listarMovimentos(caixaId=null){
 let q=caixaId?query(collection(db,MOV),where('caixaId','==',caixaId),orderBy('criadoEm','desc')):query(collection(db,MOV),orderBy('criadoEm','desc'));
 const s=await getDocs(q); return s.docs.map(d=>({id:d.id,...d.data()}));
}
export function calcularCaixa(caixa,movs){
 const entrada=movs.filter(m=>['VENDA','SUPRIMENTO'].includes(m.tipo)).reduce((a,m)=>a+Number(m.valor||0),0);
 const saida=movs.filter(m=>['SANGRIA','DESPESA'].includes(m.tipo)).reduce((a,m)=>a+Number(m.valor||0),0);
 return {entrada,saida,esperado:Number(caixa?.valorInicial||0)+entrada-saida};
}
