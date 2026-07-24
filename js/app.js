/* ==========================================
   NeoScale
   APP.JS
========================================== */


console.log("NEOSCALE APP CARREGADO");




// ==========================================
// CONFIGURAÇÃO GERAL
// ==========================================


const NeoScale = {


    nome:

    "NeoScale",


    versao:

    "1.0.0",


    modo:

    "AutoAtendimento",


    operador:

    false


};







// ==========================================
// INICIALIZAÇÃO
// ==========================================


function iniciarSistema(){



    console.log(

        "Iniciando sistema:",

        NeoScale.nome

    );



    console.log(

        "Versão:",

        NeoScale.versao

    );



    console.log(

        "Modo:",

        NeoScale.modo

    );



}







// ==========================================
// STATUS DO SISTEMA
// ==========================================


function statusSistema(){



    return {


        sistema:

        "online",



        balanca:

        "aguardando",



        impressora:

        "pronta"



    };



}







// ==========================================
// MENSAGEM INICIAL
// ==========================================


function mensagemInicial(){



    const elemento =

    document.getElementById(
        "statusSistema"
    );



    if(elemento){


        elemento.innerText =

        "NeoScale pronto para uso";


    }



}







// ==========================================
// INICIAR
// ==========================================


document.addEventListener(

"DOMContentLoaded",

()=>{


    iniciarSistema();


    mensagemInicial();


});