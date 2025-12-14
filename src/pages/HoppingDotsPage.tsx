import { useState } from 'react';
import HoppingDots from '../components/HoppingDots';
import './HoppingDotsPage.css';

const HoppingDotsPage = () => {
  const [frogCount, setFrogCount] = useState(1);

  return (
    <div className="hopping-dots-page">
      <div className="hopping-dots-container">
        <HoppingDots frogCount={frogCount} />
      </div>
      
      <div className="hopping-controls-container">
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
          <circle 
            cx="12" 
            cy="12" 
            r="8" 
            fill="none" 
            stroke="#9CA3AF" 
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        </svg>
        
        <div className="styled-slider-wrapper">
          <div className="styled-slider-track" />
          <div 
            className="styled-slider-fill" 
            style={{ width: `${((frogCount - 1) / 19) * 100}%` }}
          />
          <input
            type="range"
            id="frogCount"
            min="1"
            max="20"
            value={frogCount}
            onChange={(e) => setFrogCount(Number(e.target.value))}
            className="styled-slider"
          />
        </div>
        
        <svg width="24" height="24" viewBox="0 0 24 24">
          <circle 
            cx="12" 
            cy="12" 
            r="8" 
            fill="none" 
            stroke="#6B7280" 
            strokeWidth="2"
            strokeDasharray="2 2"
          />
          <circle 
            cx="12" 
            cy="12" 
            r="5" 
            fill="none" 
            stroke="#6B7280" 
            strokeWidth="2"
            strokeDasharray="2 2"
          />
        </svg>
      </div>
    </div>
  );
};

export default HoppingDotsPage;
