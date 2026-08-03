# ADR 0001 — Idempotência e retries por tipo de falha

Status: aceito

## Contexto

Webhooks podem ser reenviados pela origem e APIs de destino podem falhar por motivos temporários. Reprocessar tudo da mesma forma cria duplicidade e também desperdiça tentativas em payloads que nunca serão válidos.

## Decisão

Cada origem envia `X-Idempotency-Key`. O banco garante unicidade dessa chave dentro do fluxo e devolve a execução já registrada quando recebe uma duplicata.

Os erros são separados em duas categorias:

- definitivos, como campo obrigatório ausente ou JSON inválido;
- recuperáveis, como timeout ou indisponibilidade temporária do destino.

Somente erros recuperáveis entram em retry. O padrão é uma tentativa inicial e até três novas tentativas. Depois disso, o evento muda para `dead_letter` e fica disponível para análise manual.

## Consequências

- A operação evita duplicar efeitos no sistema de destino.
- O histórico explica por que cada evento parou ou foi reprocessado.
- Adaptadores reais precisam classificar seus erros de forma consistente.
- Uma evolução futura deve agendar retries com backoff em uma fila, sem manter a requisição HTTP aberta.
