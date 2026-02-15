import { api } from './core';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';

export type ParcelStatus = 'Incoming' | 'Received' | 'Collected';

export type Parcel = {
  id: string;
  storeId: string;
  deliveryNumber: string;
  customerName: string;
  status: ParcelStatus;
  collectionCode?: string | null;
  receiptCode?: string | null;
  dateReceived?: string | null;
  dateCollected?: string | null;
  collectingPersonName?: string | null;
  collectingPersonPhone?: string | null;
  collectingPersonId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateParcelDto = {
  storeId: string;
  deliveryNumber: string;
  customerName: string;
};

export type ReceiveParcelDto = {
  receiptCode: string;
};

export type CollectParcelDto = {
  collectionCode: string;
  collectingPersonName: string;
  collectingPersonId: string;
  collectingPersonPhone?: string;
};

export interface GetParcelsParams extends PaginationParams {
  status?: ParcelStatus;
  search?: string; // Search by delivery number or collection code
}

export const parcelsApi = {
  create: (data: CreateParcelDto) => {
    return api.post<Parcel>('/parcels', data);
  },

  /**
   * Get all parcels with pagination and filters
   */
  getAll: (params?: GetParcelsParams) => {
    const requestParams: Record<string, number | string> = {};
    if (params?.page !== undefined) {
      requestParams.page = params.page;
    }
    if (params?.limit !== undefined) {
      requestParams.limit = params.limit;
    }
    if (params?.status !== undefined) {
      requestParams.status = params.status;
    }
    if (params?.search !== undefined) {
      requestParams.search = params.search;
    }

    return api.get<PaginatedResponse<Parcel> | Parcel[]>('/parcels', {
      params: Object.keys(requestParams).length > 0 ? requestParams : undefined,
    });
  },

  /**
   * Get a parcel by ID
   */
  getById: (id: string) => {
    return api.get<Parcel>(`/parcels/${id}`);
  },

  /**
   * Get a parcel by collection code
   */
  getByCollectionCode: (code: string) => {
    return api.get<Parcel>(`/parcels/collection-code/${code}`);
  },

  /**
   * Mark a parcel as received
   */
  receive: (id: string, data: ReceiveParcelDto) => {
    return api.post<Parcel>(`/parcels/${id}/receive`, data);
  },

  /**
   * Mark a parcel as collected
   */
  collect: (id: string, data: CollectParcelDto) => {
    return api.post<Parcel>(`/parcels/${id}/collect`, data);
  },

  /**
   * Update a parcel
   */
  update: (id: string, data: Partial<Parcel>) => {
    return api.patch<Parcel>(`/parcels/${id}`, data);
  },

  /**
   * Delete a parcel
   */
  delete: (id: string) => {
    return api.delete(`/parcels/${id}`);
  },
};
