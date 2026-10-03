import { db } from "@/db";
import { categories, products, restaurants, tables } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ restaurante: string; mesa: string }> };

function formatMoney(value: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

export default async function PublicMenuPage({ params }: Props) {
  const { restaurante, mesa } = await params;

  const [restaurant] = await db
    .select({
      id: restaurants.id,
      name: restaurants.name,
      slug: restaurants.slug,
      primaryColor: restaurants.primaryColor,
    })
    .from(restaurants)
    .where(and(eq(restaurants.slug, restaurante), eq(restaurants.active, true)))
    .limit(1);

  if (!restaurant) notFound();

  const [table] = await db
    .select({ id: tables.id, name: tables.name })
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

  const [categoryRows, productRows] = await Promise.all([
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
  ]);

  const uncategorized = productRows.filter((product) => !product.categoryId);

  return (
    <main className="public-menu-shell" style={{ "--restaurant-accent": restaurant.primaryColor || "#c75a3a" } as CSSProperties}>
      <header className="public-menu-header">
        <div>
          <span className="public-menu-brand">Calori<span>.</span></span>
          <p>{restaurant.name}</p>
        </div>
        <div className="public-table-pill">{table.name}</div>
      </header>

      <section className="public-menu-hero">
        <span>Cardápio digital</span>
        <h1>Escolha com calma.</h1>
        <p>Veja o que está disponível agora. Em breve, você também poderá montar e enviar o pedido direto por aqui.</p>
      </section>

      {productRows.length === 0 ? (
        <div className="public-empty">
          <strong>O cardápio ainda está sendo preparado.</strong>
          <span>Volte em alguns instantes.</span>
        </div>
      ) : (
        <section className="public-menu-sections">
          {categoryRows.map((category) => {
            const items = productRows.filter((product) => product.categoryId === category.id);
            if (!items.length) return null;

            return (
              <section className="public-category" key={category.id}>
                <div className="public-category-heading">
                  <span>{category.name}</span>
                  <small>{items.length} {items.length === 1 ? "item" : "itens"}</small>
                </div>
                <div className="public-product-list">
                  {items.map((product) => (
                    <article className="public-product-card" key={product.id}>
                      <div>
                        <h2>{product.name}</h2>
                        {product.description && <p>{product.description}</p>}
                      </div>
                      <strong>{formatMoney(product.price)}</strong>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}

          {uncategorized.length > 0 && (
            <section className="public-category">
              <div className="public-category-heading">
                <span>Outros</span>
                <small>{uncategorized.length} {uncategorized.length === 1 ? "item" : "itens"}</small>
              </div>
              <div className="public-product-list">
                {uncategorized.map((product) => (
                  <article className="public-product-card" key={product.id}>
                    <div>
                      <h2>{product.name}</h2>
                      {product.description && <p>{product.description}</p>}
                    </div>
                    <strong>{formatMoney(product.price)}</strong>
                  </article>
                ))}
              </div>
            </section>
          )}
        </section>
      )}
    </main>
  );
}
