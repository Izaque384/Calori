import { db } from "@/db";
import { tables } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { signOut } from "../actions";
import { createTable, toggleTable } from "./actions";

export const dynamic = "force-dynamic";

export default async function TablesPage() {
  const { restaurant } = await requireCurrentRestaurant();

  const rows = await db
    .select()
    .from(tables)
    .where(eq(tables.restaurantId, restaurant.id))
    .orderBy(asc(tables.name));

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="brand">Calori<span>.</span></div>
        <div className="restaurant-pill">{restaurant.name}</div>
        <nav>
          <a href="/dashboard">Visão geral</a>
          <span>Pedidos</span>
          <a href="/dashboard/cardapio">Cardápio</a>
          <a className="active" href="/dashboard/mesas">Mesas</a>
          <span>Configurações</span>
        </nav>
        <form action={signOut}><button className="ghost-button" type="submit">Sair</button></form>
      </aside>

      <section className="dashboard-content menu-content">
        <div className="page-heading-row">
          <div>
            <p className="eyebrow">Mesas</p>
            <h1>Organize o salão.</h1>
            <p className="muted">Cada mesa recebe um endereço público e um QR Code próprio para abrir o cardápio correto.</p>
          </div>
          <div className="status-chip">{rows.filter((row) => row.active).length} ativas</div>
        </div>

        <section className="panel-card tables-create-card">
          <div className="section-title">
            <div>
              <span className="section-kicker">Nova mesa</span>
              <h2>Adicionar mesa</h2>
            </div>
          </div>
          <form action={createTable} className="inline-form">
            <input name="name" required placeholder="Ex.: Mesa 1, Varanda 2..." />
            <button className="primary-button compact" type="submit">Criar mesa</button>
          </form>
        </section>

        <section className="products-section">
          <div className="section-title">
            <div>
              <span className="section-kicker">Salão</span>
              <h2>Mesas cadastradas</h2>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="large-empty-state">
              <strong>Nenhuma mesa cadastrada.</strong>
              <span>Crie a primeira mesa acima para gerar o QR Code de acesso ao cardápio.</span>
            </div>
          ) : (
            <div className="table-card-grid">
              {rows.map((table) => (
                <article className="table-card" key={table.id}>
                  <div className="table-card-head">
                    <div>
                      <span className="product-category">{table.active ? "Ativa" : "Pausada"}</span>
                      <h3>{table.name}</h3>
                    </div>
                    <span className="table-code">{table.publicCode}</span>
                  </div>

                  <p>QR exclusivo para esta mesa. O cliente será levado direto ao cardápio de {restaurant.name}.</p>

                  <div className="table-card-actions">
                    <Link className="secondary-link-button" href={`/dashboard/mesas/${table.id}/qr`}>Ver QR Code</Link>
                    <Link className="text-link-button" href={`/r/${restaurant.slug}/m/${table.publicCode}`} target="_blank">Abrir cardápio</Link>
                    <form action={toggleTable}>
                      <input type="hidden" name="tableId" value={table.id} />
                      <input type="hidden" name="active" value={String(table.active)} />
                      <button className={table.active ? "availability-button on" : "availability-button off"} type="submit">
                        {table.active ? "Ativa" : "Pausada"}
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
