import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const memberRole = pgEnum("member_role", ["owner", "manager", "staff"]);
export const orderStatus = pgEnum("order_status", [
  "new",
  "preparing",
  "ready",
  "delivered",
  "cancelled",
]);
export const serviceRequestType = pgEnum("service_request_type", [
  "call_waiter",
  "request_bill",
]);
export const serviceRequestStatus = pgEnum("service_request_status", [
  "pending",
  "handled",
  "cancelled",
]);

export const restaurants = pgTable(
  "restaurants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logoUrl: text("logo_url"),
    bannerUrl: text("banner_url"),
    primaryColor: text("primary_color"),
    phone: text("phone"),
    address: text("address"),
    active: boolean("active").notNull().default(true),
    subscriptionStatus: text("subscription_status").notNull().default("trialing"),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    subscriptionStartedAt: timestamp("subscription_started_at", { withTimezone: true }),
    subscriptionCanceledAt: timestamp("subscription_canceled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("restaurants_slug_uq").on(table.slug)],
);

// userId will reference the chosen auth provider's stable user id.
export const restaurantMembers = pgTable(
  "restaurant_members",
  {
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: memberRole("role").notNull().default("staff"),
    email: text("email"),
    displayName: text("display_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.restaurantId, table.userId] }),
    index("restaurant_members_user_idx").on(table.userId),
  ],
);


export const teamInvites = pgTable(
  "team_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: memberRole("role").notNull(),
    tokenHash: text("token_hash").notNull(),
    invitedByUserId: text("invited_by_user_id").notNull(),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("team_invites_token_hash_uq").on(table.tokenHash),
    index("team_invites_restaurant_idx").on(table.restaurantId),
    index("team_invites_email_idx").on(table.email),
  ],
);

export const tables = pgTable(
  "tables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    publicCode: text("public_code").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("tables_public_code_uq").on(table.publicCode),
    index("tables_restaurant_idx").on(table.restaurantId),
  ],
);

export const tableVisits = pgTable(
  "table_visits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    tableId: uuid("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    index("table_visits_restaurant_idx").on(table.restaurantId),
    index("table_visits_table_idx").on(table.tableId),
  ],
);

export const tableSessions = pgTable(
  "table_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    tableId: uuid("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),
    visitId: uuid("visit_id").references(() => tableVisits.id, { onDelete: "set null" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("table_sessions_token_hash_uq").on(table.tokenHash),
    index("table_sessions_restaurant_idx").on(table.restaurantId),
    index("table_sessions_table_idx").on(table.tableId),
    index("table_sessions_visit_idx").on(table.visitId),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("categories_restaurant_idx").on(table.restaurantId)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    imageUrl: text("image_url"),
    available: boolean("available").notNull().default(true),
    featured: boolean("featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("products_restaurant_idx").on(table.restaurantId),
    index("products_category_idx").on(table.categoryId),
  ],
);

export const optionGroups = pgTable(
  "option_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    required: boolean("required").notNull().default(false),
    minSelections: integer("min_selections").notNull().default(0),
    maxSelections: integer("max_selections").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("option_groups_product_idx").on(table.productId)],
);

export const options = pgTable(
  "options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => optionGroups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    additionalPrice: numeric("additional_price", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    available: boolean("available").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("options_group_idx").on(table.groupId)],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "restrict" }),
    tableId: uuid("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "restrict" }),
    sessionId: uuid("session_id").references(() => tableSessions.id, { onDelete: "set null" }),
    visitId: uuid("visit_id").references(() => tableVisits.id, { onDelete: "set null" }),
    requestKey: text("request_key"),
    number: integer("number").notNull(),
    status: orderStatus("status").notNull().default("new"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("orders_restaurant_number_uq").on(table.restaurantId, table.number),
    index("orders_restaurant_status_idx").on(table.restaurantId, table.status),
    index("orders_table_idx").on(table.tableId),
    index("orders_visit_idx").on(table.visitId),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    note: text("note"),
  },
  (table) => [index("order_items_order_idx").on(table.orderId)],
);

export const orderItemOptions = pgTable(
  "order_item_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    optionId: uuid("option_id").references(() => options.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull().default("0"),
  },
  (table) => [index("order_item_options_item_idx").on(table.orderItemId)],
);

export const serviceRequests = pgTable(
  "service_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    tableId: uuid("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => tableSessions.id, { onDelete: "set null" }),
    visitId: uuid("visit_id").references(() => tableVisits.id, { onDelete: "set null" }),
    type: serviceRequestType("type").notNull(),
    status: serviceRequestStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    handledAt: timestamp("handled_at", { withTimezone: true }),
  },
  (table) => [
    index("service_requests_restaurant_status_idx").on(table.restaurantId, table.status),
    index("service_requests_table_idx").on(table.tableId),
    index("service_requests_visit_idx").on(table.visitId),
  ],
);


export const apiRateLimits = pgTable(
  "api_rate_limits",
  {
    bucketKey: text("bucket_key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(1),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.bucketKey, table.windowStart] }),
    index("api_rate_limits_expires_idx").on(table.expiresAt),
  ],
);
