import { useRef, useEffect, useState } from 'react';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface RotatedPoint extends Point3D {
  originalIndex: number;
}

interface WaveAnimation {
  id: number;
  startTime: number;
  spherePoint: Point3D;
}

interface Countdown {
  id: number;
  pointIndex: number;
  count: number;
  spherePoint: Point3D;
}

interface AnimatingPoint {
  index: number;
  scale: number;
  growing: boolean;
  startTime: number;
}

interface CursorPosition {
  x: number;
  y: number;
}

interface DottedSphereProps {
  timerMode: boolean;
  numPoints: number;
  onWaveAnimations?: (animations: WaveAnimation[]) => void;
  onCountdowns?: (countdowns: Countdown[]) => void;
}

const DottedSphere = ({ timerMode, numPoints }: DottedSphereProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [waveAnimations, setWaveAnimations] = useState<WaveAnimation[]>([]);
  const [countdowns, setCountdowns] = useState<Countdown[]>([]);
  const [cursorPos, setCursorPos] = useState<CursorPosition | null>(null);
  const [repulsionStrength, setRepulsionStrength] = useState(1);
  const [animatingPoints, setAnimatingPoints] = useState<AnimatingPoint[]>([]);
  const [velocity, setVelocity] = useState({ x: 0, y: 0 });
  const [isHoveringCircle, setIsHoveringCircle] = useState(false);
  
  // Track recent mouse positions for velocity calculation
  const recentPositions = useRef<{ x: number; y: number; time: number }[]>([]);
  const momentumFrameId = useRef<number | null>(null);

  // Generate points on a sphere using Fibonacci lattice
  const generateSpherePoints = (numPoints: number): Point3D[] => {
    const points: Point3D[] = [];
    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

    for (let i = 0; i < numPoints; i++) {
      const y = 1 - (i / (numPoints - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = phi * i;
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      points.push({ x, y, z });
    }
    return points;
  };

  const [points, setPoints] = useState<Point3D[]>(() => generateSpherePoints(numPoints));
  const animationFrameId = useRef<number | null>(null);
  const countdownIntervalId = useRef<number | null>(null);
  const decayIntervalId = useRef<number | null>(null);

  // Handle point count changes with animation
  useEffect(() => {
    const newPoints = generateSpherePoints(numPoints);
    
    if (numPoints > points.length) {
      // Adding points - animate them popping in
      const newAnimatingPoints: AnimatingPoint[] = [];
      for (let i = points.length; i < numPoints; i++) {
        newAnimatingPoints.push({
          index: i,
          scale: 0,
          growing: true,
          startTime: Date.now() + (i - points.length) * 10 // Stagger the animations
        });
      }
      setAnimatingPoints(prev => [...prev, ...newAnimatingPoints]);
    } else if (numPoints < points.length) {
      // Removing points - animate them popping out
      const removingPoints: AnimatingPoint[] = [];
      for (let i = numPoints; i < points.length; i++) {
        removingPoints.push({
          index: i,
          scale: 1,
          growing: false,
          startTime: Date.now() + (i - numPoints) * 10
        });
      }
      setAnimatingPoints(prev => [...prev, ...removingPoints]);
    }
    
    setPoints(newPoints);
  }, [numPoints]);

  // Handle momentum physics
  useEffect(() => {
    if (!isDragging && (Math.abs(velocity.x) > 0.0001 || Math.abs(velocity.y) > 0.0001)) {
      const friction = 0.95; // Deceleration factor
      
      const animate = () => {
        setVelocity(prev => {
          const newVelX = prev.x * friction;
          const newVelY = prev.y * friction;
          
          // Apply velocity to rotation
          setRotation(rot => ({
            x: rot.x + newVelX,
            y: rot.y + newVelY
          }));
          
          // Stop if velocity is negligible
          if (Math.abs(newVelX) < 0.0001 && Math.abs(newVelY) < 0.0001) {
            return { x: 0, y: 0 };
          }
          
          return { x: newVelX, y: newVelY };
        });
        
        momentumFrameId.current = requestAnimationFrame(animate);
      };
      
      momentumFrameId.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (momentumFrameId.current) {
        cancelAnimationFrame(momentumFrameId.current);
      }
    };
  }, [isDragging, velocity.x !== 0 || velocity.y !== 0]);

  // Handle repulsion strength decay
  useEffect(() => {
    if (isDragging) {
      // Start decaying when dragging with easing
      decayIntervalId.current = window.setInterval(() => {
        setRepulsionStrength(prev => {
          // Exponential decay for smooth easing (fast at first, slow at end)
          return prev * 0.92;
        });
      }, 16); // ~60fps
    } else {
      // Restore when not dragging with easing
      decayIntervalId.current = window.setInterval(() => {
        setRepulsionStrength(prev => {
          // Exponential growth for smooth restoration
          const diff = 1 - prev;
          return prev + diff * 0.08;
        });
      }, 16);
    }

    return () => {
      if (decayIntervalId.current) {
        clearInterval(decayIntervalId.current);
      }
    };
  }, [isDragging]);

  // Handle countdown timer updates
  useEffect(() => {
    if (countdowns.length > 0) {
      countdownIntervalId.current = window.setInterval(() => {
        setCountdowns(prev => {
          const updated = prev.map(cd => ({
            ...cd,
            count: cd.count - 1
          })).filter(cd => cd.count >= 0);
          
          // Trigger animations for completed countdowns
          prev.forEach(cd => {
            if (cd.count === 0) {
              setWaveAnimations(prevWaves => [...prevWaves, {
                id: Date.now() + Math.random(),
                startTime: performance.now(),
                spherePoint: cd.spherePoint
              }]);
            }
          });
          
          return updated;
        });
      }, 1000);
    }

    return () => {
      if (countdownIntervalId.current) {
        clearInterval(countdownIntervalId.current);
      }
    };
  }, [countdowns.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const sphereRadius = 180;

    const render = (timestamp: number) => {
      ctx.clearRect(0, 0, width, height);

      const rotatedPoints: RotatedPoint[] = points.map((point, index) => {
        // Rotate around Y axis
        let x = point.x * Math.cos(rotation.y) - point.z * Math.sin(rotation.y);
        let z = point.x * Math.sin(rotation.y) + point.z * Math.cos(rotation.y);
        
        // Rotate around X axis
        let y = point.y * Math.cos(rotation.x) - z * Math.sin(rotation.x);
        z = point.y * Math.sin(rotation.x) + z * Math.cos(rotation.x);

        return { x, y, z, originalIndex: index };
      });

      // Sort by z-depth for proper rendering
      rotatedPoints.sort((a, b) => a.z - b.z);

      // Draw points
      rotatedPoints.forEach(point => {
        let x2d = point.x * sphereRadius + centerX;
        let y2d = point.y * sphereRadius + centerY;
        
        // Apply electromagnetic repulsion effect from cursor
        if (cursorPos && repulsionStrength > 0.01 && point.z > -0.3) {
          // Only affect dots on the front/visible part of sphere (z > -0.3)
          const dx = x2d - cursorPos.x;
          const dy = y2d - cursorPos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const repulsionRadius = 160; // Larger radius of effect
          
          if (distance < repulsionRadius) {
            // Inverse square law for electromagnetic-like repulsion with decay
            const force = Math.pow((repulsionRadius - distance) / repulsionRadius, 2);
            const angle = Math.atan2(dy, dx);
            const displacement = force * 10 * repulsionStrength; // Weaker strength
            
            x2d += Math.cos(angle) * displacement;
            y2d += Math.sin(angle) * displacement;
          }
        }
        
        // Check if this point has a countdown
        const countdown = countdowns.find(cd => cd.pointIndex === point.originalIndex);
        
        if (countdown) {
          // Draw countdown number instead of dot
          ctx.fillStyle = `rgba(60, 60, 60, ${0.7 + (point.z + 1) * 0.15})`;
          ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(countdown.count.toString(), x2d, y2d);
        } else {
          // Draw normal dot
          let size = 1.5 + (point.z + 1) * 0.5;
          let opacity = 0.3 + (point.z + 1) * 0.35;
          
          // Apply all wave animations
          waveAnimations.forEach(waveAnimation => {
            const elapsed = timestamp - waveAnimation.startTime;
            const waveSpeed = 0.002;
            const waveRadius = elapsed * waveSpeed;
            
            // Calculate distance from click point in 3D space
            const dx = points[point.originalIndex].x - waveAnimation.spherePoint.x;
            const dy = points[point.originalIndex].y - waveAnimation.spherePoint.y;
            const dz = points[point.originalIndex].z - waveAnimation.spherePoint.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            // Create wave effect
            if (distance < waveRadius && distance > waveRadius - 0.5) {
              const waveIntensity = 1 - Math.abs(distance - waveRadius + 0.25) / 0.25;
              size += waveIntensity * 3;
              opacity = Math.min(1, opacity + waveIntensity * 0.5);
            }
          });
          
          ctx.fillStyle = `rgba(60, 60, 60, ${opacity})`;
          ctx.beginPath();
          ctx.arc(x2d, y2d, size, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Remove completed animations
      setWaveAnimations(prev => prev.filter(anim => {
        const elapsed = timestamp - anim.startTime;
        const waveRadius = elapsed * 0.002;
        return waveRadius <= 4;
      }));

      // Update animating points
      setAnimatingPoints(prev => {
        const now = Date.now();
        return prev.map(ap => {
          const elapsed = now - ap.startTime;
          if (elapsed < 0) return ap; // Not started yet
          
          const progress = Math.min(elapsed / 300, 1); // 300ms animation
          const easeProgress = ap.growing 
            ? progress * progress // ease in for growing
            : 1 - (1 - progress) * (1 - progress); // ease out for shrinking
          
          return {
            ...ap,
            scale: ap.growing ? easeProgress : 1 - easeProgress
          };
        }).filter(ap => {
          const elapsed = now - ap.startTime;
          return elapsed < 300; // Remove completed animations
        });
      });

      if (waveAnimations.length > 0 || countdowns.length > 0 || cursorPos || animatingPoints.length > 0) {
        animationFrameId.current = requestAnimationFrame(render);
      }
    };

    if (waveAnimations.length > 0 || countdowns.length > 0 || cursorPos || animatingPoints.length > 0) {
      animationFrameId.current = requestAnimationFrame(render);
    } else {
      render(performance.now());
    }

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [rotation, points, waveAnimations, countdowns, cursorPos, repulsionStrength, animatingPoints]);

  const isInsideCircle = (clientX: number, clientY: number): boolean => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const sphereRadius = 180;
    
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance <= sphereRadius;
  };

  const findNearestPoint = (clientX: number, clientY: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const sphereRadius = 180;

    let nearestIndex = 0;
    let minDistance = Infinity;

    points.forEach((point, index) => {
      // Rotate point to current view
      let px = point.x * Math.cos(rotation.y) - point.z * Math.sin(rotation.y);
      let pz = point.x * Math.sin(rotation.y) + point.z * Math.cos(rotation.y);
      let py = point.y * Math.cos(rotation.x) - pz * Math.sin(rotation.x);
      pz = point.y * Math.sin(rotation.x) + pz * Math.cos(rotation.x);

      const x2d = px * sphereRadius + centerX;
      const y2d = py * sphereRadius + centerY;

      const dist = Math.sqrt((x - x2d) ** 2 + (y - y2d) ** 2);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = index;
      }
    });

    return nearestIndex;
  };

  const get3DPointFromClick = (clientX: number, clientY: number): Point3D => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, z: 0 };
    
    const rect = canvas.getBoundingClientRect();
    // Scale to match canvas internal coordinates
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const sphereRadius = 180;
    
    // Convert to normalized coordinates
    const nx = (x - centerX) / sphereRadius;
    const ny = (y - centerY) / sphereRadius;
    
    // Apply current rotation to find the actual 3D point
    const distFromCenter = Math.sqrt(nx * nx + ny * ny);
    
    if (distFromCenter > 1) {
      // Click outside sphere, project to edge
      const scale = 1 / distFromCenter;
      const sphereX = nx * scale;
      const sphereY = ny * scale;
      const sphereZ = 0;
      
      // Reverse rotate to get original sphere coordinates
      let y = sphereY * Math.cos(-rotation.x) - sphereZ * Math.sin(-rotation.x);
      let z = sphereY * Math.sin(-rotation.x) + sphereZ * Math.cos(-rotation.x);
      let x = sphereX * Math.cos(-rotation.y) - z * Math.sin(-rotation.y);
      z = sphereX * Math.sin(-rotation.y) + z * Math.cos(-rotation.y);
      
      return { x, y, z };
    } else {
      // Click inside sphere, calculate z
      const sphereZ = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      
      // Reverse rotate to get original sphere coordinates
      let y = ny * Math.cos(-rotation.x) - sphereZ * Math.sin(-rotation.x);
      let z = ny * Math.sin(-rotation.x) + sphereZ * Math.cos(-rotation.x);
      let x = nx * Math.cos(-rotation.y) - z * Math.sin(-rotation.y);
      z = nx * Math.sin(-rotation.y) + z * Math.cos(-rotation.y);
      
      return { x, y, z };
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isInsideCircle(e.clientX, e.clientY)) return;
    
    // Stop any ongoing momentum
    setVelocity({ x: 0, y: 0 });
    recentPositions.current = [{ x: e.clientX, y: e.clientY, time: performance.now() }];
    
    setIsDragging(true);
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - lastPos.x;
    const deltaY = e.clientY - lastPos.y;
    const now = performance.now();
    
    // Track recent positions for velocity calculation (keep last 5)
    recentPositions.current.push({ x: e.clientX, y: e.clientY, time: now });
    if (recentPositions.current.length > 5) {
      recentPositions.current.shift();
    }
    
    setRotation(prev => ({
      x: prev.x - deltaY * 0.01,
      y: prev.y - deltaX * 0.01
    }));
    
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    // Calculate velocity from recent positions
    let velX = 0;
    let velY = 0;
    const positions = recentPositions.current;
    
    if (positions.length >= 2) {
      const recent = positions[positions.length - 1];
      const older = positions[0];
      const timeDelta = recent.time - older.time;
      
      if (timeDelta > 0) {
        // Convert pixel velocity to rotation velocity
        velX = -((recent.y - older.y) / timeDelta) * 0.15;
        velY = -((recent.x - older.x) / timeDelta) * 0.15;
      }
    }
    
    const speed = Math.sqrt(velX * velX + velY * velY);
    
    // Only trigger wave animation if the user wasn't flinging (low velocity)
    if (isDragging && isInsideCircle(e.clientX, e.clientY) && speed < 0.01) {
      const spherePoint = get3DPointFromClick(e.clientX, e.clientY);
      
      if (timerMode) {
        // Find nearest point and start countdown
        const nearestIndex = findNearestPoint(e.clientX, e.clientY);
        setCountdowns(prev => [...prev, {
          id: Date.now() + Math.random(),
          pointIndex: nearestIndex,
          count: 2,
          spherePoint: spherePoint
        }]);
      } else {
        // Immediate wave animation
        setWaveAnimations(prev => [...prev, {
          id: Date.now() + Math.random(),
          startTime: performance.now(),
          spherePoint: spherePoint
        }]);
      }
    }
    
    // Apply momentum if velocity is significant
    if (speed > 0.001) {
      setVelocity({ x: velX, y: velY });
    }
    
    setIsDragging(false);
    recentPositions.current = [];
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isInsideCircle(e.touches[0].clientX, e.touches[0].clientY)) return;
    
    // Stop any ongoing momentum
    setVelocity({ x: 0, y: 0 });
    recentPositions.current = [{ 
      x: e.touches[0].clientX, 
      y: e.touches[0].clientY, 
      time: performance.now() 
    }];
    
    setIsDragging(true);
    setLastPos({ 
      x: e.touches[0].clientX, 
      y: e.touches[0].clientY 
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.touches[0].clientX - lastPos.x;
    const deltaY = e.touches[0].clientY - lastPos.y;
    const now = performance.now();
    
    // Track recent positions for velocity calculation
    recentPositions.current.push({ 
      x: e.touches[0].clientX, 
      y: e.touches[0].clientY, 
      time: now 
    });
    if (recentPositions.current.length > 5) {
      recentPositions.current.shift();
    }
    
    setRotation(prev => ({
      x: prev.x - deltaY * 0.01,
      y: prev.y - deltaX * 0.01
    }));
    
    setLastPos({ 
      x: e.touches[0].clientX, 
      y: e.touches[0].clientY 
    });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Calculate velocity from recent positions
    let velX = 0;
    let velY = 0;
    const positions = recentPositions.current;
    
    if (positions.length >= 2) {
      const recent = positions[positions.length - 1];
      const older = positions[0];
      const timeDelta = recent.time - older.time;
      
      if (timeDelta > 0) {
        velX = -((recent.y - older.y) / timeDelta) * 0.15;
        velY = -((recent.x - older.x) / timeDelta) * 0.15;
      }
    }
    
    const speed = Math.sqrt(velX * velX + velY * velY);
    
    if (isDragging && e.changedTouches.length > 0) {
      if (isInsideCircle(e.changedTouches[0].clientX, e.changedTouches[0].clientY) && speed < 0.01) {
        const spherePoint = get3DPointFromClick(
          e.changedTouches[0].clientX, 
          e.changedTouches[0].clientY
        );
        
        if (timerMode) {
          const nearestIndex = findNearestPoint(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
          setCountdowns(prev => [...prev, {
            id: Date.now() + Math.random(),
            pointIndex: nearestIndex,
            count: 2,
            spherePoint: spherePoint
          }]);
        } else {
          setWaveAnimations(prev => [...prev, {
            id: Date.now() + Math.random(),
            startTime: performance.now(),
            spherePoint: spherePoint
          }]);
        }
      }
    }
    
    // Apply momentum if velocity is significant
    if (speed > 0.001) {
      setVelocity({ x: velX, y: velY });
    }
    
    setIsDragging(false);
    recentPositions.current = [];
  };

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={600}
      className={isDragging ? "cursor-grabbing" : "cursor-grab"}
      style={{ touchAction: 'none' }}
      onMouseDown={handleMouseDown}
      onMouseMove={(e) => {
        handleMouseMove(e);
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        // Scale cursor position to match canvas internal coordinates
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        setCursorPos({ x, y });
      }}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        handleMouseUp({} as React.MouseEvent);
        setCursorPos(null);
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  );
};

export default DottedSphere;
