"use client";

import { useEffect, useMemo, useState } from "react";

type OptionItem = {
  id: string;
  groupId: string;
  name: string;
  price: number;
};

type OptionGroupItem = {
  id: string;
  productId: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  options: OptionItem[];
};

type ProductItem = {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  price: number;
};

type CategoryItem = {
  id: string;
  name: string;
};

type CartItem = {
  key: string;
  productId: string;
  name: string;
  quantity: number;
  basePrice: number;
  optionIds: string[];
  options: Array<{ id: string; name: string; price: number }>;
  note: string;
  unitPrice: number;
};

type ActiveOrderStatus = "new" | "preparing" | "ready" | "delivered" | "cancelled";

type ActiveOrder = {
  id: string;
  number: number;
  total: number;
  table: string;
  status: ActiveOrderStatus;
};

type Props = {
  restaurantSlug: string;
  tableCode: string;
  categories: CategoryItem[];
  products: ProductItem[];
  optionGroups: OptionGroupItem[];
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function PublicMenuClient({
  restaurantSlug,
  tableCode,
  categories,
  products,
  optionGroups,
}: Props) {
  const [activeProduct, setActiveProduct] = useState<ProductItem | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<ActiveOrder | null>(null);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [serviceSending, setServiceSending] = useState(false);
  const [serviceMessage, setServiceMessage] = useState("");

  const activeGroups = activeProduct
    ? optionGroups.filter((group) => group.productId === activeProduct.id)
    : [];

  const selectedOptions = activeGroups
    .flatMap((group) => group.options)
    .filter((option) => selected.includes(option.id));

  const activeUnitPrice = activeProduct
    ? activeProduct.price + selectedOptions.reduce((sum, option) => sum + option.price, 0)
    : 0;

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart],
  );

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    const storageKey = `calori-active-order:${restaurantSlug}:${tableCode}`;
    const saved = window.localStorage.getItem(storageKey);

    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as Partial<ActiveOrder>;
      const validStatuses: ActiveOrderStatus[] = [
        "new",
        "preparing",
        "ready",
        "delivered",
        "cancelled",
      ];

      if (
        typeof parsed.id === "string" &&
        typeof parsed.number === "number" &&
        typeof parsed.total === "number" &&
        typeof parsed.table === "string" &&
        parsed.status &&
        validStatuses.includes(parsed.status)
      ) {
        setOrder(parsed as ActiveOrder);
      } else {
        window.localStorage.removeItem(storageKey);
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [restaurantSlug, tableCode]);

  useEffect(() => {
    if (!order?.id) return;

    const storageKey = `calori-active-order:${restaurantSlug}:${tableCode}`;
    let cancelled = false;
    let timer: ReturnType<typeof window.setInterval> | undefined;

    async function refreshOrderStatus() {
      try {
        const params = new URLSearchParams({ restaurantSlug, tableCode });
        const response = await fetch(
          `/api/public/orders/${order.id}/status?${params.toString()}`,
          { cache: "no-store" },
        );

        if (!response.ok) return;

        const data = (await response.json()) as {
          order: {
            id: string;
            number: number;
            total: number;
            table: string;
            status: ActiveOrderStatus;
          };
        };

        if (cancelled) return;

        const nextOrder: ActiveOrder = {
          id: data.order.id,
          number: data.order.number,
          total: data.order.total,
          table: data.order.table,
          status: data.order.status,
        };

        setOrder(nextOrder);
        window.localStorage.setItem(storageKey, JSON.stringify(nextOrder));

        if (
          (nextOrder.status === "delivered" || nextOrder.status === "cancelled") &&
          timer !== undefined
        ) {
          window.clearInterval(timer);
          timer = undefined;
        }
      } catch {
        // Mantém o último status conhecido se uma atualização falhar.
      }
    }

    void refreshOrderStatus();
    timer = window.setInterval(() => {
      void refreshOrderStatus();
    }, 5000);

    return () => {
      cancelled = true;
      if (timer !== undefined) {
        window.clearInterval(timer);
      }
    };
  }, [order?.id, restaurantSlug, tableCode]);

  function openProduct(product: ProductItem) {
    setActiveProduct(product);
    setSelected([]);
    setNote("");
    setQuantity(1);
    setError("");
  }

  function toggleOption(group: OptionGroupItem, optionId: string) {
    setSelected((current) => {
      const selectedInGroup = group.options.filter((option) => current.includes(option.id));

      if (current.includes(optionId)) {
        return current.filter((id) => id !== optionId);
      }

      if (group.maxSelections === 1) {
        const groupIds = new Set(group.options.map((option) => option.id));
        return [...current.filter((id) => !groupIds.has(id)), optionId];
      }

      if (selectedInGroup.length >= group.maxSelections) {
        return current;
      }

      return [...current, optionId];
    });
  }

  function addToCart() {
    if (!activeProduct) return;

    for (const group of activeGroups) {
      const count = group.options.filter((option) => selected.includes(option.id)).length;
      if (count < group.minSelections) {
        setError(`Escolha pelo menos ${group.minSelections} opção(ões) em “${group.name}”.`);
        return;
      }
    }

    const item: CartItem = {
      key: crypto.randomUUID(),
      productId: activeProduct.id,
      name: activeProduct.name,
      quantity,
      basePrice: activeProduct.price,
      optionIds: selected,
      options: selectedOptions,
      note: note.trim(),
      unitPrice: activeUnitPrice,
    };

    setCart((current) => [...current, item]);
    setActiveProduct(null);
    setCartOpen(true);
  }

  function changeQuantity(key: string, delta: number) {
    setCart((current) =>
      current
        .map((item) =>
          item.key === key
            ? { ...item, quantity: Math.max(0, Math.min(30, item.quantity + delta)) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  async function sendServiceRequest(type: "call_waiter" | "request_bill") {
    if (serviceSending) return;

    setServiceSending(true);
    setServiceMessage("");

    try {
      const response = await fetch("/api/public/service", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          restaurantSlug,
          tableCode,
          type,
        }),
      });

      const data = await response.json();
      setServiceMessage(
        response.ok ? data.message : data.error || "Não conseguimos enviar a solicitação.",
      );
    } catch {
      setServiceMessage("Não conseguimos enviar a solicitação. Tente novamente.");
    } finally {
      setServiceSending(false);
    }
  }

  async function submitOrder() {
    if (!cart.length || sending) return;

    setSending(true);
    setError("");

    try {
      const response = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          restaurantSlug,
          tableCode,
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            optionIds: item.optionIds,
            note: item.note,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não conseguimos enviar seu pedido.");
        return;
      }

      const nextOrder: ActiveOrder = {
        id: data.order.id,
        number: data.order.number,
        total: data.order.total,
        table: data.order.table,
        status: data.order.status as ActiveOrderStatus,
      };

      setOrder(nextOrder);
      window.localStorage.setItem(
        `calori-active-order:${restaurantSlug}:${tableCode}`,
        JSON.stringify(nextOrder),
      );
      setCart([]);
      setCartOpen(false);
    } catch {
      setError("Não conseguimos enviar seu pedido. Verifique sua conexão e tente novamente.");
    } finally {
      setSending(false);
    }
  }

  if (order) {
    const statusIndex = ["new", "preparing", "ready", "delivered"].indexOf(order.status);
    const statusCopy =
      order.status === "new"
        ? "Seu pedido foi recebido pelo restaurante."
        : order.status === "preparing"
          ? "Seu pedido está sendo preparado."
          : order.status === "ready"
            ? "Seu pedido está pronto."
            : order.status === "delivered"
              ? "Pedido entregue. Bom apetite!"
              : "Este pedido foi cancelado.";

    return (
      <section className="public-order-success order-tracking">
        <span className={`success-mark ${order.status === "cancelled" ? "cancelled" : ""}`}>
          {order.status === "cancelled" ? "×" : "✓"}
        </span>
        <p className="section-kicker">Pedido #{order.number}</p>
        <h2>{statusCopy}</h2>
        <p>{order.table} · atualização automática</p>

        {order.status !== "cancelled" && (
          <div className="order-progress" aria-label="Andamento do pedido">
            {[
              ["new", "Recebido"],
              ["preparing", "Preparando"],
              ["ready", "Pronto"],
              ["delivered", "Entregue"],
            ].map(([key, label], index) => (
              <div
                className={`order-progress-step ${index <= statusIndex ? "active" : ""}`}
                key={key}
              >
                <span>{index + 1}</span>
                <small>{label}</small>
              </div>
            ))}
          </div>
        )}

        <strong>{formatMoney(order.total)}</strong>

        <div className="order-tracking-actions">
          {(order.status === "delivered" || order.status === "cancelled") && (
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                window.localStorage.removeItem(
                  `calori-active-order:${restaurantSlug}:${tableCode}`,
                );
                setOrder(null);
              }}
            >
              Fazer novo pedido
            </button>
          )}

          {order.status !== "delivered" && order.status !== "cancelled" && (
            <button
              className="text-button"
              type="button"
              onClick={() => setOrder(null)}
            >
              Adicionar mais itens
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="public-menu-sections">
        {categories.map((category) => {
          const items = products.filter((product) => product.categoryId === category.id);
          if (!items.length) return null;

          return (
            <section className="public-category" key={category.id}>
              <div className="public-category-heading">
                <span>{category.name}</span>
                <small>{items.length} {items.length === 1 ? "item" : "itens"}</small>
              </div>
              <div className="public-product-list">
                {items.map((product) => (
                  <button className="public-product-card product-button" type="button" key={product.id} onClick={() => openProduct(product)}>
                    <div>
                      <h2>{product.name}</h2>
                      {product.description && <p>{product.description}</p>}
                    </div>
                    <strong>{formatMoney(product.price)}</strong>
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        {products.some((product) => !product.categoryId) && (
          <section className="public-category">
            <div className="public-category-heading">
              <span>Outros</span>
            </div>
            <div className="public-product-list">
              {products.filter((product) => !product.categoryId).map((product) => (
                <button className="public-product-card product-button" type="button" key={product.id} onClick={() => openProduct(product)}>
                  <div>
                    <h2>{product.name}</h2>
                    {product.description && <p>{product.description}</p>}
                  </div>
                  <strong>{formatMoney(product.price)}</strong>
                </button>
              ))}
            </div>
          </section>
        )}
      </section>

      {activeProduct && (
        <div className="menu-modal-backdrop" onClick={() => setActiveProduct(null)}>
          <section className="menu-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setActiveProduct(null)}>×</button>
            <span className="section-kicker">Adicionar ao pedido</span>
            <h2>{activeProduct.name}</h2>
            {activeProduct.description && <p className="muted">{activeProduct.description}</p>}
            <strong className="modal-base-price">{formatMoney(activeProduct.price)}</strong>

            {activeGroups.map((group) => (
              <div className="public-option-group" key={group.id}>
                <div className="public-option-heading">
                  <div>
                    <strong>{group.name}</strong>
                    <span>{group.required ? "Obrigatório" : "Opcional"} · até {group.maxSelections}</span>
                  </div>
                </div>
                <div className="public-options">
                  {group.options.map((option) => (
                    <label className="public-option-row" key={option.id}>
                      <input
                        type={group.maxSelections === 1 ? "radio" : "checkbox"}
                        name={`group-${group.id}`}
                        checked={selected.includes(option.id)}
                        onChange={() => toggleOption(group, option.id)}
                      />
                      <span>{option.name}</span>
                      <small>{option.price > 0 ? `+ ${formatMoney(option.price)}` : "Sem acréscimo"}</small>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <label className="public-note">
              Observação
              <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} placeholder="Ex.: sem cebola" />
            </label>

            {error && <p className="form-error">{error}</p>}

            <div className="modal-footer">
              <div className="quantity-control">
                <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button>
                <span>{quantity}</span>
                <button type="button" onClick={() => setQuantity((value) => Math.min(30, value + 1))}>+</button>
              </div>
              <button className="primary-button add-cart-button" type="button" onClick={addToCart}>
                Adicionar · {formatMoney(activeUnitPrice * quantity)}
              </button>
            </div>
          </section>
        </div>
      )}

      {cartOpen && (
        <div className="menu-modal-backdrop cart-backdrop" onClick={() => setCartOpen(false)}>
          <section className="menu-modal cart-panel" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setCartOpen(false)}>×</button>
            <span className="section-kicker">Seu pedido</span>
            <h2>Revise antes de enviar.</h2>

            <div className="cart-items">
              {cart.map((item) => (
                <article className="cart-item" key={item.key}>
                  <div>
                    <strong>{item.name}</strong>
                    {item.options.length > 0 && <small>{item.options.map((option) => option.name).join(" · ")}</small>}
                    {item.note && <small>Obs.: {item.note}</small>}
                    <span>{formatMoney(item.unitPrice)}</span>
                  </div>
                  <div className="quantity-control compact-quantity">
                    <button type="button" onClick={() => changeQuantity(item.key, -1)}>−</button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => changeQuantity(item.key, 1)}>+</button>
                  </div>
                </article>
              ))}
            </div>

            {error && <p className="form-error">{error}</p>}

            <div className="cart-total">
              <span>Total</span>
              <strong>{formatMoney(cartTotal)}</strong>
            </div>

            <button className="primary-button cart-submit" type="button" disabled={sending || !cart.length} onClick={submitOrder}>
              {sending ? "Enviando..." : "Enviar pedido"}
            </button>
          </section>
        </div>
      )}

      <button className="floating-service" type="button" onClick={() => { setServiceOpen(true); setServiceMessage(""); }}>
        Atendimento
      </button>

      {serviceOpen && (
        <div className="menu-modal-backdrop" onClick={() => setServiceOpen(false)}>
          <section className="menu-modal service-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setServiceOpen(false)}>×</button>
            <span className="section-kicker">Atendimento</span>
            <h2>Como podemos ajudar?</h2>
            <p className="muted">Envie uma solicitação para a equipe do restaurante.</p>

            <div className="service-choice-grid">
              <button type="button" disabled={serviceSending} onClick={() => sendServiceRequest("call_waiter")}>
                <strong>Chamar garçom</strong>
                <span>Peça atendimento na sua mesa.</span>
              </button>
              <button type="button" disabled={serviceSending} onClick={() => sendServiceRequest("request_bill")}>
                <strong>Pedir a conta</strong>
                <span>Avise a equipe que deseja encerrar.</span>
              </button>
            </div>

            {serviceMessage && <p className="service-feedback">{serviceMessage}</p>}
          </section>
        </div>
      )}

      {cartCount > 0 && (
        <button className="floating-cart" type="button" onClick={() => setCartOpen(true)}>
          <span>Ver pedido · {cartCount} {cartCount === 1 ? "item" : "itens"}</span>
          <strong>{formatMoney(cartTotal)}</strong>
        </button>
      )}
    </>
  );
}
