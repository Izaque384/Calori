import { db } from "@/db";
import { orders, restaurantMembers, restaurants, tables } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { canViewReports } from "@/lib/permissions";
import { getSubscriptionSummary } from "@/lib/subscription";
import { and, desc, eq, gte, ne } from "drizzle-orm";

function resolvePeriod(value: string | null) {
  return value === "7" || value === "90" ? Number(value) : 30;
}

function startOfDaysAgo(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

function csvCell(value: string | number | null) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const [membership] = await db
    .select({
      restaurantId: restaurantMembers.restaurantId,
      role: restaurantMembers.role,
    })
    .from(restaurantMembers)
    .where(eq(restaurantMembers.userId, session.user.id))
    .limit(1);

  if (!membership || !canViewReports(membership.role)) {
    return Response.json({ error: "Sem permissão para relatórios." }, { status: 403 });
  }

  const [restaurant] = await db
    .select({
      name: restaurants.name,
      active: restaurants.active,
      subscriptionStatus: restaurants.subscriptionStatus,
      trialEndsAt: restaurants.trialEndsAt,
    })
    .from(restaurants)
    .where(eq(restaurants.id, membership.restaurantId))
    .limit(1);

  const access = restaurant
    ? getSubscriptionSummary({
        status: restaurant.subscriptionStatus,
        trialEndsAt: restaurant.trialEndsAt,
      })
    : null;

  if (!restaurant?.active || !access?.hasAccess) {
    return Response.json({ error: "Assinatura inativa." }, { status: 402 });
  }

  const url = new URL(request.url);
  const period = resolvePeriod(url.searchParams.get("period"));
  const start = startOfDaysAgo(period - 1);

  const rows = await db
    .select({
      number: orders.number,
      tableName: tables.name,
      status: orders.status,
      subtotal: orders.subtotal,
      total: orders.total,
      note: orders.note,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(tables, eq(orders.tableId, tables.id))
    .where(
      and(
        eq(orders.restaurantId, membership.restaurantId),
        gte(orders.createdAt, start),
        ne(orders.status, "cancelled"),
      ),
    )
    .orderBy(desc(orders.createdAt));

  const header = [
    "Pedido",
    "Mesa",
    "Status",
    "Subtotal",
    "Total",
    "Observação",
    "Data",
  ];

  const lines = [
    header.map(csvCell).join(";"),
    ...rows.map((row) =>
      [
        row.number,
        row.tableName,
        row.status,
        Number(row.subtotal).toFixed(2).replace(".", ","),
        Number(row.total).toFixed(2).replace(".", ","),
        row.note,
        row.createdAt.toLocaleString("pt-BR", { timeZone: "America/Fortaleza" }),
      ]
        .map(csvCell)
        .join(";"),
    ),
  ];

  const safeName = restaurant.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "restaurante";

  return new Response("\uFEFF" + lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="calori-${safeName}-${period}-dias.csv"`,
      "cache-control": "no-store",
    },
  });
}
