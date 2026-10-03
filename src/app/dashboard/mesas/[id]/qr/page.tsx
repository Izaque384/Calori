import { db } from "@/db";
import { tables } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function TableQrPage({ params }: Props) {
  const { id } = await params;
  const { restaurant } = await requireCurrentRestaurant();

  const [table] = await db
    .select()
    .from(tables)
    .where(and(eq(tables.id, id), eq(tables.restaurantId, restaurant.id)))
    .limit(1);

  if (!table) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://calorixx.vercel.app";
  const menuUrl = `${baseUrl}/r/${restaurant.slug}/m/${table.publicCode}`;
  const qrDataUrl = await QRCode.toDataURL(menuUrl, {
    width: 720,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  return (
    <main className="qr-page">
      <div className="qr-sheet">
        <div className="brand">Calori<span>.</span></div>
        <p className="eyebrow">Cardápio digital</p>
        <h1>{table.name}</h1>
        <p className="muted">Escaneie para acessar o cardápio e fazer seu pedido.</p>

        <div className="qr-frame">
          <img src={qrDataUrl} alt={`QR Code da ${table.name}`} />
        </div>

        <strong className="qr-restaurant-name">{restaurant.name}</strong>
        <span className="qr-code-label">{table.publicCode}</span>

        <div className="qr-actions no-print">
          <Link className="secondary-link-button" href="/dashboard/mesas">Voltar para mesas</Link>
          <PrintButton />
        </div>
      </div>
    </main>
  );
}
