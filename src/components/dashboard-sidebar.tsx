import Link from "next/link";
import CaloriBrand from "@/components/calori-brand";
import { signOut } from "@/app/dashboard/actions";
import type { RestaurantRole } from "@/lib/permissions";

type Props = {
  restaurantName: string;
  role: RestaurantRole;
  activePath: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: "home" | "orders" | "tables" | "service" | "menu" | "reports" | "team" | "plan" | "settings";
};

function NavIcon({ icon }: { icon: NavItem["icon"] }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (icon === "home") return <svg {...common}><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>;
  if (icon === "orders") return <svg {...common}><path d="M7 3h10l2 4H5l2-4Z"/><path d="M5 7v14h14V7"/><path d="M9 11h6M9 15h6"/></svg>;
  if (icon === "tables") return <svg {...common}><path d="M4 9h16M6 9l1-5h10l1 5M7 9v11M17 9v11M5 15h14"/></svg>;
  if (icon === "service") return <svg {...common}><path d="M4 16h16M6 16a6 6 0 0 1 12 0M12 6v2"/><path d="M9 4h6"/></svg>;
  if (icon === "menu") return <svg {...common}><path d="M6 3v18M10 4h8M10 9h8M10 14h8M10 19h8"/></svg>;
  if (icon === "reports") return <svg {...common}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>;
  if (icon === "team") return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15 15a5 5 0 0 1 6 5"/></svg>;
  if (icon === "plan") return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>;
}

function NavLink({ item, activePath }: { item: NavItem; activePath: string }) {
  const active = activePath === item.href;
  return (
    <Link className={active ? "active" : ""} href={item.href} aria-current={active ? "page" : undefined}>
      <NavIcon icon={item.icon} />
      <span>{item.label}</span>
    </Link>
  );
}

export default function DashboardSidebar({ restaurantName, role, activePath }: Props) {
  const operation: NavItem[] = [
    { href: "/dashboard", label: "Visão geral", icon: "home" },
    { href: "/dashboard/pedidos", label: "Pedidos", icon: "orders" },
    { href: "/dashboard/mesas", label: "Mesas", icon: "tables" },
    { href: "/dashboard/atendimento", label: "Atendimento", icon: "service" },
  ];

  const management: NavItem[] = [];
  if (role !== "staff") {
    management.push(
      { href: "/dashboard/cardapio", label: "Cardápio", icon: "menu" },
      { href: "/dashboard/relatorios", label: "Relatórios", icon: "reports" },
    );
  }
  if (role === "owner") {
    management.push(
      { href: "/dashboard/equipe", label: "Equipe", icon: "team" },
      { href: "/dashboard/assinatura", label: "Assinatura", icon: "plan" },
      { href: "/dashboard/configuracoes", label: "Configurações", icon: "settings" },
    );
  }

  return (
    <aside className="dashboard-sidebar">
      <div className="dashboard-sidebar-brand">
        <CaloriBrand compact />
        <span className="dashboard-product-label">Restaurante</span>
      </div>

      <div className="restaurant-pill">
        <span className="restaurant-pill-dot" />
        <div>
          <small>Você está em</small>
          <strong>{restaurantName}</strong>
        </div>
      </div>

      <nav className="dashboard-nav" aria-label="Navegação do painel">
        <div className="dashboard-nav-section">
          <span className="dashboard-nav-label">Operação</span>
          {operation.map((item) => <NavLink key={item.href} item={item} activePath={activePath} />)}
        </div>

        {management.length > 0 && (
          <div className="dashboard-nav-section">
            <span className="dashboard-nav-label">Gestão</span>
            {management.map((item) => <NavLink key={item.href} item={item} activePath={activePath} />)}
          </div>
        )}
      </nav>

      <div className="dashboard-sidebar-footer">
        <div className="dashboard-brand-note">
          <span />
          <div>
            <strong>Calori</strong>
            <small>Simples, elegante e próximo.</small>
          </div>
        </div>
        <form action={signOut}>
          <button className="dashboard-signout" type="submit">Sair</button>
        </form>
      </div>
    </aside>
  );
}
