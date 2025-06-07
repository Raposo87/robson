// my-surf-backend/server.js
require('dotenv').config();

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer'); // Importe o Nodemailer

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: 'http://127.0.0.1:5500' // Ou o endereço do seu servidor local
}));
app.use(express.json());

// Configuração do Nodemailer
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVICE_HOST,
    port: parseInt(process.env.EMAIL_SERVICE_PORT),
    secure: process.env.EMAIL_SERVICE_SECURE === 'true', // true para porta 465, false para outras como 587
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Endpoint para criar a sessão de checkout do Stripe (sem mudanças aqui para emails)
app.post('/api/create-checkout-session', async (req, res) => {
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
                email_cliente: email, // Usar um nome diferente para evitar conflito com o 'email' do Stripe
                telefone: telefone,
                participantes: participantes,
                data_agendamento: data,
                horario_agendamento: horario,
                descricao_aula: descricao, // Guardar descrição no metadata
                preco_aula: preco // Guardar preço no metadata
            },
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error('Erro ao criar sessão de checkout do Stripe:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao criar sessão de pagamento.' });
    }
});

// Endpoint para webhooks do Stripe
app.post('/api/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => { // Adicionado 'async'
    const sig = req.headers['stripe-signature'];
    let event;

    try {
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
            console.log('Customer Email (Stripe):', session.customer_details ? session.customer_details.email : 'N/A');
            console.log('Metadata:', session.metadata);

            // Extrair dados do metadata
            const {
                nome,
                email_cliente, // Usar o nome que você definiu no metadata
                telefone,
                participantes,
                data_agendamento,
                horario_agendamento,
                descricao_aula,
                preco_aula
            } = session.metadata;

            // TODO: Aqui é onde você atualizaria o status do agendamento no seu banco de dados
            // Ex: saveAppointmentToDatabase(session.id, nome, email_cliente, ...);

            // --- Enviar E-mail para o Cliente ---
            const mailOptionsCliente = {
                from: process.env.EMAIL_USER, // Seu e-mail de envio
                to: email_cliente,           // E-mail do cliente
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

            // --- Enviar E-mail para o Administrador ---
            const mailOptionsAdmin = {
                from: process.env.EMAIL_USER,       // Seu e-mail de envio
                to: 'email_do_dono@example.com', // <<<<< Mude para o e-mail do dono/administrador
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
        // Adicione outros eventos conforme necessário
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
});

app.listen(PORT, () => {
    console.log(`Backend rodando em http://localhost:${PORT}`);
});