import { useState } from 'react';
import { Timer } from 'lucide-react';
import DottedSphere from '../components/DottedSphere';
import './DottedSpherePage.css';

const DottedSpherePage = () => {
  const [timerMode, setTimerMode] = useState(false);
  const [targetNumPoints, setTargetNumPoints] = useState(800);

  return (
    <div className="dotted-sphere-page">
      <div className="timer-toggle-wrapper">
        <button
          onClick={() => setTimerMode(!timerMode)}
          className={`toggle-button ${timerMode ? 'active' : ''}`}
          aria-label="Toggle timer mode"
        >
          <div className={`toggle-slider ${timerMode ? 'active' : ''}`} />
        </button>
        <Timer className={`timer-icon ${timerMode ? 'active' : ''}`} />
      </div>
      
      <div className="sphere-container">
        <DottedSphere timerMode={timerMode} numPoints={targetNumPoints} />
      </div>
      
      <div className="controls-container">
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
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem',
          width: '600px',
          paddingLeft: '64px',
          paddingRight: '64px'
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="2" fill="#9CA3AF"/>
            <circle cx="8" cy="16" r="2" fill="#9CA3AF"/>
            <circle cx="16" cy="16" r="2" fill="#9CA3AF"/>
          </svg>
          
          <div className="styled-slider-wrapper">
            <div className="styled-slider-track" />
            <div 
              className="styled-slider-fill" 
              style={{ width: `${((targetNumPoints - 200) / 1000) * 100}%` }}
            />
            <input
              type="range"
              min="200"
              max="1200"
              value={targetNumPoints}
              onChange={(e) => setTargetNumPoints(Number(e.target.value))}
              className="styled-slider"
            />
          </div>
          
          <svg width="24" height="24" viewBox="0 0 24 24">
            <circle cx="12" cy="6" r="1.5" fill="#6B7280"/>
            <circle cx="18" cy="10" r="1.5" fill="#6B7280"/>
            <circle cx="16" cy="17" r="1.5" fill="#6B7280"/>
            <circle cx="8" cy="17" r="1.5" fill="#6B7280"/>
            <circle cx="6" cy="10" r="1.5" fill="#6B7280"/>
            <circle cx="12" cy="12" r="1.5" fill="#6B7280"/>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default DottedSpherePage;

