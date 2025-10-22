import { ref, onValue, set, push, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const database = window.database;
if (!database) {
  console.error("Firebase database não inicializado! Verifique o HTML.");
  return;
}

let eventos = [];
let isAdmin = false;

// Carregar eventos do Firebase
const eventosRef = ref(database, 'eventos');
onValue(eventosRef, (snapshot) => {
  const data = snapshot.val();
  if (data) {
    eventos = Object.values(data); // Converte objeto do Firebase em array
  } else {
    eventos = [];
  }
  renderEventos();
  console.log("Eventos carregados:", eventos);
});

// Renderiza lista de eventos
function renderEventos(eventosFiltrados = eventos) {
  const lista = document.getElementById("listaEventos");
  if (!lista) {
    console.error("Erro: Elemento com id 'listaEventos' não encontrado.");
    return;
  }
  lista.innerHTML = "";

  if (!Array.isArray(eventosFiltrados) || eventosFiltrados.length === 0) {
    lista.innerHTML = "<p style='text-align: center;'>Nenhum evento encontrado. 😕</p>";
    return;
  }

  eventosFiltrados.forEach((evento, index) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${evento.nome}</h3>
      <p>Meta: R$ ${evento.meta.toFixed(2)}</p>
      <p>Arrecadado: R$ ${evento.arrecadado.toFixed(2)}</p>
      <button class="btn btn-doar" data-index="${index}">Doar</button>
      ${isAdmin ? `
        <button class="btn btn-outline btn-editar" data-index="${index}">Editar</button>
        <button class="btn btn-outline btn-excluir" data-index="${index}">Excluir</button>` : ""}
    `;
    lista.appendChild(card);
  });
  atualizarEstatisticas();
}

// Estatísticas
function atualizarEstatisticas() {
  document.getElementById("statEventos").textContent = eventos.length;
  let total = eventos.reduce((s, e) => s + (e.arrecadado || 0), 0);
  document.getElementById("statArrecadado").textContent = `R$ ${total.toFixed(2)}`;
  let doacoes = eventos.flatMap(e => e.doacoes || []);
  let media = doacoes.length ? total / doacoes.length : 0;
  document.getElementById("statMedia").textContent = `R$ ${media.toFixed(2)}`;
  document.getElementById("statDoadores").textContent = doacoes.length;
}

// Função de busca
function buscarEventos() {
  const inputBusca = document.getElementById("busca");
  if (!inputBusca) {
    console.error("Erro: Input com id 'busca' não encontrado.");
    return;
  }

  const termoBusca = inputBusca.value.trim().toLowerCase();
  const eventosFiltrados = eventos.filter((evento) =>
    evento.nome.toLowerCase().includes(termoBusca)
  );
  renderEventos(eventosFiltrados);
}

// Modal novo evento
const modalEvento = document.getElementById("modalEvento");
document.getElementById("btnNovoEvento").addEventListener("click", () => modalEvento.showModal());
document.getElementById("salvarEvento").addEventListener("click", () => {
  const nome = document.getElementById("nomeEvento").value.trim();
  const meta = parseFloat(document.getElementById("metaEvento").value);
  if (!nome || !(meta > 0)) {
    alert("Preencha nome e meta válidos!");
    return;
  }
  const novoEvento = { nome, meta, arrecadado: 0, doacoes: [], admin: isAdmin };
  const novoEventoRef = push(eventosRef);
  set(novoEventoRef, novoEvento)
    .then(() => {
      document.getElementById("nomeEvento").value = "";
      document.getElementById("metaEvento").value = "";
      modalEvento.close();
    })
    .catch((error) => console.error("Erro ao adicionar evento:", error));
});

// Modal doação
const modalDoacao = document.getElementById("modalDoacao");
const nomeEventoDoacao = document.getElementById("nomeEventoDoacao");
const valorDoacao = document.getElementById("valorDoacao");
let eventoAtualIndex = null;

document.getElementById("listaEventos").addEventListener("click", (e) => {
  const index = e.target.dataset.index;
  if (e.target.classList.contains("btn-doar")) {
    eventoAtualIndex = index;
    nomeEventoDoacao.textContent = eventos[index].nome;
    valorDoacao.value = "";
    modalDoacao.showModal();
  }
  if (e.target.classList.contains("btn-excluir") && confirm("Deseja excluir?")) {
    const eventoId = eventos[index].id; // Supondo que 'id' foi adicionado ao evento
    remove(ref(database, `eventos/${eventoId}`))
      .then(() => console.log("Evento excluído"))
      .catch((error) => console.error("Erro:", error));
  }
  if (e.target.classList.contains("btn-editar")) {
    const ev = eventos[index];
    const nn = prompt("Editar nome:", ev.nome);
    const nm = prompt("Editar meta:", ev.meta);
    if (nn && nm) {
      ev.nome = nn;
      ev.meta = parseFloat(nm);
      set(ref(database, `eventos/${ev.id}`), ev)
        .then(() => console.log("Evento atualizado"))
        .catch((error) => console.error("Erro ao editar:", error));
    }
  }
});

// Função de pagamento
function processarDoacao(tipo) {
  const val = parseFloat(valorDoacao.value);
  if (!val || val <= 0) {
    alert("Valor inválido!");
    return;
  }
  const eventoAtual = eventos[eventoAtualIndex];
  eventoAtual.arrecadado += val;
  eventoAtual.doacoes.push({ valor: val, tipo });
  set(ref(database, `eventos/${eventoAtual.id}`), eventoAtual)
    .then(() => {
      modalDoacao.close();
      alert(`Obrigado pela doação de R$ ${val.toFixed(2)} via ${tipo} 💙`);
    })
    .catch((error) => console.error("Erro ao atualizar doação:", error));
}

// Botões de pagamento
modalDoacao.querySelector(".btn-pix").addEventListener("click", () => processarDoacao("Pix"));
modalDoacao.querySelector(".btn-credito").addEventListener("click", () => processarDoacao("Crédito"));
modalDoacao.querySelector(".btn-debito").addEventListener("click", () => processarDoacao("Débito"));

// Admin
document.getElementById("btnAdmin").addEventListener("click", () => {
  if (isAdmin) {
    isAdmin = false;
    renderEventos();
    alert("Modo admin desativado");
    return;
  }
  const pin = prompt("Digite PIN admin (demo:123)");
  if (pin === "123") {
    isAdmin = true;
    renderEventos();
    alert("Modo admin ativado ✅");
  } else {
    alert("PIN incorreto!");
  }
});

// Exportar
document.getElementById("btnExport").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(eventos, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "eventos.json";
  a.click();
});

// Importar
document.getElementById("fileImport").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      eventos = JSON.parse(reader.result);
      const eventosRef = ref(database, 'eventos');
      set(eventosRef, eventos)
        .then(() => {
          alert("Importação concluída ✅");
        })
        .catch((error) => console.error("Erro ao importar:", error));
    } catch {
      alert("Arquivo inválido!");
    }
  };
  reader.readAsText(file);
});

// Configura a busca
document.getElementById("busca").addEventListener("input", buscarEventos);

// Render inicial
renderEventos();