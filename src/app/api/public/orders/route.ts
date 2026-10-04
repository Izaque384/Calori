import { db } from "@/db";
import {
  optionGroups,
  options,
  orderItemOptions,
  orderItems,
  orders,
  products,
  restaurants,
  tables,
} from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";

type CartItemInput = {
  productId: string;
  quantity: number;
  optionIds?: string[];
  note?: string;
};

type OrderPayload = {
  restaurantSlug?: string;
  tableCode?: string;
  items?: CartItemInput[];
  note?: string;
};

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
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (!restaurantSlug || !tableCode || items.length === 0) {
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

  const productIds = [...new Set(items.map((item) => String(item.productId ?? "")))];

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

  const allOptionIds = [
    ...new Set(
      items.flatMap((item) =>
        Array.isArray(item.optionIds) ? item.optionIds.map(String) : [],
      ),
    ),
  ];

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

      if (count < group.minSelections || count > group.maxSelections) {
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

  const [lastOrder] = await db
    .select({ number: orders.number })
    .from(orders)
    .where(eq(orders.restaurantId, restaurant.id))
    .orderBy(desc(orders.number))
    .limit(1);

  let nextNumber = (lastOrder?.number ?? 0) + 1;
  let createdOrder: { id: string; number: number } | undefined;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      [createdOrder] = await db
        .insert(orders)
        .values({
          restaurantId: restaurant.id,
          tableId: table.id,
          number: nextNumber,
          status: "new",
          subtotal: subtotal.toFixed(2),
          total: total.toFixed(2),
          note: String(payload.note ?? "").trim().slice(0, 500) || null,
        })
        .returning({ id: orders.id, number: orders.number });

      break;
    } catch {
      nextNumber += 1;
    }
  }

  if (!createdOrder) {
    return Response.json({ error: "Não conseguimos criar o pedido. Tente novamente." }, { status: 500 });
  }

  try {
    for (const item of normalizedItems) {
      const [createdItem] = await db
        .insert(orderItems)
        .values({
          orderId: createdOrder.id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toFixed(2),
          subtotal: item.subtotal.toFixed(2),
          note: item.note,
        })
        .returning({ id: orderItems.id });

      if (item.selectedOptions.length) {
        await db.insert(orderItemOptions).values(
          item.selectedOptions.map((option) => ({
            orderItemId: createdItem.id,
            optionId: option.id,
            name: option.name,
            price: option.price.toFixed(2),
          })),
        );
      }
    }
  } catch {
    await db.delete(orders).where(eq(orders.id, createdOrder.id));
    return Response.json({ error: "Não conseguimos concluir o pedido. Tente novamente." }, { status: 500 });
  }

  return Response.json({
    ok: true,
    order: {
      id: createdOrder.id,
      number: createdOrder.number,
      status: "new",
      total,
      table: table.name,
    },
  });
}
