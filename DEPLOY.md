# Publicação

O projeto Firebase `hsmodas-comissoes-57f17` é compartilhado por vários sistemas: **11 sites de hosting, 57 Cloud Functions e 3 bancos Firestore**. Tudo aqui está escopado para não encostar neles. Publique sempre com `--only`, nunca `firebase deploy` sozinho.

## O que já está configurado

| Item | Valor | Isolamento |
|---|---|---|
| Projeto | `hsmodas-comissoes-57f17` | — |
| Site | `hspl-contratos` (alvo `clm`) | Alvo nomeado; os outros 10 sites não são tocados |
| Banco | `(default)` | Regras só da coleção `clm` |
| Funções | codebase `clm`, prefixo `clm*` | As 57 funções existentes ficam noutro codebase |
| Região | `southamerica-east1` | Mesma convenção do projeto |

O site `hspl-contratos.web.app` responde 404 hoje, ou seja, nunca recebeu deploy. Não há nada a sobrescrever.

## 1. Regras do Firestore

**Este é o único passo que exige cuidado manual.** Publicar `firestore.rules` substitui o conjunto inteiro de regras do banco, incluindo as dos outros aplicativos.

Antes de publicar, abra Console do Firebase → Firestore Database → Regras, copie o conteúdo atual e **acrescente** o bloco `match /clm/{ws}` do arquivo `firestore.rules`, preservando o que já existe. Só então:

```bash
npm run deploy:rules
```

Se preferir não arriscar o arquivo local, cole o bloco direto no console e publique por lá.

## 2. Site

```bash
npm run deploy:hosting
```

Compila e publica em https://hspl-contratos.web.app. O `firebase.json` usa o alvo `clm`, então o comando não alcança os demais sites.

As variáveis do `.env` entram no bundle **no momento do build**. Como o `.env` não está no Git, o build precisa rodar numa máquina que o tenha.

## 3. Funções do Assinafy

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
