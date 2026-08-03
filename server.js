const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path'); // <-- Adicionado para gerenciar caminhos de arquivos

const app = express();
app.use(express.json());
app.use(cors());

// ==========================================
// SERVIR OS ARQUIVOS HTML, CSS, JS E ASSETS
// ==========================================
app.use(express.static(__dirname)); // Permite acessar index.html, fortune-tiger.html, etc.

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==========================================
// BANCO DE DADOS SQLITE
// ==========================================
const db = new sqlite3.Database('./willbet.db', (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err.message);
    } else {
        console.log('Conectado com sucesso ao banco de dados SQLite.');
    }
});

// Criação da tabela de transações Pix
db.run(`CREATE TABLE IF NOT EXISTS pix_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    e2e TEXT UNIQUE NOT NULL,
    cpf TEXT NOT NULL,
    nome TEXT NOT NULL,
    valor REAL NOT NULL,
    status TEXT DEFAULT 'PENDENTE_CONFERENCIA',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// ==========================================
// ROTAS DA API
// ==========================================
app.post('/api/deposit', (req, res) => {
    const { e2e, cpf, nome, valor } = req.body;

    if (!e2e || !cpf || !nome || !valor) {
        return res.status(400).json({ success: false, error: 'Todos os campos são obrigatórios.' });
    }

    // 1. Verifica se o E2E já existe no banco de dados
    db.get(`SELECT * FROM pix_transactions WHERE e2e = ?`, [e2e], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Erro interno no servidor.' });
        }

        if (row) {
            return res.status(400).json({ 
                success: false, 
                error: `Erro de segurança: Este código E2E já foi utilizado anteriormente pela conta de CPF: ${row.cpf} (${row.nome})!` 
            });
        }

        // 2. Se não existir, salva no banco
        const query = `INSERT INTO pix_transactions (e2e, cpf, nome, valor, status) VALUES (?, ?, ?, ?, ?)`;
        db.run(query, [e2e, cpf, nome, valor, 'PENDENTE_CONFERENCIA'], function(err) {
            if (err) {
                return res.status(500).json({ success: false, error: 'Erro ao salvar transação.' });
            }

            return res.json({
                success: true,
                message: 'Depósito registrado e saldo liberado com sucesso!',
                transactionId: this.lastID
            });
        });
    });
});

// ==========================================
// ROTA DE PING PARA O UPTIMEROBOT NÃO DORMIR
// ==========================================
app.get('/ping', (req, res) => {
    res.status(200).send('Estou vivo!');
});

// Inicializar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor da WillBet rodando na porta ${PORT}`);
});
