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
  imageUrl: string | null;
  featured: boolean;
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
  const [order, setOrder] = useState<{ number: number; total: number; table: string } | null>(null);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [serviceSending, setServiceSending] = useState(false);
  const [serviceMessage, setServiceMessage] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [billOpen, setBillOpen] = useState(false);
  const [billLoading, setBillLoading] = useState(false);
  const [billError, setBillError] = useState("");
  const [bill, setBill] = useState<{
    table: string;
    orderCount: number;
    total: number;
    orders: Array<{
      id: string;
      number: number;
      status: string;
      total: number;
      createdAt: string;
    }>;
  } | null>(null);

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
  const featuredProducts = products.filter((product) => product.featured);

  const tableSessionKey = `calori-table-session:${restaurantSlug}:${tableCode}`;
  const cartStorageKey = `calori-cart:${restaurantSlug}:${tableCode}`;

  async function createTableSession() {
    const response = await fetch("/api/public/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ restaurantSlug, tableCode }),
    });

    const data = await response.json();

    if (!response.ok || !data.session?.token) {
      throw new Error(data.error || "Não conseguimos iniciar a sessão da mesa.");
    }

    const token = String(data.session.token);
    window.localStorage.setItem(tableSessionKey, token);
    setSessionToken(token);
    return token;
  }

  async function ensureTableSession() {
    if (sessionToken) return sessionToken;

    const stored = window.localStorage.getItem(tableSessionKey);
    if (stored) {
      setSessionToken(stored);
      return stored;
    }

    return createTableSession();
  }

  async function renewTableSession() {
    window.localStorage.removeItem(tableSessionKey);
    setSessionToken(null);
    return createTableSession();
  }

  useEffect(() => {
    const stored = window.localStorage.getItem(tableSessionKey);
    if (stored) {
      setSessionToken(stored);
    }
  }, [tableSessionKey]);

  useEffect(() => {
    const storedCart = window.localStorage.getItem(cartStorageKey);
    if (!storedCart) return;

    try {
      const parsed = JSON.parse(storedCart) as CartItem[];
      if (Array.isArray(parsed)) {
        setCart(
          parsed.filter(
            (item) =>
              item &&
              typeof item.key === "string" &&
              typeof item.productId === "string" &&
              typeof item.name === "string" &&
              typeof item.quantity === "number" &&
              typeof item.unitPrice === "number",
          ),
        );
      }
    } catch {
      window.localStorage.removeItem(cartStorageKey);
    }
  }, [cartStorageKey]);

  useEffect(() => {
    if (cart.length === 0) {
      window.localStorage.removeItem(cartStorageKey);
      return;
    }

    window.localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  }, [cart, cartStorageKey]);

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
      const minimumRequired = group.required
        ? Math.max(1, group.minSelections)
        : group.minSelections;

      if (count < minimumRequired) {
        setError(`Escolha pelo menos ${minimumRequired} opção(ões) em “${group.name}”.`);
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

  async function openBill() {
    if (billLoading) return;

    setBillLoading(true);
    setBillError("");

    try {
      const token = await ensureTableSession();
      const params = new URLSearchParams({
        restaurantSlug,
        tableCode,
        sessionToken: token,
      });

      let response = await fetch(`/api/public/bill?${params.toString()}`, {
        cache: "no-store",
      });

      if (response.status === 401) {
        const freshToken = await renewTableSession();
        params.set("sessionToken", freshToken);
        response = await fetch(`/api/public/bill?${params.toString()}`, {
          cache: "no-store",
        });
      }

      const data = await response.json();

      if (!response.ok) {
        setBillError(data.error || "Não conseguimos carregar a conta.");
        setBillOpen(true);
        return;
      }

      setBill(data.bill);
      setBillOpen(true);
    } catch {
      setBillError("Não conseguimos carregar a conta. Tente novamente.");
      setBillOpen(true);
    } finally {
      setBillLoading(false);
    }
  }

  async function sendServiceRequest(type: "call_waiter" | "request_bill") {
    if (serviceSending) return;

    setServiceSending(true);
    setServiceMessage("");

    try {
      const token = await ensureTableSession();

      let response = await fetch("/api/public/service", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          restaurantSlug,
          tableCode,
          sessionToken: token,
          type,
        }),
      });

      if (response.status === 401) {
        const freshToken = await renewTableSession();
        response = await fetch("/api/public/service", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            restaurantSlug,
            tableCode,
            sessionToken: freshToken,
            type,
          }),
        });
      }

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
      const token = await ensureTableSession();

      let response = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          restaurantSlug,
          tableCode,
          sessionToken: token,
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            optionIds: item.optionIds,
            note: item.note,
          })),
        }),
      });

      if (response.status === 401) {
        const freshToken = await renewTableSession();
        response = await fetch("/api/public/orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            restaurantSlug,
            tableCode,
            sessionToken: freshToken,
            items: cart.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              optionIds: item.optionIds,
              note: item.note,
            })),
          }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não conseguimos enviar seu pedido.");
        return;
      }

      setOrder({
        number: data.order.number,
        total: data.order.total,
        table: data.order.table,
      });
      setCart([]);
      window.localStorage.removeItem(cartStorageKey);
      setCartOpen(false);
    } catch {
      setError("Não conseguimos enviar seu pedido. Verifique sua conexão e tente novamente.");
    } finally {
      setSending(false);
    }
  }

  if (order) {
    return (
      <section className="public-order-success">
        <span className="success-mark">✓</span>
        <p className="section-kicker">Pedido enviado</p>
        <h2>Pedido #{order.number}</h2>
        <p>A cozinha já recebeu sua solicitação para {order.table}.</p>
        <strong>{formatMoney(order.total)}</strong>
        <button className="primary-button" type="button" onClick={() => setOrder(null)}>
          Voltar ao cardápio
        </button>
      </section>
    );
  }

  return (
    <>
      <section className="public-menu-sections">
        {featuredProducts.length > 0 && (
          <section className="public-category public-featured-section">
            <div className="public-category-heading">
              <span>Destaques</span>
              <small>Escolhas da casa</small>
            </div>
            <div className="public-featured-grid">
              {featuredProducts.map((product) => (
                <button
                  className="public-product-card product-button featured-product-card"
                  type="button"
                  key={`featured-${product.id}`}
                  onClick={() => openProduct(product)}
                >
                  {product.imageUrl && (
                    <img className="public-product-image" src={product.imageUrl} alt={product.name} />
                  )}
                  <div>
                    <span className="featured-badge">Destaque</span>
                    <h2>{product.name}</h2>
                    {product.description && <p>{product.description}</p>}
                  </div>
                  <strong>{formatMoney(product.price)}</strong>
                </button>
              ))}
            </div>
          </section>
        )}

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
                    {product.imageUrl && (
                      <img className="public-product-image" src={product.imageUrl} alt={product.name} />
                    )}
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
                  {product.imageUrl && (
                    <img className="public-product-image" src={product.imageUrl} alt={product.name} />
                  )}
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
              <button type="button" disabled={billLoading} onClick={openBill}>
                <strong>Ver conta da mesa</strong>
                <span>Veja os pedidos e o total acumulado.</span>
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

      {billOpen && (
        <div className="menu-modal-backdrop" onClick={() => setBillOpen(false)}>
          <section className="menu-modal bill-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setBillOpen(false)}>×</button>
            <span className="section-kicker">Conta da mesa</span>
            <h2>{bill?.table || "Sua mesa"}</h2>

            {billError ? (
              <p className="form-error">{billError}</p>
            ) : bill ? (
              <>
                {bill.orders.length === 0 ? (
                  <p className="muted">Nenhum pedido foi registrado nesta sessão ainda.</p>
                ) : (
                  <div className="bill-order-list">
                    {bill.orders.map((item) => (
                      <div className="bill-order-row" key={item.id}>
                        <div>
                          <strong>Pedido #{item.number}</strong>
                          <small>
                            {new Date(item.createdAt).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {" · "}
                            {item.status === "new"
                              ? "Recebido"
                              : item.status === "preparing"
                                ? "Preparando"
                                : item.status === "ready"
                                  ? "Pronto"
                                  : "Entregue"}
                          </small>
                        </div>
                        <strong>{formatMoney(item.total)}</strong>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bill-total">
                  <span>Total da sessão</span>
                  <strong>{formatMoney(bill.total)}</strong>
                </div>

                <button
                  className="primary-button cart-submit"
                  type="button"
                  disabled={serviceSending || bill.orderCount === 0}
                  onClick={() => sendServiceRequest("request_bill")}
                >
                  {serviceSending ? "Enviando..." : "Pedir a conta"}
                </button>
              </>
            ) : (
              <p className="muted">Carregando conta...</p>
            )}
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
