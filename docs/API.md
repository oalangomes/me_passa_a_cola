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

