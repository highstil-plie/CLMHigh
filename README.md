# CLM — Gestão do Ciclo de Vida de Contratos

**No ar:** https://hspl-contratos.web.app

Aplicação web que reproduz o funcionamento do Docusign CLM, seguindo passo a passo o tour guiado publicado em `docusign.com/pt-br/produtos/clm`.

Roda em dois modos. Com Firebase configurado, os dados vivem no Firestore, são compartilhados em tempo real entre os membros e o acesso exige login. Sem Firebase, o app funciona sozinho no navegador e guarda tudo em `localStorage`.

O aplicativo **abre vazio**, sem nenhum contrato, parte ou relatório. Vêm configurados apenas os três modelos, a biblioteca de cláusulas e as regras condicionais, que são o que faz o motor funcionar. Para ver os painéis povoados há um conjunto de dados de exemplo que se carrega sob demanda em Administrador.

## Como executar

```bash
npm install
```

```bash
npm run dev
```

A aplicação abre em `http://localhost:5173`. Sem nenhuma configuração ela já roda em modo local. Para ligar o Firebase, veja a próxima seção.

## Firebase

Com `.env` preenchido o app passa a exigir login e a guardar tudo no Firestore.

Atenção se o projeto do Firebase for compartilhado com outro sistema: Firestore, usuários e regras são os mesmos para todos os aplicativos do projeto. As regras abaixo tocam apenas a coleção `clm`, mas quem já tem conta no projeto pode se autenticar neste app, e só a lista de membros impede que veja os contratos.

**1. Configuração.** Copie `.env.example` para `.env` e preencha com os dados do seu projeto, em Console do Firebase → Configurações do projeto → Seus aplicativos. Esses valores não são segredo: o que protege os dados são as regras do Firestore e a lista de membros.

**2. Login por e-mail e senha.** Ative em Authentication → Sign-in method → Email/Password.

**3. Regras.** Publique o conteúdo de `firestore.rules`. Se o projeto já atende outro aplicativo, **acrescente** o bloco `match /clm/{ws}` às regras existentes em vez de substituir o arquivo, ou o outro app perde o acesso.

```bash
firebase deploy --only firestore:rules
```

**4. Primeiro acesso.** Crie sua conta pela própria tela de login. Quem entra primeiro cria o espaço de trabalho e vira o único membro. Os demais precisam ser adicionados por e-mail em Administrador → Empresa e dados → Membros: criar conta no Firebase, sozinho, não dá acesso a nada.

### Como os dados ficam no Firestore

Tudo sob a coleção `clm`, para conviver com outros aplicativos no mesmo projeto:

```
clm/{workspace}                 empresa, membros, preferências de filtro
clm/{workspace}/documents/{id}  contratos
clm/{workspace}/parties/{id}    partes
clm/{workspace}/contacts/{id}   contatos
clm/{workspace}/tasks/{id}      tarefas
clm/{workspace}/reports/{id}    relatórios
clm/{workspace}/templates/{id}  modelos e regras condicionais
clm/{workspace}/clauses/{id}    biblioteca de cláusulas
clm/{workspace}/dashboards/{id} painéis
clm/{workspace}/users/{uid}     perfis de quem já entrou
```

`VITE_CLM_WORKSPACE` troca o espaço, útil para separar produção de homologação no mesmo projeto.

A sincronização é nos dois sentidos. Alterações locais são agrupadas e enviadas em lote após 400 ms, e mudanças feitas por outro membro chegam por `onSnapshot` sem recarregar a página.

## Stack

React 19, TypeScript, Vite, Tailwind CSS 4, React Router, Zustand, Recharts e Firebase (Auth e Firestore).

## Cobertura do tour

Os 14 passos do tour guiado, na mesma ordem:

| # | Passo do tour | Onde está |
|---|---|---|
| 1 | Início | `/` |
| 2 | Criar acordo | Menu Ações → Criar Minuta Comercial |
| 3 | Modelos | `/clm/gerar` passo 1 |
| 4 | Preencher formulário | `/clm/gerar` passo 2 |
| 5 | Condições especiais | Configuração do Contrato → Customizado |
| 6 | Regras condicionais | Painel "Fluxo previsto" na lateral |
| 7 | Revisar e salvar | `/clm/gerar` passo 3 |
| 8 | Colaboração | `/clm/documentos/:id` |
| 9 | Busca | `/clm/documentos` |
| 10 | Filtros | Botão "Todos os filtros" |
| 11 | Partes | `/clm/partes` |
| 12 | Relatórios | `/clm/relatorios` |
| 13-14 | Painel | `/clm` |

## O que está implementado

**Geração de documentos.** Assistente de três passos com salvamento automático de rascunho. Os campos do formulário aparecem e desaparecem conforme as respostas anteriores. O contrato é montado a partir de blocos de texto com substituição de variáveis, incluindo valores por extenso em português.

**Regras condicionais.** Cada modelo declara regras que inserem etapas de aprovação no fluxo. No modelo MSA: configuração customizada aciona o Jurídico, valor a partir de R$ 50.000 aciona o Financeiro, valor acima de R$ 100.000 aciona a Diretoria. O fluxo previsto é recalculado a cada alteração e exibido durante o preenchimento.

