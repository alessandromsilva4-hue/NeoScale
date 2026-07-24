/* ==========================================
   NeoScale
   HISTORICO.JS
========================================== */


console.log("NEOSCALE HISTORICO CARREGADO");



import { db } from "./firebase.js";


import {


collection,

getDocs,

query,

orderBy


}

from

"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";








const tabela =

document.getElementById(
"tabelaHistorico"
);








// ==========================================
// FORMATAR DATA
// ==========================================


function formatarData(data){


    if(!data)

    return "-";



    if(
        data.toDate
    ){


        return data
        .toDate()
        .toLocaleDateString(
            "pt-BR"
        );


    }



    return data;



}








// ==========================================
// CARREGAR HISTÓRICO
// ==========================================


async function carregarHistorico(){



    if(!tabela)

    return;





    tabela.innerHTML = "";





    const consulta =

    query(

        collection(
            db,
            "historico"
        ),

        orderBy(
            "data",
            "desc"
        )

    );





    const resultado =

    await getDocs(
        consulta
    );







    resultado.forEach((doc)=>{


        const dados =

        doc.data();





        tabela.innerHTML += `


        <tr>


        <td>

        ${formatarData(
            dados.data
        )}

        </td>



        <td>

        ${

        Number(
        dados.peso || 0
        )
        .toFixed(3)

        }

        kg

        </td>





        <td>

        R$

        ${

        Number(
        dados.valor || 0
        )
        .toFixed(2)

        }


        </td>




        <td>

        ${

        dados.frase || "-"

        }


        </td>



        </tr>


        `;



    });



}









// ==========================================
// INICIAR
// ==========================================


document.addEventListener(

"DOMContentLoaded",

()=>{


    carregarHistorico();


});