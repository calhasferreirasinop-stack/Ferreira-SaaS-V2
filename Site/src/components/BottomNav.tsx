import { Link, useLocation } from 'react-router-dom';
import { Calculator, LayoutGrid, Factory, ClipboardList, User, Users, Package, UserCircle, DollarSign } from 'lucide-react';
import { clsx } from 'clsx';

export default function BottomNav() {
    const location = useLocation();

    const navItems = [
        {
            label: 'Orçamento',
            icon: Calculator,
            path: '/app/orcamentos',
        },
        {
            label: 'Central',
            icon: LayoutGrid,
            path: '/app/gestao-orcamentos',
        },
        {
            label: 'Financeiro',
            icon: ClipboardList,
            path: '/app/dashboard-financeiro',
        },
        {
            label: 'Receber',
            icon: DollarSign,
            path: '/app/contas-a-receber',
        },
        {
            label: 'Parâmetros',
            icon: UserCircle,
            path: '/app/parametros',
        },
    ];

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-2xl border-t border-white/10 z-50 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_32px_rgba(0,0,0,0.5)]">
            <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
                {navItems.map((item) => {
                    const isActive = (item.path.includes('?')
                        ? (location.pathname + location.search) === item.path
                        : (location.pathname === item.path && location.search === ''));
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={clsx(
                                "flex flex-col items-center justify-center flex-1 min-w-[64px] h-full gap-1 transition-all active:scale-90",
                                isActive ? "text-brand-primary" : "text-slate-500"
                            )}
                        >
                            <div className={clsx(
                                "p-2 rounded-2xl transition-all duration-300",
                                isActive ? "bg-brand-primary shadow-lg shadow-brand-primary/20 scale-110" : "bg-transparent"
                            )}>
                                <Icon className={clsx("w-6 h-6", isActive ? "text-white stroke-[2.5px]" : "stroke-2")} />
                            </div>
                            <span className={clsx(
                                "text-[10px] font-bold uppercase tracking-tight",
                                isActive ? "text-brand-primary opacity-100" : "text-slate-500 opacity-80"
                            )}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
