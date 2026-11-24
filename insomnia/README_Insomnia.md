# EstoqueJá — Roteiro de dados e testes no Insomnia

Esta coleção foi montada para a versão do EstoqueJá com API hospedada em Render e PostgreSQL no Supabase.

## 1. Importar a coleção

1. Abra o Insomnia.
2. Selecione **Import** → **File**.
3. Escolha `EstoqueJa_Insomnia_Collection.json`.
4. Abra o **Base Environment** da coleção.
5. Preencha `admin_username` e `admin_password` com o login de administrador já criado no sistema.
6. Mantenha `base_url` como `https://estoqueja-radio.onrender.com` (ou troque pela URL do seu serviço).
7. Salve o ambiente.

A coleção usa o formato de exportação Insomnia v4 (JSON), compatível com a importação do Insomnia. Os requests estão organizados por pastas.

## 2. Fazer login e manter a sessão

Na pasta **00 - Saúde, autenticação e painel**, execute na ordem:

1. `01 - Verificar API e Supabase` — esperado `200` e `database: connected`.
2. `02 - Login administrador` — esperado `200`.
3. `03 - Consultar usuário autenticado` — esperado `200`.
4. `04 - Dashboard` — esperado `200`.

Os requests estão configurados com `settingStoreCookies=true` e `settingSendCookies=true`. O Insomnia deve guardar e enviar o cookie `estoque.sid` nas chamadas seguintes. Use sempre o mesmo host da variável `base_url`; não misture o domínio `onrender.com` com outro domínio ou localhost durante a mesma sessão.

Se uma rota protegida retornar `401`, abra **Cookies / Cookie Jar** para o host e confira se existe o cookie `estoque.sid`. Tente executar novamente o login. Não coloque manualmente a senha no cabeçalho Cookie.

## 3. Popular o banco para a demonstração

A coleção cria registros fictícios identificados com o prefixo `DEMO-` ou `DEMO -`. Eles foram pensados como dados de apresentação da rádio, não são inventário real nem preços de compra confirmados.

Execute uma vez, na ordem das pastas:

### Categorias

Na pasta **01 - Categorias**:

1. Crie a categoria temporária.
2. Consulte a categoria.
3. Edite a categoria.
4. Exclua a categoria temporária.
5. Crie as cinco categorias de demonstração (Áudio, Cabos, Informática, Rede e Energia).
6. Liste as categorias.

Os scripts After-response salvam os IDs retornados em variáveis do ambiente do Insomnia.

### Produtos

Na pasta **02 - Produtos**, crie os seis produtos de demonstração e o produto temporário de exclusão. Depois execute listagem, filtros e consulta por ID.

Os itens incluem:

- Cabo XLR balanceado: consumível, saldo inicial 15, mínimo 5.
- Conector XLR macho: consumível, saldo inicial 2, mínimo 8 (para demonstrar estoque baixo).
- Pilha AA: consumível.
- Cabo de rede CAT6: consumível medido em metros.
- Microfone dinâmico: equipamento unitário com patrimônio fictício.
- Switch Gigabit: equipamento unitário com patrimônio fictício.
- Produto temporário: saldo zero e sem movimentações, utilizado para demonstrar DELETE permitido.

Os IDs de produto também são salvos automaticamente após cada criação.

**Importante:** a API cria uma movimentação de saldo inicial quando um produto é cadastrado com quantidade maior que zero. Por isso, a exclusão de produtos que já têm histórico é bloqueada com `409`. O produto temporário tem quantidade zero justamente para demonstrar um `DELETE` com sucesso.

Se uma categoria DEMO já existir, o POST correspondente responderá `409`. Nesse caso, não repita a criação; consulte `GET /api/categorias` e siga para os produtos. Se um código de produto já existir, escolha um novo `codigo` no corpo da requisição antes de tentar novamente.

## 4. Testar movimentações

Na pasta **03 - Movimentações**, execute:

1. Entrada de 5 cabos XLR: saldo 15 → 20.
2. Saída de 2 cabos XLR: saldo 20 → 18.
3. Listagem geral e filtros.
4. Histórico individual do cabo XLR.
5. Saída de 999 conectores XLR: deve retornar `400` e o saldo não pode ficar negativo.
6. Movimentação de produto inexistente: deve retornar `404`.

## 5. Demonstrar integridade e erros

Na pasta **04 - Erros tratados**:

- Excluir categoria com produto vinculado: esperado `409 Conflict`.
- Consultar produtos com `tipo=qualquer-coisa`: esperado `400 Bad Request`.
- Consultar categoria inexistente: esperado `404 Not Found`.

Na pasta **02 - Produtos**, o request de exclusão do produto com histórico deve retornar `409`; o request de exclusão do produto temporário sem histórico deve retornar `200`.

Os scripts de After-response testam o status esperado e armazenam IDs retornados. Se sua versão do Insomnia não executar scripts, copie o `id` do JSON de resposta e preencha a variável correspondente manualmente no Base Environment.

## 6. Rotas cobertas

| Método | Rota | Demonstração |
|---|---|---|
| GET | `/api/health` | Saúde da API e conexão com o banco |
| POST | `/api/auth/login` | Login e criação da sessão |
| GET | `/api/auth/me` | Usuário autenticado |
| POST | `/api/auth/logout` | Encerrar sessão |
| GET | `/api/dashboard` | Indicadores do painel |
| GET / POST | `/api/categorias` | Listar e criar categorias |
| GET / PUT / DELETE | `/api/categorias/:id` | Consultar, editar e excluir categorias |
| GET / POST | `/api/produtos` | Listar e cadastrar produtos |
| GET / PUT / DELETE | `/api/produtos/:id` | Consultar, editar e excluir produtos |
| GET | `/api/produtos?estoqueBaixo=true` | Filtrar estoque baixo |
| GET | `/api/produtos/:id/movimentacoes` | Histórico do produto |
| GET / POST | `/api/movimentacoes` | Listar e registrar entradas/saídas |

## 7. Roteiro curto para apresentação (10–15 min)

1. Faça login e mostre `GET /api/auth/me`.
2. Cadastre uma categoria e um produto (ou mostre os registros DEMO já criados).
3. Abra o Supabase → Table Editor → `categories` e `items`, e mostre que os registros estão persistidos na nuvem.
4. Edite um produto com `PUT /api/produtos/:id` e consulte novamente.
5. Registre entrada e saída com `POST /api/movimentacoes`; mostre o saldo atualizado em `GET /api/produtos/:id`.
6. Demonstre a falha controlada de estoque negativo (`400`).
7. Demonstre conflito ao excluir categoria com produto vinculado (`409`) e recurso inexistente (`404`).
8. Finalize mostrando `GET /api/dashboard` e o histórico.

## 8. Cuidados

- Não compartilhe `admin_password`, cookies de sessão ou dados de conexão do Supabase.
- A coleção não contém credenciais reais; preencha-as no seu Insomnia local.
- Os registros DEMO são persistidos no banco usado pelo Render. Só os insira no projeto/ambiente em que você pretende fazer a apresentação.
- Não apague diretamente linhas de `movements` no Supabase para forçar exclusões: o histórico é usado para preservar a rastreabilidade.


## Correção de compatibilidade

Esta versão corrigida define `dataPropertyOrder` e `environmentPropertyOrder` usando listas no formato esperado pelo Insomnia, evitando valores nulos no metadado de ordenação do ambiente.
