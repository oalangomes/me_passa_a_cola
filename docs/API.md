# API

## POST /notion-content

Cria conteúdo no Notion de acordo com o campo `type` enviado no corpo
(`resumo`, `flashcards`, `cronograma` ou `pdf`).

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

Atualiza ou cria arquivos e realiza commit.

## POST /create-notion-content-git

Cria página no Notion e salva em repositório Git.

## POST /github-issues

Cria uma issue no GitHub.
Se `milestone` ou `column_id` não forem enviados,
os valores `defaultIssueMilestone`, `defaultIssueProject` e `defaultIssueColumn`
do arquivo `.cola-config` são utilizados, quando presentes.

## GET /github-issues

Lista issues do repositório. Suporta paginação usando `page` e `per_page`.

## PATCH /github-issues

Atualiza uma issue existente. Envie `state: "closed"` para fechar.

## POST /github-workflows

Dispara um workflow no GitHub

## GET /github-workflows

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
Lista projetos do repositório. Para navegar, envie o parâmetro `cursor` retornado pela página anterior.

## POST /github-projects/columns

Cria coluna em um projeto via GraphQL

> **Nota**: se a resposta do GitHub contiver `errors`, o serviço retorna
> a mensagem de erro fornecida pela API.

## GET /github-projects/columns

Lista colunas de um projeto

## POST /github-projects/columns/cards

Adiciona issue ao projeto via GraphQL (use o `node_id` da issue)

## POST /github-pulls

Cria um pull request. Se `merge: true` (ou `auto: true`) for enviado no corpo, o PR será mesclado automaticamente. Utilize `autoClose: true` para fechar o PR após o merge.

```http
POST /github-pulls

{
  "token": "ghp_xxx",
  "owner": "usuario",
  "repo": "repositorio",
  "head": "feature-branch",
  "base": "main",
  "repoUrl": "https://github.com/usuario/repositorio.git",
  "credentials": "usuario:token",
  "type": "feature",
  "merge": true,
  "autoClose": true
}
```

## PATCH /github-pulls

Atualiza, fecha ou mescla um pull request. Envie `merge: true` (ou `auto: true`) para realizar o merge. Para apenas fechar, use `close: true` ou `state: 'closed'`.

## POST /linear-issues/project

Atualiza o projeto de uma issue no Linear

