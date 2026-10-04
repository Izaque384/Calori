import { db } from "@/db";
import { categories, optionGroups, options, products } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { asc, eq } from "drizzle-orm";
import { signOut } from "../actions";
import {
  createCategory,
  createOption,
  createOptionGroup,
  createProduct,
  deleteCategory,
  deleteProduct,
  toggleOptionAvailability,
  toggleProductAvailability,
} from "./actions";

export const dynamic = "force-dynamic";

function formatMoney(value: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

export default async function MenuPage() {
  const { restaurant } = await requireCurrentRestaurant();

  const [categoryRows, productRows, groupRows, optionRows] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(eq(categories.restaurantId, restaurant.id))
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
    db
      .select()
      .from(products)
      .where(eq(products.restaurantId, restaurant.id))
      .orderBy(asc(products.sortOrder), asc(products.name)),
    db
      .select({
        id: optionGroups.id,
        productId: optionGroups.productId,
        name: optionGroups.name,
        required: optionGroups.required,
        maxSelections: optionGroups.maxSelections,
      })
      .from(optionGroups),
    db.select().from(options).orderBy(asc(options.sortOrder), asc(options.name)),
  ]);

  const productIds = new Set(productRows.map((product) => product.id));
  const groups = groupRows.filter((group) => productIds.has(group.productId));
  const groupIds = new Set(groups.map((group) => group.id));
  const filteredOptions = optionRows.filter((option) => groupIds.has(option.groupId));

  const categoryName = new Map(categoryRows.map((category) => [category.id, category.name]));

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="brand">Calori<span>.</span></div>
        <div className="restaurant-pill">{restaurant.name}</div>
        <nav>
          <a href="/dashboard">Visão geral</a>
          <span>Pedidos</span>
          <a className="active" href="/dashboard/cardapio">Cardápio</a>
          <a href="/dashboard/mesas">Mesas</a>
          <a href="/dashboard/atendimento">Atendimento</a>
          <a href="/dashboard/configuracoes">Configurações</a>
        </nav>
        <form action={signOut}>
          <button className="ghost-button" type="submit">Sair</button>
        </form>
      </aside>

      <section className="dashboard-content menu-content">
        <div className="page-heading-row">
          <div>
            <p className="eyebrow">Cardápio</p>
            <h1>Monte seu menu.</h1>
            <p className="muted">
              Organize categorias, produtos e adicionais. Tudo aqui será a base do cardápio que o cliente verá pelo QR Code.
            </p>
          </div>
          <div className="status-chip">{productRows.length} {productRows.length === 1 ? "produto" : "produtos"}</div>
        </div>

        <section className="menu-grid">
          <article className="panel-card">
            <div className="section-title">
              <div>
                <span className="section-kicker">Estrutura</span>
                <h2>Categorias</h2>
              </div>
            </div>

            <form action={createCategory} className="inline-form">
              <input name="name" placeholder="Ex.: Entradas" required />
              <button className="primary-button compact" type="submit">Adicionar</button>
            </form>

            <div className="category-list">
              {categoryRows.length === 0 ? (
                <p className="empty-state">Comece criando uma categoria para organizar o cardápio.</p>
              ) : (
                categoryRows.map((category) => (
                  <div className="category-row" key={category.id}>
                    <span>{category.name}</span>
                    <form action={deleteCategory}>
                      <input type="hidden" name="categoryId" value={category.id} />
                      <button className="text-button danger" type="submit">Excluir</button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="panel-card">
            <div className="section-title">
              <div>
                <span className="section-kicker">Novo item</span>
                <h2>Adicionar produto</h2>
              </div>
            </div>

            <form action={createProduct} className="product-form">
              <label>
                Nome
                <input name="name" placeholder="Ex.: Hambúrguer da casa" required />
              </label>

              <div className="form-row">
                <label>
                  Preço
                  <input name="price" inputMode="decimal" placeholder="29,90" required />
                </label>

                <label>
                  Categoria
                  <select name="categoryId" defaultValue="">
                    <option value="">Sem categoria</option>
                    {categoryRows.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Descrição
                <textarea name="description" rows={3} placeholder="Descreva ingredientes, preparo ou destaque do prato." />
              </label>

              <button className="primary-button" type="submit">Adicionar ao cardápio</button>
            </form>
          </article>
        </section>

        <section className="products-section">
          <div className="section-title">
            <div>
              <span className="section-kicker">Itens do menu</span>
              <h2>Produtos</h2>
            </div>
          </div>

          {productRows.length === 0 ? (
            <div className="large-empty-state">
              <strong>Seu cardápio ainda está vazio.</strong>
              <span>Adicione o primeiro produto acima. Ele aparecerá aqui pronto para receber adicionais.</span>
            </div>
          ) : (
            <div className="product-list">
              {productRows.map((product) => {
                const productGroups = groups.filter((group) => group.productId === product.id);

                return (
                  <article className="product-card" key={product.id}>
                    <div className="product-topline">
                      <div>
                        <span className="product-category">{product.categoryId ? categoryName.get(product.categoryId) ?? "Categoria" : "Sem categoria"}</span>
                        <h3>{product.name}</h3>
                        {product.description && <p>{product.description}</p>}
                      </div>
                      <div className="product-price">{formatMoney(product.price)}</div>
                    </div>

                    <div className="product-actions">
                      <form action={toggleProductAvailability}>
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="available" value={String(product.available)} />
                        <button className={product.available ? "availability-button on" : "availability-button off"} type="submit">
                          {product.available ? "Disponível" : "Indisponível"}
                        </button>
                      </form>
                      <form action={deleteProduct}>
                        <input type="hidden" name="productId" value={product.id} />
                        <button className="text-button danger" type="submit">Excluir produto</button>
                      </form>
                    </div>

                    <div className="addons-box">
                      <div className="addons-heading">
                        <div>
                          <span className="section-kicker">Personalização</span>
                          <strong>Adicionais e opções</strong>
                        </div>
                      </div>

                      <form action={createOptionGroup} className="addon-group-form">
                        <input type="hidden" name="productId" value={product.id} />
                        <input name="groupName" placeholder="Ex.: Escolha o ponto da carne" required />
                        <input name="maxSelections" type="number" min="1" defaultValue="1" aria-label="Máximo de escolhas" />
                        <label className="check-label">
                          <input name="required" type="checkbox" /> Obrigatório
                        </label>
                        <button className="secondary-button" type="submit">Criar grupo</button>
                      </form>

                      {productGroups.length > 0 && (
                        <div className="option-group-list">
                          {productGroups.map((group) => {
                            const groupOptions = filteredOptions.filter((option) => option.groupId === group.id);

                            return (
                              <div className="option-group" key={group.id}>
                                <div className="option-group-title">
                                  <strong>{group.name}</strong>
                                  <span>{group.required ? "Obrigatório" : "Opcional"} · até {group.maxSelections}</span>
                                </div>

                                <div className="option-list">
                                  {groupOptions.map((option) => (
                                    <div className="option-row" key={option.id}>
                                      <div>
                                        <span>{option.name}</span>
                                        <small>+ {formatMoney(option.additionalPrice)}</small>
                                      </div>
                                      <form action={toggleOptionAvailability}>
                                        <input type="hidden" name="optionId" value={option.id} />
                                        <input type="hidden" name="available" value={String(option.available)} />
                                        <button className={option.available ? "mini-status on" : "mini-status off"} type="submit">
                                          {option.available ? "Ativo" : "Pausado"}
                                        </button>
                                      </form>
                                    </div>
                                  ))}
                                </div>

                                <form action={createOption} className="option-form">
                                  <input type="hidden" name="groupId" value={group.id} />
                                  <input name="optionName" placeholder="Ex.: Bem passado" required />
                                  <input name="additionalPrice" placeholder="+ 0,00" inputMode="decimal" defaultValue="0,00" />
                                  <button className="secondary-button" type="submit">Adicionar opção</button>
                                </form>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
