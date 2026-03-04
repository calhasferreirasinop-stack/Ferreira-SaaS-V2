import { useState, useCallback } from 'react';

export function useApi<T>(basePath: string) {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(basePath, { credentials: 'include' });
            if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
            const json = await res.json();
            setData(json);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [basePath]);

    const create = async (item: Partial<T>) => {
        const res = await fetch(basePath, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
            credentials: 'include'
        });
        if (!res.ok) {
            const d = await res.json();
            throw new Error(d.error || 'Create error');
        }
        refresh();
    };

    const update = async (id: any, item: Partial<T>) => {
        const res = await fetch(`${basePath}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
            credentials: 'include'
        });
        if (!res.ok) {
            const d = await res.json();
            throw new Error(d.error || 'Update error');
        }
        refresh();
    };

    const remove = async (id: any) => {
        const res = await fetch(`${basePath}/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Delete error');
        refresh();
    };

    return { data, loading, error, refresh, create, update, remove };
}
