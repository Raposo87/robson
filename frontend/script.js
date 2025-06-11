// script.js

// ** Adicione esta linha no topo do seu script.js **
const stripe = Stripe('pk_test_51OD9PzJMj3xtQZqA3ra4lRAyGs4oHj2bWNRb4nrLoljqoNIHB5sB5MVfoBmthFmUdgxwc11SMlXYpBCNsawBvZuf00S85he36r'); // Substitua pela sua chave pública do Stripe

// Variável global para armazenar o preço base da aula por participante
let precoBaseAula = 0;

/**
 * Abre o modal de agendamento e inicializa os dados da aula.
 * @param {string} descricao - A descrição da aula selecionada.
 * @param {number} preco - O preço por participante da aula selecionada.
 */
function abrirModalAgendamento(descricao, preco) {
    // Define o título do modal com a descrição da aula
    document.getElementById('reserva-titulo').textContent = descricao;
    // Exibe o preço por participante no modal
    document.getElementById('preco-por-participante').textContent = preco.toFixed(2);
    // Armazena o preço base para cálculos futuros (precoTotal)
    precoBaseAula = preco;

    // Guarda a descrição e o preço base no dataset do formulário (para referência, se necessário)
    document.getElementById('form-agendamento').dataset.descricao = descricao;
    document.getElementById('form-agendamento').dataset.preco = preco;

    // Define o número inicial de participantes como 1 e recalcula o preço total
    document.getElementById('participantes').value = 1;
    calcularEAtualizarPrecoTotal(); // Chama a função para calcular o total inicial

    // Exibe o modal
    document.getElementById('modal-agendamento').style.display = 'flex';
}

/**
 * Calcula e atualiza o preço total da reserva com base no número de participantes.
 */
function calcularEAtualizarPrecoTotal() {
    // Obtém o número de participantes do input e converte para inteiro
    const participantes = parseInt(document.getElementById('participantes').value, 10);

    // Garante que o número de participantes é pelo menos 1 e é um número válido
    const numParticipantes = isNaN(participantes) || participantes < 1 ? 1 : participantes;
    document.getElementById('participantes').value = numParticipantes; // Atualiza o input caso seja inválido

    // Calcula o preço total (preço base por participante * número de participantes)
    const precoTotal = precoBaseAula * numParticipantes;

    // Atualiza o elemento HTML que exibe o preço total, formatando para 2 casas decimais
    document.getElementById('reserva-preco').textContent = precoTotal.toFixed(2);
}

/**
 * Fecha o modal de agendamento e reseta o formulário e mensagens.
 */
function fecharModalAgendamento() {
    document.getElementById('modal-agendamento').style.display = 'none';
    document.getElementById('mensagem-agendamento').style.display = 'none';
    document.getElementById('form-agendamento').reset(); // Reseta os campos do formulário
    // Limpa os dados da aula armazenados no dataset do formulário
    document.getElementById('form-agendamento').removeAttribute('data-descricao');
    document.getElementById('form-agendamento').removeAttribute('data-preco');
    precoBaseAula = 0; // Reseta o preço base
}

// Garante que o DOM está completamente carregado antes de adicionar event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Adiciona event listener para o input de número de participantes
    const inputParticipantes = document.getElementById('participantes');
    if (inputParticipantes) {
        // 'input' dispara a cada mudança (digitando, setas, etc.)
        inputParticipantes.addEventListener('input', calcularEAtualizarPrecoTotal);
    }

    // Adiciona evento de clique a todos os botões de "Reservar"
    const reservarBtns = document.querySelectorAll('.reservar-btn');
    reservarBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Obtém a descrição e o preço base da aula diretamente do dataset do botão clicado
            const descricao = this.dataset.descricao;
            const preco = parseFloat(this.dataset.preco); // CONSERTADO: Pega o preço base do botão

            // Abre o modal com os dados da aula
            abrirModalAgendamento(descricao, preco);
        });
    });

    // Adiciona evento de clique para o botão de fechar modal (X)
    document.getElementById('fechar-modal').onclick = fecharModalAgendamento;

    // Adiciona evento de clique na janela para fechar o modal se clicar fora do conteúdo
    window.onclick = function(event) {
        const modal = document.getElementById('modal-agendamento');
        if (event.target === modal) {
            fecharModalAgendamento();
        }
    };

    // Lógica para lidar com o envio do formulário de agendamento
    document.getElementById('form-agendamento').onsubmit = async function(e) {
        e.preventDefault(); // Impede o envio padrão do formulário

        const form = e.target;
        const descricaoAula = form.dataset.descricao; // Pega a descrição do dataset do formulário

        // CONSERTADO: Pega o preço TOTAL CALCULADO do elemento que o exibe na tela
        const precoTotalParaEnvio = parseFloat(document.getElementById('reserva-preco').textContent);

        const dadosAgendamento = {
            nome: document.getElementById('nome').value,
            email: document.getElementById('email').value,
            telefone: document.getElementById('telefone').value,
            participantes: parseInt(document.getElementById('participantes').value, 10), // Pega o número de participantes
            data: document.getElementById('data').value,
            horario: document.getElementById('horario').value,
            descricao: descricaoAula, // Passa a descrição da aula
            preco: precoTotalParaEnvio // CONSERTADO: Passa o preço TOTAL CALCULADO
        };

        // Exibe mensagem de processamento
        document.getElementById('mensagem-agendamento').innerText = 'Processando pagamento...';
        document.getElementById('mensagem-agendamento').style.display = 'block';

        try {
            // Faz a requisição POST para o backend
            const response = await fetch('https://robson-production.up.railway.app/api/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dadosAgendamento)
            });

            const session = await response.json();

            if (session.id) {
                // Redireciona para o Stripe Checkout se a sessão for criada com sucesso
                const result = await stripe.redirectToCheckout({
                    sessionId: session.id
                });

                if (result.error) {
                    // Lida com erros durante o redirecionamento
                    document.getElementById('mensagem-agendamento').innerText = `Erro: ${result.error.message}`;
                    document.getElementById('mensagem-agendamento').style.backgroundColor = '#f2dede';
                    document.getElementById('mensagem-agendamento').style.color = '#a94442';
                }
            } else if (session.error) {
                // Lida com erros vindos do próprio backend
                document.getElementById('mensagem-agendamento').innerText = `Erro: ${session.error}`;
                document.getElementById('mensagem-agendamento').style.backgroundColor = '#f2dede';
                document.getElementById('mensagem-agendamento').style.color = '#a94442';
            }

        } catch (error) {
            console.error('Erro ao conectar com o backend:', error);
            // Lida com erros de conexão ou outros erros de rede/processamento
            document.getElementById('mensagem-agendamento').innerText = 'Erro ao processar o agendamento. Tente novamente mais tarde.';
            document.getElementById('mensagem-agendamento').style.backgroundColor = '#f2dede';
            document.getElementById('mensagem-agendamento').style.color = '#a94442';
        }
    };

    // Configurar a data mínima para o input de data para hoje
    const hoje = new Date();
    const dd = String(hoje.getDate()).padStart(2, '0');
    const mm = String(hoje.getMonth() + 1).padStart(2, '0'); // Janeiro é 0!
    const aaaa = hoje.getFullYear();
    const dataMinima = `${aaaa}-${mm}-${dd}`;
    document.getElementById('data').setAttribute('min', dataMinima);
});
