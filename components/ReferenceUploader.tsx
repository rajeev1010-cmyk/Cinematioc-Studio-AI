
import React, { useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { ReferenceType } from '../types';

interface ReferenceUploaderProps {
  slot: { id: ReferenceType; label: string };
  dataUrl?: string;
  onUpload: (dataUrl: string, mimeType: string) => void;
  onRemove: () => void;
}

const ReferenceUploader: React.FC<ReferenceUploaderProps> = ({ slot, dataUrl, onUpload, onRemove }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        onUpload(result, file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div 
      className={`relative group rounded-lg lg:rounded-xl overflow-hidden aspect-square border-2 border-dashed transition-all ${
        dataUrl 
          ? 'border-indigo-500/50 bg-[#1a1a1a]' 
          : 'border-white/5 hover:border-white/20 bg-white/5'
      }`}
    >
      {dataUrl ? (
        <>
          <img src={dataUrl} alt={slot.label} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 bg-black/60 opacity-0 lg:group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity gap-1 lg:gap-2 p-1.5">
            <span className="text-[8px] lg:text-[10px] text-white font-medium text-center leading-tight truncate w-full px-1">{slot.label}</span>
            <button 
              onClick={onRemove}
              className="bg-red-500/80 hover:bg-red-500 text-white p-1 rounded-full transition-colors"
            >
              <X className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
            </button>
          </div>
          {/* Mobile indicator that it has image */}
          <div className="lg:hidden absolute top-1 right-1">
             <div className="bg-indigo-500 w-2 h-2 rounded-full shadow-lg shadow-indigo-500/50"></div>
          </div>
        </>
      ) : (
        <label className="flex flex-col items-center justify-center h-full cursor-pointer p-2 lg:p-4 text-center group">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleChange} 
            className="hidden" 
            accept="image/*"
          />
          <div className="w-6 h-6 lg:w-10 lg:h-10 rounded-full bg-white/5 flex items-center justify-center mb-1.5 lg:mb-3 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors text-white/20">
            <Upload className="w-3 h-3 lg:w-5 lg:h-5" />
          </div>
          <span className="text-[7px] lg:text-[10px] text-white/40 font-semibold tracking-wider uppercase group-hover:text-white/60 transition-colors leading-tight">
            {slot.label}
          </span>
        </label>
      )}
    </div>
  );
};

export default ReferenceUploader;
