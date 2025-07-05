
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

4. Para executar os testes automatizados, utilize:

   ```bash
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
POST /git-commit
Headers:
  x-api-token: <seu_token>

{
  "repoUrl": "https://github.com/usuario/repositorio.git",
  "credentials": "ghp_xxx",
  "message": "feat: meu commit",
  "files": ["arquivo.txt"],
  "branch": "main",  # opcional
  "content": {
  "novo.txt": "conteudo gerado"
  }
}
```

O campo `branch` é opcional e assume `main` como padrão. Os caminhos listados em `files` são relativos ao repositório. O objeto `content` permite criar arquivos fornecendo pares caminho/conteúdo. O acesso é protegido pelo cabeçalho `x-api-token`.

### 🔧 Variáveis de ambiente

Antes de iniciar a API é preciso definir algumas variáveis no ambiente:

- `API_TOKEN`: usada para autenticação em `/git-commit`.
- `PORT` (opcional, padrão `3333`).

Você pode exportá-las no terminal ou criar um arquivo `.env` na raiz do projeto.
Ao executar `npm start`, esse arquivo será lido automaticamente:

```bash
API_TOKEN=seu_token PORT=3333 npm start
```

## 📄 Endpoint para PDF

Envia um arquivo PDF em base64 e registra o texto no Notion.

```http
POST /pdf-to-notion

{
  "notion_token": "secret_xxx",
  "nome_database": "Me Passa A Cola (GPT)",
  "tema": "Matéria X",
  "subtitulo": "Aula 1",
  "pdf_base64": "<arquivo em base64>",
  "tags": ["exemplo"],
  "data": "2024-04-01"
}
```

O PDF é convertido em Markdown antes de ser enviado ao Notion.

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

## 🔍 Validação automática do deploy

O repositório conta com um workflow do **GitHub Actions** que monitora se o
deploy no Render está ativo. O arquivo
`.github/workflows/render-deploy-check.yml` espera 45&nbsp;segundos antes de
fazer uma requisição para `https://me-passa-a-cola.onrender.com/api-docs`. Se a
resposta não for `200`, o workflow falha e sinaliza um problema no ambiente de
produção.

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
