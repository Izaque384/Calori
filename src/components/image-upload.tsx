"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Purpose = "restaurant-logo" | "restaurant-banner" | "product";

const MAX_SOURCE_SIZE = 16 * 1024 * 1024;
const MAX_UPLOAD_SIZE = 4 * 1024 * 1024;

async function optimizeImage(file: File, purpose: Purpose) {
  if (file.size > MAX_SOURCE_SIZE) {
    throw new Error("A imagem original deve ter no máximo 16 MB.");
  }

  if (typeof createImageBitmap !== "function") {
    return file;
  }

  const bitmap = await createImageBitmap(file);

  try {
    const limits =
      purpose === "restaurant-banner"
        ? { width: 2000, height: 1200 }
        : purpose === "restaurant-logo"
          ? { width: 1200, height: 1200 }
          : { width: 1600, height: 1600 };

    const scale = Math.min(
      1,
      limits.width / bitmap.width,
      limits.height / bitmap.height,
    );

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    if (
      scale === 1 &&
      file.size <= 900 * 1024 &&
      file.type === "image/webp"
    ) {
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, width, height);

    const optimizedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.84);
    });

    if (!optimizedBlob) return file;

    if (optimizedBlob.size >= file.size && file.size <= MAX_UPLOAD_SIZE) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "imagem";
    return new File([optimizedBlob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}

type Props = {
  purpose: Purpose;
  currentUrl?: string | null;
  productId?: string;
  label: string;
  description?: string;
  aspect?: "square" | "logo" | "banner";
};

export default function ImageUpload({
  purpose,
  currentUrl,
  productId,
  label,
  description,
  aspect = "square",
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(currentUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setMessage("");

    let localPreview = "";

    try {
      let uploadFile = file;

      try {
        uploadFile = await optimizeImage(file, purpose);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível preparar a imagem.",
        );
        return;
      }

      if (uploadFile.size > MAX_UPLOAD_SIZE) {
        setMessage("A imagem continuou acima de 4 MB após a otimização.");
        return;
      }

      localPreview = URL.createObjectURL(uploadFile);
      setPreview(localPreview);

      const formData = new FormData();
      formData.set("purpose", purpose);
      if (productId) formData.set("productId", productId);
      formData.set("file", uploadFile);

      const response = await fetch("/api/dashboard/media", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        setPreview(currentUrl ?? "");
        setMessage(data.error || "Não foi possível enviar a imagem.");
        return;
      }

      setPreview(data.url);
      setMessage("Imagem atualizada.");
      router.refresh();
    } catch {
      setPreview(currentUrl ?? "");
      setMessage("Não foi possível enviar a imagem. Tente novamente.");
    } finally {
      if (localPreview) URL.revokeObjectURL(localPreview);
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    if (!preview || busy) return;
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/dashboard/media", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose, productId }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setMessage(data.error || "Não foi possível remover a imagem.");
        return;
      }

      setPreview("");
      setMessage("Imagem removida.");
      router.refresh();
    } catch {
      setMessage("Não foi possível remover a imagem.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="media-uploader">
      <div className={`media-uploader-preview ${aspect} ${preview ? "has-image" : "empty"}`}>
        {preview ? (
          <img src={preview} alt="" />
        ) : (
          <div className="media-uploader-empty">
            <span aria-hidden="true">+</span>
            <strong>{aspect === "banner" ? "Adicionar banner" : "Adicionar imagem"}</strong>
          </div>
        )}
      </div>

      <div className="media-uploader-copy">
        <strong>{label}</strong>
        {description && <p>{description}</p>}
        <span>JPG, PNG, WebP ou AVIF · otimização automática</span>

        <div className="media-uploader-actions">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <button
            className="secondary-button"
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Enviando..." : preview ? "Trocar imagem" : "Escolher imagem"}
          </button>
          {preview && (
            <button className="text-button danger" type="button" disabled={busy} onClick={() => void remove()}>
              Remover
            </button>
          )}
        </div>

        {message && (
          <p className={message.includes("atualizada") || message.includes("removida") ? "media-upload-success" : "media-upload-error"}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
