
import React from 'react';

interface GrupoMsLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const GrupoMsLogo: React.FC<GrupoMsLogoProps> = ({ 
  className = '',
  size = 'md' 
}) => {
  const [hasFailed, setHasFailed] = React.useState(false);

  const sizeClasses = {
    sm: 'h-10 max-h-10',
    md: 'h-13 max-h-13',
    lg: 'h-18 max-h-18',
  };

  if (hasFailed) {
    return (
      <div className={`flex items-center gap-2 select-none ${className}`}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-900 to-amber-600 flex items-center justify-center shadow-md text-white font-black text-base tracking-tighter border border-white/20">
          MS
        </div>
        <div className="text-left">
          <div className="text-lg font-black tracking-tight text-slate-900 leading-none">
            GRUPO <span className="text-amber-600">MS</span>
          </div>
          <div className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">
            Distribuição & Logística
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      {/* Logomarca oficial Grupo MS do anexo em alta fidelidade */}
      <img
        src="/assets/aistudio/9b955f91-ebc0-4824-9af3-85c060323026_017e3b87.png"
        alt="Grupo MS"
        className={`${sizeClasses[size]} w-auto object-contain transition-transform hover:scale-105`}
        loading="eager"
        onError={(e) => {
          if (!e.currentTarget.src.includes('logo-grupo-ms.png')) {
            e.currentTarget.src = '/logo-grupo-ms.png';
          } else {
            setHasFailed(true);
          }
        }}
      />
    </div>
  );
};