**Fluxo de trabalho.** Sete etapas possíveis, da minuta à assinatura. Aprovar avança a etapa, gera tarefa para o próximo responsável e registra duração. Rejeitar interrompe o fluxo e permite reabertura.

**Colaboração.** Comentários com menção por `@`, que criam tarefa para a pessoa mencionada. Painéis laterais de informações, tags, tarefas, histórico, versões e fluxo.

**Repositório e busca.** Busca por palavra-chave no nome, na descrição e no corpo do contrato, com destaque dos termos e trecho de contexto. Filtros por parte, status, tipo, validade, data de criação e exclusão de termos, com favoritos.

**Relatórios.** 23 relatórios pré-configurados, criação e edição de novos, exportação em CSV e JSON.

**Painéis.** Quatro painéis com dez visualizações disponíveis: tempo médio por etapa, contratos por tipo, por status e por tipo de parte, próximos da expiração, expiração por mês, valor contratado por mês, tempo de ciclo, minhas tarefas e documentos recentes. Cada painel é personalizável.

**Administração.** Modelos, biblioteca de cláusulas com aprovação prévia do Jurídico, ativação de regras condicionais e escolha do aprovador de cada uma, usuários, membros do espaço de trabalho, dados da empresa contratante e carga ou limpeza dos dados de demonstração.

## Primeiros passos

1. Em **Administrador → Empresa e dados**, preencha os dados da empresa contratante. Eles entram no cabeçalho e na qualificação das partes de todo contrato. Enquanto estiverem em branco, o contrato mostra o campo entre colchetes.
2. Ainda nessa aba, ajuste nome, e-mail e cargo do seu usuário.
3. Gere o primeiro contrato pelo menu **Ações**. Com o repositório vazio, escolha a opção de parte nova: os dados informados criam a parte automaticamente.

## Usuários

Com Firebase, cada pessoa entra com a própria conta e o avatar no canto superior direito oferece sair. Os perfis aparecem na lista conforme cada um faz o primeiro login, e o aprovador de cada regra condicional é escolhido em Administrador → Regras condicionais.

Sem Firebase, o estado inicial tem um único usuário e todas as regras apontam para ele. Com os dados de demonstração carregados passam a existir seis, e o avatar permite entrar como qualquer um, o que muda quais tarefas aparecem e quais aprovações podem ser executadas. O fluxo completo do MSA passa por Douglas Silva, Alice Gomes, Gabriela Gomes e André Santos.

## Estrutura

```
src/
  types.ts              modelo de domínio
  store.ts              estado global e ações
  lib/firebase.ts       inicialização do SDK e modo local
  lib/sync.ts           sincronização bidirecional com o Firestore
  lib/engine.ts         montagem do contrato e cálculo do fluxo
  lib/utils.ts          formatação, datas, condições
  data/templates.ts     modelos, cláusulas e regras
  data/empty.ts         estado inicial vazio
  data/seed.ts          dados de demonstração, carregados sob demanda
  components/           layout, visualizações, componentes de interface
  pages/Login.tsx       entrada por e-mail e senha
  pages/                uma página por rota
```

## Dados de demonstração

Não entram sozinhos. Em **Administrador → Empresa e dados** há dois botões:

- **Carregar dados de demonstração** substitui tudo por 113 documentos, 14 partes, 20 contatos, 23 relatórios e 6 usuários fictícios, com a Tally Inc. como empresa contratante. Serve para ver painéis e relatórios povoados sem cadastrar nada à mão.
- **Voltar ao estado inicial** apaga tudo que foi cadastrado, inclusive os dados da empresa, preservando apenas modelos, cláusulas e regras.

A semente é determinística (`rng(20241204)` em `src/data/seed.ts`), então os números do painel são sempre os mesmos.

### De onde vêm os dados

**Copiado das telas do tour.** Nomes das partes (Alfa Inc, Beta Corp, Delta S/A, Epsilon LTDA, Gama Inc, Omega Inc, Rubi Corp, Safira S/A, Turquesa LTDA, Acme Corp, Casa Confortável, Água Pura, Alimentos Frescos, Beleza Natural), os seis usuários, os três modelos, o texto do contrato MSA da Tally, doze dos nomes de relatório, os tipos de acordo com suas proporções, as etapas do fluxo e o comentário de exemplo no documento ID-0113.

**Gerado por sorteio com semente fixa.** Os 113 documentos e tudo que varia entre eles: datas, valores, tipo, status, duração de cada etapa, tarefas e pastas. As proporções de tipo e status seguem os percentuais que aparecem nas roscas do painel do tour.

**Inventado para preencher lacunas.** CNPJs, endereços, contatos externos, as oito cláusulas da biblioteca e os onze relatórios que o tour não mostra.

Nada veio de conta real, API ou banco de dados da Docusign. O tour é um conjunto de imagens estáticas hospedado no Guideflow, e foi essa a única fonte consultada.
