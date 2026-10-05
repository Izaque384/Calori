import { db } from "@/db";
import { orders, serviceRequests, tables } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { desc, eq, inArray, ne } from "drizzle-orm";
import { signOut } from "../actions";
import { cancelServiceRequest, handleServiceRequest } from "./actions";
import ServiceMonitor from "./service-monitor";

export const dynamic = "force-dynamic";

function requestLabel(type: string) {
  return type === "request_bill" ? "Pedir a conta" : "Chamar garçom";
}

function statusLabel(status: string) {
  if (status === "handled") return "Atendida";
  if (status === "cancelled") return "Cancelada";
  return "Pendente";
}

export default async function ServicePage() {
  const { restaurant } = await requireCurrentRestaurant();

  const rows = await db
    .select({
      id: serviceRequests.id,
      type: serviceRequests.type,
      status: serviceRequests.status,
      createdAt: serviceRequests.createdAt,
      handledAt: serviceRequests.handledAt,
      sessionId: serviceRequests.sessionId,
      tableName: tables.name,
    })
    .from(serviceRequests)
    .innerJoin(tables, eq(serviceRequests.tableId, tables.id))
    .where(eq(serviceRequests.restaurantId, restaurant.id))
    .orderBy(desc(serviceRequests.createdAt));

  const pending = rows.filter((row) => row.status === "pending");
  const history = rows.filter((row) => row.status !== "pending").slice(0, 20);

  const pendingBillSessionIds = pending
    .filter((row) => row.type === "request_bill" && row.sessionId)
    .map((row) => row.sessionId as string);

  const billOrders = pendingBillSessionIds.length
    ? await db
        .select({
          sessionId: orders.sessionId,
          total: orders.total,
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurant.id),
            inArray(orders.sessionId, pendingBillSessionIds),
            ne(orders.status, "cancelled"),
          ),
        )
    : [];

  const totalsBySession = new Map<string, { total: number; count: number }>();
  for (const order of billOrders) {
    if (!order.sessionId) continue;
    const current = totalsBySession.get(order.sessionId) ?? { total: 0, count: 0 };
    current.total += Number(order.total);
    current.count += 1;
    totalsBySession.set(order.sessionId, current);
  }

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="brand">Calori<span>.</span></div>
        <div className="restaurant-pill">{restaurant.name}</div>
        <nav>
          <a href="/dashboard">Visão geral</a>
          <a href="/dashboard/pedidos">Pedidos</a>
          <a href="/dashboard/cardapio">Cardápio</a>
          <a href="/dashboard/mesas">Mesas</a>
          <a className="active" href="/dashboard/atendimento">Atendimento</a>
          <a href="/dashboard/configuracoes">Configurações</a>
        </nav>
        <form action={signOut}><button className="ghost-button" type="submit">Sair</button></form>
      </aside>

      <section className="dashboard-content menu-content">
        <div className="page-heading-row">
          <div>
            <p className="eyebrow">Atendimento</p>
            <h1>Chamados das mesas.</h1>
            <p className="muted">Veja quem chamou o garçom ou pediu a conta e marque cada solicitação assim que for resolvida.</p>
          </div>
          <div className="status-chip">{pending.length} pendentes</div>
        </div>

        <ServiceMonitor
          initialRequests={pending.map((request) => ({
            id: request.id,
            type: request.type,
            tableName: request.tableName,
            createdAt: request.createdAt.toISOString(),
          }))}
        />

        <section className="service-grid">
          {pending.length === 0 ? (
            <div className="large-empty-state">
              <strong>Nenhuma solicitação pendente.</strong>
              <span>Quando um cliente chamar o atendimento ou pedir a conta, aparecerá aqui.</span>
            </div>
          ) : (
            pending.map((request) => {
              const billSummary = request.sessionId
                ? totalsBySession.get(request.sessionId)
                : undefined;

              return (
              <article className="service-card" key={request.id}>
                <span className={`service-type ${request.type}`}>
                  {requestLabel(request.type)}
                </span>
                <h2>{request.tableName}</h2>
                <p>
                  Solicitado às {new Date(request.createdAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>

                {request.type === "request_bill" && (
                  <div className="service-bill-summary">
                    <span>Consumo da sessão</span>
                    <strong>
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(billSummary?.total ?? 0)}
                    </strong>
                    <small>
                      {billSummary?.count ?? 0} {(billSummary?.count ?? 0) === 1 ? "pedido" : "pedidos"}
                    </small>
                  </div>
                )}

                <div className="service-card-actions">
                  <form action={handleServiceRequest}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <button className="primary-button" type="submit">
                      {request.type === "request_bill" ? "Encerrar conta" : "Marcar como atendida"}
                    </button>
                  </form>
                  <form action={cancelServiceRequest}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <button className="text-button danger" type="submit">Cancelar</button>
                  </form>
                </div>
              </article>
              );
            })
          )}
        </section>

        {history.length > 0 && (
          <section className="service-history">
            <div className="section-title">
              <div>
                <span className="section-kicker">Recentes</span>
                <h2>Histórico</h2>
              </div>
            </div>

            <div className="service-history-list">
              {history.map((request) => (
                <div key={request.id}>
                  <div>
                    <strong>{request.tableName}</strong>
                    <span>{requestLabel(request.type)}</span>
                  </div>
                  <span>{statusLabel(request.status)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
