# TriagemAI — Backend

API Node.js que serve o frontend React do **TriagemAI**, uma aplicação de
triagem de currículos com IA. O recrutador cola uma descrição de vaga (JD),
faz upload de currículos (PDF/DOCX), e a aplicação usa IA para extrair
critérios ponderados, pontuar candidatos e gerar um ranking com justificativas.

> Stack: **Node.js + Express + SQLite (better-sqlite3)** + **Ollama local (llama3)**
> com fallback para **Groq** (API gratuita) e, por último, um provedor
> heurístico determinístico que permite rodar tudo sem nenhum LLM.

---

## Sumário

- [Arquitetura](#arquitetura)
- [Pré-requisitos](#pré-requisitos)
- [Como rodar](#como-rodar)
- [Configuração (.env)](#configuração-env)
- [Provedores de IA e fallback](#provedores-de-ia-e-fallback)
- [Endpoints da API](#endpoints-da-api)
- [Regras de negócio](#regras-de-negócio)
- [Banco de dados e migrations](#banco-de-dados-e-migrations)
- [Tratamento de erros](#tratamento-de-erros)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Testando manualmente (curl)](#testando-manualmente-curl)

---

## Arquitetura

Arquitetura em camadas, **uma responsabilidade por arquivo**:

```
HTTP → routes → (validators) → controllers → services → repositories → SQLite
                                     │
                                     └── services/ai (Ollama → Groq → heurístico)
                                     └── services/parser (PDF/DOCX → texto)
```

- **routes** — apenas declaram as rotas e amarram middlewares.
- **validators** — validam o input *antes* de chegar ao controller (lançam `400`).
- **controllers** — finos: leem a request, chamam o service, devolvem a response.
- **services** — toda a regra de negócio (extração, scoring, pipeline, CSV).
- **repositories** — todo o SQL fica isolado aqui.
- **middleware** — CORS, upload (multer), 404 e **error handler global**.

---

## Pré-requisitos

- **Node.js ≥ 18.17** (testado em Node 22). Usa `fetch` nativo.
- **npm**
- (Opcional) **Ollama** rodando localmente para usar o LLM local.
- (Opcional) Uma **API key da Groq** (gratuita) para o fallback em nuvem.

> Sem Ollama nem Groq a aplicação **ainda funciona**: cai no provedor
> heurístico. Os scores ficam mais simples, mas todos os endpoints respondem.

> ⚠️ **Não rode o projeto de dentro do iCloud Drive / "Mobile Documents".**
> O iCloud materializa arquivos sob demanda e pode travar a leitura dos módulos
> na inicialização do servidor. Use um diretório em disco local.

---

## Como rodar

```bash
# 1. Instalar dependências
npm install

# 2. Criar o arquivo de ambiente a partir do exemplo
cp .env.example .env
#    (ajuste valores se necessário — veja a seção Configuração)

# 3. Rodar as migrations do banco (cria ./data/triagemai.db)
npm run migrate

# 4. Subir o servidor
npm start
#    ou, em desenvolvimento (reinicia ao salvar):
npm run dev
```

O servidor sobe em `http://localhost:3000`. As migrations também rodam
automaticamente a cada boot, então o passo 3 é opcional.

Teste rápido:

```bash
curl http://localhost:3000/api/health
# {"status":"ok","timestamp":"..."}
```

### Scripts disponíveis

| Script            | O que faz                                   |
| ----------------- | ------------------------------------------- |
| `npm start`       | Sobe o servidor (`node src/server.js`)      |
| `npm run dev`     | Sobe com `--watch` (reinício automático)    |
| `npm run migrate` | Aplica migrations pendentes e sai           |

---

## Configuração (.env)

Todas as variáveis estão documentadas em **`.env.example`**. Resumo:

| Variável                | Default                          | Descrição                                          |
| ----------------------- | -------------------------------- | -------------------------------------------------- |
| `PORT`                  | `3000`                           | Porta do servidor                                  |
| `NODE_ENV`              | `development`                    | Em `development` os erros incluem `detail`         |
| `CORS_ORIGIN`           | `http://localhost:5173`          | Origem permitida (frontend Vite em dev)            |
| `DATABASE_PATH`         | `./data/triagemai.db`            | Caminho do arquivo SQLite                          |
| `UPLOAD_DIR`            | `./uploads`                      | Onde os CVs enviados são gravados                  |
| `MAX_UPLOAD_BYTES`      | `10485760` (10 MB)               | Tamanho máximo por upload                          |
| `AI_PROVIDER_CHAIN`     | `ollama,groq,heuristic`          | Ordem de tentativa dos provedores de IA            |
| `AI_REQUEST_TIMEOUT_MS` | `60000`                          | Timeout por chamada a um provedor                  |
| `OLLAMA_BASE_URL`       | `http://localhost:11434`         | URL do Ollama local                                |
| `OLLAMA_MODEL`          | `llama3`                         | Modelo do Ollama                                   |
| `GROQ_API_KEY`          | *(vazio)*                        | Chave da Groq; vazio = fallback Groq desativado    |
| `GROQ_BASE_URL`         | `https://api.groq.com/openai/v1` | Endpoint compatível com OpenAI da Groq             |
| `GROQ_MODEL`            | `llama-3.3-70b-versatile`        | Modelo da Groq                                     |

---

## Provedores de IA e fallback

O serviço de IA (`src/services/ai/`) é **isolado** do resto da aplicação e
tenta os provedores na ordem de `AI_PROVIDER_CHAIN`, caindo para o próximo
quando um falha:

1. **`ollama`** — LLM local. Requer o Ollama rodando:
   ```bash
   # instale em https://ollama.com e então:
   ollama pull llama3
   ollama serve   # normalmente já roda como serviço
   ```
2. **`groq`** — fallback gratuito em nuvem. Pegue uma key em
   <https://console.groq.com/keys> e coloque em `GROQ_API_KEY`. Sem a key,
   este provedor é pulado automaticamente.
3. **`heuristic`** — fallback determinístico **sem LLM**, baseado em
   palavras-chave. Existe para que a aplicação rode e seja testável mesmo sem
   Ollama nem Groq. Para **forçar** um LLM de verdade, remova `heuristic` de
   `AI_PROVIDER_CHAIN`.

Cada chamada faz log de qual provedor respondeu e de eventuais quedas para o
fallback. Se todos falharem, a API responde `502`.

---

## Endpoints da API

Base URL: `http://localhost:3000/api`. Tudo em JSON, exceto upload
(`multipart/form-data`) e export (`text/csv`).

| Método  | Rota                                  | Descrição                                  | Sucesso |
| ------- | ------------------------------------- | ------------------------------------------ | ------- |
| `GET`   | `/health`                             | Health check                               | `200`   |
| `POST`  | `/jobs/extract-criteria`              | Extrai critérios ponderados da JD          | `200`   |
| `PATCH` | `/jobs/:jobId/criteria`               | Atualiza os pesos dos critérios            | `200`   |
| `POST`  | `/jobs/:jobId/cvs`                     | Upload de um CV (PDF/DOCX, multipart)      | `201`   |
| `POST`  | `/jobs/:jobId/analyze`                | Inicia a análise (assíncrona)              | `202`   |
| `GET`   | `/analyses/:analysisId`               | Status/resultado (polling a cada 1500 ms)  | `200`   |
| `GET`   | `/analyses/:analysisId/export.csv`    | Exporta o ranking em CSV                    | `200`   |

### `POST /jobs/extract-criteria`
```jsonc
// req
{ "jobDescription": "Senior Backend Engineer — strong Python, PostgreSQL, AWS..." }
// res 200
{ "jobId": "job_8f3a2b1c", "criteria": [ { "id": "c1", "name": "Python", "weight": 5 } ] }
```
Erros: `400` (jobDescription ausente), `422` (JD muito curta / sem critérios).

### `PATCH /jobs/:jobId/criteria`
```jsonc
// req
{ "criteria": [ { "id": "c1", "name": "Python", "weight": 5 } ] }
// res 200
{ "jobId": "job_8f3a2b1c", "updatedAt": "2026-06-05T14:22:31.000Z" }
```
Pesos fora de `1..5` → `400`.

### `POST /jobs/:jobId/cvs` (multipart, campo `file`)
```jsonc
// res 201
{ "fileId": "cv_a1b2c3", "name": "ana_souza_cv.pdf", "size": 284512, "status": "uploaded" }
```
Erros: `413` (> 10 MB), `415` (tipo não suportado).

### `POST /jobs/:jobId/analyze`
```jsonc
// req
{ "fileIds": ["cv_a1b2c3"], "criteria": [ { "id": "c1", "name": "Python", "weight": 5 } ] }
// res 202
{ "analysisId": "ana_9d8e7f", "status": "processing", "totalCandidates": 1 }
```

### `GET /analyses/:analysisId` (polling)
Enquanto processa:
```jsonc
{ "analysisId": "ana_9d8e7f", "status": "processing", "stage": "matching", "progress": 47, "candidates": [] }
```
`stage ∈ parsing | matching | scoring`. Quando conclui, vem o `AnalysisResult`
completo com `candidates[]` ordenados. Em caso de falha: `status: "failed"` + `error`.

### `GET /analyses/:analysisId/export.csv`
`text/csv; charset=utf-8` com **BOM UTF-8**, separador vírgula, quebra `\r\n`,
e `Content-Disposition: attachment`. Colunas: `Rank, Name, Title, Overall Score,
Band`, depois `<Critério> Score` por critério, depois `<Critério> Justification`.

---

## Regras de negócio

- **Score final** (`overall`): média ponderada arredondada
  `round( Σ(score_i × weight_i) / Σ(weight_i) )`, com `score_i ∈ 0..100` e
  `weight_i ∈ 1..5`.
- **Bandas**: `Recommended` (`>= 80`), `Review` (`60..79`), `Discard` (`< 60`).
- **Ordenação**: `overall` desc, desempate por `name` asc.
- A lógica pura vive em `src/services/scoring.service.js`.

---

## Banco de dados e migrations

- SQLite via **better-sqlite3** (modo WAL, foreign keys ligadas).
- As migrations ficam em `src/db/migrations/` como arquivos `.sql` numerados.
- O runner (`src/db/migrate.js`) aplica apenas as pendentes e registra o que já
  foi aplicado em `schema_migrations` — é **idempotente** e roda a cada boot.

Tabelas: `jobs`, `criteria`, `cvs`, `analyses`, `candidates`, `candidate_scores`.

Para criar uma nova migration, adicione `002_xxx.sql` na pasta e rode
`npm run migrate` (ou apenas reinicie o servidor).

---

## Tratamento de erros

Um **error handler global** (`src/middleware/errorHandler.js`) centraliza todas
as respostas de erro no formato:

```json
{ "error": "mensagem legível", "code": "CODIGO_OPCIONAL" }
```

- Erros de negócio usam a classe `AppError` (status + código).
- Erros do multer viram `413` (arquivo grande) ou `400`.
- JSON malformado no body vira `400`.
- Erros inesperados (`>= 500`) são logados com stack; em `development` a resposta
  inclui um campo `detail`.
- Os **headers de CORS** são aplicados antes de tudo, então **respostas de erro
  também são CORS-safe**.

---

## Estrutura de pastas

```
triaje-backend/
├── .env.example              # variáveis documentadas
├── package.json
├── README.md
├── data/                     # arquivo SQLite (gitignored)
├── uploads/                  # CVs enviados (gitignored)
└── src/
    ├── server.js             # entrypoint: valida config, migra, escuta
    ├── app.js                # wiring do Express (cors → json → rotas → erros)
    ├── config/index.js       # config centralizada + validação
    ├── db/
    │   ├── connection.js     # singleton do better-sqlite3
    │   ├── migrate.js        # runner de migrations
    │   └── migrations/001_init.sql
    ├── routes/               # jobs.routes, analyses.routes, index
    ├── controllers/          # jobs.controller, analyses.controller
    ├── services/
    │   ├── job.service.js
    │   ├── cv.service.js
    │   ├── analysis.service.js
    │   ├── scoring.service.js
    │   ├── csv.service.js
    │   ├── ai/               # index (fallback) + ollama/groq/heuristic + prompts
    │   └── parser/document.parser.js   # PDF (pdf-parse) + DOCX (mammoth)
    ├── repositories/         # job/cv/analysis — todo o SQL
    ├── middleware/           # cors, upload, notFound, errorHandler
    ├── validators/           # jobs.validator, analyses.validator
    └── utils/                # AppError, asyncHandler, id
```

---

## Testando manualmente (curl)

```bash
# 1. Extrair critérios
JOB=$(curl -s -X POST localhost:3000/api/jobs/extract-criteria \
  -H 'Content-Type: application/json' \
  -d '{"jobDescription":"Senior Backend Engineer. Strong Python, PostgreSQL, AWS. Leadership and English required."}')
echo "$JOB"
JOBID=$(node -e "console.log(JSON.parse(process.argv[1]).jobId)" "$JOB")

# 2. Upload de um CV (PDF ou DOCX)
CV=$(curl -s -X POST "localhost:3000/api/jobs/$JOBID/cvs" -F "file=@/caminho/cv.pdf")
echo "$CV"
FID=$(node -e "console.log(JSON.parse(process.argv[1]).fileId)" "$CV")

# 3. Analisar
ANA=$(curl -s -X POST "localhost:3000/api/jobs/$JOBID/analyze" \
  -H 'Content-Type: application/json' \
  -d "{\"fileIds\":[\"$FID\"],\"criteria\":[{\"id\":\"c1\",\"name\":\"Python\",\"weight\":5}]}")
echo "$ANA"
ANAID=$(node -e "console.log(JSON.parse(process.argv[1]).analysisId)" "$ANA")

# 4. Polling
curl -s "localhost:3000/api/analyses/$ANAID"

# 5. Export CSV
curl -s "localhost:3000/api/analyses/$ANAID/export.csv" -o ranking.csv
```

---

## Licença

MIT.
