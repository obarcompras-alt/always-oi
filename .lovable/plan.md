# Controle de Estoque + Lista de Compras

Substitui a planilha do Notion por um app onde funcionários contam itens e o dono vê a lista de compras pronta, agrupada por fornecedor em fardos. Sem fórmulas expostas — nada quebra.

## Telas

1. **Login** (email/senha) — mesma tela pra funcionários e admin
2. **Contagem (home dos funcionários)**
   - Lista de itens com busca no topo
   - Cada linha: nome, fornecedor (badge), estoque atual grande, botões `−` `+`, campo pra digitar valor direto
   - Ajuste é salvo na hora (realtime) — se outro funcionário abrir, vê o número atualizado
   - Badge de "faltando X" quando abaixo do mínimo
3. **Lista de Compras**
   - Agrupada por fornecedor (Giuliard, FORTE, adega, coca cola, etc.)
   - Cada item: `19 fardo(s) de HEINEKEN LONG NECK` (arredonda pra cima)
   - Botão "Copiar lista do fornecedor" (pra colar no WhatsApp)
   - Botão "Copiar tudo"
4. **Gerenciar Itens (só admin)**
   - CRUD de itens: nome, fornecedor, estoque mínimo, unidades por fardo
   - CRUD de fornecedores
   - Definir quem é admin

## Regras de cálculo

- `diferença = contagem − estoque_mínimo` (negativo = precisa comprar)
- `unidades_a_comprar = max(0, estoque_mínimo − contagem)`
- `fardos = ceil(unidades_a_comprar / unidades_por_fardo)`
- Item só entra na lista de compras se `fardos > 0`

## Dados (Lovable Cloud)

- `suppliers`: id, nome, cor (pra badge)
- `items`: id, nome, supplier_id, estoque_minimo, unidades_por_fardo, contagem_atual, updated_at, updated_by
- `profiles`: id (→ auth.users), nome
- `user_roles`: user_id, role (`admin` | `staff`) — tabela separada, security definer `has_role()`
- Realtime ligado em `items` pra contagem sincronizar entre dispositivos
- RLS: staff pode ler tudo e atualizar só `contagem_atual`; admin faz tudo

## Detalhes técnicos

- Rotas: `/auth`, `/_authenticated/` (contagem = index), `/_authenticated/compras`, `/_authenticated/gerenciar`
- Contagem atualizada via `UPDATE items SET contagem_atual = ...` — nenhum funcionário vê fórmula, só o número
- Debounce de 400ms no input direto pra não spammar o banco
- Primeiro usuário que se cadastrar vira admin automaticamente (trigger); demais entram como `staff`
- Design: mobile-first (funcionário conta com celular na mão), botões grandes, tema escuro pra bar

## Fora deste plano (pode vir depois)

- Histórico de ciclos semana a semana
- Exportar PDF
- Envio direto pro WhatsApp do fornecedor via API
