# 📘 Me passa a cola?

Um GPT personalizado criado com empatia, criatividade e foco real em pessoas que aprendem de forma diferente.

---

## ✨ Sobre o projeto

**“Me passa a cola?”** é um assistente de estudos construído sobre o ChatGPT (usando a ferramenta "Meus GPTs"), criado por Alan Gomes para ajudar sua esposa — diagnosticada com TEA — a estudar de forma mais leve, organizada e acessível durante a faculdade.

A ideia surgiu de uma necessidade real dentro de uma família neurodivergente e se transformou em uma solução criativa e funcional, que pode ajudar qualquer pessoa com dificuldades em organização, foco, leitura ou rotina de estudos.

---

## 🌟 Motivação

> "Somos uma família atípica. Minha esposa tem TEA, eu sou TDAH, nossos filhos também. Estudar, aqui, exige criatividade e empatia. E às vezes, o que a gente precisa, ainda não existe. Então a gente cria."

O GPT foi desenvolvido para:

* Reduzir a sobrecarga cognitiva
* Organizar os estudos por tema
* Fornecer recursos de apoio adaptáveis ao estilo de cada pessoa

---

## 🧠 Funcionalidades principais

* **Organização por tema**: um chat por matéria para manter o foco
* **Geração de cronogramas personalizados**
* **Resumos rápidos ou detalhados**, com escolha de formato (bullet points, texto corrido, mapa mental)
* **Criação de miniprovas e quizzes**
* **Planos de estudo adaptados à rotina**
* **Sugestões de técnicas de estudo** (Pomodoro, Cornell, repetição espaçada)
* **Recomendações de conteúdos extras** (vídeos, livros, podcasts)
* **Flashcards automáticos**

---

## 📄 Como funciona

1. O usuário informa o tema de estudo
2. O GPT organiza o conteúdo exclusivamente dentro daquele tema
3. Se já houver conteúdo gerado, o GPT pergunta se deseja editar, substituir ou revisar
4. Todas as entregas vêm com sugestões de próximas ações (reforçando foco e continuidade)

Exemplo de interação:

```text
🟢 Tema: Inteligência Artificial
O que gostaria de fazer agora?
- Gerar um cronograma?
- Criar um resumo (rápido ou detalhado)?
- Montar um plano de estudos?
- Fazer uma miniprova de revisão?
```

---

## 💬 Linguagem acessível

* Fala com o usuário de forma empática, informal e clara
* Usa emojis com moderação
* Respeita o tempo e o ritmo de quem está aprendendo

---

## 📌 Dica para uso ideal

Para quem usar com frequência: renomeie cada chat com o tema. Exemplo:

> 📘 Inteligência Artificial — Me passa a cola?

Assim você pode voltar depois e continuar de onde parou.

---

## 🤝 Integração com Notion e Google Sheets

### ✅ Funcionalidade externa

O projeto permite enviar conteúdos gerados para:

* Um banco de dados no **Notion**
* Uma planilha no **Google Sheets**

### 🏢 Como funciona:

1. O usuário fornece seu **token do Notion** ou o **ID da planilha do Sheets**
2. O GPT envia os dados para um App Script (usado como backend)
3. Esse backend armazena os conteúdos no local desejado

### 📚 Como pegar o token do Notion:

1. Acesse [https://www.notion.com/my-integrations](https://www.notion.com/my-integrations)
2. Clique em "New integration"
3. Dê um nome (ex: `MePassaACola`), escolha um workspace
4. Marque as permissões: `Read`, `Insert`, `Update`
5. Salve e copie o token gerado (`secret_...`)
6. No Notion, compartilhe sua página ou banco com a integração criada (botão "Share")

### 📊 Como saber o ID do banco ou página:

* Acesse a página ou database desejado
* Copie da URL: `https://www.notion.so/nome-da-pagina/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
* O trecho final (sem os `-`) é o **page\_id** ou **database\_id**

---

## ⚖️ Política de uso e privacidade

* Nenhuma informação pessoal é armazenada nos servidores do GPT.
* O envio para Google Sheets ou Notion é feito diretamente pelo App Script fornecido.
* Cada usuário deve configurar seu próprio token de acesso.
* O projeto não acessa, armazena nem compartilha suas credenciais.

> Tudo é feito localmente entre você, seu navegador e seus serviços.

---

## 🙌 Quer usar?

Se esse projeto fizer sentido pra você, sua família ou seu time, pode me chamar. É um prazer compartilhar ou adaptar a ideia.

> Feito com carinho, código e intenção.

---

## 📌 Criado por

**Alan Gomes**
Arquiteto de Soluções | Dev criativo | Pai neurodivergente | Explorador de ideias reais com IA

[𝔻 LinkedIn](https://www.linkedin.com/in/oalangomes) • [𝔻 Instagram](https://instagram.com/oalangomes)

---

## 🏷️ Tags

`#educação` `#chatgpt` `#gptcustom` `#tecnologiahumana` `#neurodivergência` `#TDAH` `#TEA` `#criatividade` `#produtividade` `#empatia`
