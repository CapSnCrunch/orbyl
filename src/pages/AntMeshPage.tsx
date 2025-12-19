import { useState } from 'react';
import AntMesh from '../components/AntMesh';
import './AntMeshPage.css';

const AntMeshPage = () => {
  const [gridSize, setGridSize] = useState(18);

  return (
    <div className="ant-mesh-page">
      <div className="ant-mesh-container">
        <AntMesh gridSize={gridSize} />
      </div>
      
      <div className="ant-mesh-controls-container">
        <style>{`
          .styled-slider-wrapper {
            position: relative;
            width: 100%;
            height: 12px;
            display: flex;
            align-items: center;
          }
          
          .styled-slider-track {
            position: absolute;
            left: 0;
            right: 0;
            height: 6px;
            background: #e5e7eb;
            border-radius: 6px;
            pointer-events: none;
          }
          
          .styled-slider-fill {
            position: absolute;
            left: 0;
            height: 12px;
            background: #666;
            border-radius: 12px;
            pointer-events: none;
          }
          
          .styled-slider {
            position: relative;
            width: 100%;
            height: 12px;
            cursor: pointer;
            -webkit-appearance: none;
            appearance: none;
            outline: none;
            background: transparent;
            z-index: 1;
          }
          
          .styled-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 12px;
            height: 12px;
            border-radius: 12px;
            background: transparent;
            cursor: pointer;
            border: none;
          }
          
          .styled-slider::-moz-range-thumb {
            width: 12px;
            height: 12px;
            border-radius: 12px;
            background: transparent;
            cursor: pointer;
            border: none;
          }
        `}</style>
        
        <svg width="24" height="24" viewBox="0 0 24 24">
          <rect x="6" y="6" width="4" height="4" fill="#9CA3AF"/>
          <rect x="14" y="6" width="4" height="4" fill="#9CA3AF"/>
          <rect x="6" y="14" width="4" height="4" fill="#9CA3AF"/>
          <rect x="14" y="14" width="4" height="4" fill="#9CA3AF"/>
        </svg>
        
        <div className="styled-slider-wrapper">
          <div className="styled-slider-track" />
          <div 
            className="styled-slider-fill" 
            style={{ width: `${((gridSize - 10) / 14) * 100}%` }}
          />
          <input
            type="range"
            id="gridSize"
            min="10"
            max="24"
            value={gridSize}
            onChange={(e) => setGridSize(Number(e.target.value))}
            className="styled-slider"
          />
        </div>
        
        <svg width="24" height="24" viewBox="0 0 24 24">
          <rect x="3" y="3" width="3" height="3" fill="#6B7280"/>
          <rect x="7.5" y="3" width="3" height="3" fill="#6B7280"/>
          <rect x="12" y="3" width="3" height="3" fill="#6B7280"/>
          <rect x="16.5" y="3" width="3" height="3" fill="#6B7280"/>
          <rect x="3" y="7.5" width="3" height="3" fill="#6B7280"/>
          <rect x="7.5" y="7.5" width="3" height="3" fill="#6B7280"/>
          <rect x="12" y="7.5" width="3" height="3" fill="#6B7280"/>
          <rect x="16.5" y="7.5" width="3" height="3" fill="#6B7280"/>
          <rect x="3" y="12" width="3" height="3" fill="#6B7280"/>
          <rect x="7.5" y="12" width="3" height="3" fill="#6B7280"/>
          <rect x="12" y="12" width="3" height="3" fill="#6B7280"/>
          <rect x="16.5" y="12" width="3" height="3" fill="#6B7280"/>
          <rect x="3" y="16.5" width="3" height="3" fill="#6B7280"/>
          <rect x="7.5" y="16.5" width="3" height="3" fill="#6B7280"/>
          <rect x="12" y="16.5" width="3" height="3" fill="#6B7280"/>
          <rect x="16.5" y="16.5" width="3" height="3" fill="#6B7280"/>
        </svg>
      </div>
    </div>
  );
};

export default AntMeshPage;
