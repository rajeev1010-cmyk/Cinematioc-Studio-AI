import React, { useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon, Cloud, Camera } from 'lucide-react';
import { ReferenceType } from '../types';
import { showPicker, fetchGoogleFile } from '../services/googlePickerService';

interface ReferenceUploaderProps {
  slot: { id: ReferenceType; label: string };
  dataUrl?: string;
  onUpload: (dataUrl: string, mimeType: string) => void;
  onRemove: () => void;
}

const ReferenceUploader: React.FC<ReferenceUploaderProps> = ({ slot, dataUrl, onUpload, onRemove }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPickerLoading, setIsPickerLoading] = useState(false);

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

  const handlePicker = async (type: 'drive' | 'photos') => {
    setIsPickerLoading(true);
    try {
      const fileId = await showPicker(type);
      if (fileId) {
        // If it's a URL (Photos sometimes returns URLs)
        if (fileId.startsWith('http')) {
          // For simplicity, we'll try to fetch it if it's a direct image link
          // But usually Picker returns the link to the file.
          // For this app, we need the actual data.
          onUpload(fileId, 'image/jpeg'); // Mocking mime if URL
        } else {
          const { dataUrl, mimeType } = await fetchGoogleFile(fileId);
          onUpload(dataUrl, mimeType);
        }
      }
    } catch (error) {
      console.error("Picker failed", error);
      alert("Failed to access Google " + (type === 'drive' ? 'Drive' : 'Photos'));
    } finally {
      setIsPickerLoading(false);
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
          <img src={dataUrl} alt={slot.label} className="w-full h-full object-cover opacity-80 lg:group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 bg-black/60 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity gap-1 lg:gap-2 p-1.5">
            <span className="text-[7px] lg:text-[10px] text-white font-medium text-center leading-tight truncate w-full px-1">{slot.label}</span>
            <button 
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="bg-red-500/80 hover:bg-red-500 text-white p-1 rounded-full transition-colors"
            >
              <X className="w-2.5 h-2.5 lg:w-3.5 lg:h-3.5" />
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full p-2 lg:p-4 text-center group bg-[#0d0d0d]">
          <div className="w-6 h-6 lg:w-10 lg:h-10 rounded-full bg-white/5 flex items-center justify-center mb-1 lg:mb-3 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors text-white/20">
            <Upload className="w-3 h-3 lg:w-5 lg:h-5" />
          </div>
          <span className="text-[6px] lg:text-[10px] text-white/40 font-semibold tracking-wider uppercase group-hover:text-white/60 transition-colors leading-tight mb-2">
            {slot.label}
          </span>
          <div className="flex gap-1 lg:gap-2">
            <label className="p-1 lg:p-1.5 bg-white/5 hover:bg-white/10 rounded cursor-pointer transition-colors" title="Upload Local">
              <input type="file" ref={fileInputRef} onChange={handleChange} className="hidden" accept="image/*" />
              <Upload className="w-2.5 h-2.5 lg:w-3.5 lg:h-3.5 text-white/30" />
            </label>
            <button 
              disabled={isPickerLoading}
              onClick={() => handlePicker('drive')}
              className="p-1 lg:p-1.5 bg-white/5 hover:bg-white/10 rounded cursor-pointer transition-colors disabled:opacity-50" 
              title="Google Drive"
            >
              <Cloud className="w-2.5 h-2.5 lg:w-3.5 lg:h-3.5 text-white/30" />
            </button>
            <button 
              disabled={isPickerLoading}
              onClick={() => handlePicker('photos')}
              className="p-1 lg:p-1.5 bg-white/5 hover:bg-white/10 rounded cursor-pointer transition-colors disabled:opacity-50" 
              title="Google Photos"
            >
              <Camera className="w-2.5 h-2.5 lg:w-3.5 lg:h-3.5 text-white/30" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferenceUploader;