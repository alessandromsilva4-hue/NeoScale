/* ==========================================
   NeoScale
   CONFIGURAÇÕES.JS
========================================== */


console.log("NEOSCALE CONFIGURAÇÕES CARREGADO");



import { db } from "./firebase.js";



import {

    collection,

    addDoc,

    getDocs,

    query,

    limit

}

from

"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";







// ==========================================
// CAMPOS
// ==========================================


const nomeRestaurante =

document.getElementById(
"nomeRestaurante"
);



const precoPadrao =

document.getElementById(
"precoPadrao"
);



const impressora =

document.getElementById(
"impressora"
);



const modeloBalanca =

document.getElementById(
"modeloBalanca"
);



const mensagemComanda =

document.getElementById(
"mensagemComanda"
);



const botaoSalvar =

document.getElementById(
"btnSalvarConfiguracao"
);








// ==========================================
// SALVAR
// ==========================================


async function salvarConfiguracao(){



    const dados = {



        restaurante:

        nomeRestaurante.value,



        precoKg:

        Number(
            precoPadrao.value
        ),



        impressora:

        impressora.value,



        balanca:

        modeloBalanca.value,



        mensagem:

        mensagemComanda.value,



        atualizadoEm:

        new Date()



    };






    await addDoc(

        collection(
            db,
            "configuracoes"
        ),

        dados

    );





    alert(

    "Configurações salvas!"

    );



}







// ==========================================
// CARREGAR
// ==========================================


async function carregarConfiguracao(){



    const consulta =

    query(

        collection(
            db,
            "configuracoes"
        ),

        limit(1)

    );





    const resultado =

    await getDocs(
        consulta
    );





    resultado.forEach((doc)=>{


        const dados =

        doc.data();




        nomeRestaurante.value =

        dados.restaurante || "";



        precoPadrao.value =

        dados.precoKg || "";



        impressora.value =

        dados.impressora || "";



        modeloBalanca.value =

        dados.balanca || "";



        mensagemComanda.value =

        dados.mensagem || "";



    });



}








// ==========================================
// EVENTOS
// ==========================================


if(botaoSalvar){


    botaoSalvar.addEventListener(

        "click",

        salvarConfiguracao

    );


}




document.addEventListener(

"DOMContentLoaded",

()=>{


    carregarConfiguracao();


});