/* ==========================================
   NeoScale
   PRODUTOS.JS
========================================== */


console.log("NEOSCALE PRODUTOS CARREGADO");



import { db } from "./firebase.js";



import {

    collection,

    addDoc,

    getDocs,

    serverTimestamp

}

from

"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";





// ==========================================
// ELEMENTOS
// ==========================================


const nomeProduto =

document.getElementById(
"nomeProduto"
);



const precoProduto =

document.getElementById(
"precoProduto"
);



const categoriaProduto =

document.getElementById(
"categoriaProduto"
);



const botaoSalvar =

document.getElementById(
"btnSalvarProduto"
);



const tabela =

document.getElementById(
"listaProdutos"
);







// ==========================================
// SALVAR PRODUTO
// ==========================================


async function salvarProduto(){



    const nome =

    nomeProduto.value.trim();



    const preco =

    Number(
        precoProduto.value
    );



    const categoria =

    categoriaProduto.value.trim();





    if(!nome || !preco){


        alert(
        "Informe nome e preço do produto."
        );


        return;


    }





    try {



        await addDoc(

            collection(
                db,
                "produtos"
            ),

            {


                nome,


                precoKg: preco,


                categoria,


                ativo:true,


                criadoEm:
                serverTimestamp()


            }


        );





        alert(
        "Produto cadastrado com sucesso!"
        );




        limparFormulario();


        carregarProdutos();





    }

    catch(error){


        console.error(
            error
        );


        alert(
        "Erro ao salvar produto."
        );


    }


}







// ==========================================
// LIMPAR CAMPOS
// ==========================================


function limparFormulario(){


    nomeProduto.value="";


    precoProduto.value="";


    categoriaProduto.value="";


}







// ==========================================
// LISTAR PRODUTOS
// ==========================================


async function carregarProdutos(){



    if(!tabela)
    return;




    tabela.innerHTML="";




    const consulta =

    await getDocs(

        collection(
            db,
            "produtos"
        )

    );






    consulta.forEach((doc)=>{


        const produto =

        doc.data();




        tabela.innerHTML += `



        <tr>


            <td>

                ${produto.nome}

            </td>


            <td>

                ${produto.categoria || "-"}

            </td>


            <td>

                R$ ${produto.precoKg.toFixed(2)}

            </td>


            <td>


                <span class="status-ativo">

                    Ativo

                </span>


            </td>


        </tr>


        `;



    });



}







// ==========================================
// EVENTOS
// ==========================================


if(botaoSalvar){


    botaoSalvar.addEventListener(

        "click",

        salvarProduto

    );


}





document.addEventListener(

"DOMContentLoaded",

()=>{


    carregarProdutos();


});