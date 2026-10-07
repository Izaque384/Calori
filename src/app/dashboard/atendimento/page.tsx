import { db } from "@/db";
import DashboardSidebar from "@/components/dashboard-sidebar";
import { orders, serviceRequests, tableSessions, tables } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { and, desc, eq, gt, inArray, ne } from "drizzle-orm";
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
  const { restaurant, role } = await requireCurrentRestaurant();

  const rows = await db
    .select({
      id: serviceRequests.id,
      type: serviceRequests.type,
      status: serviceRequests.status,
      createdAt: serviceRequests.createdAt,
      handledAt: serviceRequests.handledAt,
      sessionId: serviceRequests.sessionId,
      tableId: serviceRequests.tableId,
      tableName: tables.name,
    })
    .from(serviceRequests)
    .innerJoin(tables, eq(serviceRequests.tableId, tables.id))
    .where(eq(serviceRequests.restaurantId, restaurant.id))
    .orderBy(desc(serviceRequests.createdAt));

  const pending = rows.filter((row) => row.status === "pending");
  const history = rows.filter((row) => row.status !== "pending").slice(0, 20);

  const pendingBillTableIds = [
    ...new Set(
      pending
        .filter((row) => row.type === "request_bill")
        .map((row) => row.tableId),
    ),
  ];

  const activeBillSessions = pendingBillTableIds.length
    ? await db
        .select({
          id: tableSessions.id,
          tableId: tableSessions.tableId,
        })
        .from(tableSessions)
        .where(
          and(
            eq(tableSessions.restaurantId, restaurant.id),
            inArray(tableSessions.tableId, pendingBillTableIds),
            gt(tableSessions.expiresAt, new Date()),
          ),
        )
    : [];

  const activeBillSessionIds = activeBillSessions.map((session) => session.id);

  const billOrders = activeBillSessionIds.length
    ? await db
        .select({
          sessionId: orders.sessionId,
          total: orders.total,
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurant.id),
            inArray(orders.sessionId, activeBillSessionIds),
            ne(orders.status, "cancelled"),
          ),
        )
    : [];

  const tableBySession = new Map(
    activeBillSessions.map((session) => [session.id, session.tableId]),
  );
  const totalsByTable = new Map<string, { total: number; count: number }>();

  for (const order of billOrders) {
    if (!order.sessionId) continue;
    const tableId = tableBySession.get(order.sessionId);
    if (!tableId) continue;

    const current = totalsByTable.get(tableId) ?? { total: 0, count: 0 };
    current.total += Number(order.total);
    current.count += 1;
    totalsByTable.set(tableId, current);
  }

  return (
    <main className="dashboard-shell">
      <DashboardSidebar restaurantName={restaurant.name} role={role} activePath="/dashboard/atendimento" />

      <section className="dashboard-content menu-content">
        <div className="page-heading-row">
          <div>
            <p className="eyebrow">Atendimento</p>
            <h1>Atenda no tempo certo.</h1>
            <p className="muted">Chamados e pedidos de conta chegam aqui para sua equipe responder rápido, sem tirar o toque humano do serviço.</p>
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
              const billSummary =
                request.type === "request_bill"
                  ? totalsByTable.get(request.tableId)
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
                    <span>Consumo da mesa</span>
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
