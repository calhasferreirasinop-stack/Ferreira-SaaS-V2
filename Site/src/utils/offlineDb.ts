import Dexie, { Table } from 'dexie';

export interface OfflineEstimate {
    id?: string;
    clientId: string;
    clientName: string;
    clientAddress: string;
    selectedProducts: any[];
    items: any[];
    bends: any[];
    totalValue: number;
    finalValue: number;
    notes: string;
    createdAt: string;
    companyId: string;
    syncStatus: 'offline_pending_sync' | 'synced' | 'failed';
    error?: string;
}

export class MyDatabase extends Dexie {
    offlineEstimates!: Table<OfflineEstimate>;

    constructor() {
        super('CalhaFlowOfflineDB');
        this.version(1).stores({
            offlineEstimates: '++id, companyId, syncStatus, clientId'
        });
    }
}

export const db = new MyDatabase();
