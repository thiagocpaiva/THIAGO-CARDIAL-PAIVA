
import React from 'react';

interface EquipmentTypeFigureProps {
  type: 'all' | 'freezer' | 'chopeira' | 'nao_cadastrado';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const EquipmentTypeFigure: React.FC<EquipmentTypeFigureProps> = ({
  type,
  className = '',
  size = 'md',
}) => {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5 sm:w-6 sm:h-6',
    lg: 'w-7 h-7 sm:w-8 sm:h-8',
  };

  const sz = sizeMap[size];

  switch (type) {
    case 'freezer':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={`${sz} shrink-0 ${className}`}>
          {/* Corpo do Freezer Horizontal / Chest Freezer */}
          <rect x="2" y="7" width="20" height="13" rx="2" fill="#e0f2fe" stroke="#0284c7" strokeWidth="1.5" />
          {/* Tampas superiores com divisão central */}
          <path d="M2 7V5.5C2 4.7 2.7 4 3.5 4h7.5V7H2z" fill="#bae6fd" stroke="#0284c7" strokeWidth="1.3" />
          <path d="M13 7V4h7.5c.8 0 1.5.7 1.5 1.5V7H13z" fill="#bae6fd" stroke="#0284c7" strokeWidth="1.3" />
          {/* Puxadores embutidos das tampas */}
          <rect x="5.5" y="4.8" width="4" height="1.2" rx="0.6" fill="#0369a1" />
          <rect x="14.5" y="4.8" width="4" height="1.2" rx="0.6" fill="#0369a1" />
          {/* Grade de ventilação lateral */}
          <line x1="18" y1="13" x2="20" y2="13" stroke="#0369a1" strokeWidth="1" strokeLinecap="round" />
          <line x1="18" y1="15" x2="20" y2="15" stroke="#0369a1" strokeWidth="1" strokeLinecap="round" />
          <line x1="18" y1="17" x2="20" y2="17" stroke="#0369a1" strokeWidth="1" strokeLinecap="round" />
          {/* Painel digital de temperatura na frente */}
          <rect x="4" y="10" width="4" height="2.5" rx="0.5" fill="#0369a1" />
          <circle cx="5" cy="11.2" r="0.4" fill="#38bdf8" />
          <circle cx="6.5" cy="11.2" r="0.4" fill="#38bdf8" />
          {/* Pés do freezer */}
          <rect x="4" y="20" width="2" height="1.5" rx="0.5" fill="#0369a1" />
          <rect x="18" y="20" width="2" height="1.5" rx="0.5" fill="#0369a1" />
        </svg>
      );

    case 'chopeira':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={`${sz} shrink-0 ${className}`}>
          {/* Chopeira Elétrica com Gabinete Inox, Torre e Torneiras de Chopp */}
          {/* Base / Pingadeira de inox com grade */}
          <rect x="4" y="19" width="16" height="3" rx="1" fill="#cbd5e1" stroke="#475569" strokeWidth="1.2" />
          <line x1="7" y1="20.5" x2="17" y2="20.5" stroke="#64748b" strokeWidth="1" strokeLinecap="round" strokeDasharray="1 1.5" />
          {/* Gabinete elétrico de resfriamento */}
          <rect x="6" y="10" width="12" height="9" rx="1.5" fill="#e2e8f0" stroke="#475569" strokeWidth="1.4" />
          {/* Grade frontal de resfriamento do compressor */}
          <line x1="8.5" y1="14" x2="15.5" y2="14" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" />
          <line x1="8.5" y1="16.5" x2="15.5" y2="16.5" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" />
          {/* Torre de Chopp cromada vertical */}
          <rect x="10.5" y="4" width="3" height="6" rx="0.8" fill="#f1f5f9" stroke="#334155" strokeWidth="1.3" />
          {/* Torneira 1 (Esquerda) com alavanca/manopla */}
          <path d="M10.5 6H8v2" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="8" y1="6" x2="6.5" y2="4" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
          {/* Torneira 2 (Direita) com alavanca/manopla */}
          <path d="M13.5 6H16v2" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="16" y1="6" x2="17.5" y2="4" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
          {/* Chapéu / topo da torre */}
          <ellipse cx="12" cy="4" rx="2" ry="0.8" fill="#94a3b8" stroke="#334155" strokeWidth="1" />
        </svg>
      );

    case 'nao_cadastrado':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={`${sz} shrink-0 ${className}`}>
          {/* Plaqueta / Etiqueta de Patrimônio com Ponto de Interrogação */}
          <rect x="3" y="5" width="18" height="14" rx="2.5" fill="#fef3c7" stroke="#d97706" strokeWidth="1.5" />
          {/* Furo para fixação / arrebite */}
          <circle cx="5.5" cy="7.5" r="1" fill="#b45309" />
          <circle cx="18.5" cy="7.5" r="1" fill="#b45309" />
          {/* Linhas de código de barras simulado na lateral */}
          <line x1="6" y1="12" x2="6" y2="16" stroke="#d97706" strokeWidth="1.2" />
          <line x1="8" y1="12" x2="8" y2="16" stroke="#d97706" strokeWidth="0.8" />
          <line x1="10" y1="12" x2="10" y2="16" stroke="#d97706" strokeWidth="1.5" />
          {/* Símbolo de Interrogação em destaque */}
          <path d="M14 10.5c0-1.2 1-2 2.2-2 1.3 0 2.3 1 2.3 2.1 0 .9-.6 1.4-1.3 1.8-.7.4-1.2.9-1.2 1.6v.5" stroke="#b45309" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="16" cy="16.5" r="0.9" fill="#b45309" />
        </svg>
      );

    case 'all':
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className={`${sz} shrink-0 ${className}`}>
          {/* Ícone de Todos os Equipamentos */}
          <rect x="3" y="4" width="8" height="16" rx="1.5" fill="#cffafe" stroke="#0891b2" strokeWidth="1.4" />
          <line x1="3" y1="10" x2="11" y2="10" stroke="#0891b2" strokeWidth="1.2" />
          <rect x="13" y="7" width="8" height="13" rx="1.5" fill="#ede9fe" stroke="#7c3aed" strokeWidth="1.4" />
          <path d="M17 7V5h2" stroke="#7c3aed" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="5" cy="7" r="0.6" fill="#0891b2" />
          <circle cx="15" cy="10" r="0.6" fill="#7c3aed" />
        </svg>
      );
  }
};
