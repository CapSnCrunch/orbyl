import { useRef, useEffect, useState } from 'react';

interface Point {
  x: number;
  y: number;
}

interface DotData {
  id: number;
  x: number;
  y: number;
  isHopping: boolean;
  isRemoving: boolean;
  trajectoryPath?: string;
  landingCircle?: Point;
  scale: number;
  opacity: number;
}

interface HoppingDotsProps {
  frogCount: number;
}

const HoppingDots = ({ frogCount }: HoppingDotsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dots, setDots] = useState<DotData[]>([]);
  const dotsRef = useRef<DotData[]>([]);
  const intervalRefs = useRef<Map<number, number>>(new Map());
  const animationFrameRef = useRef<number | null>(null);
  
  const circleRadius = 150;
  const center = { x: 150, y: 150 };
  const boundaryRadius = 135;

  // Sync dots ref with state
  useEffect(() => {
    dotsRef.current = dots;
  }, [dots]);

  const getRandomPosition = (): Point => {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * boundaryRadius;
    return {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle)
    };
  };

  const reflectVector = (vx: number, vy: number, nx: number, ny: number): Point => {
    const dot = vx * nx + vy * ny;
    return {
      x: vx - 2 * dot * nx,
      y: vy - 2 * dot * ny
    };
  };

  const lineCircleIntersection = (
    x1: number, 
    y1: number, 
    dx: number, 
    dy: number
  ): { t: number; x: number; y: number } | null => {
    const ox = x1 - center.x;
    const oy = y1 - center.y;
    const a = dx * dx + dy * dy;
    const b = 2 * (ox * dx + oy * dy);
    const c = ox * ox + oy * oy - boundaryRadius * boundaryRadius;
    const disc = b * b - 4 * a * c;
    
    if (disc < 0) return null;
    
    const t = (-b + Math.sqrt(disc)) / (2 * a);
    if (t > 0.001) {
      return { t, x: x1 + dx * t, y: y1 + dy * t };
    }
    return null;
  };

  const calculateTrajectoryWithAngle = (
    startX: number,
    startY: number,
    angle: number,
    totalDistance: number
  ): Point[] => {
    let dx = Math.cos(angle);
    let dy = Math.sin(angle);
    let remaining = totalDistance;
    let x = startX;
    let y = startY;
    
    const points: Point[] = [{ x, y }];
    const maxBounces = 5;
    let bounces = 0;
    
    while (remaining > 0 && bounces < maxBounces) {
      const intersection = lineCircleIntersection(x, y, dx, dy);
      
      if (intersection && intersection.t < remaining) {
        x = intersection.x;
        y = intersection.y;
        points.push({ x, y });
        remaining -= intersection.t;
        
        const nx = (x - center.x) / boundaryRadius;
        const ny = (y - center.y) / boundaryRadius;
        const reflected = reflectVector(dx, dy, nx, ny);
        dx = reflected.x;
        dy = reflected.y;
        
        x -= nx * 0.5;
        y -= ny * 0.5;
        bounces++;
      } else {
        x += dx * remaining;
        y += dy * remaining;
        
        const dist = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
        if (dist > boundaryRadius) {
          x = center.x + (x - center.x) * boundaryRadius / dist;
          y = center.y + (y - center.y) * boundaryRadius / dist;
        }
        
        points.push({ x, y });
        remaining = 0;
      }
    }
    
    return points;
  };

  const buildPathD = (points: Point[]): string => {
    if (points.length < 2) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  };

  const getPathLength = (points: Point[]): number => {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  };

  const getPointAtDistance = (
    points: Point[],
    distance: number
  ): { x: number; y: number; segmentIndex: number } => {
    let traveled = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      const segLength = Math.sqrt(dx * dx + dy * dy);
      
      if (traveled + segLength >= distance) {
        const t = (distance - traveled) / segLength;
        return {
          x: points[i - 1].x + dx * t,
          y: points[i - 1].y + dy * t,
          segmentIndex: i
        };
      }
      traveled += segLength;
    }
    return {
      x: points[points.length - 1].x,
      y: points[points.length - 1].y,
      segmentIndex: points.length - 1
    };
  };

  const hop = (dotId: number) => {
    const dot = dotsRef.current.find(d => d.id === dotId);
    if (!dot || dot.isHopping || dot.isRemoving) return;

    const finalAngle = Math.random() * Math.PI * 2;
    const totalDistance = 100 + Math.random() * 120;
    const startAngle = Math.random() * Math.PI * 2;
    const spinAmount = (Math.random() > 0.5 ? 1 : -1) * (Math.PI * 1.5 + Math.random() * Math.PI);

    let finalTrajectory: Point[] = [];
    const drawDuration = 1500;
    const drawStart = performance.now();

    const animateDraw = (now: number) => {
      const elapsed = now - drawStart;
      const progress = Math.min(elapsed / drawDuration, 1);

      const lengthEased = 1 - Math.pow(1 - progress, 2);
      const spinEased = 1 - Math.pow(1 - progress, 3);

      const currentAngle = startAngle + spinAmount * spinEased;
      const currentDistance = lengthEased * totalDistance;

      const trajectory = calculateTrajectoryWithAngle(dot.x, dot.y, currentAngle, currentDistance);
      const pathD = buildPathD(trajectory);
      const endPoint = trajectory.length > 1 ? trajectory[trajectory.length - 1] : null;

      setDots(prev => prev.map(d =>
        d.id === dotId
          ? { ...d, isHopping: true, trajectoryPath: pathD, landingCircle: endPoint || undefined }
          : d
      ));

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animateDraw);
      } else {
        finalTrajectory = trajectory;

        setTimeout(() => {
          const totalLength = getPathLength(finalTrajectory);
          const jumpDuration = 1200;
          const jumpStart = performance.now();

          const animateJump = (now: number) => {
            const elapsed = now - jumpStart;
            const progress = Math.min(elapsed / jumpDuration, 1);

            const eased = progress < 0.5
              ? 2 * progress * progress
              : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            const distance = eased * totalLength;
            const pos = getPointAtDistance(finalTrajectory, distance);

            const hopScale = 1 + Math.sin(progress * Math.PI) * 1.5;

            // Build remaining path
            let remainingD = '';
            if (distance < totalLength) {
              let traveled = 0;
              let started = false;

              for (let i = 1; i < finalTrajectory.length; i++) {
                const dx = finalTrajectory[i].x - finalTrajectory[i - 1].x;
                const dy = finalTrajectory[i].y - finalTrajectory[i - 1].y;
                const segLength = Math.sqrt(dx * dx + dy * dy);

                if (traveled + segLength > distance) {
                  if (!started) {
                    remainingD = `M ${pos.x} ${pos.y}`;
                    started = true;
                  }
                  remainingD += ` L ${finalTrajectory[i].x} ${finalTrajectory[i].y}`;
                }

                traveled += segLength;
              }
            }

            setDots(prev => prev.map(d =>
              d.id === dotId
                ? {
                    ...d,
                    x: pos.x,
                    y: pos.y,
                    scale: hopScale,
                    trajectoryPath: remainingD || undefined
                  }
                : d
            ));

            if (progress < 1) {
              animationFrameRef.current = requestAnimationFrame(animateJump);
            } else {
              setDots(prev => prev.map(d =>
                d.id === dotId
                  ? {
                      ...d,
                      isHopping: false,
                      trajectoryPath: undefined,
                      landingCircle: undefined,
                      scale: 1
                    }
                  : d
              ));
            }
          };

          animationFrameRef.current = requestAnimationFrame(animateJump);
        }, 400);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animateDraw);
  };

  const createDot = (): DotData => {
    const pos = getRandomPosition();
    const newDot: DotData = {
      id: Date.now() + Math.random(),
      x: pos.x,
      y: pos.y,
      isHopping: false,
      isRemoving: false,
      scale: 1,
      opacity: 1
    };

    const initialDelay = Math.random() * 3000;
    const timeoutId = window.setTimeout(() => {
      hop(newDot.id);
      const intervalId = window.setInterval(() => hop(newDot.id), 5000);
      intervalRefs.current.set(newDot.id, intervalId);
    }, initialDelay);

    return newDot;
  };

  const removeDot = (dotId: number) => {
    const interval = intervalRefs.current.get(dotId);
    if (interval) {
      clearInterval(interval);
      intervalRefs.current.delete(dotId);
    }

    // Mark as removing and animate pop
    setDots(prev => prev.map(d =>
      d.id === dotId ? { ...d, isRemoving: true } : d
    ));

    // Animate the pop effect
    const popStart = performance.now();
    const popDuration = 200;

    const animatePop = (now: number) => {
      const elapsed = now - popStart;
      const progress = Math.min(elapsed / popDuration, 1);

      const scale = 1 + progress * 2; // Grow to 3x
      const opacity = 1 - progress;

      setDots(prev => prev.map(d =>
        d.id === dotId ? { ...d, scale, opacity } : d
      ));

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animatePop);
      } else {
        // Remove the dot after animation
        setDots(prev => prev.filter(d => d.id !== dotId));
      }
    };

    animationFrameRef.current = requestAnimationFrame(animatePop);
  };

  // Update dots when frogCount changes
  useEffect(() => {
    if (dots.length < frogCount) {
      // Add dots
      const newDots = [...dots];
      while (newDots.length < frogCount) {
        newDots.push(createDot());
      }
      setDots(newDots);
    } else if (dots.length > frogCount) {
      // Remove dots (remove non-hopping ones first)
      const dotsToRemove = dots.length - frogCount;
      const nonHopping = dots.filter(d => !d.isHopping && !d.isRemoving);
      const hopping = dots.filter(d => d.isHopping && !d.isRemoving);

      for (let i = 0; i < dotsToRemove; i++) {
        const dotToRemove = nonHopping[i] || hopping[i];
        if (dotToRemove) {
          removeDot(dotToRemove.id);
        }
      }
    }
  }, [frogCount]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      intervalRefs.current.forEach(interval => clearInterval(interval));
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        aspectRatio: '1 / 1',
        border: '2px solid rgba(100, 100, 100, 0.2)',
        borderRadius: '50%'
      }}
    >
      <svg
        ref={svgRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
        viewBox="0 0 300 300"
      >
        {dots.map(dot => (
          <g key={dot.id}>
            {/* Trajectory path */}
            {dot.trajectoryPath && (
              <path
                d={dot.trajectoryPath}
                fill="none"
                stroke="rgba(100, 100, 100, 0.4)"
                strokeWidth="2"
                strokeDasharray="4 10"
                strokeLinecap="round"
                opacity={dot.opacity}
                style={{
                  animation: dot.isHopping && !dot.isRemoving ? 'dash 0.4s linear infinite' : 'none'
                }}
              />
            )}
            {/* Landing circle */}
            {dot.landingCircle && !dot.isRemoving && (
              <circle
                cx={dot.landingCircle.x}
                cy={dot.landingCircle.y}
                r="8"
                fill="none"
                stroke="rgba(100, 100, 100, 0.3)"
                strokeWidth="1.5"
                opacity={dot.opacity}
              />
            )}
          </g>
        ))}
      </svg>

      {/* Dots */}
      {dots.map(dot => (
        <div
          key={dot.id}
          style={{
            position: 'absolute',
            width: '4%',
            height: '4%',
            background: '#333',
            borderRadius: '50%',
            left: `${(dot.x / 300) * 100}%`,
            top: `${(dot.y / 300) * 100}%`,
            transform: `translate(-50%, -50%) scale(${dot.scale})`,
            opacity: dot.opacity,
            transition: dot.isRemoving ? 'all 0.2s ease-out' : 'none',
            zIndex: 10
          }}
        />
      ))}

      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -28;
          }
        }
      `}</style>
    </div>
  );
};

export default HoppingDots;
