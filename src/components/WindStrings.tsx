import { useState, useEffect, useRef, useMemo } from 'react';
import { Wind } from 'lucide-react';

// Seeded random number generator for consistent positions
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
};

interface Segment {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

interface StringData {
  id: number;
  anchorX: number;
  anchorY: number;
  anchorZ: number;
  segments: Segment[];
  phase: number;
  currentLength: number;
  targetLength: number;
}

interface WindStates {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
}

interface WindForces {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

type Direction = keyof WindStates;

const WindStringsVisualization = () => {
  const [windStates, setWindStates] = useState<WindStates>({
    left: false,
    right: false,
    top: false,
    bottom: false
  });
  const [strings, setStrings] = useState<StringData[]>([]);
  const [stringCount, setStringCount] = useState(40);
  const animationFrameRef = useRef<number | null>(null);
  const windForces = useRef<WindForces>({
    left: 0,
    right: 0,
    top: 0,
    bottom: 0
  });
  const timeRef = useRef<number>(0);
  
  const maxStrings = 80;
  const stringLength = 8;
  const segmentLength = 10;
  
  const viewAngle = useRef({ rotX: 90, rotY: 0 });
  
  // Pre-generate all possible string positions in a spiral pattern
  const stringPositions = useMemo(() => {
    const positions: Array<{ x: number; z: number; phase: number }> = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.5 degrees
    const spacing = 18;
    
    for (let i = 0; i < maxStrings; i++) {
      const angle = i * goldenAngle;
      const radius = spacing * Math.sqrt(i);
      positions.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        phase: seededRandom(i * 17) * Math.PI * 2
      });
    }
    return positions;
  }, []);
  
  const noise = (x: number, y: number, z: number, t: number): number => {
    return (
      Math.sin(x * 0.5 + t) * Math.cos(y * 0.3 + t * 0.7) +
      Math.sin(z * 0.8 - t * 1.3) * 0.5 +
      Math.cos(y * 0.6 + t * 0.9) * 0.5 +
      Math.sin((x + y + z) * 0.4 + t * 1.1) * 0.3
    );
  };
  
  const turbulence = (x: number, y: number, z: number, t: number): number => {
    return (
      noise(x * 0.02, y * 0.02, z * 0.02, t * 0.8) * 0.5 +
      noise(x * 0.05, y * 0.05, z * 0.05, t * 1.5) * 0.25 +
      noise(x * 0.1, y * 0.1, z * 0.1, t * 2.5) * 0.125
    );
  };
  
  // Initialize strings
  useEffect(() => {
    const initialStrings: StringData[] = [];
    for (let i = 0; i < maxStrings; i++) {
      const pos = stringPositions[i];
      const segments: Segment[] = [];
      
      for (let j = 0; j <= stringLength; j++) {
        segments.push({
          x: pos.x,
          y: -j * segmentLength,
          z: pos.z,
          vx: 0,
          vy: 0,
          vz: 0
        });
      }
      
      initialStrings.push({
        id: i,
        anchorX: pos.x,
        anchorY: 0,
        anchorZ: pos.z,
        segments: segments,
        phase: pos.phase,
        currentLength: i < 40 ? 1 : 0,
        targetLength: i < 40 ? 1 : 0
      });
    }
    setStrings(initialStrings);
  }, [stringPositions]);
  
  // Update target lengths when stringCount changes
  useEffect(() => {
    setStrings(prev => prev.map((string, i) => ({
      ...string,
      targetLength: i < stringCount ? 1 : 0
    })));
  }, [stringCount]);
  
