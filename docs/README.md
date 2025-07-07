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
```

As mesmas opções podem ser definidas em JSON.

Os campos `defaultIssueMilestone`, `defaultIssueProject` e `defaultIssueColumn` definem valores padrão para a rota `/github-issues` quando `milestone` ou `column_id` não são enviados na requisição.

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
