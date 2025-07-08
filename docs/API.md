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


## GET /git-files

Lista os arquivos de um diretório do repositório.

## GET /git-file


Retorna o conteúdo de um arquivo do repositório.

## PATCH /git-file

Atualiza ou cria um arquivo e realiza commit.

## POST /git-commit

Realiza commit em repositório privado usando token

## POST /create-notion-content-git

Cria página no Notion e salva em repositório Git.

## POST /pdf-to-notion

Envia um PDF em base64 para conversão em Markdown e registro no Notion.

## POST /github-issues

Cria uma issue no GitHub.
Se `milestone` ou `column_id` não forem enviados,
os valores `defaultIssueMilestone`, `defaultIssueProject` e `defaultIssueColumn`
do arquivo `.cola-config` são utilizados, quando presentes.

## GET /github-issues

Lista issues do repositório

## PATCH /github-issues

Atualiza uma issue existente

## DELETE /github-issues

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

## PATCH /github-milestones

Atualiza uma milestone

## POST /github-projects

Cria um projeto via GraphQL

## GET /github-projects

Lista projetos do repositório

## POST /github-projects/columns

Cria coluna em um projeto via GraphQL

> **Nota**: se a resposta do GitHub contiver `errors`, o serviço retorna
> a mensagem de erro fornecida pela API.

## GET /github-projects/columns

Lista colunas de um projeto

## POST /github-projects/columns/cards

Adiciona issue ao projeto via GraphQL (use o `node_id` da issue)

## POST /github-pulls

Cria um pull request

## POST /github-pulls/auto

Cria e mescla automaticamente um pull request a partir de um template definido em `.cola-config`. Envie `autoClose: true` para fechar o PR após o merge.

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

## PATCH /github-pulls

Atualiza um pull request

## DELETE /github-pulls

Fecha um pull request

## POST /linear-issues/project

Atualiza o projeto de uma issue no Linear

