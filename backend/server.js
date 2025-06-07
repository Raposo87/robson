// my-surf-backend/server.js
require('dotenv').config();

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const bodyParser = require('body-parser'); // Já existe
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuração do CORS
app.use(cors({
    origin: 'https://satisfied-rejoicing-production-0f56.up.railway.app/'
}));

// Configuração do Nodemailer (já está ok)
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVICE_HOST,
    port: parseInt(process.env.EMAIL_SERVICE_PORT),
    secure: process.env.EMAIL_SERVICE_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// **ATENÇÃO: MUDE ESTE BLOCO DO WEBHOOK PARA O TOPO, ANTES DE app.use(express.json())**
// Endpoint para webhooks do Stripe
// Usamos body-parser.raw para o Stripe poder verificar a assinatura do webhook.
// Este MIDDLEWARE DEVE SER APLICADO APENAS A ESTA ROTA ESPECÍFICA, e antes de qualquer express.json().
app.post('/api/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // req.body aqui já será o buffer raw graças ao bodyParser.raw
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // ... (o restante da sua lógica do webhook, que parece estar correta)
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            console.log('--- Checkout Session Completed! ---');
            console.log('Session ID:', session.id);
            console.log('Customer Email (Stripe):', session.customer_details ? session.customer_details.email : 'N/A');
            console.log('Metadata:', session.metadata);

            const { nome, email_cliente, telefone, participantes, data_agendamento, horario_agendamento, descricao_aula, preco_aula } = session.metadata;

            const mailOptionsCliente = {
                from: process.env.EMAIL_USER,
                to: email_cliente,
                subject: 'Confirmação do seu Agendamento na Surf Wave Lisboa',
                html: `
                    <h1>Olá, ${nome}!</h1>
                    <p>Seu agendamento para a aula de **${descricao_aula}** foi confirmado com sucesso!</p>
                    <p>Detalhes do Agendamento:</p>
                    <ul>
                        <li>**Data:** ${data_agendamento}</li>
                        <li>**Horário:** ${horario_agendamento}</li>
                        <li>**Aula:** ${descricao_aula}</li>
                        <li>**Participantes:** ${participantes}</li>
                        <li>**Preço Total:** €${parseFloat(preco_aula).toFixed(2)}</li>
                    </ul>
                    <p>Aguardamos você para uma ótima sessão de surf!</p>
                    <p>Atenciosamente,<br>Equipe Surf Wave Lisboa</p>
                    <p><small>Este é um e-mail automático, por favor não responda.</small></p>
                `,
            };

            try {
                await transporter.sendMail(mailOptionsCliente);
                console.log('E-mail de confirmação enviado para o cliente:', email_cliente);
            } catch (mailError) {
                console.error('Erro ao enviar e-mail para o cliente:', mailError);
            }

            const mailOptionsAdmin = {
                from: process.env.EMAIL_USER,
                to: 'igorraposo02@gmail.com', // <<<<< Mude para o e-mail do dono/administrador
                subject: 'NOVO AGENDAMENTO: Surf Wave Lisboa',
                html: `
                    <h1>Novo Agendamento Recebido!</h1>
                    <p>Detalhes da Nova Reserva:</p>
                    <ul>
                        <li>**Nome do Cliente:** ${nome}</li>
                        <li>**Email do Cliente:** ${email_cliente}</li>
                        <li>**Telefone do Cliente:** ${telefone}</li>
                        <li>**Aula Reservada:** ${descricao_aula}</li>
                        <li>**Data:** ${data_agendamento}</li>
                        <li>**Horário:** ${horario_agendamento}</li>
                        <li>**Participantes:** ${participantes}</li>
                        <li>**Valor Pago:** €${parseFloat(preco_aula).toFixed(2)}</li>
                        <li>**ID da Sessão Stripe:** ${session.id}</li>
                    </ul>
                    <p>Acesse seu painel do Stripe para mais detalhes sobre o pagamento.</p>
                `,
            };

            try {
                await transporter.sendMail(mailOptionsAdmin);
                console.log('E-mail de notificação enviado para o administrador.');
            } catch (mailError) {
                console.error('Erro ao enviar e-mail para o administrador:', mailError);
            }
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
});

// Middleware para parsing do corpo da requisição JSON
// ESTE DEVE VIR DEPOIS DA ROTA DO WEBHOOK, para que não parseie o body do webhook
app.use(express.json());

// Endpoint para criar a sessão de checkout do Stripe (este usa express.json())
app.post('/api/create-checkout-session', async (req, res) => {
    // ... (restante do seu código para criar a sessão, que parece estar ok)
    const { nome, email, telefone, participantes, data, horario, descricao, preco } = req.body;
    const precoEmCentavos = Math.round(parseFloat(preco) * 100);

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
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
            success_url: 'http://127.0.0.1:5500/frontend/sucesso.html?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: 'http://127.0.0.1:5500/frontend/cancelado.html',
            metadata: {
                nome: nome,
                email_cliente: email,
                telefone: telefone,
                participantes: participantes,
                data_agendamento: data,
                horario_agendamento: horario,
                descricao_aula: descricao,
                preco_aula: preco
            },
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error('Erro ao criar sessão de checkout do Stripe:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao criar sessão de pagamento.' });
    }
});


app.listen(PORT, () => {
    console.log(`Backend rodando em http://localhost:${PORT}`);
});