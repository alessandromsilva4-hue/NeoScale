/* ==========================================
   NeoScale
   DASHBOARD.JS
========================================== */


console.log("NEOSCALE DASHBOARD CARREGADO");



// ==========================================
// SAUDAÇÃO AUTOMÁTICA
// ==========================================

function atualizarSaudacao(){


    const agora = new Date();

    const hora = agora.getHours();


    let mensagem = "Bom dia!";


    if(hora >= 12 && hora < 18){

        mensagem = "Boa tarde!";

    }


    if(hora >= 18){

        mensagem = "Boa noite!";

    }


    const elemento =
    document.getElementById("saudacao");


    if(elemento){

        elemento.innerText = mensagem;

    }


}




// ==========================================
// DATA E HORA
// ==========================================

function atualizarDataHora(){


    const agora = new Date();


    const data =
    agora.toLocaleDateString("pt-BR",
    {

        day:"2-digit",

        month:"2-digit",

        year:"numeric"

    });


    const hora =
    agora.toLocaleTimeString("pt-BR");



    const campoData =
    document.getElementById("dataAtual");


    const campoHora =
    document.getElementById("horaAtual");



    if(campoData){

        campoData.innerText = data;

    }


    if(campoHora){

        campoHora.innerText = hora;

    }



}



// ==========================================
// FRASES DO DIA
// ==========================================


const frasesNeoScale = [


    {

        texto:
        "A simplicidade é o último grau da sofisticação.",

        autor:
        "Leonardo da Vinci"

    },


    {

        texto:
        "Tudo vale a pena quando a alma não é pequena.",

        autor:
        "Fernando Pessoa"

    },


    {

        texto:
        "A vida é a arte do encontro.",

        autor:
        "Vinicius de Moraes"

    },


    {

        texto:
        "O essencial é invisível aos olhos.",

        autor:
        "Antoine de Saint-Exupéry"

    }


];





function trocarFrase(){


    const numero =

    Math.floor(
        Math.random()
        *
        frasesNeoScale.length
    );



    const frase =
    frasesNeoScale[numero];



    const campo =
    document.getElementById("fraseDia");



    if(campo){


        campo.innerText =
        `"${frase.texto}"`;



        const autor =
        campo.nextElementSibling;



        if(autor){

            autor.innerText =
            frase.autor;

        }


    }


}





// ==========================================
// INICIALIZAÇÃO
// ==========================================


document.addEventListener(
"DOMContentLoaded",
()=>{


    atualizarSaudacao();


    atualizarDataHora();


    trocarFrase();



    setInterval(

        atualizarDataHora,

        1000

    );



    setInterval(

        trocarFrase,

        15000

    );


});