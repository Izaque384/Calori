import { db } from "@/db";
import { categories, optionGroups, options, products, restaurants, tables } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import PublicMenuClient from "./menu-client";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ restaurante: string; mesa: string }> };

export default async function PublicMenuPage({ params }: Props) {
  const { restaurante, mesa } = await params;

  const [restaurant] = await db
    .select({
      id: restaurants.id,
      name: restaurants.name,
      slug: restaurants.slug,
      primaryColor: restaurants.primaryColor,
      logoUrl: restaurants.logoUrl,
      phone: restaurants.phone,
      address: restaurants.address,
    })
    .from(restaurants)
    .where(and(eq(restaurants.slug, restaurante), eq(restaurants.active, true)))
    .limit(1);

  if (!restaurant) notFound();

  const [table] = await db
    .select({ id: tables.id, name: tables.name, publicCode: tables.publicCode })
    .from(tables)
    .where(
      and(
        eq(tables.restaurantId, restaurant.id),
        eq(tables.publicCode, mesa),
        eq(tables.active, true),
      ),
    )
    .limit(1);

  if (!table) notFound();

  const [categoryRows, productRows, groupRows, optionRows] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(and(eq(categories.restaurantId, restaurant.id), eq(categories.active, true)))
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
    db
      .select()
      .from(products)
      .where(and(eq(products.restaurantId, restaurant.id), eq(products.available, true)))
      .orderBy(asc(products.sortOrder), asc(products.name)),
    db
      .select({
        id: optionGroups.id,
        productId: optionGroups.productId,
        name: optionGroups.name,
        required: optionGroups.required,
        minSelections: optionGroups.minSelections,
        maxSelections: optionGroups.maxSelections,
        sortOrder: optionGroups.sortOrder,
      })
      .from(optionGroups)
      .orderBy(asc(optionGroups.sortOrder)),
    db
      .select({
        id: options.id,
        groupId: options.groupId,
        name: options.name,
        additionalPrice: options.additionalPrice,
        available: options.available,
        sortOrder: options.sortOrder,
      })
      .from(options)
      .where(eq(options.available, true))
      .orderBy(asc(options.sortOrder), asc(options.name)),
  ]);

  const productIds = new Set(productRows.map((product) => product.id));
  const relevantGroups = groupRows.filter((group) => productIds.has(group.productId));
  const groupIds = new Set(relevantGroups.map((group) => group.id));
  const relevantOptions = optionRows.filter((option) => groupIds.has(option.groupId));

  const groups = relevantGroups.map((group) => ({
    id: group.id,
    productId: group.productId,
    name: group.name,
    required: group.required,
    minSelections: group.minSelections,
    maxSelections: group.maxSelections,
    options: relevantOptions
      .filter((option) => option.groupId === group.id)
      .map((option) => ({
        id: option.id,
        groupId: option.groupId,
        name: option.name,
        price: Number(option.additionalPrice),
      })),
  }));

  return (
    <main
      className="public-menu-shell"
      style={{ "--restaurant-accent": restaurant.primaryColor || "#c75a3a" } as CSSProperties}
    >
      <header className="public-menu-header">
        <div className="public-restaurant-identity">
          {restaurant.logoUrl ? (
            <img className="public-restaurant-logo" src={restaurant.logoUrl} alt={`Logo de ${restaurant.name}`} />
          ) : (
            <span className="public-menu-brand">Calori<span>.</span></span>
          )}
          <div>
            <strong>{restaurant.name}</strong>
            {(restaurant.address || restaurant.phone) && (
              <p>
                {[restaurant.address, restaurant.phone].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="public-table-pill">{table.name}</div>
      </header>

      <section className="public-menu-hero">
        <span>Cardápio digital</span>
        <h1>Escolha com calma.</h1>
        <p>Monte seu pedido, personalize os itens e envie direto para o restaurante.</p>
      </section>

      {productRows.length === 0 ? (
        <div className="public-empty">
          <strong>O cardápio ainda está sendo preparado.</strong>
          <span>Volte em alguns instantes.</span>
        </div>
      ) : (
        <PublicMenuClient
          restaurantSlug={restaurant.slug}
          tableCode={table.publicCode}
          categories={categoryRows.map((category) => ({
            id: category.id,
            name: category.name,
          }))}
          products={productRows.map((product) => ({
            id: product.id,
            categoryId: product.categoryId,
            name: product.name,
            description: product.description,
            imageUrl: product.imageUrl,
            featured: product.featured,
            price: Number(product.price),
          }))}
          optionGroups={groups}
        />
      )}
    </main>
  );
}
