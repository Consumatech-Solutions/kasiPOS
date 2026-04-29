import { api } from "./core";
import type { Store, CreateStoreDto, UpdateStoreDto } from "@/types";

export type StoreRoleTransferOldAdminState = "staff user" | "deleted";

export const storesApi = {
  getMyStore: () => api.get<Store>("/stores/my-store"),

  getById: (id: string) => api.get<Store>(`/stores/${id}`),

  create: (data: CreateStoreDto) => api.post<Store>("/stores", data),

  update: (id: string, data: UpdateStoreDto) =>
    api.patch<Store>(`/stores/${id}`, data),

  transferStoreRole: (data: {
    newStoreAdminId: string;
    oldStoreAdminState: StoreRoleTransferOldAdminState;
  }) => api.post<void>("/stores/role-transfer", data),
};
