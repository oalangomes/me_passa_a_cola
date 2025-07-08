# Documentação

O serviço utiliza um arquivo `.cola-config.yml` ou `.cola-config.json` dentro do repositório clonado para ajustar comportamentos.

Exemplo de configuração em YAML:

```yaml
commitTemplate: .github/commit-template.md
commitWorkflow: deploy.yml
githubToken: ghp_xxx
githubOwner: usuario
githubRepo: repositorio
defaultIssueMilestone: 1
defaultIssueProject: proj1
defaultIssueColumn: col1
pullRequestTemplates.feature: .github/pr-feature.md
pullRequestTemplates.fix: .github/pr-fix.md
pullRequestTemplates.chore: .github/pr-chore.md
```

As mesmas opções podem ser definidas em JSON.

Os campos `defaultIssueMilestone`, `defaultIssueProject` e `defaultIssueColumn` definem valores padrão para a rota `/github-issues` quando `milestone` ou `column_id` não são enviados na requisição.

Use `pullRequestTemplates` para apontar arquivos de template por tipo de PR. O título será a primeira linha do arquivo e o restante compõe o corpo do pull request.

Esses templates também são utilizados pela rota `/github-pulls/auto`, que cria e mescla PRs automaticamente. Envie `autoClose: true` para fechar o PR após o merge.

Também é possível definir `issueRules` para aplicar ações automáticas em issues recém criadas ou atualizadas. Exemplo:

```yaml
issueRules:
  - if:
      labels: ['bug']
    set:
      milestone: 'Sprint 1'
      column: 'Bugs'
```

Se a issue possuir a label **bug**, ela será movida para a coluna indicada e terá a milestone atribuída automaticamente.
