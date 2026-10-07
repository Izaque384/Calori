"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Purpose = "restaurant-logo" | "restaurant-banner" | "product";

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

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    try {
      const formData = new FormData();
      formData.set("purpose", purpose);
      if (productId) formData.set("productId", productId);
      formData.set("file", file);

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
      URL.revokeObjectURL(localPreview);
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
        <span>JPG, PNG, WebP ou AVIF · até 4 MB</span>

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
