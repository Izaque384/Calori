import { db } from "@/db";
import { restaurants } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { signOut } from "../actions";
import { updateRestaurantSettings } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { restaurant, role } = await requireCurrentRestaurant();

  if (role !== "owner") redirect("/dashboard");

  const [settings] = await db
    .select({
      name: restaurants.name,
      slug: restaurants.slug,
      logoUrl: restaurants.logoUrl,
      primaryColor: restaurants.primaryColor,
      phone: restaurants.phone,
      address: restaurants.address,
    })
    .from(restaurants)
    .where(eq(restaurants.id, restaurant.id))
    .limit(1);

  const canEdit = true;

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="brand">Calori<span>.</span></div>
        <div className="restaurant-pill">{settings.name}</div>
        <nav>
          <a href="/dashboard">Visão geral</a>
          <a href="/dashboard/pedidos">Pedidos</a>
          <a href="/dashboard/cardapio">Cardápio</a>
          <a href="/dashboard/mesas">Mesas</a>
          <a href="/dashboard/atendimento">Atendimento</a>
          <a href="/dashboard/equipe">Equipe</a>
          <a className="active" href="/dashboard/configuracoes">Configurações</a>
        </nav>
        <form action={signOut}><button className="ghost-button" type="submit">Sair</button></form>
      </aside>

      <section className="dashboard-content settings-content">
        <div className="page-heading-row">
          <div>
            <p className="eyebrow">Configurações</p>
            <h1>Identidade do restaurante.</h1>
            <p className="muted">Essas informações aparecem no cardápio público e ajudam a manter a experiência com a identidade do seu negócio.</p>
          </div>
        </div>

        <form action={updateRestaurantSettings} className="settings-form">
          <section className="settings-card">
            <div className="settings-card-heading">
              <div>
                <span className="section-kicker">Perfil</span>
                <h2>Informações principais</h2>
              </div>
            </div>

            <div className="settings-fields">
              <label>
                Nome do restaurante
                <input name="name" defaultValue={settings.name} required minLength={2} maxLength={100} disabled={!canEdit} />
              </label>

              <label>
                Endereço público
                <input name="address" defaultValue={settings.address ?? ""} maxLength={300} placeholder="Rua, número, bairro e cidade" disabled={!canEdit} />
              </label>

              <label>
                Telefone
                <input name="phone" defaultValue={settings.phone ?? ""} maxLength={40} placeholder="(00) 00000-0000" disabled={!canEdit} />
              </label>

              <label>
                URL da logo
                <input name="logoUrl" defaultValue={settings.logoUrl ?? ""} maxLength={500} placeholder="https://..." disabled={!canEdit} />
              </label>
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-card-heading">
              <div>
                <span className="section-kicker">Aparência</span>
                <h2>Cor do cardápio</h2>
              </div>
              <div className="color-preview" style={{ background: settings.primaryColor || "#C75A3A" }} />
            </div>

            <div className="settings-fields compact">
              <label>
                Cor principal
                <div className="color-field">
                  <input type="color" name="primaryColor" defaultValue={settings.primaryColor || "#C75A3A"} disabled={!canEdit} />
                  <span>{settings.primaryColor || "#C75A3A"}</span>
                </div>
              </label>

              <label>
                Endereço do cardápio
                <input value={`/r/${settings.slug}/m/CODIGO-DA-MESA`} readOnly />
                <small>O código final muda para cada mesa e já é incluído automaticamente nos QR Codes.</small>
              </label>
            </div>
          </section>

          {!canEdit && (
            <p className="settings-readonly">Sua função atual permite visualizar, mas não alterar estas configurações.</p>
          )}

          {canEdit && (
            <div className="settings-actions">
              <button className="primary-button" type="submit">Salvar alterações</button>
            </div>
          )}
        </form>
      </section>
    </main>
  );
}
