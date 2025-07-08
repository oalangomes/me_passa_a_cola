
# 📘 Me passa a cola?

Um GPT personalizado criado com empatia, criatividade e foco real em pessoas que aprendem de forma diferente.

---

## ✨ Sobre o projeto

**“Me passa a cola?”** é um assistente de estudos construído sobre o ChatGPT (usando a ferramenta "Meus GPTs"), criado por Alan Gomes para ajudar sua esposa — diagnosticada com TEA — a estudar de forma mais leve, organizada e acessível durante a faculdade.

A ideia surgiu de uma necessidade real dentro de uma família neurodivergente e se transformou em uma solução criativa e funcional, que pode ajudar qualquer pessoa com dificuldades em organização, foco, leitura ou rotina de estudos.

---

## 🌟 Motivação

> "Somos uma família atípica. Minha esposa tem TEA, eu sou TDAH, nossos filhos também. Estudar, aqui, exige criatividade e empatia. E às vezes, o que a gente precisa, ainda não existe. Então a gente cria."

O GPT foi desenvolvido para:

* Reduzir a sobrecarga cognitiva
* Organizar os estudos por tema
* Fornecer recursos de apoio adaptáveis ao estilo de cada pessoa

---

## 🧠 Funcionalidades principais

* **Organização por tema**: um chat por matéria para manter o foco
* **Geração de cronogramas personalizados**
* **Resumos rápidos ou detalhados**, com escolha de formato (bullet points, texto corrido, mapa mental)
* **Criação de miniprovas e quizzes**
* **Planos de estudo adaptados à rotina**
* **Sugestões de técnicas de estudo** (Pomodoro, Cornell, repetição espaçada)
* **Recomendações de conteúdos extras** (vídeos, livros, podcasts)
* **Flashcards automáticos**
* **Integração com Notion** para guardar resumos, cronogramas e flashcards
* **Envio de PDFs convertidos em Markdown** diretamente para o banco
* **Commits automáticos e gestão de issues no GitHub**
* **Disparo e verificação de workflows do GitHub**

---

## 📄 Como funciona

1. O usuário informa o tema de estudo
2. O GPT organiza o conteúdo exclusivamente dentro daquele tema
3. Se já houver conteúdo gerado, o GPT pergunta se deseja editar, substituir ou revisar
4. Todas as entregas vêm com sugestões de próximas ações (reforçando foco e continuidade)

Exemplo de interação:

```text
🟢 Tema: Inteligência Artificial
O que gostaria de fazer agora?
- Gerar um cronograma?
- Criar um resumo (rápido ou detalhado)?
- Montar um plano de estudos?
- Fazer uma miniprova de revisão?
```

---

## 💬 Linguagem acessível

* Fala com o usuário de forma empática, informal e clara
* Usa emojis com moderação
* Respeita o tempo e o ritmo de quem está aprendendo

---

## 📌 Dica para uso ideal

Para quem usar com frequência: renomeie cada chat com o tema. Exemplo:

> 📘 Inteligência Artificial — Me passa a cola?

Assim você pode voltar depois e continuar de onde parou.

---

## 🤝 Integração com Notion

### ✅ Funcionalidade externa

O projeto permite enviar conteúdos gerados para um **banco de dados no Notion**, de forma automática e personalizada.

### 🏢 Como funciona:

1. O usuário fornece seu **token do Notion** e o **ID do banco de dados**
2. O GPT envia os dados para um App Script (usado como backend)
3. Esse backend armazena os conteúdos no Notion, organizados por tema

### 🧪 Como pegar o token do Notion:

