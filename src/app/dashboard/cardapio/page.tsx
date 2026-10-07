import { db } from "@/db";
import DashboardSidebar from "@/components/dashboard-sidebar";
import { categories, optionGroups, options, products } from "@/db/schema";
import { requireCurrentRestaurant } from "@/lib/current-restaurant";
import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  createCategory,
  createOption,
  createOptionGroup,
  createProduct,
  deleteCategory,
  deleteOption,
  deleteOptionGroup,
  deleteProduct,
  toggleCategoryActive,
  toggleOptionAvailability,
  toggleProductAvailability,
  toggleProductFeatured,
  updateCategoryName,
  updateProductDetails,
  updateProductImage,
} from "./actions";

export const dynamic = "force-dynamic";

function formatMoney(value: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

export default async function MenuPage() {
  const { restaurant, role } = await requireCurrentRestaurant();

  if (role === "staff") redirect("/dashboard/pedidos");

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
      <DashboardSidebar restaurantName={restaurant.name} role={role} activePath="/dashboard/cardapio" />

      <section className="dashboard-content menu-content">
        <div className="page-heading-row">
          <div>
            <p className="eyebrow">Experiência do cliente</p>
            <h1>Seu cardápio, do seu jeito.</h1>
            <p className="muted">
              Organize pratos, categorias e personalizações com a mesma atenção que você dedica à experiência à mesa.
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
                    <form action={updateCategoryName} className="category-edit-form">
                      <input type="hidden" name="categoryId" value={category.id} />
                      <input name="name" defaultValue={category.name} aria-label="Nome da categoria" />
                      <button className="secondary-button" type="submit">Salvar</button>
                    </form>
                    <div className="category-row-actions">
                      <form action={toggleCategoryActive}>
                        <input type="hidden" name="categoryId" value={category.id} />
                        <input type="hidden" name="active" value={String(category.active)} />
                        <button className={category.active ? "mini-status on" : "mini-status off"} type="submit">
                          {category.active ? "Ativa" : "Pausada"}
                        </button>
                      </form>
                      <form action={deleteCategory}>
                        <input type="hidden" name="categoryId" value={category.id} />
                        <button className="text-button danger" type="submit">Excluir</button>
                      </form>
                    </div>
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

              <label>
                URL da imagem
                <input name="imageUrl" type="url" placeholder="https://..." />
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
                      {product.imageUrl ? (
                        <img
                          className="dashboard-product-image"
                          src={product.imageUrl}
                          alt={product.name}
                        />
                      ) : (
                        <div className="dashboard-product-image product-image-placeholder">
                          <span>Sem foto</span>
                        </div>
                      )}
                      <div>
                        <span className="product-category">{product.categoryId ? categoryName.get(product.categoryId) ?? "Categoria" : "Sem categoria"}</span>
                        <h3>{product.name}</h3>
                        {product.description && <p>{product.description}</p>}
                      </div>
                      <div className="product-price">{formatMoney(product.price)}</div>
                    </div>

                    <details className="product-management-details">
                      <summary>
                        <span>Editar produto</span>
                        <small>Nome, preço, categoria, descrição e imagem</small>
                      </summary>
                      <div className="product-management-body">
                    <form action={updateProductDetails} className="product-edit-form">
                      <input type="hidden" name="productId" value={product.id} />
                      <div className="form-row">
                        <label>
                          Nome
                          <input name="name" defaultValue={product.name} required />
                        </label>
                        <label>
                          Preço
                          <input name="price" defaultValue={String(product.price).replace(".", ",")} inputMode="decimal" required />
                        </label>
                      </div>
                      <label>
                        Categoria
                        <select name="categoryId" defaultValue={product.categoryId ?? ""}>
                          <option value="">Sem categoria</option>
                          {categoryRows.map((category) => (
                            <option key={category.id} value={category.id}>{category.name}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Descrição
                        <textarea name="description" rows={2} defaultValue={product.description ?? ""} />
                      </label>
                      <button className="secondary-button" type="submit">Salvar alterações</button>
                    </form>

                    <form action={updateProductImage} className="product-image-form">
                      <input type="hidden" name="productId" value={product.id} />
                      <input
                        name="imageUrl"
                        type="url"
                        defaultValue={product.imageUrl ?? ""}
                        placeholder="URL da imagem"
                      />
                      <button className="secondary-button" type="submit">Salvar imagem</button>
                    </form>
                      </div>
                    </details>

                    <div className="product-actions">
                      <form action={toggleProductFeatured}>
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="featured" value={String(product.featured)} />
                        <button className={product.featured ? "availability-button on" : "availability-button off"} type="submit">
                          {product.featured ? "Em destaque" : "Destacar"}
                        </button>
                      </form>
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

                    <details className="product-addons-details">
                      <summary>
                        <span>Adicionais e opções</span>
                        <small>{productGroups.length} {productGroups.length === 1 ? "grupo configurado" : "grupos configurados"}</small>
                      </summary>
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
                                  <div>
                                    <strong>{group.name}</strong>
                                    <span>{group.required ? "Obrigatório" : "Opcional"} · até {group.maxSelections}</span>
                                  </div>
                                  <form action={deleteOptionGroup}>
                                    <input type="hidden" name="groupId" value={group.id} />
                                    <button className="text-button danger" type="submit">Excluir grupo</button>
                                  </form>
                                </div>

                                <div className="option-list">
                                  {groupOptions.map((option) => (
                                    <div className="option-row" key={option.id}>
                                      <div>
                                        <span>{option.name}</span>
                                        <small>+ {formatMoney(option.additionalPrice)}</small>
                                      </div>
                                      <div className="option-row-actions">
                                        <form action={toggleOptionAvailability}>
                                          <input type="hidden" name="optionId" value={option.id} />
                                          <input type="hidden" name="available" value={String(option.available)} />
                                          <button className={option.available ? "mini-status on" : "mini-status off"} type="submit">
                                            {option.available ? "Ativo" : "Pausado"}
                                          </button>
                                        </form>
                                        <form action={deleteOption}>
                                          <input type="hidden" name="optionId" value={option.id} />
                                          <button className="text-button danger" type="submit">Excluir</button>
                                        </form>
                                      </div>
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
                    </details>
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
