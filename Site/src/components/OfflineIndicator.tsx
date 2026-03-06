import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { motion, AnimatePresence } from 'motion/react';

export default function OfflineIndicator() {
    const { isOnline, pendingCount, syncing } = useOfflineSync();

    return (
        <AnimatePresence>
            {!isOnline || pendingCount > 0 ? (
                <motion.div
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    className={`fixed top-0 left-0 right-0 z-[1000] flex items-center justify-center gap-4 py-2 px-6 text-xs font-bold font-sans uppercase tracking-widest shadow-lg ${isOnline ? 'bg-amber-500 text-white' : 'bg-red-600 text-white'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        {!isOnline ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
                        <span>
                            {!isOnline
                                ? 'Modo Offline — Seus orçamentos serão sincronizados automaticamente ao conectar.'
                                : `Aguardando Sincronização: ${pendingCount} registro(s)`}
                        </span>
                    </div>
                    {syncing && (
                        <div className="flex items-center gap-2 border-l border-white/20 pl-4 ml-4">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Sincronizando...</span>
                        </div>
                    )}
                </motion.div>
            ) : null}
        </AnimatePresence>
    );
}