  useEffect(() => {
    if (!strings.length) return;
    
    const animate = () => {
      timeRef.current += 0.016;
      const t = timeRef.current;
      
      (Object.keys(windForces.current) as Direction[]).forEach(dir => {
        const gustIntensity = windStates[dir] ? 
          (1 + Math.sin(t * 1.5 + dir.length) * 0.2 + Math.sin(t * 3.7 + dir.length * 2) * 0.15) : 0;
        
        if (windStates[dir]) {
          windForces.current[dir] = Math.min(windForces.current[dir] + 0.02, 0.4 * gustIntensity);
        } else {
          windForces.current[dir] = Math.max(windForces.current[dir] - 0.015, 0);
        }
      });
      
      setStrings(prevStrings => {
        return prevStrings.map(string => {
          // Animate length toward target
          const lengthDiff = string.targetLength - string.currentLength;
          const newLength = Math.abs(lengthDiff) < 0.01 
            ? string.targetLength 
            : string.currentLength + lengthDiff * 0.08;
          
          if (newLength < 0.01) {
            return { ...string, currentLength: newLength };
          }
          
          const newSegments = string.segments.map(s => ({...s}));
          const activeSegments = Math.ceil(stringLength * newLength) + 1;
          const effectiveSegmentLength = segmentLength * newLength;
          
          // Check if any wind is active
          const hasActiveWind = windForces.current.left > 0 || 
                                windForces.current.right > 0 || 
                                windForces.current.top > 0 || 
                                windForces.current.bottom > 0;
          
          // If string is growing and there's no wind, position segments in natural hanging position
          const isGrowing = lengthDiff > 0.01;
          const shouldUseNaturalPosition = isGrowing && !hasActiveWind;
          
          newSegments[0] = {
            ...newSegments[0],
            x: string.anchorX,
            y: string.anchorY,
            z: string.anchorZ,
            vx: 0,
            vy: 0,
            vz: 0
          };
          
          for (let i = 1; i < newSegments.length; i++) {
            const segment = newSegments[i];
            const depth = i / newSegments.length;
            
            if (i >= activeSegments) {
              segment.x = newSegments[i-1].x;
              segment.y = newSegments[i-1].y;
              segment.z = newSegments[i-1].z;
              continue;
            }
            
            // If growing without wind, position in natural hanging position
            if (shouldUseNaturalPosition) {
              segment.x = string.anchorX;
              segment.y = string.anchorY - i * effectiveSegmentLength;
              segment.z = string.anchorZ;
              segment.vx = 0;
              segment.vy = 0;
              segment.vz = 0;
              continue;
            }
            
            const turbX = turbulence(segment.x, segment.y, segment.z, t + string.phase);
            const turbY = turbulence(segment.x + 100, segment.y + 100, segment.z + 100, t * 0.8 + string.phase);
            const turbZ = turbulence(segment.x + 200, segment.y + 200, segment.z + 200, t * 0.6 + string.phase);
            
            const windMultiplier = (0.3 + depth * 0.7) * newLength;
            
            const leftWindX = windForces.current.left * windMultiplier * (1 + turbX * 0.5);
            const leftWindZ = windForces.current.left * windMultiplier * turbZ * 0.2;
            
            const rightWindX = -windForces.current.right * windMultiplier * (1 + turbX * 0.5);
            const rightWindZ = windForces.current.right * windMultiplier * turbZ * 0.2;
            
            const topWindZ = -windForces.current.top * windMultiplier * (1 + turbZ * 0.5);
            const topWindX = windForces.current.top * windMultiplier * turbX * 0.2;
            
            const bottomWindZ = windForces.current.bottom * windMultiplier * (1 + turbZ * 0.5);
            const bottomWindX = windForces.current.bottom * windMultiplier * turbX * 0.2;
            
            const windX = leftWindX + rightWindX + topWindX + bottomWindX;
            const windY = (windForces.current.left + windForces.current.right + 
                          windForces.current.top + windForces.current.bottom) * 
                         windMultiplier * turbY * 0.1;
            const windZ = leftWindZ + rightWindZ + topWindZ + bottomWindZ;
            
            const gravity = -0.05;
            
            const prevSegment = newSegments[i - 1];
            const dx = prevSegment.x - segment.x;
            const dy = prevSegment.y - segment.y;
            const dz = prevSegment.z - segment.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            if (distance > 0) {
              const force = (distance - effectiveSegmentLength) * 0.25;
              const fx = (dx / distance) * force;
              const fy = (dy / distance) * force;
              const fz = (dz / distance) * force;
              
              segment.vx += fx + windX;
              segment.vy += fy + windY + gravity;
              segment.vz += fz + windZ;
              
              segment.vx *= 0.94;
              segment.vy *= 0.94;
              segment.vz *= 0.94;
              
              segment.x += segment.vx;
              segment.y += segment.vy;
              segment.z += segment.vz;
            }
            
            for (let j = 0; j < 2; j++) {
              const constraintDx = segment.x - prevSegment.x;
              const constraintDy = segment.y - prevSegment.y;
              const constraintDz = segment.z - prevSegment.z;
              const constraintDist = Math.sqrt(constraintDx * constraintDx + constraintDy * constraintDy + constraintDz * constraintDz);
              
              if (constraintDist > 0) {
                const ratio = effectiveSegmentLength / constraintDist;
                segment.x = prevSegment.x + constraintDx * ratio;
                segment.y = prevSegment.y + constraintDy * ratio;
                segment.z = prevSegment.z + constraintDz * ratio;
              }
            }
          }
          
          return {
            ...string,
            segments: newSegments,
            currentLength: newLength
          };
        });
      });
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [strings.length, windStates]);
  
  const toggleWind = (direction: Direction) => {
    setWindStates(prev => ({
      ...prev,
      [direction]: !prev[direction]
    }));
  };
  
  const project3D = (x: number, y: number, z: number) => {
    const rotX = viewAngle.current.rotX * Math.PI / 180;
    const rotY = viewAngle.current.rotY * Math.PI / 180;
    
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;
    
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const y1 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;
    
    const perspective = 300;
    const scale = perspective / (perspective + z2);
    
    return {
      x: x1 * scale + 300,
      y: y1 * scale + 250,
      scale: scale,
      depth: z2
    };
  };
  
  const visibleStrings = strings.filter(s => s.currentLength > 0.01);
  const sortedStrings = [...visibleStrings].sort((a, b) => {
    const aDepth = project3D(a.anchorX, a.anchorY, a.anchorZ).depth;
    const bDepth = project3D(b.anchorX, b.anchorY, b.anchorZ).depth;
    return bDepth - aDepth;
  });
  
  const windButtons = [
    { direction: 'left', x: 40, y: 250, color: '#22c55e', rotation: 0 },
    { direction: 'right', x: 560, y: 250, color: '#ef4444', rotation: 180 },
    { direction: 'top', x: 300, y: 20, color: '#eab308', rotation: 90 },
    { direction: 'bottom', x: 300, y: 480, color: '#3b82f6', rotation: -90 }
  ];
  
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh'
    }}>
      <div style={{ position: 'relative', width: 600, height: 560 }}>
        {/* Wind control buttons */}
        {windButtons.map(({ direction, x, y, color, rotation }) => (
          <button
            key={direction}
            onClick={() => toggleWind(direction as Direction)}
            style={{ 
              position: 'absolute',
              left: x, 
              top: y, 
              transform: 'translate(-50%, -50%)',
              background: 'transparent',
              border: 'none',
              padding: '16px',
              cursor: 'pointer'
            }}
          >
            <Wind 
              size={28}
              style={{
                transform: `rotate(${rotation}deg)`,
                color: windStates[direction as Direction] ? color : '#9CA3AF',
                opacity: windStates[direction as Direction] ? 1 : 0.5,
                transition: 'color 0.3s, opacity 0.3s'
              }}
            />
          </button>
        ))}
        
