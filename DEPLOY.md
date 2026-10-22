# Publicação

O projeto Firebase `hsmodas-comissoes-57f17` é compartilhado por vários sistemas: **11 sites de hosting, 57 Cloud Functions e 3 bancos Firestore**. Tudo aqui está escopado para não encostar neles. Publique sempre com `--only`, nunca `firebase deploy` sozinho.

## O que já está configurado

| Item | Valor | Isolamento |
|---|---|---|
| Projeto | `hsmodas-comissoes-57f17` | — |
| Site | `hspl-contratos` (alvo `clm`) | Alvo nomeado; os outros 10 sites não são tocados |
| Banco Firestore | `clm-contratos` (novo) | Banco dedicado; os outros 3 não entram no `firebase.json` |
| Bucket Storage | `clm` | `firebase.json` fixa o bucket; o padrão do projeto não é tocado |
| Funções | codebase `clm`, prefixo `clm*` | As 57 funções existentes ficam noutro codebase |
| Região | `southamerica-east1` | Mesma convenção do projeto |

O site `hspl-contratos.web.app` responde 404 hoje, ou seja, nunca recebeu deploy. Não há nada a sobrescrever.

## 1. Regras do Firestore — já publicadas

O CLM usa o banco próprio `clm-contratos`, criado em `southamerica-east1`. Como o `firebase.json` lista apenas esse banco, publicar as regras daqui **não alcança** `(default)`, `central-pj` nem `showroom-agenda`.

```bash
npm run deploy:rules
```

Foi o que eliminou a necessidade de mesclar regras com outros sistemas: cada banco Firestore tem o seu próprio conjunto.

## 2. Site

```bash
npm run deploy:hosting
```

Compila e publica em https://hspl-contratos.web.app. O `firebase.json` usa o alvo `clm`, então o comando não alcança os demais sites.

As variáveis do `.env` entram no bundle **no momento do build**. Como o `.env` não está no Git, o build precisa rodar numa máquina que o tenha.

## 3. Bucket do Storage — já publicado

O bucket `clm` guarda anexos que **não** vão para assinatura. O documento assinado continua no Assinafy.

```bash
npm run deploy:storage
```

> O campo `"bucket": "clm"` em `firebase.json` é o que prende as regras a esse bucket. Sem ele o deploy aplicaria as regras ao bucket padrão do projeto, usado por outros sistemas.

As regras consultam a lista de membros no banco `clm-contratos`. Essa consulta entre serviços compila, mas ainda não foi exercitada em tempo de execução: o app não envia arquivos para o bucket até a tela de anexos ser implementada.

## 4. Funções do Assinafy

As funções levam a chave do Assinafy, que nunca pode ir para o navegador. Cadastre os segredos uma vez:

```bash
firebase functions:secrets:set ASSINAFY_API_KEY
```

```bash
firebase functions:secrets:set ASSINAFY_ACCOUNT_ID
```

```bash
firebase functions:secrets:set ASSINAFY_WEBHOOK_SECRET
```

Depois publique **apenas o codebase do CLM**:

```bash
firebase deploy --only functions:clm
```

> Nunca rode `firebase deploy --only functions` sem o `:clm`. Sem o escopo, o Firebase considera que as outras 57 funções foram removidas e oferece apagá-las.

### Funções publicadas

| Função | Tipo | Papel |
|---|---|---|
| `clmAssinafyUpload` | HTTPS | Recebe os bytes do arquivo e envia ao Assinafy |
| `clmAssinafyDownload` | HTTPS | Baixa um artefato (`original`, `certificated`, `pades`, `certificate-page`, `bundle`) |
| `clmAssinafyStatus` | Callable | Situação do documento no Assinafy |
| `clmAssinafyRequestSignature` | Callable | Dispara o pedido de assinatura |
| `clmAssinafyWebhook` | HTTPS | Recebe eventos e atualiza o documento no Firestore |

Todas, exceto o webhook, exigem login no Firebase **e** que o e-mail esteja na lista de membros do espaço de trabalho. O webhook é público e confere a assinatura HMAC do corpo.

### Webhook

Depois do deploy, registre o endereço no Assinafy:

```
https://southamerica-east1-hsmodas-comissoes-57f17.cloudfunctions.net/clmAssinafyWebhook
```

O segredo de assinatura vem de `GET /v1/accounts/{accountId}/webhooks/endpoints/{endpointId}/secret` e é o valor de `ASSINAFY_WEBHOOK_SECRET`.

## Onde cada coisa fica guardada

- **Contrato gerado pelo modelo:** não é arquivo. O Firestore guarda as respostas do formulário e o motor remonta o texto a cada leitura. É o que permite buscar palavras dentro do contrato.
- **PDF enviado para assinatura e documento assinado:** na nuvem do Assinafy. O CLM guarda apenas o `documentId` e o status.
- **Firebase Storage:** não é usado. Guardar o mesmo documento em duas nuvens só criaria divergência.
