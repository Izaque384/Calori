import { del, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, restaurants } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { canManageCatalog, canManageSettings } from "@/lib/permissions";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

type MediaPurpose = "restaurant-logo" | "restaurant-banner" | "product";

function isPurpose(value: string): value is MediaPurpose {
  return value === "restaurant-logo" || value === "restaurant-banner" || value === "product";
}

function safeFilename(name: string) {
  const extension = name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "img";
  return `image.${extension}`;
}

function isBlobUrl(url: string | null) {
  return Boolean(url && url.includes(".blob.vercel-storage.com/"));
}

async function deleteBlobBestEffort(url: string | null) {
  if (!isBlobUrl(url)) return;
  try {
    await del(url!);
  } catch {
    // A troca da imagem não deve falhar caso a limpeza do arquivo antigo não consiga executar.
  }
}

async function getProduct(productId: string, restaurantId: string) {
  const [product] = await db
    .select({ id: products.id, imageUrl: products.imageUrl })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.restaurantId, restaurantId)))
    .limit(1);

  return product ?? null;
}

export async function POST(request: Request) {
  const { restaurant, role } = await requireCurrentRestaurant();

  const formData = await request.formData();
  const purposeRaw = String(formData.get("purpose") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const file = formData.get("file");

  if (!isPurpose(purposeRaw)) {
    return NextResponse.json({ error: "Destino de imagem inválido." }, { status: 400 });
  }

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Selecione uma imagem." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Use uma imagem JPG, PNG, WebP ou AVIF." },
      { status: 415 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "A imagem deve ter no máximo 4 MB." },
      { status: 413 },
    );
  }

  let previousUrl: string | null = null;
  let pathname = `restaurants/${restaurant.id}/${purposeRaw}/${safeFilename(file.name)}`;

  if (purposeRaw === "product") {
    if (!canManageCatalog(role) || !productId) {
      return NextResponse.json({ error: "Você não tem permissão para alterar este produto." }, { status: 403 });
    }

    const product = await getProduct(productId, restaurant.id);
    if (!product) {
      return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
    }

    previousUrl = product.imageUrl;
    pathname = `restaurants/${restaurant.id}/products/${productId}/${safeFilename(file.name)}`;
  } else {
    if (!canManageSettings(role)) {
      return NextResponse.json({ error: "Somente o proprietário pode alterar a identidade do restaurante." }, { status: 403 });
    }

    const [row] = await db
      .select({
        logoUrl: restaurants.logoUrl,
        bannerUrl: restaurants.bannerUrl,
      })
      .from(restaurants)
      .where(eq(restaurants.id, restaurant.id))
      .limit(1);

    previousUrl = purposeRaw === "restaurant-logo" ? row?.logoUrl ?? null : row?.bannerUrl ?? null;
  }

  try {
    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });

    if (purposeRaw === "product") {
      await db
        .update(products)
        .set({ imageUrl: blob.url, updatedAt: new Date() })
        .where(and(eq(products.id, productId), eq(products.restaurantId, restaurant.id)));
    } else if (purposeRaw === "restaurant-logo") {
      await db
        .update(restaurants)
        .set({ logoUrl: blob.url, updatedAt: new Date() })
        .where(eq(restaurants.id, restaurant.id));
    } else {
      await db
        .update(restaurants)
        .set({ bannerUrl: blob.url, updatedAt: new Date() })
        .where(eq(restaurants.id, restaurant.id));
    }

    await deleteBlobBestEffort(previousUrl);

    return NextResponse.json({ url: blob.url });
  } catch {
    return NextResponse.json(
      {
        error:
          "Não foi possível acessar o armazenamento de imagens. Verifique se um Vercel Blob Store está conectado ao projeto Calori.",
      },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request) {
  const { restaurant, role } = await requireCurrentRestaurant();
  const body = (await request.json().catch(() => null)) as
    | { purpose?: string; productId?: string }
    | null;

  const purposeRaw = String(body?.purpose ?? "");
  const productId = String(body?.productId ?? "");

  if (!isPurpose(purposeRaw)) {
    return NextResponse.json({ error: "Destino de imagem inválido." }, { status: 400 });
  }

  let previousUrl: string | null = null;

  if (purposeRaw === "product") {
    if (!canManageCatalog(role) || !productId) {
      return NextResponse.json({ error: "Você não tem permissão para alterar este produto." }, { status: 403 });
    }

    const product = await getProduct(productId, restaurant.id);
    if (!product) return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });

    previousUrl = product.imageUrl;
    await db
      .update(products)
      .set({ imageUrl: null, updatedAt: new Date() })
      .where(and(eq(products.id, productId), eq(products.restaurantId, restaurant.id)));
  } else {
    if (!canManageSettings(role)) {
      return NextResponse.json({ error: "Somente o proprietário pode alterar a identidade do restaurante." }, { status: 403 });
    }

    const [row] = await db
      .select({ logoUrl: restaurants.logoUrl, bannerUrl: restaurants.bannerUrl })
      .from(restaurants)
      .where(eq(restaurants.id, restaurant.id))
      .limit(1);

    previousUrl = purposeRaw === "restaurant-logo" ? row?.logoUrl ?? null : row?.bannerUrl ?? null;

    await db
      .update(restaurants)
      .set(
        purposeRaw === "restaurant-logo"
          ? { logoUrl: null, updatedAt: new Date() }
          : { bannerUrl: null, updatedAt: new Date() },
      )
      .where(eq(restaurants.id, restaurant.id));
  }

  await deleteBlobBestEffort(previousUrl);
  return NextResponse.json({ ok: true });
}
