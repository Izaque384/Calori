# Calori

**Calori — a experiência digital do seu restaurante.**

Fundação do MVP construída com Next.js, TypeScript, Drizzle ORM e Neon Postgres, com Managed Better Auth.

## Stack

- Next.js (App Router)
- React + TypeScript
- Neon Postgres
- Drizzle ORM / Drizzle Kit
- Neon Managed Better Auth
- Vercel (deploy planejado)

## Fluxo implementado

1. Cadastro em `/auth/sign-up`
2. Login em `/auth/sign-in`
3. Onboarding em `/onboarding`
4. Criação do restaurante em `restaurants`
5. Vínculo do usuário como `owner` em `restaurant_members`
6. Redirecionamento para `/dashboard`
7. Proteção de `/dashboard` e `/onboarding` pelo Neon Auth

## Banco já provisionado

A branch `production` do projeto Neon Calori já contém o schema principal do MVP:

- restaurants
- restaurant_members
- tables
- table_sessions
- categories
- products
- option_groups
- options
- orders
- order_items
- order_item_options
- service_requests

## Configuração local

Copie `.env.example` para `.env.local` e preencha com as credenciais do projeto Neon.

```bash
cp .env.example .env.local
npm install
npm run dev
```

O runtime usa `DATABASE_URL` (pooled). Para migrations, use `DATABASE_URL_UNPOOLED`.

## Variáveis necessárias

```env
DATABASE_URL=
DATABASE_URL_UNPOOLED=
NEON_AUTH_BASE_URL=
NEON_AUTH_COOKIE_SECRET=
```

`NEON_AUTH_COOKIE_SECRET` deve ter pelo menos 32 caracteres.

## Próximo bloco

- CRUD de categorias e produtos
- upload de imagens
- disponibilidade de produtos
- grupos de adicionais
- navegação real do dashboard
