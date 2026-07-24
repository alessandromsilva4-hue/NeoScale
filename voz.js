/* ==========================================
   NeoScale
   ASSISTENTE DE VOZ
========================================== */


console.log("NEOSCALE VOZ CARREGADO");




// ==========================================
// CONFIGURAÇÃO DA VOZ
// ==========================================


const configuracaoVoz = {

    ativo: true,

    idioma: "pt-BR",

    velocidade: 1,

    tom: 1.35

};




// ==========================================
// FUNÇÃO PRINCIPAL DE FALA
// ==========================================


function falar(texto){


    if(!configuracaoVoz.ativo){

        return;

    }



    if(!window.speechSynthesis){


        console.log(
            "Voz não disponível neste navegador"
        );


        return;


    }



    // evita acumular mensagens

    window.speechSynthesis.cancel();




    const mensagem =

    new SpeechSynthesisUtterance(
        texto
    );



    mensagem.lang =

    configuracaoVoz.idioma;



    mensagem.rate =

    configuracaoVoz.velocidade;



    mensagem.pitch =

    configuracaoVoz.tom;




    window.speechSynthesis.speak(
        mensagem
    );


}









// ==========================================
// MENSAGEM INICIAL
// ==========================================


function iniciarAtendimento(){


    falar(

        "Bem vindo ao NeoScale. Coloque seu prato na balança."

    );


}









// ==========================================
// AGUARDANDO PESO
// ==========================================


function vozAguardandoPeso(){


    falar(

        "Coloque seu prato na balança."

    );


}









// ==========================================
// PESO IDENTIFICADO
// ==========================================


function vozPesoIdentificado(
    peso,
    valor
){


    falar(

`Peso identificado.
${peso} quilogramas.
O valor da sua refeição é ${valor}.`

    );


}









// ==========================================
// COMANDA IMPRESSA
// ==========================================


function vozComanda(){


    falar(

        "Sua comanda foi impressa. Obrigado pela preferência. Tenha uma excelente refeição."

    );


}






// ==========================================
// ERRO
// ==========================================


function vozErro(){


    falar(

        "Não foi possível realizar a pesagem. Por favor tente novamente."

    );


}








// ==========================================
// CONTROLE DE VOZ
// ==========================================


function ativarVoz(){


    configuracaoVoz.ativo = true;


}




function desativarVoz(){


    configuracaoVoz.ativo = false;


}









// ==========================================
// EXPORTAR PARA O SISTEMA
// ==========================================


window.NeoVoice = {


    falar,

    iniciarAtendimento,

    vozAguardandoPeso,

    vozPesoIdentificado,

    vozComanda,

    vozErro,

    ativarVoz,

    desativarVoz


};
