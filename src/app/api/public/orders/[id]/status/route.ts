import { db } from "@/db";
import { orders, restaurants, tables } from "@/db/schema";
import { and, eq } from "drizzle-orm";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: Props) {
  const { id } = await params;
  const url = new URL(request.url);
  const restaurantSlug = String(url.searchParams.get("restaurantSlug") ?? "").trim();
  const tableCode = String(url.searchParams.get("tableCode") ?? "").trim();

  if (!id || !restaurantSlug || !tableCode) {
    return Response.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const [row] = await db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      total: orders.total,
      updatedAt: orders.updatedAt,
      tableName: tables.name,
    })
    .from(orders)
    .innerJoin(restaurants, eq(orders.restaurantId, restaurants.id))
    .innerJoin(tables, eq(orders.tableId, tables.id))
    .where(
      and(
        eq(orders.id, id),
        eq(restaurants.slug, restaurantSlug),
        eq(tables.publicCode, tableCode),
      ),
    )
    .limit(1);

  if (!row) {
    return Response.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  return Response.json({
    order: {
      id: row.id,
      number: row.number,
      status: row.status,
      total: Number(row.total),
      updatedAt: row.updatedAt.toISOString(),
      table: row.tableName,
    },
  });
}
