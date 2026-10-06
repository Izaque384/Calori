"use server";

import { db } from "@/db";
import { categories, optionGroups, options, products } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { assertPermission, canManageCatalog } from "@/lib/permissions";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function moneyToDatabase(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");

  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Preço inválido");
  }

  return amount.toFixed(2);
}

async function assertCategoryOwnership(categoryId: string, restaurantId: string) {
  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.restaurantId, restaurantId)))
    .limit(1);

  return Boolean(category);
}

async function assertProductOwnership(productId: string, restaurantId: string) {
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.restaurantId, restaurantId)))
    .limit(1);

  return Boolean(product);
}

export async function createCategory(formData: FormData) {
  const { restaurant, role } = await requireCurrentRestaurant();
  assertPermission(canManageCatalog(role));
  const name = String(formData.get("name") ?? "").trim();

  if (!name) return;

  const [lastCategory] = await db
    .select({ sortOrder: categories.sortOrder })
    .from(categories)
    .where(eq(categories.restaurantId, restaurant.id))
    .orderBy(desc(categories.sortOrder))
    .limit(1);

  await db.insert(categories).values({
    restaurantId: restaurant.id,
    name,
    sortOrder: (lastCategory?.sortOrder ?? 0) + 1,
  });

  revalidatePath("/dashboard/cardapio");
}

export async function deleteCategory(formData: FormData) {
  const { restaurant, role } = await requireCurrentRestaurant();
  assertPermission(canManageCatalog(role));
  const categoryId = String(formData.get("categoryId") ?? "");

  if (!categoryId || !(await assertCategoryOwnership(categoryId, restaurant.id))) return;

  await db.delete(categories).where(
    and(eq(categories.id, categoryId), eq(categories.restaurantId, restaurant.id)),
  );

  revalidatePath("/dashboard/cardapio");
}

export async function createProduct(formData: FormData) {
  const { restaurant, role } = await requireCurrentRestaurant();
  assertPermission(canManageCatalog(role));

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const price = moneyToDatabase(formData.get("price"));

  if (!name) return;

  if (categoryId && !(await assertCategoryOwnership(categoryId, restaurant.id))) {
    throw new Error("Categoria inválida");
  }

  await db.insert(products).values({
    restaurantId: restaurant.id,
    categoryId: categoryId || null,
    name,
    description: description || null,
    price,
    available: true,
  });

  revalidatePath("/dashboard/cardapio");
}

export async function toggleProductAvailability(formData: FormData) {
  const { restaurant, role } = await requireCurrentRestaurant();
  assertPermission(canManageCatalog(role));
  const productId = String(formData.get("productId") ?? "");
  const available = String(formData.get("available") ?? "") === "true";

  if (!productId || !(await assertProductOwnership(productId, restaurant.id))) return;

  await db
    .update(products)
    .set({ available: !available, updatedAt: new Date() })
    .where(and(eq(products.id, productId), eq(products.restaurantId, restaurant.id)));

  revalidatePath("/dashboard/cardapio");
}

export async function deleteProduct(formData: FormData) {
  const { restaurant, role } = await requireCurrentRestaurant();
  assertPermission(canManageCatalog(role));
  const productId = String(formData.get("productId") ?? "");

  if (!productId || !(await assertProductOwnership(productId, restaurant.id))) return;

  await db.delete(products).where(
    and(eq(products.id, productId), eq(products.restaurantId, restaurant.id)),
  );

  revalidatePath("/dashboard/cardapio");
}

export async function createOptionGroup(formData: FormData) {
  const { restaurant, role } = await requireCurrentRestaurant();
  assertPermission(canManageCatalog(role));

  const productId = String(formData.get("productId") ?? "");
  const name = String(formData.get("groupName") ?? "").trim();
  const required = formData.get("required") === "on";
  const maxSelections = Math.max(1, Number(formData.get("maxSelections") ?? 1) || 1);

  if (!productId || !name || !(await assertProductOwnership(productId, restaurant.id))) return;

  await db.insert(optionGroups).values({
    productId,
    name,
    required,
    minSelections: required ? 1 : 0,
    maxSelections,
  });

  revalidatePath("/dashboard/cardapio");
}

export async function createOption(formData: FormData) {
  const { restaurant, role } = await requireCurrentRestaurant();
  assertPermission(canManageCatalog(role));

  const groupId = String(formData.get("groupId") ?? "");
  const name = String(formData.get("optionName") ?? "").trim();
  const additionalPrice = moneyToDatabase(formData.get("additionalPrice"));

  if (!groupId || !name) return;

  const [group] = await db
    .select({ productId: optionGroups.productId })
    .from(optionGroups)
    .where(eq(optionGroups.id, groupId))
    .limit(1);

  if (!group || !(await assertProductOwnership(group.productId, restaurant.id))) return;

  await db.insert(options).values({
    groupId,
    name,
    additionalPrice,
    available: true,
  });

  revalidatePath("/dashboard/cardapio");
}

export async function toggleOptionAvailability(formData: FormData) {
  const { restaurant, role } = await requireCurrentRestaurant();
  assertPermission(canManageCatalog(role));

  const optionId = String(formData.get("optionId") ?? "");
  const available = String(formData.get("available") ?? "") === "true";

  const [record] = await db
    .select({
      optionId: options.id,
      productId: optionGroups.productId,
    })
    .from(options)
    .innerJoin(optionGroups, eq(options.groupId, optionGroups.id))
    .where(eq(options.id, optionId))
    .limit(1);

  if (!record || !(await assertProductOwnership(record.productId, restaurant.id))) return;

  await db
    .update(options)
    .set({ available: !available })
    .where(eq(options.id, optionId));

  revalidatePath("/dashboard/cardapio");
}
