# Índices TJSP

Painel web para consultar, organizar e visualizar a variação mensal dos índices judiciais publicados pelo [Tribunal de Justiça de São Paulo](https://www.tjsp.jus.br/PrimeiraInstancia/CalculosJudiciais/Comunicado?codigoComunicado=2528).

**Aplicação em produção:** [indices-tjsp-rt.craftylemur1024.chatgpt.site](https://indices-tjsp-rt.craftylemur1024.chatgpt.site)

> Os dados exibidos têm caráter informativo. Para uso processual ou financeiro, confirme sempre o valor e as regras aplicáveis no documento oficial do TJSP.

## O que o projeto faz

- Consulta a página oficial “Índices Diversos” do TJSP.
- Localiza os anexos disponibilizados pelo comunicado.
- Faz o download dos PDFs compatíveis e lê a linha referente ao ano do próprio comunicado.
- Armazena cada valor mensal, o índice e a URL do PDF de origem.
- Exibe um gráfico de evolução mensal por índice.
- Permite abrir o documento oficial diretamente da interface.

Atualmente, a coleta já suporta PDFs textuais compatíveis, como IGP-DI, IGP-M, INCC, INPC, IPC-FIPE, IPCA-E e TR Mensal. Alguns anexos do TJSP são planilhas ou usam estruturas diferentes e ainda precisam de adaptadores específicos.

## Tecnologias

| Camada | Ferramentas |
| --- | --- |
| Interface | React, TypeScript e Tailwind CSS |
| Framework | Next.js executado com Vinext |
| Gráficos | Recharts |
| Backend | Cloudflare Workers |
| Banco de dados | Cloudflare D1 (SQLite) |
| ORM e migrações | Drizzle ORM |
| Hospedagem | Cloudflare Sites |

## Arquitetura

```text
Comunicado TJSP
       |
       v
Rota POST /api/refresh
       |
       +--> encontra anexos PDF
       +--> preserva bytes e extrai texto dos streams do PDF
       +--> identifica os valores mensais do ano publicado
       |
       v
Cloudflare D1 (index_values)
       |
       v
Rota GET /api/indices --> gráfico React
```

Cada registro contém o nome do índice, ano de referência, mês, valor, URL do PDF e data de coleta. A interface consulta sempre a série mais recente disponível para cada índice.

## Executando localmente

### Pré-requisitos

- Node.js 22 ou superior
- npm

### Instalação

```bash
git clone https://github.com/rafathomas/indices-tj.git
cd indices-tj
npm ci
```

### Ambiente de desenvolvimento

```bash
npm run dev
```

O servidor local é iniciado, por padrão, em `http://localhost:5173`.

### Build de produção

```bash
npm run build
```

### Banco local

A migração inicial está em `drizzle/0000_index_values.sql`. Em uma prévia local com D1, aplique-a usando o `wrangler` configurado pelo projeto:

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js \
  d1 execute DB --local --config dist/server/wrangler.json \
  --persist-to .wrangler/state --file drizzle/0000_index_values.sql
```

## Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/indices` | Retorna os pontos da série mais recente de cada índice. |
| `POST` | `/api/refresh` | Consulta o comunicado do TJSP e atualiza os índices extraídos dos PDFs compatíveis. |

## Limitações e próximos passos

- Implementar leitores para anexos em XLS/XLSM e outros formatos publicados pelo TJSP.
- Adicionar uma rotina agendada para disparar a coleta mensal automaticamente.
- Exibir a data da última coleta por índice e alertas para anexos não processados.
- Permitir exportação da série histórica em CSV.

## Fonte dos dados

Os dados são obtidos exclusivamente do comunicado oficial do TJSP:

[Índices Diversos — TJSP](https://www.tjsp.jus.br/PrimeiraInstancia/CalculosJudiciais/Comunicado?codigoComunicado=2528)

## Licença

Este repositório ainda não possui uma licença definida.
