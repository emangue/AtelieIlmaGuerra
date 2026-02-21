'use client';

/**
 * BottomNavigation - Navegação inferior mobile (estilo Finanças V5)
 * 5 tabs com FAB central para ação principal (Novo)
 * Ref: FotosAppSheet - layout similar ao app de metas/financeiro
 */

import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ClipboardList, Plus, FileText, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'painel', label: 'Painel', icon: LayoutDashboard, path: '/mobile' },
  { id: 'pedidos', label: 'Pedidos', icon: ClipboardList, path: '/mobile/pedidos' },
  { id: 'novo', label: 'Novo', icon: Plus, path: '/mobile/pedidos/novo' },
  { id: 'orcamentos', label: 'Orçamentos', icon: Receipt, path: '/mobile/orcamentos' },
  { id: 'contratos', label: 'Contratos', icon: FileText, path: '/mobile/contratos' },
];

export function BottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around h-20 px-2">
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const isActive =
            tab.path === '/mobile'
              ? pathname === '/mobile' || pathname === '/mobile/'
              : pathname.startsWith(tab.path);

          // FAB central (índice 2 = Novo)
          if (index === 2) {
            return (
              <div key={tab.id} className="flex flex-col items-center flex-1">
                <button
                  onClick={() => router.push(tab.path)}
                  className="
                    w-14 h-14 rounded-full bg-black text-white
                    flex items-center justify-center
                    shadow-lg -mt-6
                    transition-transform duration-150
                    active:scale-95 hover:bg-gray-800
                  "
                  aria-label={tab.label}
                >
                  <Icon className="w-6 h-6" />
                </button>
                <span className="text-xs mt-1 text-gray-600">{tab.label}</span>
              </div>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => router.push(tab.path)}
              className={cn(
                'flex flex-col items-center flex-1 py-2 transition-colors duration-150',
                isActive ? 'text-black' : 'text-gray-400'
              )}
              aria-label={tab.label}
            >
              <Icon className={cn('w-6 h-6', isActive && 'text-black')} />
              <span className="text-xs mt-1">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
