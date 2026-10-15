export type FloorTableItem = {
  id: string;
  name: string;
  publicCode: string;
  active: boolean;
  occupied: boolean;
  startedAt: string | null;
  orderCount: number;
  total: number;
  orderStatus: "new" | "preparing" | "ready" | "delivered" | null;
  waiterRequest: boolean;
  billRequest: boolean;
  pendingCount: number;
};
