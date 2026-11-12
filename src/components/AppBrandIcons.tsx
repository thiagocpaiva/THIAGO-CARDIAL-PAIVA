
import React, { useState } from 'react';

interface AppBrandIconProps {
  type: 'full' | 'materiais' | 'equipamentos';
  size?: 'sm' | 'md' | 'lg' | 'hero';
  className?: string;
  showNames?: boolean;
}

export const AppBrandIcon: React.FC<AppBrandIconProps> = ({ 
  type, 
  size = 'md', 
  className = '',
  showNames = false,
}) => {
  // Animação apenas no hover; não mantém estado selecionado ao clicar
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Configurações de dimensão
  const sizeClasses = {
    sm: 'p-1 gap-1',
    md: 'p-1.5 gap-1.5',
    lg: 'p-2 gap-2',
    hero: 'p-2.5 sm:p-3 gap-2 sm:gap-2.5',
  };

  const iconSizeClasses = {
    sm: 'w-5 h-5 text-xs',
    md: 'w-7 h-7 text-sm',
    lg: 'w-8 h-8 text-base',
    hero: 'w-9 h-9 sm:w-10 sm:h-10 text-lg',
  };

  // Itens visuais representados com modelo padrão e modelo alternativo (mesmo modelo, outro tipo/perspectiva)
  const items = {
    mesa: {
      id: 'mesa',
      name: 'Mesa',
      shortName: 'Mesa',
      bg: 'bg-amber-100 text-amber-800 border-amber-300',
      activeBg: 'bg-amber-200 text-amber-950 border-amber-400 ring-2 ring-amber-400/40',
      svgDefault: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-amber-600 transition-all">
          <rect x="4" y="6" width="16" height="4" rx="1" fill="#fef3c7" />
          <path d="M7 10v10M17 10v10M2 13h3M19 13h3" />
        </svg>
      ),
      svgAlternate: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-amber-700 animate-in zoom-in-75 duration-200">
          {/* Mesa Redonda / Bistrô com Base Estrela */}
          <ellipse cx="12" cy="7" rx="9" ry="3.5" fill="#fde68a" stroke="#d97706" />
          <path d="M12 10.5v8" stroke="#b45309" strokeWidth="2.5" />
          <path d="M7 21l5-2.5 5 2.5" stroke="#b45309" strokeWidth="2" />
          <circle cx="12" cy="7" r="1.5" fill="#f59e0b" />
        </svg>
      ),
    },
    cadeira: {
      id: 'cadeira',
      name: 'Cadeira',
      shortName: 'Cadeira',
      bg: 'bg-orange-100 text-orange-800 border-orange-300',
      activeBg: 'bg-orange-200 text-orange-950 border-orange-400 ring-2 ring-orange-400/40',
      svgDefault: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-orange-600 transition-all">
          <path d="M7 4v7h10V4" />
          <rect x="5" y="11" width="14" height="3" rx="1" fill="#ffedd5" />
          <path d="M7 14v7M17 14v7" />
        </svg>
      ),
      svgAlternate: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-orange-700 animate-in zoom-in-75 duration-200">
          {/* Cadeira Dobrável em Perspectiva com Pés em X */}
          <path d="M6 3h12v7H6z" fill="#fed7aa" stroke="#ea580c" />
          <path d="M4 11h16l-2 3H6z" fill="#fdba74" stroke="#c2410c" />
          <path d="M6 14l10 7M18 14L8 21" stroke="#9a3412" strokeWidth="2" />
        </svg>
      ),
    },
    freezer: {
      id: 'freezer',
      name: 'Freezer',
      shortName: 'Freezer',
      bg: 'bg-sky-100 text-sky-800 border-sky-300',
      activeBg: 'bg-sky-200 text-sky-950 border-sky-400 ring-2 ring-sky-400/40',
      svgDefault: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-sky-600 transition-all">
          <rect x="2" y="5" width="20" height="14" rx="2" fill="#e0f2fe" />
          <line x1="2" y1="9" x2="22" y2="9" />
          <line x1="12" y1="5" x2="12" y2="9" />
          <circle cx="18" cy="14" r="1.5" fill="currentColor" />
        </svg>
      ),
      svgAlternate: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-sky-700 animate-in zoom-in-75 duration-200">
          {/* Freezer Aberto com Tampas Deslizantes e Cestos Internos */}
          <rect x="2" y="7" width="20" height="13" rx="2" fill="#bae6fd" stroke="#0284c7" />
          <path d="M3 7l3-4h12l3 4" stroke="#0369a1" strokeWidth="1.5" fill="#e0f2fe" />
          <rect x="5" y="9" width="6" height="5" rx="1" fill="#38bdf8" fillOpacity="0.4" stroke="#0284c7" />
          <rect x="13" y="9" width="6" height="5" rx="1" fill="#38bdf8" fillOpacity="0.4" stroke="#0284c7" />
          <path d="M12 4v3" stroke="#0284c7" />
          <circle cx="18" cy="16" r="1.5" fill="#0284c7" />
        </svg>
      ),
    },
    chopeira: {
      id: 'chopeira',
      name: 'Chopeira',
      shortName: 'Chopeira',
      bg: 'bg-purple-100 text-purple-800 border-purple-300',
      activeBg: 'bg-purple-200 text-purple-950 border-purple-400 ring-2 ring-purple-400/40',
      svgDefault: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-purple-600 transition-all">
          <rect x="5" y="7" width="14" height="13" rx="2" fill="#f3e8ff" />
          <path d="M10 7V3h4v4M8 3h8M12 7v3" />
          <circle cx="12" cy="14" r="2" fill="currentColor" />
        </svg>
      ),
      svgAlternate: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-purple-700 animate-in zoom-in-75 duration-200">
          {/* Chopeira Elétrica com Torre Dupla Naja e Pingadeira */}
          <rect x="4" y="9" width="16" height="12" rx="2" fill="#e9d5ff" stroke="#7e22ce" />
          <path d="M10 9V4c0-.6.4-1 1-1h2c.6 0 1 .4 1 1v5" stroke="#6b21a8" strokeWidth="2" />
          <path d="M9 5h1M14 5h1" stroke="#6b21a8" strokeWidth="2" strokeLinecap="round" />
          <path d="M8 15h8M8 18h8" stroke="#9333ea" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="1.5" fill="#a855f7" />
        </svg>
      ),
    },
    caixaTermica: {
      id: 'caixa',
      name: 'Caixa Térmica',
      shortName: 'Caixa Térmica',
      bg: 'bg-blue-100 text-blue-800 border-blue-300',
      activeBg: 'bg-blue-200 text-blue-950 border-blue-400 ring-2 ring-blue-400/40',
      svgDefault: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-blue-600 transition-all">
          <rect x="3" y="8" width="18" height="12" rx="2" fill="#dbeafe" />
          <path d="M7 8V4h10v4" />
          <line x1="3" y1="12" x2="21" y2="12" />
        </svg>
      ),
      svgAlternate: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-blue-700 animate-in zoom-in-75 duration-200">
          {/* Caixa Térmica Aberta com Tampa Inclinada */}
          <rect x="3" y="9" width="18" height="12" rx="2" fill="#93c5fd" stroke="#1d4ed8" />
          <path d="M3 9L9 3h12l-6 6" fill="#bfdbfe" stroke="#1e40af" strokeWidth="1.5" />
          <path d="M7 13h2v2H7zM15 13h2v2h-2z" fill="#ffffff" />
          <circle cx="12" cy="14" r="1.5" fill="#2563eb" />
        </svg>
      ),
    },
    barril: {
      id: 'barril',
      name: 'Barril Chopp',
      shortName: 'Barril',
      bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      activeBg: 'bg-emerald-200 text-emerald-950 border-emerald-400 ring-2 ring-emerald-400/40',
      svgDefault: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-emerald-600 transition-all">
          <ellipse cx="12" cy="5" rx="7" ry="2.5" fill="#d1fae5" />
          <path d="M5 5v14c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5" fill="#ecfdf5" />
          <ellipse cx="12" cy="19" rx="7" ry="2.5" fill="#a7f3d0" />
          <line x1="5" y1="12" x2="19" y2="12" strokeDasharray="2 2" />
        </svg>
      ),
      svgAlternate: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-emerald-700 animate-in zoom-in-75 duration-200">
          {/* Barril Slim Keg Inox com Válvula Extratora no Topo */}
          <rect x="6" y="5" width="12" height="15" rx="3" fill="#a7f3d0" stroke="#047857" />
          <path d="M6 8h12M6 17h12" stroke="#065f46" strokeWidth="1.5" />
          <path d="M12 5V2M10 2h4" stroke="#065f46" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="12" cy="12.5" rx="2" ry="1.5" fill="#059669" />
        </svg>
      ),
    },
    co2: {
      id: 'co2',
      name: 'Cilindro CO2',
      shortName: 'CO2',
      bg: 'bg-teal-100 text-teal-800 border-teal-300',
      activeBg: 'bg-teal-200 text-teal-950 border-teal-400 ring-2 ring-teal-400/40',
      svgDefault: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-teal-600 transition-all">
          <rect x="8" y="7" width="8" height="14" rx="4" fill="#ccfbf1" />
          <path d="M12 7V3M10 3h4" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
      ),
      svgAlternate: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-teal-700 animate-in zoom-in-75 duration-200">
          {/* Cilindro com Regulador de Pressão Duplo e Manômetros Analógicos */}
          <rect x="8" y="8" width="8" height="13" rx="4" fill="#99f6e4" stroke="#0f766e" />
          <path d="M12 8V4" stroke="#0f766e" strokeWidth="2" />
          <circle cx="8" cy="4" r="2.5" fill="#f0fdfa" stroke="#0f766e" strokeWidth="1.5" />
          <circle cx="16" cy="4" r="2.5" fill="#f0fdfa" stroke="#0f766e" strokeWidth="1.5" />
          <path d="M8 4l1-1M16 4l1-1" stroke="#0d9488" strokeWidth="1" />
          <circle cx="12" cy="13" r="1.5" fill="#0d9488" />
        </svg>
      ),
    }
  };

  // Seleciona quais itens mostrar conforme a tela:
  // - Tela de Login: Mesa, Cadeira, Freezer, Chopeira, Caixa Térmica, Barril e CO2
  // - Tela de Materiais: Mesa, Cadeira, Caixa Térmica, Barril e CO2
  // - Tela de Equipamentos: Freezer e Chopeira
  let activeItems = [
    items.mesa,
    items.cadeira,
    items.freezer,
    items.chopeira,
    items.caixaTermica,
    items.barril,
    items.co2
  ];

  if (type === 'materiais') {
    activeItems = [
      items.mesa,
      items.cadeira,
      items.caixaTermica,
      items.barril,
      items.co2
    ];
  } else if (type === 'equipamentos') {
    activeItems = [
      items.freezer,
      items.chopeira
    ];
  }

  return (
    <div className={`inline-flex items-start justify-center rounded-2xl bg-white border border-slate-200 shadow-sm ${sizeClasses[size]} ${className}`}>
      {activeItems.map(item => {
        const isAlternate = hoveredId === item.id;
        return (
          <div 
            key={item.id} 
            className="flex flex-col items-center gap-1 min-w-[32px] sm:min-w-[40px] select-none"
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div 
              className={`flex items-center justify-center rounded-xl p-1 border shadow-xs transition-all duration-300 ease-out cursor-default shrink-0 ${
                isAlternate 
                  ? `${item.activeBg} scale-110 -translate-y-0.5 shadow-md` 
                  : `${item.bg} hover:scale-105`
              } ${iconSizeClasses[size]}`}
            >
              {isAlternate ? item.svgAlternate : item.svgDefault}
            </div>
            {showNames && (
              <span className={`text-[9px] sm:text-[10px] font-bold tracking-tight text-center leading-tight flex flex-col items-center justify-start transition-colors ${
                isAlternate ? 'text-emerald-800 font-extrabold' : 'text-slate-700'
              }`}>
                {item.id === 'caixa' ? (
                  <>
                    <span>Caixa</span>
                    <span>Térmica</span>
                  </>
                ) : (
                  <span>{item.shortName}</span>
                )}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