        {/* SVG Canvas */}
        <svg width={600} height={500} style={{ marginTop: 0 }}>
          {sortedStrings.map(string => {
            const projectedSegments = string.segments.map(s => 
              project3D(s.x, s.y, s.z)
            );
            
            const stringPath = projectedSegments.map((p, i) => {
              if (i === 0) return `M ${p.x},${p.y}`;
              const prev = projectedSegments[i - 1];
              const cpX = (prev.x + p.x) / 2;
              const cpY = (prev.y + p.y) / 2;
              return `Q ${prev.x},${prev.y} ${cpX},${cpY}`;
            }).join(' ');
            
            return (
              <path
                key={string.id}
                d={stringPath}
                stroke="#333"
                strokeWidth="2"
                fill="none"
                opacity={0.8 * Math.min(1, string.currentLength * 2)}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        
        {/* Slider */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingLeft: '64px',
          paddingRight: '64px'
        }}>
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
          <div className="styled-slider-wrapper">
            <div className="styled-slider-track" />
            <div 
              className="styled-slider-fill" 
              style={{ width: `${((stringCount - 1) / (maxStrings - 1)) * 100}%` }}
            />
            <input
              type="range"
              min="1"
              max={maxStrings}
              value={stringCount}
              onChange={(e) => setStringCount(parseInt(e.target.value))}
              className="styled-slider"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WindStringsVisualization;