1. Acesse [https://www.notion.com/my-integrations](https://www.notion.com/my-integrations)
2. Clique em "New integration"
3. Dê um nome (ex: `MePassaACola`), escolha um workspace
4. Marque as permissões: `Read`, `Insert`, `Update`
5. Salve e copie o token gerado (`secret_...`)
6. No Notion, compartilhe sua página ou banco com a integração criada (botão "Share")

### 📊 Como saber o ID do banco:

* Acesse o banco de dados desejado
* Copie da URL: `https://www.notion.so/nome-da-pagina/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
* O trecho final (sem os `-`) é o **database_id**

### 📋 Estrutura mínima do Notion

Crie um banco com os seguintes campos (com esses nomes e tipos):

- Tema (Título)
- Tipo (Texto)
- Resumo (Texto)
- Observacoes (Texto)
- Tags (Multi-seleção)
- Data (Data)
## 🚀 Como rodar localmente

Para executar o projeto em sua máquina, siga os passos abaixo:

1. Certifique-se de ter o **Node.js 18** instalado (conforme especificado no `package.json`).
2. No diretório do projeto, instale as dependências executando:

   ```bash
   npm install
   ```

3. Inicie a API definindo seu token e rodando o comando:

   ```bash
   API_TOKEN=<seu_token> npm start
   ```

   Caso prefira, crie um arquivo `.env` com suas variáveis (`API_TOKEN`, `PORT`, etc.).
   Ao executar `npm start`, esse arquivo será carregado automaticamente.

4. Para executar os testes automatizados, primeiro instale as dependências e depois rode o comando:

   ```bash
   npm install
   npm test
   ```


## 📬 Endpoints principais do Notion

A documentação completa pode ser consultada em [`/api-docs`](https://me-passa-a-cola.onrender.com/api-docs).

### POST /create-notion-content

Envia um resumo ou texto para uma página do banco.

**Parâmetros**

- `notion_token` (obrigatório)
- `nome_database` (opcional)
- `tema` (opcional)
- `subtitulo` (opcional)
- `tipo` (opcional)
- `resumo`
- `tags` (opcional)
- `data` (opcional)

**Exemplo**

```http
POST /create-notion-content
{
  "notion_token": "secret_xxx",
  "nome_database": "Me Passa A Cola (GPT)",
  "tema": "Matéria X",
  "subtitulo": "Aula 1",
  "resumo": "Conteúdo em Markdown",
  "tags": ["exemplo"],
  "data": "2024-04-01"
}
```

**Resposta**

```json
{ "ok": true, "pageUrl": "https://..." }
```

### POST /create-notion-flashcards

Gera uma página de flashcards para um tema.

**Parâmetros**

- `notion_token` (obrigatório)
- `nome_database` (opcional)
- `tema` (obrigatório)
- `subtitulo` (opcional)
- `flashcards` (lista de `{ pergunta, resposta }`)
- `tags` (opcional)
- `data` (opcional)

**Exemplo**

```http
POST /create-notion-flashcards
{
  "notion_token": "secret_xxx",
  "tema": "Matéria X",
  "flashcards": [
    { "pergunta": "O que é IA?", "resposta": "Área que estuda..." }
  ]
}
```

**Resposta**

```json
{ "ok": true, "flashcardsUrl": "https://..." }
```

### POST /create-notion-cronograma

Cria atividades de cronograma dentro de um tema.

**Parâmetros**

- `notion_token` (obrigatório)
- `nome_database` (opcional)
- `tema` (obrigatório)
- `cronograma` (lista de `{ atividade, descricao?, data? }`)
- `tags` (lista ou string, opcional)

**Exemplo**

```http
POST /create-notion-cronograma
{
  "notion_token": "secret_xxx",
  "nome_database": "Me Passa A Cola (GPT)",
  "tema": "Matéria X",
  "cronograma": [
    {
      "atividade": "Ler capítulo 1",
      "descricao": "Leitura inicial",
      "data": "2024-04-02"
    }
  ],
  "tags": ["leitura", "cap1"],
  "outrasProps": {
    "Professor": { "rich_text": [{ "text": { "content": "Fulano" } }] }
  }
}
```

É possível enviar outras propriedades do Notion no campo `outrasProps`, seguindo
o formato aceito pela API.

**Resposta**

```json
{ "ok": true, "atividades": ["..."] }
```

### GET /notion-content

Consulta conteúdos registrados no Notion.

**Parâmetros (query)**

- `notion_token` (obrigatório)
- `nome_database` (opcional)
- `tema` (opcional)
- `subtitulo` (opcional)
- `tipo` (opcional)
- `limit` (opcional)

**Exemplo**

```
GET /notion-content?notion_token=secret_xxx&tema=Matéria%20X&limit=5
```

**Resposta**

```json
{ "ok": true, "results": [] }
```

### POST /atualizar-titulos-e-tags

Atualiza os títulos e tags das subpáginas de um tema.

**Parâmetros**

- `notion_token` (obrigatório)
- `nome_database` (opcional)
- `tema` (obrigatório)

**Exemplo**

```http
POST /atualizar-titulos-e-tags
{
  "notion_token": "secret_xxx",
  "tema": "Matéria X"
}
```

**Resposta**

```json
{ "ok": true, "total": 0 }
```


## 🚀 Endpoint de Commit no Git

A API disponibiliza a rota `POST /git-commit` para realizar commits em repositórios privados utilizando um token de acesso.

### Requisição

```http
POST /git-commit?x-api-token=<seu_token>

{
  "repoUrl": "https://github.com/usuario/repositorio.git",
  "credentials": "ghp_xxx",
  "message": "feat: meu commit",
  "files": ["arquivo.txt"],
  "branch": "main",  # opcional
  "content": {
  "novo.txt": "conteudo gerado"
  }
  "githubToken": "ghp_xxx",      # opcional para disparar workflow
  "githubOwner": "usuario",      # opcional
  "githubRepo": "repositorio"    # opcional
}
```

O campo `branch` é opcional e assume `main` como padrão. Os caminhos listados em `files` são relativos ao repositório. O objeto `content` permite criar arquivos fornecendo pares caminho/conteúdo. O acesso é protegido pelo parâmetro de query `x-api-token`.
Se o arquivo `.cola-config` contiver `commitWorkflow`, esse workflow será disparado após o commit usando as credenciais informadas.

## \ud83d\udcc2 Endpoints para arquivos do Git

Permitem listar diret\u00f3rios e ler ou atualizar arquivos individuais.

- `GET /git-files` lista arquivos de um caminho (par\u00e2metros: `repoUrl`, `credentials`, `path`).
- `GET /git-file` obt\u00e9m o conte\u00fado de um arquivo (par\u00e2metros: `repoUrl`, `credentials`, `file`).
- `PATCH /git-file` cria ou atualiza o arquivo e executa um commit.

Exemplos de uso:

```http
GET /git-files?repoUrl=https://github.com/usuario/repositorio.git&credentials=usuario:token&path=docs
```

```http
GET /git-file?repoUrl=https://github.com/usuario/repositorio.git&credentials=usuario:token&file=README.md
```

```http
PATCH /git-file
Headers:
  x-api-token: <seu_token>

{
  "repoUrl": "https://github.com/usuario/repositorio.git",
  "credentials": "usuario:token",
  "filePath": "docs/novo.md",
  "content": "# Novo conte\u00fado",
  "commitMessage": "docs: atualiza arquivo"
}
```

## 🚀 Endpoint para Notion + Git

Cria o conteúdo no Notion e salva o mesmo texto em um repositório Git.

### Requisição

```http
POST /create-notion-content-git?x-api-token=<seu_token>

{
  "repoUrl": "https://github.com/usuario/repositorio.git",
  "credentials": "ghp_xxx",
  "commitMessage": "feat: novo conteúdo",
  "filePath": "docs/novo.md",
  "branch": "main",  # opcional
  "notion_token": "secret_xxx",
  "tema": "Matéria X",
  "subtitulo": "Aula 1",
  "resumo": "Conteúdo em Markdown",
  "githubToken": "ghp_xxx",      # opcional para disparar workflow
  "githubOwner": "usuario",      # opcional
  "githubRepo": "repositorio"    # opcional
}
```

As tags informadas são combinadas com tags geradas automaticamente a partir do texto antes de criar a página e salvar o arquivo.

### 🔧 Variáveis de ambiente

Antes de iniciar a API é preciso definir algumas variáveis no ambiente:

- `API_TOKEN`: usada para autenticação em `/git-commit`.
- `PORT` (opcional, padrão `3333`).

Você pode exportá-las no terminal ou criar um arquivo `.env` na raiz do projeto.
Ao executar `npm start`, esse arquivo será lido automaticamente:

```bash
API_TOKEN=seu_token PORT=3333 npm start
```

### 📁 Arquivo de configuração `.cola-config`

Dentro de qualquer repositório usado pelas rotas de Git é possível criar um arquivo
`.cola-config.yml` ou `.cola-config.json` com ajustes extras. O campo
`commitTemplate` define o template da mensagem de commit quando `commitMessage`
não é informado. Também é possível indicar o workflow a ser disparado após cada
commit através de `commitWorkflow` (nome ou `workflow_id`). Caso o workflow
necessite autenticação, informe `githubToken`, `githubOwner` e `githubRepo`.

Exemplo em YAML:

```yaml
commitTemplate: .github/commit-template.md
commitWorkflow: deploy.yml
githubToken: ghp_xxx
githubOwner: usuario
githubRepo: repositorio
defaultIssueProject: proj1
pullRequestTemplates:
  feature: .github/PULL_REQUEST_TEMPLATE/feature.md
  fix: .github/PULL_REQUEST_TEMPLATE/fix.md
  chore: .github/PULL_REQUEST_TEMPLATE/chore.md
issueRules:
  - if:
      labels: ['bug']
    set:
      milestone: 'Sprint 1'
      column: 'Bugs'
```

A seção `pullRequestTemplates` define os caminhos para cada tipo de PR. Se omitida,
o serviço usará os arquivos dentro de `.github/PULL_REQUEST_TEMPLATE`.

Ou em JSON:

```json
{
  "commitTemplate": ".github/commit-template.md",
  "commitWorkflow": "deploy.yml",
  "githubToken": "ghp_xxx",
  "githubOwner": "usuario",
  "githubRepo": "repositorio",
  "pullRequestTemplates": {
    "feature": ".github/PULL_REQUEST_TEMPLATE/feature.md",
    "fix": ".github/PULL_REQUEST_TEMPLATE/fix.md",
    "chore": ".github/PULL_REQUEST_TEMPLATE/chore.md"
  }
}
```

Use `pullRequestTemplates` para indicar diferentes modelos de Pull Request. Se
nenhum caminho for configurado, o serviço procura por `.github/PULL_REQUEST_TEMPLATE/<tipo>.md`.

O campo `issueRules` permite automatizar passos após criar ou atualizar uma issue. Veja um exemplo de regra que define milestone e coluna quando a label `bug` estiver presente.

Crie também o arquivo citado no campo `commitTemplate`. Esse documento será lido
como base para a mensagem de commit. Caso não exista configuração, o caminho
padrão procurado é `.github/commit-template.md`.

Exemplo de `.github/commit-template.md`:

```text
chore: atualiza documentos
```

## 📄 Enviar PDF para o Notion

Envia um arquivo PDF em base64, converte para Markdown e registra o texto usando `POST /notion-content` com `type` igual a `pdf`.

```http
POST /notion-content

{
  "type": "pdf",
  "notion_token": "secret_xxx",
  "nome_database": "Me Passa A Cola (GPT)",
  "tema": "Matéria X",
  "subtitulo": "Aula 1",
  "pdf_base64": "<arquivo em base64>",
  "tags": ["exemplo"],
  "data": "2024-04-01"
}
```

O PDF é convertido em Markdown antes de ser salvo.

## 🧹 Endpoint para limpar tags órfãs

Remove opções de tags não utilizadas em nenhuma página do banco.

```http
POST /limpar-tags-orfas

{
  "notion_token": "secret_xxx",
  "nome_database": "Me Passa A Cola (GPT)"
}
```

Retorna um resumo com a quantidade de tags removidas.

## 🐙 Endpoints de Issues do GitHub

Gerencie issues em repositórios diretamente pela API.

### Criar Issue

```http
POST /github-issues

{
  "token": "ghp_xxx",
  "owner": "usuario",
  "repo": "repositorio",
  "title": "Nova issue",
  "body": "Descrição opcional",
  "labels": ["bug"],
  "assignees": ["usuario"],
  "column_id": 123456,
  "milestone": "Sprint 1"
}
```
O campo `column_id` é opcional. Se não informado, a API tenta utilizar a primeira coluna do primeiro projeto encontrado no repositório.
O campo `milestone` aceita o número ou o título da milestone.


### Atualizar Issue

```http
PATCH /github-issues

{
  "token": "ghp_xxx",
  "owner": "usuario",
  "repo": "repositorio",
  "number": 123,
  "title": "Novo título",
  "state": "open",
  "milestone": 1
}
```

### Fechar Issue

```http
DELETE /github-issues?token=ghp_xxx&owner=usuario&repo=repositorio&number=123
```

### Listar Issues

```http
GET /github-issues?token=ghp_xxx&owner=usuario&repo=repositorio&state=open
```

### Criar Label

```http
POST /github-labels

{
  "token": "ghp_xxx",
  "owner": "usuario",
  "repo": "repositorio",
  "name": "nova-label",
  "color": "f29513"
}
```

### Criar Milestone

```http
POST /github-milestones

{
  "token": "ghp_xxx",
  "owner": "usuario",
  "repo": "repositorio",
  "title": "Sprint 1"
}
```

### Listar Milestones

```http
GET /github-milestones?token=ghp_xxx&owner=usuario&repo=repositorio&state=open
```

### Atualizar Milestone

```http
PATCH /github-milestones

{
  "token": "ghp_xxx",
  "owner": "usuario",
  "repo": "repositorio",
  "number": 1,
  "title": "Sprint 1 - Ajuste"
}
```

### Criar Projeto (GraphQL)

```http
POST /github-projects

{
  "token": "ghp_xxx",
  "owner": "usuario",
  "repo": "repositorio",
  "name": "Projeto X"
}
```

### Criar Column no Projeto (GraphQL)

```http
POST /github-projects/columns

{
  "token": "ghp_xxx",
  "project_id": "proj1",
  "name": "To Do"
}
```

### Adicionar Issue ao Projeto (use `node_id` da issue)

```http
POST /github-projects/columns/cards

{
  "token": "ghp_xxx",
  "column_id": "col1",
  "issue_id": "abc123"
}
```

### Listar Projetos

```http
GET /github-projects?token=ghp_xxx&owner=usuario&repo=repositorio
```

### Listar Colunas do Projeto

```http
GET /github-projects/columns?token=ghp_xxx&project_id=proj1
```

### Criar Pull Request

```http
POST /github-pulls

{
  "token": "ghp_xxx",
  "owner": "usuario",
  "repo": "repositorio",
  "title": "Minha feature",
  "head": "feature-branch",
  "base": "main",
  "type": "feature"
}
```

O campo `type` indica qual template de Pull Request deve ser aplicado.

### Criar e Mesclar Pull Request automaticamente

```http
POST /github-pulls/auto

{
  "token": "ghp_xxx",
  "owner": "usuario",
  "repo": "repositorio",
  "head": "feature-branch",
  "base": "main",
  "repoUrl": "https://github.com/usuario/repositorio.git",
  "credentials": "usuario:token",
  "type": "feature",
  "autoClose": true
}
```

Use o campo `type` para indicar qual modelo de PR será utilizado (`feature`, `fix` ou `chore`).

### Atualizar/Fechar Pull Request

```http
PATCH /github-pulls

{
  "token": "ghp_xxx",
  "owner": "usuario",
  "repo": "repositorio",
  "number": 10,
  "title": "Novo título"
}
```

```http
DELETE /github-pulls?token=ghp_xxx&owner=usuario&repo=repositorio&number=10
```

### Disparar Workflow

```http
POST /github-workflows/dispatch

{
  "token": "ghp_xxx",
  "owner": "usuario",
  "repo": "repositorio",
  "workflow_id": "deploy.yml",
  "ref": "main"
}
```

### Verificar Status do Workflow

```http
GET /github-workflows/status?token=ghp_xxx&owner=usuario&repo=repositorio&run_id=12345
```

## 🔄 Integrar Projeto no Linear

Atualiza o projeto de uma issue já existente no Linear.

```http
POST /linear-issues/project

{
  "token": "lin_xxx",
  "issue_id": "abc123",
  "project_id": "proj789"
}
```

## 📚 Documentação com Doca

Execute `npm run doca` para gerar a documentação da API em `docs/API.md`.
Depois de iniciar o servidor, acesse `http://localhost:3333/doca/API.md` para visualizar.

### Ações para GPT personalizado

Todos os endpoints estão definidos em um único arquivo, `gpt/actions.json`.
Use esse arquivo na etapa de **Actions** ao criar seu GPT para habilitar
as integrações disponíveis.

## 🔍 Validação automática do deploy

O repositório conta com um workflow do **GitHub Actions** que monitora se o
deploy no Render está ativo. O arquivo
`.github/workflows/render-deploy-and-check.yml` espera 45&nbsp;segundos antes de
fazer uma requisição para `https://me-passa-a-cola.onrender.com/health`. Se a
resposta não for `200`, o workflow falha e sinaliza um problema no ambiente de
produção.

Para testar manualmente, rode:

```bash
node scripts/check-deploy.js [URL]
```

Se nenhum URL for informado, ele verifica `https://me-passa-a-cola.onrender.com/health`.
O script retorna código diferente de zero caso a URL não responda com `200`.

---

## ⚖️ Política de uso e privacidade

* Nenhuma informação pessoal é armazenada nos servidores do GPT.
* O envio para o Notion é feito diretamente pelo App Script fornecido.
* Cada usuário configura seu próprio token de acesso.
* O projeto não acessa, armazena nem compartilha suas credenciais.

> Tudo é feito localmente entre você, seu navegador e seus serviços.

---

## 🙌 Quer usar?

Se esse projeto fizer sentido pra você, sua família ou seu time, pode me chamar. É um prazer compartilhar ou adaptar a ideia.

> Feito com carinho, código e intenção.

---

## 📌 Criado por

**Alan Gomes**  
Arquiteto de Soluções | Dev criativo | Pai neurodivergente | Explorador de ideias reais com IA  
[LinkedIn](https://www.linkedin.com/in/oalangomes) • [Instagram](https://instagram.com/oalangomes)

---

## 🏷️ Tags

`#educação` `#chatgpt` `#gptcustom` `#tecnologiahumana` `#neurodivergência` `#TDAH` `#TEA` `#criatividade` `#produtividade` `#empatia`
