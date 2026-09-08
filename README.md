# Me passa a cola?

**Um assistente de estudos com integrações para transformar conteúdo gerado em material organizado e reutilizável.**

O projeto nasceu de um problema real: tornar sessões de estudo mais fáceis de organizar, revisar e continuar ao longo do tempo.

Hoje ele é composto por duas partes principais:

- um **GPT personalizado**, responsável pela experiência conversacional e pelos fluxos de estudo;
- um **serviço de integração em Node.js/Express**, usado para persistência e automação em ferramentas externas como Notion e GitHub.

A proposta não é substituir métodos de estudo ou prometer personalização cognitiva automática. O objetivo é reduzir atrito operacional: gerar conteúdo, estruturar, registrar, recuperar e automatizar tarefas relacionadas ao estudo.

## O que o projeto demonstra

- design de workflows com LLM;
- contratos de Actions/OpenAPI para um GPT personalizado;
- API Node.js/Express;
- integração com Notion;
- automação com Git e GitHub;
- processamento de Markdown e PDF;
- geração automatizada de documentação;
- testes de integração do serviço;
- workflows de CI e validação de deploy.

## Arquitetura

```text
usuário
  │
  ▼
GPT personalizado
  │
  │ Actions / HTTP
  ▼
Node.js integration service
  │
  ├── Notion
  ├── Git / GitHub
  └── Linear
```

As instruções e contratos do GPT vivem em `gpt/`. O serviço Express concentra as integrações e expõe os endpoints consumidos pelas Actions.

Mais detalhes: [docs/architecture.md](docs/architecture.md).

## Casos de uso

O assistente pode apoiar fluxos como:

- resumos em diferentes níveis de detalhe;
- cronogramas de estudo;
- flashcards;
- quizzes e revisão;
- organização por tema;
- envio de conteúdo estruturado para Notion;
- conversão de PDF para conteúdo em Markdown;
- leitura e atualização de arquivos Git;
- criação e atualização de issues e pull requests;
- disparo e consulta de workflows GitHub.

Nem todos os recursos pertencem ao mesmo nível de abstração: parte do repositório representa o produto de estudo, enquanto parte representa experimentos de automação que cresceram ao redor dele.

## Estrutura

```text
gpt/
├── actions.json       # contrato das Actions
├── prompts.json       # exemplos usados na documentação
└── prompt*.md         # instruções do assistente

src/
├── index.js           # API Express
├── formatter.js       # Markdown → blocos estruturados
└── utils/             # Notion, Git e integrações auxiliares

scripts/
└── generate-docs.js   # gera docs/API.md a partir do contrato

tests/
└── run.js             # testes do serviço e integrações mockadas

docs/
├── index.md
├── architecture.md
└── API.md
```

## Rodando localmente

### Requisitos

- Node.js 18
- npm

### Instalação

```bash
npm install
```

### Execução

Defina um token de API para as rotas que exigem autenticação:

```bash
API_TOKEN=change-me npm start
```

Ou use um arquivo `.env` local.

Por padrão, o serviço usa a porta configurada por `PORT` ou a porta definida pela aplicação.

## Testes

```bash
npm test
```

Os testes exercitam o serviço HTTP e fluxos de integração com dependências externas substituídas quando necessário.

## Documentação da API

A documentação de endpoints é gerada a partir dos contratos em `gpt/actions.json` e dos exemplos em `gpt/prompts.json`:

```bash
npm run docs
```

Isso atualiza:

```text
docs/API.md
```

Também existe documentação Swagger exposta pelo serviço quando ele está em execução.

- [Índice da documentação](docs/index.md)
- [Arquitetura](docs/architecture.md)
- [API gerada](docs/API.md)

## Automação

O repositório contém workflows para:

- verificar a presença da documentação;
- gerar documentação de API;
- validar o deploy publicado.

Essas automações fazem parte do experimento de tratar documentação e operação como artefatos versionados, não como passos manuais esquecidos.

## Segurança e credenciais

Este serviço atua como intermediário entre o cliente e APIs externas. Isso significa que **tokens de Notion, GitHub ou outros provedores atravessam a fronteira HTTP da aplicação quando um endpoint precisa deles**.

Para qualquer implantação além de desenvolvimento local:

- use HTTPS;
- limite o acesso ao serviço;
- use tokens de menor privilégio possível;
- não reutilize credenciais pessoais amplas;
- não registre tokens em logs;
- mantenha segredos fora do repositório;
- revise quais endpoints realmente precisam ficar habilitados.

O projeto não deve ser interpretado como um cofre de credenciais ou gateway de segurança pronto para produção.

## Limitações atuais

- o escopo cresceu além do caso de uso inicial e reúne integrações de naturezas diferentes;
- alguns endpoints refletem experimentos incrementais e não uma API pública estável;
- autenticação e gestão de credenciais ainda merecem endurecimento antes de exposição ampla;
- não existe garantia de compatibilidade retroativa entre todos os endpoints;
- o projeto depende de contratos e limites de APIs de terceiros.

Essas limitações são parte importante da leitura atual do projeto: ele demonstra evolução experimental real, mas não deve ser apresentado como uma plataforma madura.

## Direção de evolução

Se o projeto voltar a evoluir, a prioridade deve ser **reduzir e clarificar o escopo**, não adicionar novas integrações.

Uma evolução saudável provavelmente separaria:

1. o produto de estudo;
2. o integration service reutilizável;
3. automações de engenharia que hoje vivem no mesmo backend.

## Autor

**Alan Gomes**  
Software Architect · AI Engineering · Developer Tooling

- GitHub: https://github.com/oalangomes
- LinkedIn: https://linkedin.com/in/oalangomes
