
import React from 'react';
import { MaterialCategory } from '../types/inventory';

interface CategoryIconProps {
  category: MaterialCategory | string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const MaterialCategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  className = '',
  size = 'md',
}) => {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5 sm:w-6 sm:h-6',
    lg: 'w-8 h-8',
  };

  const sz = sizeMap[size];

  switch (category) {
    case 'mesa_plastica':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={`${sz} shrink-0 ${className}`}>
          {/* Mesa Plástica Quadrada */}
          <rect x="3" y="6" width="18" height="4" rx="1.5" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />
          <path d="M5 10v10M19 10v10" stroke="#ca8a04" strokeWidth="2" strokeLinecap="round" />
          <path d="M8 10v7M16 10v7" stroke="#eab308" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="4" y1="8" x2="20" y2="8" stroke="#facc15" strokeWidth="1" />
        </svg>
      );

    case 'mesa_madeira':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={`${sz} shrink-0 ${className}`}>
          {/* Mesa de Madeira Rústica / Tablado */}
          <rect x="2" y="6" width="20" height="4.5" rx="1" fill="#d97706" stroke="#78350f" strokeWidth="1.5" />
          <line x1="2" y1="8.2" x2="22" y2="8.2" stroke="#92400e" strokeWidth="1" />
          <path d="M5 10.5v9.5M19 10.5v9.5" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M5 14h14" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case 'cadeira_plastica_com_braco':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={`${sz} shrink-0 ${className}`}>
          {/* Cadeira Plástica COM Braço */}
          <path d="M7 4h10v7H7z" fill="#fed7aa" stroke="#ea580c" strokeWidth="1.5" />
          {/* Braços laterais proeminentes */}
          <path d="M4 9v4h3M20 9v4h-3" stroke="#c2410c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {/* Assento */}
          <rect x="4" y="13" width="16" height="3" rx="1" fill="#ffedd5" stroke="#ea580c" strokeWidth="1.5" />
          {/* Pés */}
          <path d="M6 16v5M18 16v5" stroke="#c2410c" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'cadeira_plastica_sem_braco':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={`${sz} shrink-0 ${className}`}>
          {/* Cadeira Plástica SEM Braço */}
          <path d="M7 3h10v9H7z" fill="#fed7aa" stroke="#ea580c" strokeWidth="1.5" />
          <path d="M10 5v5M14 5v5" stroke="#fb923c" strokeWidth="1" />
          {/* Assento sem braços */}
          <rect x="5" y="12" width="14" height="3" rx="1" fill="#ffedd5" stroke="#ea580c" strokeWidth="1.5" />
          {/* Pés */}
          <path d="M7 15v6M17 15v6" stroke="#c2410c" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'cadeira_madeira':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={`${sz} shrink-0 ${className}`}>
          {/* Cadeira de Madeira com Travessas */}
          <path d="M6 3h12v9H6z" fill="#b45309" stroke="#78350f" strokeWidth="1.5" />
          <path d="M9 5v5M12 5v5M15 5v5" stroke="#fde68a" strokeWidth="1" strokeLinecap="round" />
          {/* Assento Madeira */}
          <rect x="5" y="12" width="14" height="3" rx="0.5" fill="#d97706" stroke="#78350f" strokeWidth="1.5" />
          {/* Pés com travessas */}
          <path d="M7 15v6M17 15v6" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
          <path d="M7 18h10" stroke="#92400e" strokeWidth="1.5" />
        </svg>
      );

    case 'caixa_termica':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={`${sz} shrink-0 ${className}`}>
          {/* Caixa Térmica / Cooler com Alça e Travas */}
          <rect x="3" y="9" width="18" height="11" rx="2" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
          {/* Tampa Branca/Azul Clara */}
          <path d="M2 7h20v3H2z" fill="#e0f2fe" stroke="#0284c7" strokeWidth="1.5" />
          {/* Alça superior */}
          <path d="M7 7V4c0-.6.4-1 1-1h8c.6 0 1 .4 1 1v3" stroke="#0369a1" strokeWidth="1.8" strokeLinecap="round" />
          {/* Trava frontal */}
          <rect x="10.5" y="9" width="3" height="3" rx="0.5" fill="#f8fafc" stroke="#0284c7" strokeWidth="1" />
        </svg>
      );

    case 'barril':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={`${sz} shrink-0 ${className}`}>
          {/* Barril / Keg de Chopp em Inox */}
          <rect x="5" y="5" width="14" height="15" rx="3" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
          {/* Aros e Ranhuras */}
          <line x1="5" y1="9" x2="19" y2="9" stroke="#64748b" strokeWidth="1.5" />
          <line x1="5" y1="13" x2="19" y2="13" stroke="#64748b" strokeWidth="1.5" />
          <line x1="5" y1="16" x2="19" y2="16" stroke="#64748b" strokeWidth="1.5" />
          {/* Alças superiores do Keg */}
          <rect x="7" y="6" width="3" height="1.5" rx="0.5" fill="#f8fafc" stroke="#334155" strokeWidth="0.8" />
          <rect x="14" y="6" width="3" height="1.5" rx="0.5" fill="#f8fafc" stroke="#334155" strokeWidth="0.8" />
          {/* Válvula central superior */}
          <circle cx="12" cy="4" r="1.5" fill="#94a3b8" stroke="#334155" strokeWidth="1" />
        </svg>
      );

    case 'co2':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={`${sz} shrink-0 ${className}`}>
          {/* Cilindro de Gás CO2 com Válvula e Manômetros */}
          <rect x="8" y="8" width="8" height="13" rx="2" fill="#14b8a6" stroke="#0f766e" strokeWidth="1.5" />
          {/* Ombro arredondado */}
          <path d="M8 9c0-2 2-3 4-3s4 1 4 3" fill="#0d9488" />
          {/* Gargalo */}
          <rect x="10.5" y="5" width="3" height="2" fill="#0f766e" />
          {/* Válvula de topo com volante */}
          <path d="M12 5V2.5M10 2.5h4" stroke="#0f766e" strokeWidth="1.8" strokeLinecap="round" />
          {/* Manômetros circulares duplos */}
          <circle cx="9" cy="4.5" r="1.5" fill="#f0fdfa" stroke="#0f766e" strokeWidth="1" />
          <circle cx="15" cy="4.5" r="1.5" fill="#f0fdfa" stroke="#0f766e" strokeWidth="1" />
          {/* Nível / Rótulo */}
          <rect x="9.5" y="11" width="5" height="4" rx="0.5" fill="#ccfbf1" stroke="#0d9488" strokeWidth="0.8" />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${sz} shrink-0 ${className}`}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      );
  }
};

export const MaterialCategoryFigure = MaterialCategoryIcon;
