 
// ** Adicione esta linha no topo do seu script.js **
const stripe = Stripe('pk_test_51OD9PzJMj3xtQZqA3ra4lRAyGs4oHj2bWNRb4nrLoljqoNIHB5sB5MVfoBmthFmUdgxwc11SMlXYpBCNsawBvZuf00S85he36r'); // Substitua pela sua chave pública do Stripe

// Função para abrir o modal de agendamento com os dados da aula
function abrirModalAgendamento(descricao, preco) {
  // Armazenar a descrição e preço da aula no modal para acesso posterior
  document.getElementById('reserva-titulo').textContent = descricao;
  document.getElementById('reserva-preco').textContent = `Preço: €${preco}`;
  // Guardar os valores em atributos de dados no próprio formulário ou modal para fácil acesso
  document.getElementById('form-agendamento').dataset.descricao = descricao;
  document.getElementById('form-agendamento').dataset.preco = preco;

  // Exibir o modal
  document.getElementById('modal-agendamento').style.display = 'flex';
}

// Função para fechar o modal de agendamento
function fecharModalAgendamento() {
  document.getElementById('modal-agendamento').style.display = 'none';
  document.getElementById('mensagem-agendamento').style.display = 'none';
  document.getElementById('form-agendamento').reset();
  // Limpar os dados da aula armazenados
  document.getElementById('form-agendamento').removeAttribute('data-descricao');
  document.getElementById('form-agendamento').removeAttribute('data-preco');
}

document.addEventListener('DOMContentLoaded', function() {
  // Adiciona evento aos botões de reservar
  const reservarBtns = document.querySelectorAll('.reservar-btn');
  reservarBtns.forEach(btn => {
      btn.addEventListener('click', function() {
          // Obter dados da aula
          const descricao = this.dataset.descricao;
          const preco = this.dataset.preco;
          
          // Abrir modal com os dados
          abrirModalAgendamento(descricao, preco);
      });
  });

  // Fecha o modal ao clicar no X
  document.getElementById('fechar-modal').onclick = fecharModalAgendamento;

  // Fecha o modal ao clicar fora do conteúdo
  window.onclick = function(event) {
      const modal = document.getElementById('modal-agendamento');
      if (event.target === modal) {
          fecharModalAgendamento();
      }
  };

  // Lógica do formulário de agendamento
  document.getElementById('form-agendamento').onsubmit = async function(e) {
      e.preventDefault();
      
      const form = e.target;
      const descricaoAula = form.dataset.descricao;
      const precoAula = form.dataset.preco;

      const dadosAgendamento = {
          nome: document.getElementById('nome').value,
          email: document.getElementById('email').value,
          telefone: document.getElementById('telefone').value,
          participantes: parseInt(document.getElementById('participantes').value, 10),
          data: document.getElementById('data').value,
          horario: document.getElementById('horario').value,
          descricao: descricaoAula, // Passar a descrição da aula
          preco: precoAula // Passar o preço da aula
      };

      document.getElementById('mensagem-agendamento').innerText = 'Processando pagamento...';
      document.getElementById('mensagem-agendamento').style.display = 'block';

      try {
          const response = await fetch('http://localhost:3001/api/create-checkout-session', { // Endereço do seu backend local
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify(dadosAgendamento)
          });

          const session = await response.json();

          if (session.id) {
              // Redirecionar para o Stripe Checkout
              const result = await stripe.redirectToCheckout({
                  sessionId: session.id
              });

              if (result.error) {
                  // Se houver um erro de redirecionamento (muito raro)
                  document.getElementById('mensagem-agendamento').innerText = `Erro: ${result.error.message}`;
                  document.getElementById('mensagem-agendamento').style.backgroundColor = '#f2dede'; // Cor de erro
                  document.getElementById('mensagem-agendamento').style.color = '#a94442';
              }
          } else if (session.error) {
              // Erro vindo do nosso backend
              document.getElementById('mensagem-agendamento').innerText = `Erro: ${session.error}`;
              document.getElementById('mensagem-agendamento').style.backgroundColor = '#f2dede'; // Cor de erro
              document.getElementById('mensagem-agendamento').style.color = '#a94442';
          }

      } catch (error) {
          console.error('Erro ao conectar com o backend:', error);
          document.getElementById('mensagem-agendamento').innerText = 'Erro ao processar o agendamento. Tente novamente mais tarde.';
          document.getElementById('mensagem-agendamento').style.backgroundColor = '#f2dede'; // Cor de erro
          document.getElementById('mensagem-agendamento').style.color = '#a94442';
      }
  };
  
  // Configurar data mínima para hoje
  const hoje = new Date();
  const dd = String(hoje.getDate()).padStart(2, '0');
  const mm = String(hoje.getMonth() + 1).padStart(2, '0'); // Janeiro é 0!
  const aaaa = hoje.getFullYear();
  
  const dataMinima = aaaa + '-' + mm + '-' + dd;
  document.getElementById('data').min = dataMinima;
});