import { useState, useEffect, useCallback } from 'react';
import { db, OfflineEstimate } from '../utils/offlineDb';

export function useOfflineSync() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [syncing, setSyncing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    const updatePendingCount = useCallback(async () => {
        const count = await db.offlineEstimates
            .where('syncStatus')
            .equals('offline_pending_sync')
            .count();
        setPendingCount(count);
    }, []);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            // Auto-sync when back online
            syncAll();
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        updatePendingCount();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [updatePendingCount]);

    const saveOffline = async (estimateData: any, companyId: string) => {
        const offlineItem: OfflineEstimate = {
            ...estimateData,
            companyId,
            syncStatus: 'offline_pending_sync',
            createdAt: new Date().toISOString(),
        };
        await db.offlineEstimates.add(offlineItem);
        await updatePendingCount();
    };

    const syncAll = useCallback(async () => {
        if (!navigator.onLine || syncing) return;

        const pending = await db.offlineEstimates
            .where('syncStatus')
            .equals('offline_pending_sync')
            .toArray();

        if (pending.length === 0) return;

        setSyncing(true);
        console.log(`[PWA] Iniciando sincronização de ${pending.length} registros...`);

        for (const item of pending) {
            try {
                const res = await fetch('/api/quotes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(item),
                });

                if (res.ok) {
                    await db.offlineEstimates.update(item.id!, {
                        syncStatus: 'synced',
                    });
                    // Optionally delete after sync to keep DB clean
                    // await db.offlineEstimates.delete(item.id!);
                } else {
                    console.error(`[PWA] Falha ao sincronizar item ${item.id}`);
                    const error = await res.text();
                    await db.offlineEstimates.update(item.id!, {
                        syncStatus: 'failed',
                        error: error
                    });
                }
            } catch (err) {
                console.error('[PWA] Erro na rede durante sincronização:', err);
                break; // Stop sync if network fails again
            }
        }

        setSyncing(false);
        await updatePendingCount();
    }, [syncing, updatePendingCount]);

    return {
        isOnline,
        syncing,
        pendingCount,
        saveOffline,
        syncAll
    };
}
