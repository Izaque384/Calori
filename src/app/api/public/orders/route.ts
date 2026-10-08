import { db, sqlClient } from "@/db";
import {
  optionGroups,
  options,
  orders,
  products,
  restaurants,
  tables,
} from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getValidTableSession } from "@/lib/table-session";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

type CartItemInput = {
  productId: string;
  quantity: number;
  optionIds?: string[];
  note?: string;
};

type OrderPayload = {
  restaurantSlug?: string;
  tableCode?: string;
  sessionToken?: string;
  requestKey?: string;
  items?: CartItemInput[];
  note?: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function money(value: string | number) {
  return Number(Number(value).toFixed(2));
}

export async function POST(request: Request) {
  let payload: OrderPayload;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const restaurantSlug = String(payload.restaurantSlug ?? "").trim();
  const tableCode = String(payload.tableCode ?? "").trim();
  const sessionToken = String(payload.sessionToken ?? "").trim();
  const requestKey = String(payload.requestKey ?? "").trim();
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (
    !restaurantSlug ||
    restaurantSlug.length > 160 ||
    !tableCode ||
    tableCode.length > 64 ||
    !/^[a-f0-9]{64}$/i.test(sessionToken) ||
    requestKey.length < 8 ||
    requestKey.length > 100 ||
    items.length === 0
  ) {
    return Response.json({ error: "O carrinho está vazio ou a mesa é inválida." }, { status: 400 });
  }

  if (items.length > 50) {
    return Response.json({ error: "Pedido muito grande." }, { status: 400 });
  }

  const [restaurant] = await db
    .select({ id: restaurants.id, name: restaurants.name })
    .from(restaurants)
    .where(and(eq(restaurants.slug, restaurantSlug), eq(restaurants.active, true)))
    .limit(1);

  if (!restaurant) {
    return Response.json({ error: "Restaurante indisponível." }, { status: 404 });
  }

  const [table] = await db
    .select({ id: tables.id, name: tables.name })
    .from(tables)
    .where(
      and(
        eq(tables.restaurantId, restaurant.id),
        eq(tables.publicCode, tableCode),
        eq(tables.active, true),
      ),
    )
    .limit(1);

  if (!table) {
    return Response.json({ error: "Mesa indisponível." }, { status: 404 });
  }

  const tableSession = await getValidTableSession({
    token: sessionToken,
    restaurantId: restaurant.id,
    tableId: table.id,
  });

  if (!tableSession?.visitId) {
    return Response.json(
      { error: "Sua sessão da mesa expirou. Reabra o cardápio pelo QR Code." },
      { status: 401 },
    );
  }

  const limit = await checkRateLimit({
    scope: "table-orders",
    identity: tableSession.visitId,
    limit: 12,
    windowMs: 60 * 1000,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const productIds = [...new Set(items.map((item) => String(item.productId ?? "")))];

  if (productIds.some((id) => !isUuid(id))) {
    return Response.json({ error: "Há um produto inválido no pedido." }, { status: 400 });
  }

  const rawOptionIds = items.flatMap((item) =>
    Array.isArray(item.optionIds) ? item.optionIds.map(String) : [],
  );

  if (
    items.some((item) => Array.isArray(item.optionIds) && item.optionIds.length > 40) ||
    rawOptionIds.length > 400 ||
    rawOptionIds.some((id) => !isUuid(id))
  ) {
    return Response.json({ error: "Há opções inválidas no pedido." }, { status: 400 });
  }

  const productRows = await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      available: products.available,
      restaurantId: products.restaurantId,
    })
    .from(products)
    .where(inArray(products.id, productIds));

  const productMap = new Map(productRows.map((product) => [product.id, product]));

  const allOptionIds = [...new Set(rawOptionIds)];

  const optionRows = allOptionIds.length
    ? await db
        .select({
          id: options.id,
          name: options.name,
          additionalPrice: options.additionalPrice,
          available: options.available,
          groupId: options.groupId,
          productId: optionGroups.productId,
          required: optionGroups.required,
          minSelections: optionGroups.minSelections,
          maxSelections: optionGroups.maxSelections,
        })
        .from(options)
        .innerJoin(optionGroups, eq(options.groupId, optionGroups.id))
        .where(inArray(options.id, allOptionIds))
    : [];

  const optionMap = new Map(optionRows.map((option) => [option.id, option]));

  const groupRows = await db
    .select({
      id: optionGroups.id,
      productId: optionGroups.productId,
      required: optionGroups.required,
      minSelections: optionGroups.minSelections,
      maxSelections: optionGroups.maxSelections,
    })
    .from(optionGroups)
    .where(inArray(optionGroups.productId, productIds));

  const normalizedItems: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    note: string | null;
    selectedOptions: Array<{ id: string; name: string; price: number }>;
  }> = [];

  for (const item of items) {
    const quantity = Math.floor(Number(item.quantity));
    const product = productMap.get(String(item.productId));

    if (
      !product ||
      product.restaurantId !== restaurant.id ||
      !product.available ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 30
    ) {
      return Response.json({ error: "Há um item inválido ou indisponível no pedido." }, { status: 400 });
    }

    const selectedIds = Array.isArray(item.optionIds)
      ? [...new Set(item.optionIds.map(String))]
      : [];

    const selectedOptions = selectedIds.map((id) => optionMap.get(id)).filter(Boolean);

    if (selectedOptions.some((option) => !option || !option.available || option.productId !== product.id)) {
      return Response.json({ error: `Uma opção de ${product.name} não está disponível.` }, { status: 400 });
    }

    const groupsForProduct = groupRows.filter((group) => group.productId === product.id);

    for (const group of groupsForProduct) {
      const count = selectedOptions.filter((option) => option?.groupId === group.id).length;

      const minimumRequired = group.required
        ? Math.max(1, group.minSelections)
        : group.minSelections;

      if (count < minimumRequired || count > group.maxSelections) {
        return Response.json(
          { error: `Revise as escolhas obrigatórias de ${product.name}.` },
          { status: 400 },
        );
      }
    }

    const basePrice = money(product.price);
    const extras = selectedOptions.reduce(
      (total, option) => total + money(option!.additionalPrice),
      0,
    );
    const unitPrice = money(basePrice + extras);
    const subtotal = money(unitPrice * quantity);

    normalizedItems.push({
      productId: product.id,
      productName: product.name,
      quantity,
      unitPrice,
      subtotal,
      note: String(item.note ?? "").trim().slice(0, 500) || null,
      selectedOptions: selectedOptions.map((option) => ({
        id: option!.id,
        name: option!.name,
        price: money(option!.additionalPrice),
      })),
    });
  }

  const subtotal = money(normalizedItems.reduce((sum, item) => sum + item.subtotal, 0));
  const total = subtotal;

  let createdOrder: { id: string; number: number; reused: boolean } | null = null;

  try {
    const rows = await sqlClient`
      SELECT order_id, order_number, reused
      FROM create_calori_order(
        ${restaurant.id}::uuid,
        ${table.id}::uuid,
        ${tableSession.visitId}::uuid,
        ${tableSession.id}::uuid,
        ${requestKey},
        ${subtotal.toFixed(2)}::numeric,
        ${total.toFixed(2)}::numeric,
        ${String(payload.note ?? "").trim().slice(0, 500) || null},
        ${JSON.stringify(normalizedItems)}::jsonb
      )
    `;

    const row = rows[0] as
      | { order_id?: string; order_number?: number; reused?: boolean }
      | undefined;

    if (row?.order_id && Number.isFinite(Number(row.order_number))) {
      createdOrder = {
        id: row.order_id,
        number: Number(row.order_number),
        reused: Boolean(row.reused),
      };
    }
  } catch (error) {
    console.error("calori.order.create_failed", {
      restaurantId: restaurant.id,
      tableId: table.id,
      visitId: tableSession.visitId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  if (!createdOrder) {
    return Response.json({ error: "Não conseguimos concluir o pedido. Tente novamente." }, { status: 500 });
  }

  return Response.json({
    ok: true,
    order: {
      id: createdOrder.id,
      number: createdOrder.number,
      status: "new",
      reused: createdOrder.reused,
      total,
      table: table.name,
    },
  });
}
