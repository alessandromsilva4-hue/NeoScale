const seletorTema = document.getElementById("temaQuiosque");
const chaveTema = "neoscale-tema-quiosque";
const temaPadrao = "azul";

function aplicarTema(tema, salvar = true) {
    document.body.dataset.tema = tema;
    if (seletorTema) seletorTema.value = tema;
    if (salvar) localStorage.setItem(chaveTema, tema);
}

const temaSalvo = localStorage.getItem(chaveTema) || temaPadrao;
aplicarTema(temaSalvo);

if (seletorTema) {
    seletorTema.addEventListener("change", () => aplicarTema(seletorTema.value));
}

// Mantém o quiosque aberto sincronizado com alterações feitas em outra tela.
window.addEventListener("storage", (evento) => {
    if (evento.key === chaveTema && evento.newValue) {
        aplicarTema(evento.newValue, false);
    }
});
