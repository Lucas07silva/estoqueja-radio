# EstoqueJá — Controle de Estoque para a Rádio

Projeto acadêmico baseado na **Ideia 3 — EstoqueJá: Controle de Estoque para Pequeno Comércio**. A aplicação foi contextualizada para a rotina de uma emissora de rádio, permitindo controlar materiais consumíveis e equipamentos permanentes.

O sistema possui uma interface web responsiva, uma API REST em Node.js/Express e um banco de dados PostgreSQL hospedado na nuvem. Os dados são acessados exclusivamente pelo backend; as credenciais do banco ficam em variáveis de ambiente e não são enviadas ao navegador.

## 1. Funcionalidades

- Cadastro, consulta, edição e exclusão de produtos.
- Cadastro, consulta, edição e exclusão de categorias.
- Controle de preço, quantidade atual e estoque mínimo.
- Filtro de produtos abaixo do estoque mínimo (`estoqueBaixo=true`).
- Registro de entradas e saídas com data, motivo e responsável.
- Atualização automática do saldo após cada movimentação.
- Bloqueio de saída que deixaria o saldo negativo.
- Histórico de movimentações por produto e histórico geral.
- Cadastro diferenciado para materiais consumíveis e equipamentos permanentes.
- Login com sessão, senha protegida por hash e perfis de acesso.
- Dashboard com resumo do estoque e alertas.

### Regra específica de patrimônio

Materiais consumíveis podem ter quantidade maior que uma unidade no mesmo cadastro. Equipamentos permanentes são registrados individualmente, com número de série e/ou patrimônio, e cada entrada ou saída movimenta uma unidade por vez.

## 2. Tecnologias

| Camada | Tecnologia | Uso |
|---|---|---|
| Interface | HTML5, CSS3 e JavaScript | Telas responsivas e chamadas `fetch` |
| Backend | Node.js e Express | Servidor HTTP e API REST |
| Banco de dados | PostgreSQL em nuvem (Neon ou Supabase) | Persistência dos dados |
| Driver | `pg` | Comunicação entre API e PostgreSQL |
| Segurança | `bcrypt`, `express-session` e `connect-pg-simple` | Hash de senhas e sessões persistidas no PostgreSQL |

## 3. Modelo de dados

- **app_users**: usuários, hash da senha, nome e perfil.
- **categories**: categorias de produtos.
- **items**: produtos, preço, quantidade, estoque mínimo e informações complementares de patrimônio.
- **movements**: entradas, saídas e ajustes, com saldo anterior e posterior, motivo, responsável, usuário e data.

Relacionamentos principais:

- Uma categoria pode estar associada a vários produtos (1:N).
- Um produto pode possuir várias movimentações (1:N).
- Um usuário pode registrar várias movimentações (1:N).

As tabelas `items` e `movements` possuem restrições no PostgreSQL para impedir valores negativos e preservar a integridade referencial. A operação de movimentação usa uma transação (`BEGIN`, `COMMIT` e `ROLLBACK`) e bloqueia temporariamente a linha do produto (`SELECT ... FOR UPDATE`), evitando que duas saídas simultâneas calculem o saldo com base no mesmo valor antigo.

## 4. Requisitos para instalação

