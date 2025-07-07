# API

## POST /create-notion-content

Envia o conteúdo dos resumos Notion informados no corpo.

## POST /create-notion-flashcards

Envia o conteúdo dos flashcards Notion informados no corpo.

## POST /create-notion-cronograma

Envia itens de cronograma para o Notion.

## GET /notion-content

Busca conteúdos já registrados no Notion usando filtros de tema, subtítulo ou tipo.

## POST /atualizar-titulos-e-tags

Atualiza títulos e tags das subpáginas de um tema no Notion.

## POST /limpar-tags-orfas

Remove tags não utilizadas do banco de dados.

## POST /git-commit

Realiza commit em repositório privado usando token

## POST /create-notion-content-git

Cria página no Notion e salva em repositório Git.

## POST /pdf-to-notion

Envia um PDF em base64 para conversão em Markdown e registro no Notion.

## POST /github-issues

Cria uma issue no GitHub

## GET /github-issues

Lista issues do repositório

## PATCH /github-issues/{number}

Atualiza uma issue existente

## DELETE /github-issues/{number}

Fecha uma issue

## POST /github-workflows/dispatch

Dispara um workflow no GitHub

## GET /github-workflows/status

Consulta o status de um workflow run

## POST /github-labels

Cria uma label no repositório

## POST /github-milestones

Cria uma milestone

## GET /github-milestones

Lista milestones do repositório

## PATCH /github-milestones/{number}

Atualiza uma milestone

## POST /github-projects

Cria um projeto via GraphQL

## GET /github-projects

Lista projetos do repositório

## POST /github-projects/{project_id}/columns

Cria coluna em um projeto via GraphQL

> **Nota**: se a resposta do GitHub contiver `errors`, o serviço retorna
> a mensagem de erro fornecida pela API.

## GET /github-projects/{project_id}/columns

Lista colunas de um projeto

## POST /github-projects/columns/{column_id}/cards

Adiciona issue ao projeto via GraphQL (use o `node_id` da issue)

## POST /github-pulls

Cria um pull request

## PATCH /github-pulls/{number}

Atualiza um pull request

## DELETE /github-pulls/{number}

Fecha um pull request

## POST /linear-issues/project

Atualiza o projeto de uma issue no Linear

