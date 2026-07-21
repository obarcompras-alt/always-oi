# Reestruturação do app

Vou fazer nessa ordem exata pra não retrabalhar. Cada fase é validável antes da próxima.

## Estrutura final de abas (poucas, direto ao ponto)

```
Contar/Estoque   Compras   Acompanhar   Gerenciar
   (funcionário)  (admin)   (admin)      (admin)
```

- **Contar/Estoque = MESMA tela**. Mostra o estoque atual grande e permite editar a qualquer momento antes do ciclo fechar. Atalho **+** flutuante pra cadastro rápido de item continua ali.
- **Compras** só admin vê.
- **Acompanhar** (quadro) só admin + responsável pela compra veem.
- **Gerenciar** tem sub-abas: **Itens**, **Fornecedores**, **Unidades**, **Ciclos**, **Relatórios**.

Funcionário só enxerga a aba Contar/Estoque. Admin vê tudo.

## Fase 1 — Banco de dados (fundação, invisível)

Uma única migração cria/altera:

- **`ciclos`**: id, tipo (`semanal`/`quinzenal`/`mensal`), inicio, fim, status (`aberto`/`fechado`), created_at. Sistema abre ciclo novo automaticamente com base na config.
- **`config`** (linha única): frequencia_ciclo (`semanal`/`quinzenal`/`mensal`), dia_semana ou dia_mes de virada.
- **`unidades_medida`**: id, nome (`un`, `kg`, `L`, `ml`, …), abreviacao. Seed com un/kg/L/ml.
- **`items`**: adiciona `unidade_id` (FK). `unidades_por_fardo` vira `numeric` (aceita decimal). Remove `preco_unidade` daqui (vem do histórico).
- **`contagens`**: adiciona `ciclo_id` (FK). `unidades` e `fardos` viram `numeric`. Chave única muda pra `(ciclo_id, item_id, area, tipo)` → contar de novo dentro do mesmo ciclo *atualiza*, mas mudar de ciclo cria registro novo. Histórico preservado.
- **`compras_historico`**: id, item_id, fornecedor_id, data, preco_unitario, quantidade, ciclo_id (opcional).
- **`listas_compras`**: id, ciclo_id, created_at, created_by.
- **`listas_compras_itens`**: id, lista_id, item_id, fornecedor_id, quantidade, preco_estimado, status (`a_fazer`/`solicitado`/`em_andamento`/`concluida`/`nao_realizada`), responsavel_id, ordem.
- Função `preco_estimado(item_id)` → retorna o `preco_unitario` da linha mais recente em `compras_historico` pra aquele item.
- Função `ciclo_atual()` → retorna o ciclo aberto (ou cria um se não existir, baseado em `config`).
- RLS: funcionário (staff) só lê/escreve `items`, `contagens`, `suppliers`; admin faz tudo.

## Fase 2 — Contar/Estoque (unificado)

- Uma aba só. Mostra estoque atual grande já ao entrar (sem precisar digitar na busca — reverter aquela decisão anterior, agora com filtro por fornecedor/área em cima).
- Busca continua funcionando pra achar rápido.
- Cada card aceita **decimal** nos inputs (unidades soltas e fardos).
- Rótulo do input mostra a unidade do item (`kg`, `L`, `un`).
- Contagens gravam com `ciclo_id = ciclo_atual()` → histórico automático.
- Botão **+** flutuante mantém cadastro rápido, mas com seletor de unidade de medida.

## Fase 3 — Compras

- Preço vem de `preco_estimado(item_id)` (última compra), não mais do item.
- Lista editável continua igual (ajuste por fardo/unidade, remover item).
- Botão **"Gerar lista"** cria linha em `listas_compras` + `listas_compras_itens` com status `a_fazer` → aparece no Acompanhar.
- Copiar WhatsApp continua.

## Fase 4 — Acompanhar (nova)

- Quadro Kanban com 5 colunas: A fazer / Solicitado / Em andamento / Concluída / Não realizada.
- Cards = itens da lista (agrupados por fornecedor dentro de cada coluna, ou um card por fornecedor — vou por card por item agrupado visualmente por fornecedor, mais granular).
- Arrastar entre colunas (dnd-kit) → atualiza status.
- Ao mover pra Concluída, abre modal pedindo **preço unitário real** + **quantidade final** → grava em `compras_historico`. É isso que alimenta o preço estimado do próximo ciclo.
- Filtro no topo: ciclo atual (padrão) ou histórico de ciclos anteriores.
- Só admin acessa.

## Fase 5 — Gerenciar

Sub-abas:
- **Itens**: CRUD com unidade de medida.
- **Fornecedores**: como já é.
- **Unidades**: CRUD de unidades de medida.
- **Ciclos**: configurar frequência (semanal/quinzenal/mensal) e dia de virada. Ver ciclos passados.
- **Relatórios**: consumo por período (já existe, adapta pra usar ciclos).

## Papéis

- `user_roles` já existe (admin/staff). Adiciono guarda nas abas Compras/Acompanhar/Gerenciar → staff é redirecionado pra Contar.

## Detalhes técnicos

- Numeric decimal no banco → `parseFloat` no front, `toLocaleString('pt-BR')` na exibição.
- dnd-kit pra Kanban (`@dnd-kit/core` + `@dnd-kit/sortable`).
- Ciclo atual resolvido via server function ou RPC pra evitar race.
- Migração é uma só, transacional, com backfill: cria ciclo inicial, associa contagens existentes a ele, seed de unidades, migra `preco_unidade` atual pra uma linha inicial em `compras_historico`.

## Fora deste plano

- Exportar PDF, envio direto WhatsApp API, notificações push, multi-tenant.

Confirma que posso seguir? Vou aprovar a migração pela ferramenta antes de rodar.