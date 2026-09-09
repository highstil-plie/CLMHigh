# CLM — Gestão do Ciclo de Vida de Contratos

Aplicação web que reproduz o funcionamento do Docusign CLM, seguindo passo a passo o tour guiado publicado em `docusign.com/pt-br/produtos/clm`.

Roda inteiramente no navegador. Não há backend: os dados ficam em `localStorage` e são recriados a partir de uma semente determinística na primeira execução.

## Como executar

```bash
npm install
```

```bash
npm run dev
```

A aplicação abre em `http://localhost:5173`.

## Stack

React 19, TypeScript, Vite, Tailwind CSS 4, React Router, Zustand com persistência, Recharts.

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

**Administração.** Modelos, biblioteca de cláusulas com aprovação prévia do Jurídico, ativação de regras condicionais, usuários e restauração dos dados de demonstração.

## Trocar de usuário

O avatar no canto superior direito permite entrar como qualquer um dos seis usuários. Isso muda quais tarefas aparecem e quais aprovações podem ser executadas. O fluxo completo do MSA passa por Douglas Silva, Alice Gomes, Gabriela Gomes e André Santos.

## Estrutura

```
src/
  types.ts              modelo de domínio
  store.ts              estado global e ações
  lib/engine.ts         montagem do contrato e cálculo do fluxo
  lib/utils.ts          formatação, datas, condições
  data/templates.ts     modelos, cláusulas e regras
  data/seed.ts          geração dos 113 documentos de exemplo
  components/           layout, visualizações, componentes de interface
  pages/                uma página por rota
```

## Dados de demonstração

113 documentos, 14 partes, 20 contatos (14 externos e 6 internos), 23 relatórios e 8 cláusulas. A empresa contratante é a Tally Inc.

A semente é determinística (`rng(20241204)` em `src/data/seed.ts`), então os números do painel são estáveis entre execuções. Documentos e partes que você criar entram por cima dessa base. Para restaurar: Administrador → Empresa e dados → Restaurar dados de demonstração.

### De onde vêm os dados

**Copiado das telas do tour.** Nomes das partes (Alfa Inc, Beta Corp, Delta S/A, Epsilon LTDA, Gama Inc, Omega Inc, Rubi Corp, Safira S/A, Turquesa LTDA, Acme Corp, Casa Confortável, Água Pura, Alimentos Frescos, Beleza Natural), os seis usuários, os três modelos, o texto do contrato MSA da Tally, doze dos nomes de relatório, os tipos de acordo com suas proporções, as etapas do fluxo e o comentário de exemplo no documento ID-0113.

**Gerado por sorteio com semente fixa.** Os 113 documentos e tudo que varia entre eles: datas, valores, tipo, status, duração de cada etapa, tarefas e pastas. As proporções de tipo e status seguem os percentuais que aparecem nas roscas do painel do tour.

**Inventado para preencher lacunas.** CNPJs, endereços, contatos externos, as oito cláusulas da biblioteca e os onze relatórios que o tour não mostra.

Nada veio de conta real, API ou banco de dados da Docusign. O tour é um conjunto de imagens estáticas hospedado no Guideflow, e foi essa a única fonte consultada.
