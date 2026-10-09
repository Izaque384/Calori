import { db } from "@/db";
import DashboardSidebar from "@/components/dashboard-sidebar";
import ServiceWaitTime from "@/components/service-wait-time";
import { orders, serviceRequests, tables } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { cancelServiceRequest, handleServiceRequest } from "./actions";
import ServiceMonitor from "./service-monitor";

export const dynamic = "force-dynamic";

function requestLabel(type: string) { return type === "request_bill" ? "Conta solicitada" : "Atendimento"; }
function statusLabel(status: string) { if (status === "handled") return "Atendida"; if (status === "cancelled") return "Cancelada"; return "Pendente"; }

export default async function ServicePage() {
  const { restaurant, role } = await requireCurrentRestaurant();

  const rows = await db.select({
    id: serviceRequests.id,
    type: serviceRequests.type,
    status: serviceRequests.status,
    note: serviceRequests.note,
    createdAt: serviceRequests.createdAt,
    handledAt: serviceRequests.handledAt,
    sessionId: serviceRequests.sessionId,
    visitId: serviceRequests.visitId,
    tableId: serviceRequests.tableId,
    tableName: tables.name,
  }).from(serviceRequests)
    .innerJoin(tables, eq(serviceRequests.tableId, tables.id))
    .where(eq(serviceRequests.restaurantId, restaurant.id))
    .orderBy(desc(serviceRequests.createdAt));

  const pending = rows.filter((row) => row.status === "pending").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const history = rows.filter((row) => row.status !== "pending").slice(0, 20);

  const pendingBillVisitIds = [...new Set(pending.filter((row) => row.type === "request_bill" && row.visitId).map((row) => row.visitId!))];
  const billOrders = pendingBillVisitIds.length
    ? await db.select({ visitId: orders.visitId, total: orders.total }).from(orders).where(and(
        eq(orders.restaurantId, restaurant.id),
        inArray(orders.visitId, pendingBillVisitIds),
        ne(orders.status, "cancelled"),
      ))
    : [];

  const totalsByVisit = new Map<string, { total: number; count: number }>();
  for (const order of billOrders) {
    if (!order.visitId) continue;
    const current = totalsByVisit.get(order.visitId) ?? { total: 0, count: 0 };
    current.total += Number(order.total);
    current.count += 1;
    totalsByVisit.set(order.visitId, current);
  }

  const oldest = pending[0]?.createdAt ?? null;

  return (
    <main className="dashboard-shell">
      <DashboardSidebar restaurantName={restaurant.name} role={role} activePath="/dashboard/atendimento" />
      <section className="dashboard-content menu-content">
        <div className="page-heading-row">
          <div>
            <p className="eyebrow">Central de atendimento</p>
            <h1>Quem espera mais aparece primeiro.</h1>
            <p className="muted">Chamados organizados por tempo, contexto da mesa e urgência para a equipe saber exatamente onde agir.</p>
          </div>
          <div className="service-heading-summary">
            <div className={pending.length ? "status-chip attention" : "status-chip"}>{pending.length} pendentes</div>
            {oldest && <ServiceWaitTime createdAt={oldest.toISOString()} />}
          </div>
        </div>

        <ServiceMonitor initialRequests={pending.map((request) => ({
          id: request.id,
          type: request.type,
          tableName: request.tableName,
          note: request.note,
          createdAt: request.createdAt.toISOString(),
        }))} />

        <section className="service-queue">
          {pending.length === 0 ? (
            <div className="large-empty-state">
              <strong>Salão sem chamados pendentes.</strong>
              <span>Quando alguém pedir atendimento ou a conta, a fila aparece aqui automaticamente.</span>
            </div>
          ) : pending.map((request, index) => {
            const billSummary = request.type === "request_bill" ? totalsByVisit.get(request.visitId ?? "") : undefined;
            return (
              <article className={`service-queue-card ${request.type}`} key={request.id}>
                <div className="service-queue-rank">{String(index + 1).padStart(2, "0")}</div>
                <div className="service-queue-main">
                  <div className="service-queue-topline">
                    <span className={`service-type ${request.type}`}>{requestLabel(request.type)}</span>
                    <ServiceWaitTime createdAt={request.createdAt.toISOString()} />
                  </div>
                  <h2>{request.tableName}</h2>
                  {request.note ? <p className="service-note">“{request.note}”</p> : <p className="service-note muted-note">Sem observação adicional.</p>}
                  {request.type === "request_bill" && (
                    <div className="service-bill-summary compact">
                      <span>Consumo da mesa</span>
                      <strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(billSummary?.total ?? 0)}</strong>
                      <small>{billSummary?.count ?? 0} {(billSummary?.count ?? 0) === 1 ? "pedido" : "pedidos"}</small>
                    </div>
                  )}
                </div>
                <div className="service-queue-actions">
                  <form action={handleServiceRequest}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <button className="primary-button" type="submit">{request.type === "request_bill" ? "Conta atendida" : "Atendimento concluído"}</button>
                  </form>
                  <form action={cancelServiceRequest}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <button className="text-button danger" type="submit">Cancelar</button>
                  </form>
                </div>
              </article>
            );
          })}
        </section>

        {history.length > 0 && (
          <section className="service-history">
            <div className="section-title"><div><span className="section-kicker">Recentes</span><h2>Histórico</h2></div></div>
            <div className="service-history-list">
              {history.map((request) => (
                <div key={request.id}>
                  <div><strong>{request.tableName}</strong><span>{requestLabel(request.type)}</span></div>
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
