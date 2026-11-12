
import React from 'react';

interface GrupoMSBrandProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  align?: 'center' | 'left';
  className?: string;
  showSubtitle?: boolean;
}

export const GRUPO_MS_LOGO_PATH = '/assets/aistudio/9b955f91-ebc0-4824-9af3-85c060323026_017e3b87.png';

/**
 * Componente oficial de exibição da marca "Grupo MS",
 * utilizando a imagem oficial em alta resolução com a fonte e geometria fiéis da marca.
 */
export const GrupoMSBrand: React.FC<GrupoMSBrandProps> = ({
  size = 'md',
  align = 'center',
  className = '',
  showSubtitle = false,
}) => {
  const alignClass = align === 'center' ? 'items-center text-center' : 'items-start text-left';

  // Configurações de altura mantendo proporção e nitidez cristalina
  const heights = {
    sm: 'h-8 sm:h-9',
    md: 'h-14 sm:h-16',
    lg: 'h-20 sm:h-22',
    hero: 'h-24 sm:h-28',
  };

  const currentHeight = heights[size] || heights.md;

  return (
    <div className={`flex flex-col ${alignClass} select-none ${className}`}>
      <img
        src={GRUPO_MS_LOGO_PATH}
        alt="GRUPO MS"
        className={`${currentHeight} w-auto object-contain pointer-events-none drop-shadow-xs`}
        loading="eager"
        decoding="async"
        onError={(e) => {
          if (!e.currentTarget.src.includes('logo-grupo-ms.png')) {
            e.currentTarget.src = '/logo-grupo-ms.png';
          }
        }}
      />

      {showSubtitle && (
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1.5">
          Gestão de Materiais & Equipamentos
        </span>
      )}
    </div>
  );
};
