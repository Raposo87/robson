// my-surf-backend/server.js
require('dotenv').config(); // Carrega variáveis de ambiente do .env

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const bodyParser = require('body-parser');
const cors = require('cors'); // Para permitir requisições do seu frontend (domínios diferentes)

const app = express();
const PORT = process.env.PORT || 3001; // Usaremos a porta 3001 para o backend

// Configuração do CORS para permitir requisições do seu frontend local
// Em produção, você deve restringir 'origin' ao domínio do seu site
app.use(cors({
    origin: 'http://127.0.0.1:5500' // Ou o endereço do seu servidor local (ex: Live Server)
}));

// Endpoint para criar a sessão de checkout do Stripe
app.post('/api/create-checkout-session', async (req, res) => {
    const { nome, email, telefone, participantes, data, horario, descricao, preco } = req.body;

    console.log('Recebido pedido de agendamento:', { descricao, preco, nome, email, data, horario });

    // TODO: Em um sistema real, você faria as seguintes verificações:
    // 1. Validar se todos os campos necessários foram enviados.
    // 2. Verificar a disponibilidade da aula para a data e horário selecionados no seu banco de dados.
    // 3. Salvar um registro provisório do agendamento no seu DB com status 'pendente'.

    // O preço do frontend é em euros, precisamos convertê-lo para centavos para o Stripe.
    const precoEmCentavos = Math.round(parseFloat(preco) * 100);

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur', // Moeda em Euros
                        product_data: {
                            name: descricao,
                            description: `Agendamento para ${participantes} participante(s) em ${data} às ${horario}`,
                        },
                        unit_amount: precoEmCentavos,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            // URLs para onde o cliente será redirecionado após o pagamento
            // Estas URLs devem ser no seu frontend. Podemos criar uma página simples de sucesso/cancelamento.
            success_url: 'http://127.0.0.1:5500/sucesso.html?session_id={CHECKOUT_SESSION_ID}', // Adapte para o seu frontend
            cancel_url: 'http://127.0.0.1:5500/cancelado.html', // Adapte para o seu frontend
            
            // Metadados para associar o agendamento do Stripe ao seu sistema
            metadata: {
                nome: nome,
                email: email,
                telefone: telefone,
                participantes: participantes,
                data_agendamento: data,
                horario_agendamento: horario,
                // Você pode adicionar um ID de agendamento do seu DB aqui, se já o tiver criado.
                // appointment_id: 'algum_id_do_seu_db_aqui'
            },
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error('Erro ao criar sessão de checkout do Stripe:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao criar sessão de pagamento.' });
    }
});

// Endpoint para webhooks do Stripe
// Usamos body-parser.raw para o Stripe poder verificar a assinatura do webhook
app.post('/api/webhook', bodyParser.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // Certifique-se de que process.env.STRIPE_WEBHOOK_SECRET está configurado
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Lidar com os eventos do Stripe
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            console.log('--- Checkout Session Completed! ---');
            console.log('Session ID:', session.id);
            console.log('Customer Email:', session.customer_details ? session.customer_details.email : 'N/A');
            console.log('Metadata:', session.metadata);

            // TODO: Aqui é onde você atualizaria o status do agendamento no seu banco de dados
            // Usando session.metadata, você pode encontrar o agendamento correspondente
            // e mudar seu status de 'pendente' para 'confirmado'.
            // Enviar email de confirmação para o cliente, notificar o admin, etc.

            break;
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            console.log('--- Payment Intent Succeeded! ---');
            console.log('Payment Intent ID:', paymentIntent.id);
            // Este evento é mais granular, pode ser usado para atualizações de pagamento
            // dependendo do seu fluxo, mas 'checkout.session.completed' é geralmente suficiente para o Checkout.
            break;
        // Adicione outros eventos conforme necessário (ex: payment_intent.payment_failed)
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    // Retorne uma resposta 200 para o Stripe
    res.json({ received: true });
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Backend rodando em http://localhost:${PORT}`);
});