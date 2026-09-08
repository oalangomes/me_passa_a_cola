# Documentação — Me passa a cola?

Este diretório concentra a documentação técnica do projeto.

## Comece por aqui

- [README do projeto](../README.md) — objetivo, escopo, execução e limitações.
- [Arquitetura](architecture.md) — fronteiras entre GPT, serviço de integração e provedores externos.
- [API](API.md) — referência gerada dos endpoints definidos em `gpt/actions.json`.

## Fonte da verdade

A referência de API é **gerada**, não mantida manualmente:

```bash
npm run docs
```

O gerador lê:

- `gpt/actions.json`;
- `gpt/prompts.json`.

e produz:

- `docs/API.md`.

Mudanças de contrato devem ser feitas na fonte e depois refletidas na documentação gerada.

## Escopo documental

O projeto mistura um produto de estudo com um serviço de integrações criado incrementalmente. A documentação separa explicitamente:

- comportamento do produto;
- arquitetura do serviço;
- contrato HTTP;
- limitações e requisitos de segurança.

Isso evita tratar experimentos históricos como se fossem uma API pública estável.