- Node.js 20 ou superior.
- npm (instalado junto com o Node.js).
- Conta em um provedor de PostgreSQL na nuvem, como [Neon](https://neon.tech/) ou [Supabase](https://supabase.com/).
- Git e um repositório GitHub para versionamento e entrega.

> **Importante:** para atender ao requisito acadêmico de banco em produção, use uma instância PostgreSQL hospedada na nuvem. O PostgreSQL instalado apenas no computador local não atende a esse critério.

## 5. Configurar o banco PostgreSQL na nuvem (Neon)

Este projeto usa o driver `pg`, compatível com PostgreSQL padrão. O Neon foi escolhido como caminho documentado porque fornece uma URL PostgreSQL que pode ser utilizada diretamente pela variável `DATABASE_URL`.

1. Crie uma conta no [Neon](https://neon.tech/) e crie um projeto PostgreSQL.
2. Abra o projeto e clique em **Connect** no painel.
3. Selecione a branch, o banco e o usuário (role) que serão utilizados.
4. Copie a connection string gerada pelo painel. Mantenha os parâmetros de segurança TLS fornecidos pelo Neon, normalmente `sslmode=require` e `channel_binding=require`.
5. Guarde essa URL para configurar o arquivo `.env` na próxima etapa.

Documentação oficial: [Connecting Neon to your stack](https://neon.com/docs/get-started/connect-neon) e [onde encontrar a connection string](https://neon.com/docs/connect/connect-from-any-app).

Também é possível utilizar Supabase: crie um projeto PostgreSQL e copie a connection string nas configurações de banco de dados. Use o formato recomendado pelo painel e os parâmetros SSL fornecidos pelo provedor.

## 6. Instalação e execução

### 6.1 Baixar o projeto

Clone o repositório ou extraia o ZIP entregue:

```bash
git clone URL_DO_REPOSITORIO
cd estoque-radio
```

### 6.2 Instalar dependências

```bash
npm install
```

### 6.3 Configurar variáveis de ambiente

Crie uma cópia de `.env.example` com o nome `.env`:

**Windows (PowerShell):**

```powershell
Copy-Item .env.example .env
```

Abra `.env` e substitua os valores de exemplo:

```env
DATABASE_URL="postgresql://USUARIO:SENHA@HOST-DO-NEON/NOME_DO_BANCO?sslmode=require&channel_binding=require"
SESSION_SECRET="GERE_UMA_CHAVE_ALEATORIA_LONGA_E_EXCLUSIVA"
PORT=3000
COOKIE_SECURE=false
DB_POOL_MAX=10
```

- `DATABASE_URL`: URL de conexão do PostgreSQL hospedado.
- `SESSION_SECRET`: segredo longo e aleatório usado para assinar as sessões.
- `PORT`: porta HTTP da aplicação.
- `COOKIE_SECURE`: use `false` no desenvolvimento local por HTTP. Em produção com HTTPS, configure `true`.
- `DB_POOL_MAX`: limite de conexões simultâneas abertas pelo pool.

**Nunca envie `.env` ao GitHub.** O arquivo `.gitignore` já contém a regra para ignorá-lo. Envie somente `.env.example`, sem senhas ou tokens reais.

### 6.4 Criar as tabelas

Com a URL do banco preenchida corretamente no `.env`, execute:

```bash
npm run db:init
```

O comando executa `src/schema.sql` no banco remoto e cria as tabelas e índices necessários. Faça isso em um banco/branch vazio destinado ao projeto. O script é de inicialização para uma base nova; não é uma ferramenta de migração automática de versões antigas do protótipo.

### 6.5 Criar o primeiro administrador

```bash
npm run admin:create
```

Informe o login, nome completo e senha (mínimo de 10 caracteres). A senha é armazenada como hash usando bcrypt. O primeiro usuário criado recebe perfil `admin`.

### 6.6 Iniciar a aplicação

Modo normal:

```bash
npm start
```

Modo de desenvolvimento (reinicia o servidor ao detectar alterações, Node.js 20+):

```bash
npm run dev
```

Acesse no navegador:

```text
http://localhost:3000
```

A API estará disponível no mesmo host, sob o prefixo `/api`.

## 7. Acesso pela rede local

Para outros computadores da rádio acessarem a interface:

1. Execute a aplicação em um computador que permaneça ligado e conectado à rede.
2. Descubra o IPv4 desse computador com `ipconfig`.
3. Libere a porta TCP configurada em `PORT` no Firewall do Windows somente para o perfil de rede e os dispositivos autorizados pela equipe de TI.
4. Nos demais computadores, acesse `http://IP_DO_SERVIDOR:3000`.
5. Mantenha a aplicação e a conexão com o banco em funcionamento.

O banco permanece hospedado na nuvem. A aplicação local faz as consultas e alterações no banco remoto pela API. Para disponibilizar o próprio sistema publicamente, será necessário hospedar também a API e configurar HTTPS; essa publicação da API é um diferencial opcional do trabalho.

## 8. Endpoints da API

Todas as rotas de negócio exigem autenticação por sessão. Primeiro, faça login em `POST /api/auth/login`; depois, mantenha o cookie de sessão nas próximas requisições. A rota `/api/health` e o login são públicos.

Os exemplos abaixo mostram os campos principais. IDs, datas e valores retornados são ilustrativos.

| Método | Rota | Descrição | Exemplo de corpo / parâmetros | Exemplo de resposta |
|---|---|---|---|---|
| `GET` | `/api/health` | Verifica API e conexão com banco. | Sem corpo. | `200` — `{"status":"ok","database":"connected"}` |
| `POST` | `/api/auth/login` | Inicia sessão do usuário. | `{"username":"admin","password":"SenhaForte123!"}` | `200` — `{"user":{"id":"1","username":"admin","fullName":"Administrador","role":"admin"}}` |
| `POST` | `/api/auth/logout` | Encerra a sessão atual. | Sem corpo. | `200` — `{"ok":true}` |
| `GET` | `/api/auth/me` | Retorna o usuário autenticado. | Sem corpo. | `200` — `{"user":{"id":"1","username":"admin","fullName":"Administrador","role":"admin"}}` |
| `GET` | `/api/dashboard` | Retorna indicadores, estoque baixo e movimentações recentes. | Sem corpo. | `200` — `{"summary":{"total_items":12,"consumables":8,"equipment":4,"low_stock":2},"lowStock":[],"recent":[]}` |
| `GET` | `/api/categorias` | Lista categorias e total de produtos vinculados. | Sem corpo. | `200` — `{"categorias":[{"id":1,"name":"Áudio","description":"Equipamentos e acessórios de áudio","products_count":3}]}` |
| `GET` | `/api/categorias/:id` | Consulta uma categoria. | Parâmetro: `/api/categorias/1`. | `200` — `{"categoria":{"id":1,"name":"Áudio","description":"Acessórios de áudio","products_count":3}}` |
| `POST` | `/api/categorias` | Cria uma categoria. | `{"name":"Informática","description":"Peças e periféricos"}` | `201` — `{"mensagem":"Categoria criada com sucesso.","categoria":{"id":2,"name":"Informática","description":"Peças e periféricos"}}` |
| `PUT` | `/api/categorias/:id` | Atualiza uma categoria. | `{"name":"Computadores","description":"Computadores e periféricos"}` | `200` — `{"mensagem":"Categoria atualizada com sucesso.","categoria":{"id":2,"name":"Computadores"}}` |
| `DELETE` | `/api/categorias/:id` | Exclui categoria sem produtos vinculados. | Parâmetro: `/api/categorias/2`. | `200` — `{"mensagem":"Categoria excluída com sucesso.","categoria":{"id":2,"name":"Computadores"}}` |
| `GET` | `/api/produtos` | Lista produtos. Aceita filtros `estoqueBaixo=true`, `categoria=1`, `tipo=consumivel` e `busca=cabo`. | Query string opcional; sem corpo. | `200` — `{"produtos":[{"id":1,"code":"MAT-001","name":"Cabo XLR","category_id":1,"category_name":"Áudio","price":"35.00","quantity":12,"minimum_quantity":3,"nome":"Cabo XLR","preco":35,"quantidade_estoque":12,"estoque_minimo":3}]}` |
| `GET` | `/api/produtos/:id` | Consulta um produto. | Parâmetro: `/api/produtos/1`. | `200` — `{"produto":{"id":1,"code":"MAT-001","name":"Cabo XLR","price":"35.00","quantity":12,"minimum_quantity":3,"nome":"Cabo XLR","preco":35,"quantidade_estoque":12,"estoque_minimo":3}}` |
| `POST` | `/api/produtos` | Cadastra produto. Pode informar `categoria_id` ou `categoria` (nome; caso não exista, será criada). | `{"codigo":"MAT-002","nome":"Pilha AA","categoria":"Energia","preco":4.5,"quantidade_estoque":20,"estoque_minimo":5,"tipo_item":"consumivel","unidade":"par"}` | `201` — `{"mensagem":"Produto cadastrado com sucesso.","produto":{"id":2,"code":"MAT-002","name":"Pilha AA","price":"4.50","quantity":20,"minimum_quantity":5,"category_name":"Energia"}}` |
| `PUT` | `/api/produtos/:id` | Atualiza dados do produto. Se a quantidade mudar, registra um ajuste no histórico. | `{"nome":"Pilha AA alcalina","preco":5.2,"quantidade_estoque":18,"estoque_minimo":6}` | `200` — `{"mensagem":"Produto atualizado com sucesso.","produto":{"id":2,"name":"Pilha AA alcalina","price":"5.20","quantity":18,"minimum_quantity":6}}` |
| `DELETE` | `/api/produtos/:id` | Exclui produto somente se não possuir movimentações vinculadas. | Parâmetro: `/api/produtos/2`. | `200` — `{"mensagem":"Produto excluído com sucesso.","produto":{"id":2,"code":"MAT-002","name":"Pilha AA"}}` |
| `GET` | `/api/produtos/:id/movimentacoes` | Lista histórico de movimentações de um produto. | Parâmetro: `/api/produtos/1/movimentacoes`. | `200` — `{"produto_id":1,"movimentacoes":[{"id":1,"tipo":"entrada","quantidade":12,"saldo_anterior":0,"saldo_atual":12,"motivo":"Saldo inicial no cadastro"}]}` |
| `GET` | `/api/movimentacoes` | Lista movimentações. Aceita filtros `produto=1` e `tipo=entrada` ou `tipo=saida`. | Query string opcional; sem corpo. | `200` — `{"movimentacoes":[{"id":1,"produto_id":1,"tipo":"entrada","quantidade":12,"saldo_anterior":0,"saldo_atual":12,"motivo":"Compra","data":"2026-11-23T10:00:00.000Z"}]}` |
| `POST` | `/api/movimentacoes` | Registra entrada ou saída e atualiza o saldo automaticamente. `data` e `responsavel` são opcionais. | `{"produto_id":1,"tipo":"saida","quantidade":2,"motivo":"Uso no estúdio","responsavel":"Estúdio 1"}` | `201` — `{"mensagem":"Movimentação registrada e estoque atualizado.","movimentacao":{"id":2,"produto_id":"1","tipo":"saida","quantidade":2,"saldo_anterior":12,"saldo_atual":10,"motivo":"Uso no estúdio"}}` |

### Principais códigos HTTP

- `200 OK`: consulta, atualização, exclusão ou operação concluída.
- `201 Created`: cadastro ou movimentação criada.
- `400 Bad Request`: campos inválidos, valores negativos, quantidade inválida ou tentativa de saída maior que o saldo.
- `401 Unauthorized`: sessão ausente ou login inválido.
- `403 Forbidden`: usuário autenticado sem permissão para a ação.
- `404 Not Found`: ID ou rota não encontrado.
- `409 Conflict`: código duplicado, categoria vinculada a produtos ou produto com movimentações históricas.
- `500 Internal Server Error`: erro inesperado no servidor; detalhes ficam no terminal.

## 9. Exemplos para testar no Postman ou Insomnia

### Login

`POST http://localhost:3000/api/auth/login`

```json
{
  "username": "admin",
  "password": "SENHA_CADASTRADA"
}
```

Mantenha o cookie de sessão salvo pelo Postman/Insomnia para as chamadas autenticadas seguintes.

### Criar categoria

`POST http://localhost:3000/api/categorias`

```json
{
  "name": "Áudio",
  "description": "Cabos, microfones e acessórios"
}
```

### Cadastrar produto

`POST http://localhost:3000/api/produtos`

```json
{
  "codigo": "MAT-001",
  "nome": "Cabo XLR",
  "categoria": "Áudio",
  "preco": 35.00,
  "quantidade_estoque": 10,
  "estoque_minimo": 3,
  "tipo_item": "consumivel",
  "unidade": "un"
}
```

### Registrar uma entrada

`POST http://localhost:3000/api/movimentacoes`

```json
{
  "produto_id": 1,
  "tipo": "entrada",
  "quantidade": 5,
  "motivo": "Compra de reposição",
  "responsavel": "TI"
}
```

### Demonstrar regra de negócio: saída acima do saldo

`POST http://localhost:3000/api/movimentacoes`

```json
{
  "produto_id": 1,
  "tipo": "saida",
  "quantidade": 999,
  "motivo": "Teste de validação"
}
```

Resposta esperada: `400 Bad Request` com a mensagem `Estoque insuficiente. A saída não pode deixar o saldo negativo.`

## 10. Como demonstrar o projeto na apresentação

Sugestão de fluxo para a demonstração:

1. Fazer login na interface.
2. Cadastrar uma categoria e mostrar que ela aparece na tabela de categorias.
3. Cadastrar um produto pela interface e consultar o registro no painel do banco PostgreSQL em nuvem.
4. Editar o produto e mostrar que a alteração foi persistida.
5. Registrar uma entrada e uma saída; mostrar o saldo atualizado e o histórico.
6. Tentar registrar uma saída acima do saldo e demonstrar o retorno HTTP `400` no Postman/Insomnia.
7. Criar um produto de teste sem movimentações e demonstrar a exclusão pela interface ou API.
8. Demonstrar que uma categoria vinculada a produtos não pode ser excluída (`409`) e explicar a integridade referencial.

Para demonstrar exclusão de produto, utilize um registro de teste com quantidade inicial zero, pois a criação com saldo inicial maior que zero gera uma movimentação no histórico e o banco bloqueia a exclusão para preservar a auditoria.

## 11. Versionamento no GitHub

Antes de enviar o repositório, confirme que `.env` não aparece nos arquivos versionados:

```bash
git status
```

Depois:

```bash
git add .
git commit -m "feat: primeira versão do EstoqueJá"
git push origin main
```

Confira no GitHub se `.env` não foi enviado. Se uma senha ou token real for publicado por engano, revogue/rotacione a credencial imediatamente.

## 12. Estrutura de pastas

```text
estoque-radio/
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── src/
│   ├── server.js
│   ├── db.js
│   ├── schema.sql
│   ├── init-db.js
│   ├── create-admin.js
│   ├── middleware/
│   │   └── auth.js
│   └── routes/
│       ├── auth.js
│       ├── categories.js
│       ├── dashboard.js
│       ├── products.js
│       └── movements.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## 13. Observações de segurança e produção

- Não publique credenciais do banco, `.env` ou senhas de usuários.
- Use HTTPS e `COOKIE_SECURE=true` ao hospedar a aplicação com certificado TLS.
- Restrinja as origens e os dispositivos que podem acessar a API.
- Configure cópias de segurança e teste a restauração dos dados.
- O MVP possui perfis `admin`, `operador` e `consulta`; as permissões podem ser refinadas conforme a necessidade do trabalho.
- Antes do uso operacional definitivo na rádio, realize testes completos, revise as políticas de acesso e valide o processo de backup/restauração.
