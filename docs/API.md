# API

## Sumário
- [POST /notion-content](#postnotioncontent)
- [GET /notion-content](#getnotioncontent)
- [POST /atualizar-titulos-e-tags](#postatualizartitulosetags)
- [POST /limpar-tags-orfas](#postlimpartagsorfas)
- [GET /git-files](#getgitfiles)
- [GET /git-file](#getgitfile)
- [PATCH /git-file](#patchgitfile)
- [POST /create-notion-content-git](#postcreatenotioncontentgit)
- [POST /github-issues](#postgithubissues)
- [GET /github-issues](#getgithubissues)
- [PATCH /github-issues](#patchgithubissues)
- [POST /github-workflows](#postgithubworkflows)
- [GET /github-workflows](#getgithubworkflows)
- [POST /github-labels](#postgithublabels)
- [POST /github-milestones](#postgithubmilestones)
- [GET /github-milestones](#getgithubmilestones)
- [PATCH /github-milestones](#patchgithubmilestones)
- [POST /github-projects](#postgithubprojects)
- [GET /github-projects](#getgithubprojects)
- [POST /github-projects/columns](#postgithubprojectscolumns)
- [GET /github-projects/columns](#getgithubprojectscolumns)
- [POST /github-projects/columns/cards](#postgithubprojectscolumnscards)
- [POST /github-pulls](#postgithubpulls)
- [PATCH /github-pulls](#patchgithubpulls)
- [POST /linear-issues/project](#postlinearissuesproject)

### <a id="postnotioncontent"></a> POST /notion-content

Cria conteúdo no Notion conforme o tipo informado.

Corpo da requisição:
- `type` (string) (obrigatório)

Exemplo:
```json
{
  "notion_token": "seu_token",
  "nome_database": "Me Passa A Cola (GPT)",
  "tema": "Matemática",
  "type": "resumo",
  "resumo": "Conteúdo gerado"
}
```

### <a id="getnotioncontent"></a> GET /notion-content

Busca conteúdos já registrados no Notion usando filtros de tema, subtítulo ou tipo.

Parâmetros:
- `notion_token` (query, string) (obrigatório)
- `nome_database` (query, string)
- `tema` (query, string)
- `subtitulo` (query, string)
- `tipo` (query, string)
- `limit` (query, integer)
- `start_cursor` (query, string)
- `ttl` (query, integer) - Tempo de cache em segundos

### <a id="postatualizartitulosetags"></a> POST /atualizar-titulos-e-tags

Atualiza títulos e tags das subpáginas de um tema no Notion.

Corpo da requisição:
- `notion_token` (string) (obrigatório)
- `nome_database` (string)
- `tema` (string) (obrigatório)

### <a id="postlimpartagsorfas"></a> POST /limpar-tags-orfas

Remove tags não utilizadas do banco de dados.

Corpo da requisição:
- `notion_token` (string) (obrigatório)
- `nome_database` (string)

### <a id="getgitfiles"></a> GET /git-files

Lista os arquivos de um diretório do repositório

Parâmetros:
- `x-api-token` (query, string) (obrigatório)
- `repoUrl` (query, string) (obrigatório)
- `credentials` (query, string) (obrigatório)
- `path` (query, string)

### <a id="getgitfile"></a> GET /git-file

Retorna o conteúdo de um arquivo

Parâmetros:
- `x-api-token` (query, string) (obrigatório)
- `repoUrl` (query, string) (obrigatório)
- `credentials` (query, string) (obrigatório)
- `file` (query, string) (obrigatório)

### <a id="patchgitfile"></a> PATCH /git-file

Atualiza ou cria um arquivo e realiza commit

Parâmetros:
- `x-api-token` (query, string) (obrigatório)

Corpo da requisição:
- `repoUrl` (string) (obrigatório)
- `credentials` (string) (obrigatório)
- `filePath` (string)
- `files` (array)
- `content` (object) (obrigatório)
- `commitMessage` (string)
- `branch` (string)
- `githubToken` (string)
- `githubOwner` (string)
- `githubRepo` (string)

### <a id="postcreatenotioncontentgit"></a> POST /create-notion-content-git

Cria página no Notion e salva em repositório Git.

Parâmetros:
- `x-api-token` (query, string) (obrigatório)

Corpo da requisição:
- `repoUrl` (string) (obrigatório)
- `credentials` (string) (obrigatório)
- `commitMessage` (string)
- `filePath` (string) (obrigatório)
- `branch` (string)
- `notion_token` (string) (obrigatório)
- `nome_database` (string)
- `tema` (string)
- `subtitulo` (string)
- `tipo` (string)
- `resumo` (string) (obrigatório)
- `observacoes` (string)
- `tags` (string)
- `data` (string)

### <a id="postgithubissues"></a> POST /github-issues

Cria uma issue no GitHub

Corpo da requisição:
- `token` (string) (obrigatório)
- `owner` (string) (obrigatório)
- `repo` (string) (obrigatório)
- `title` (string) (obrigatório)
- `body` (string)
- `labels` (undefined)
- `assignees` (undefined)
- `milestone` (undefined)
- `column_id` (integer)

### <a id="getgithubissues"></a> GET /github-issues

Lista issues do repositório

Parâmetros:
- `token` (query, string) (obrigatório)
- `owner` (query, string) (obrigatório)
- `repo` (query, string) (obrigatório)
- `state` (query, string)
- `labels` (query, string)
- `page` (query, integer)
- `per_page` (query, integer)

Exemplo:
```json
{
  "token": "ghp_xxx",
  "owner": "usuario",
  "repo": "repositorio"
}
```

### <a id="patchgithubissues"></a> PATCH /github-issues

Atualiza uma issue existente ou fecha quando `state` é `closed`

Corpo da requisição:
- `token` (string) (obrigatório)
- `owner` (string) (obrigatório)
- `repo` (string) (obrigatório)
- `number` (integer) (obrigatório)
- `title` (string)
- `body` (string)
- `state` (string)
- `labels` (undefined)
- `assignees` (undefined)
- `milestone` (undefined)

### <a id="postgithubworkflows"></a> POST /github-workflows

Dispara um workflow no GitHub

Corpo da requisição:
- `token` (string) (obrigatório)
- `owner` (string) (obrigatório)
- `repo` (string) (obrigatório)
- `workflow_id` (string) (obrigatório)
- `ref` (string)
- `inputs` (object)

### <a id="getgithubworkflows"></a> GET /github-workflows

Consulta o status de um workflow run

Parâmetros:
- `token` (query, string) (obrigatório)
- `owner` (query, string) (obrigatório)
- `repo` (query, string) (obrigatório)
- `run_id` (query, string) (obrigatório)

### <a id="postgithublabels"></a> POST /github-labels

Cria uma label no repositório

Corpo da requisição:
- `token` (string) (obrigatório)
- `owner` (string) (obrigatório)
- `repo` (string) (obrigatório)
- `name` (string) (obrigatório)
- `color` (string)
- `description` (string)

### <a id="postgithubmilestones"></a> POST /github-milestones

Cria uma milestone

Corpo da requisição:
- `token` (string) (obrigatório)
- `owner` (string) (obrigatório)
- `repo` (string) (obrigatório)
- `title` (string) (obrigatório)
- `state` (string)
- `description` (string)
- `due_on` (string)

### <a id="getgithubmilestones"></a> GET /github-milestones

Lista milestones do repositório

Parâmetros:
- `token` (query, string) (obrigatório)
- `owner` (query, string) (obrigatório)
- `repo` (query, string) (obrigatório)
- `state` (query, string)

### <a id="patchgithubmilestones"></a> PATCH /github-milestones

Atualiza uma milestone

Corpo da requisição:
- `token` (string) (obrigatório)
- `owner` (string) (obrigatório)
- `repo` (string) (obrigatório)
- `number` (integer) (obrigatório)
- `title` (string)
- `state` (string)
- `description` (string)
- `due_on` (string)

### <a id="postgithubprojects"></a> POST /github-projects

Cria um projeto via GraphQL

Corpo da requisição:
- `token` (string) (obrigatório)
- `owner` (string) (obrigatório)
- `repo` (string) (obrigatório)
- `name` (string) (obrigatório)
- `body` (string)

### <a id="getgithubprojects"></a> GET /github-projects

Lista projetos do repositório

Parâmetros:
- `token` (query, string) (obrigatório)
- `owner` (query, string) (obrigatório)
- `repo` (query, string) (obrigatório)
- `cursor` (query, string)

### <a id="postgithubprojectscolumns"></a> POST /github-projects/columns

Cria coluna em um projeto via GraphQL

Corpo da requisição:
- `token` (string) (obrigatório)
- `project_id` (string) (obrigatório)
- `name` (string) (obrigatório)

### <a id="getgithubprojectscolumns"></a> GET /github-projects/columns

Lista colunas de um projeto

Parâmetros:
- `token` (query, string) (obrigatório)
- `project_id` (query, string) (obrigatório)

### <a id="postgithubprojectscolumnscards"></a> POST /github-projects/columns/cards

Adiciona issue ao projeto via GraphQL

Corpo da requisição:
- `token` (string) (obrigatório)
- `column_id` (string) (obrigatório)
- `issue_id` (string) (obrigatório)

### <a id="postgithubpulls"></a> POST /github-pulls

Cria um pull request e pode mesclar automaticamente

Corpo da requisição:
- `token` (string) (obrigatório)
- `owner` (string) (obrigatório)
- `repo` (string) (obrigatório)
- `title` (string)
- `head` (string) (obrigatório)
- `base` (string)
- `body` (string)
- `repoUrl` (string)
- `credentials` (string)
- `type` (string)
- `merge` (boolean)
- `auto` (boolean)
- `autoClose` (boolean)

### <a id="patchgithubpulls"></a> PATCH /github-pulls

Atualiza, fecha ou mescla um pull request

Corpo da requisição:
- `token` (string) (obrigatório)
- `owner` (string) (obrigatório)
- `repo` (string) (obrigatório)
- `number` (integer) (obrigatório)
- `title` (string)
- `body` (string)
- `state` (string)
- `merge` (boolean)
- `auto` (boolean)
- `close` (boolean)

### <a id="postlinearissuesproject"></a> POST /linear-issues/project

Atualiza o projeto de uma issue no Linear

Corpo da requisição:
- `token` (string) (obrigatório)
- `issue_id` (string) (obrigatório)
- `project_id` (string) (obrigatório)

