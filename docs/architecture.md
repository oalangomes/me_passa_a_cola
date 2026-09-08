# Arquitetura

## Visão geral

```text
┌─────────────────────┐
│      usuário        │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  GPT personalizado  │
│ prompts + Actions   │
└─────────┬───────────┘
          │ HTTP / JSON
          ▼
┌────────────────────────────┐
│ Node.js integration service│
│ Express                    │
├────────────┬───────────────┤
│ formatting │ integrations  │
└─────┬──────┴──────┬────────┘
      │             │
      ▼             ▼
   Notion       Git/GitHub
                    │
                    └── outros experimentos, como Linear
```

## Componentes

### GPT personalizado

Os artefatos em `gpt/` descrevem comportamento conversacional e Actions.

`gpt/actions.json` funciona como contrato entre o GPT e o serviço HTTP. Exemplos utilizados pela documentação ficam em `gpt/prompts.json`.

### Integration service

`src/index.js` hospeda a API Express e coordena chamadas aos módulos auxiliares.

O serviço existe para executar operações que o fluxo conversacional não deve implementar diretamente, como:

- criar e consultar conteúdo no Notion;
- transformar conteúdo em blocos estruturados;
- ler ou alterar arquivos em repositórios Git;
- interagir com recursos do GitHub;
- executar integrações experimentais adicionais.

### Formatação

`src/formatter.js` transforma conteúdo textual/Markdown em estruturas consumíveis por integrações como Notion.

### Documentação gerada

`scripts/generate-docs.js` gera `docs/API.md` a partir do contrato das Actions. Isso reduz divergência entre o que o GPT chama e o que a documentação descreve.

## Fronteiras

### Credenciais

Credenciais de provedores externos são dados sensíveis que atravessam o serviço quando uma operação depende delas. A arquitetura atual não deve ser tratada como um gateway de credenciais endurecido.

### Persistência

O serviço não constitui uma fonte única de verdade. O estado útil vive principalmente nos provedores integrados — por exemplo, Notion e GitHub.

### Escopo

O backend cresceu incrementalmente e hoje contém funcionalidades além do produto de estudo inicial. Essa mistura é reconhecida como dívida arquitetural, não como objetivo.

## Direção recomendada

Caso o projeto evolua, a divisão natural é:

```text
study assistant
      │
      ▼
small integration API
      │
      ├── notion adapter
      └── optional external adapters

engineering automation experiments
      └── projeto separado
```

A prioridade deve ser reduzir acoplamento e explicitar contratos antes de adicionar novos provedores.
