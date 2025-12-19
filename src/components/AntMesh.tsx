import { useRef, useEffect, useCallback } from 'react';

interface Point {
  x: number;
  y: number;
  oldX: number;
  oldY: number;
  restX: number;
  restY: number;
  pinned: boolean;
}

interface Stick {
  p1: Point;
  p2: Point;
  length: number;
}

interface Ant {
  x: number;
  y: number;
  targetAngle: number;
  angle: number;
  speed: number;
  size: number;
  maxSize: number;
  opacity: number;
  wanderAngle: number;
  onGrid: boolean;
  meshBounds: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  flung: boolean;
  vx: number;
  vy: number;
  lastX: number;
  lastY: number;
  logicalX?: number;
  logicalY?: number;
}

interface AntMeshProps {
  gridSize?: number;
}

const AntMesh = ({ gridSize = 18 }: AntMeshProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const sticksRef = useRef<Stick[]>([]);
  const dragRef = useRef<Point | null>(null);
  const antsRef = useRef<Ant[]>([]);
  const lastMovementRef = useRef(Date.now());
  const isStillRef = useRef(false);
  const lastAntSpawnRef = useRef(0);
  
  const spacing = 22;
  const damping = 0.95;
  const returnForce = 0.015;
  const pinchRadius = 150;
  const pinchStrength = 0.25;
  const stillnessThreshold = 2000;
  const antSpawnRate = 800;
  const maxAnts = 15;
  
  const spawnAnt = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const side = Math.floor(Math.random() * 4);
    let x: number, y: number, targetAngle: number;
    
    switch(side) {
      case 0: // top
        x = Math.random() * canvas.width;
        y = 0;
        targetAngle = Math.PI / 2;
        break;
      case 1: // right
        x = canvas.width;
        y = Math.random() * canvas.height;
        targetAngle = Math.PI;
        break;
      case 2: // bottom
        x = Math.random() * canvas.width;
        y = canvas.height;
        targetAngle = -Math.PI / 2;
        break;
      case 3: // left
      default:
        x = 0;
        y = Math.random() * canvas.height;
        targetAngle = 0;
        break;
    }
    
    const meshCenter = canvas.width / 2;
    const meshSize = (gridSize - 1) * spacing;
    const meshBounds = {
      left: meshCenter - meshSize / 2,
      right: meshCenter + meshSize / 2,
      top: meshCenter - meshSize / 2,
      bottom: meshCenter + meshSize / 2
    };
    
    antsRef.current.push({
      x,
      y,
      targetAngle,
      angle: targetAngle,
      speed: 0.8,
      size: 0,
      maxSize: 4,
      opacity: 0,
      wanderAngle: 0,
      onGrid: false,
      meshBounds,
      flung: false,
      vx: 0,
      vy: 0,
      lastX: x,
      lastY: y
    });
  }, [gridSize, spacing]);
  
  const getDistortedPosition = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x, y };
    
    const meshCenter = canvas.width / 2;
    const meshSize = (gridSize - 1) * spacing;
    const meshStart = meshCenter - meshSize / 2;
    
    const gridX = (x - meshStart) / spacing;
    const gridY = (y - meshStart) / spacing;
    
    const x0 = Math.floor(gridX);
    const x1 = Math.ceil(gridX);
    const y0 = Math.floor(gridY);
    const y1 = Math.ceil(gridY);
    
    if (x0 < 0 || x1 >= gridSize || y0 < 0 || y1 >= gridSize) {
      return { x, y };
    }
    
    const p00 = pointsRef.current[y0 * gridSize + x0];
    const p10 = pointsRef.current[y0 * gridSize + x1];
    const p01 = pointsRef.current[y1 * gridSize + x0];
    const p11 = pointsRef.current[y1 * gridSize + x1];
    
    if (!p00 || !p10 || !p01 || !p11) return { x, y };
    
    const fx = gridX - x0;
    const fy = gridY - y0;
    
    const x_interp = p00.x * (1 - fx) * (1 - fy) +
                     p10.x * fx * (1 - fy) +
                     p01.x * (1 - fx) * fy +
                     p11.x * fx * fy;
                     
    const y_interp = p00.y * (1 - fx) * (1 - fy) +
                     p10.y * fx * (1 - fy) +
                     p01.y * (1 - fx) * fy +
                     p11.y * fx * fy;
    
    return { x: x_interp, y: y_interp };
  }, [gridSize, spacing]);
  
  const updateAnts = useCallback(() => {
    const now = Date.now();
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    let isStill = true;
    for (const p of pointsRef.current) {
      const movement = Math.abs(p.x - p.restX) + Math.abs(p.y - p.restY);
      if (movement > 0.5) {
        isStill = false;
        break;
      }
    }
    
    if (isStill && !isStillRef.current) {
      lastMovementRef.current = now;
    }
    isStillRef.current = isStill;
    
    if (isStill && now - lastMovementRef.current > stillnessThreshold) {
      if (antsRef.current.length < maxAnts && now - lastAntSpawnRef.current > antSpawnRate) {
        spawnAnt();
        lastAntSpawnRef.current = now;
      }
    }
    
    antsRef.current = antsRef.current.filter(ant => {
      if (ant.flung) {
        ant.x += ant.vx;
        ant.y += ant.vy;
        ant.vx *= 0.98;
        ant.vy *= 0.98;
        ant.opacity -= 0.005;
        ant.size *= 0.98;
        return ant.opacity > 0;
      }
      
      if (ant.opacity < 1 && !ant.flung) {
        ant.opacity += 0.02;
        ant.size = Math.min(ant.size + 0.1, ant.maxSize);
      }
      
      if (!ant.logicalX) {
        ant.logicalX = ant.x;
        ant.logicalY = ant.y;
      }
      
      if (!ant.onGrid) {
        const onGrid = ant.logicalX > ant.meshBounds.left && ant.logicalX < ant.meshBounds.right &&
                      ant.logicalY > ant.meshBounds.top && ant.logicalY < ant.meshBounds.bottom;
        if (onGrid) {
          ant.onGrid = true;
          ant.wanderAngle = Math.random() * Math.PI * 2;
        }
      }
      
      if (ant.onGrid && !ant.flung) {
        ant.wanderAngle += (Math.random() - 0.5) * 0.3;
        ant.angle = ant.wanderAngle;
        
        const margin = 20;
        if (ant.logicalX < ant.meshBounds.left + margin) {
          ant.wanderAngle = 0;
        } else if (ant.logicalX > ant.meshBounds.right - margin) {
          ant.wanderAngle = Math.PI;
        }
        if (ant.logicalY < ant.meshBounds.top + margin) {
          ant.wanderAngle = Math.PI / 2;
        } else if (ant.logicalY > ant.meshBounds.bottom - margin) {
          ant.wanderAngle = -Math.PI / 2;
        }
        
        ant.logicalX += Math.cos(ant.angle) * ant.speed;
        ant.logicalY += Math.sin(ant.angle) * ant.speed;
        
        const distorted = getDistortedPosition(ant.logicalX, ant.logicalY);
        
        ant.vx = distorted.x - ant.lastX;
        ant.vy = distorted.y - ant.lastY;
        ant.lastX = ant.x;
        ant.lastY = ant.y;
        
        ant.x = distorted.x;
        ant.y = distorted.y;
      } else if (!ant.flung) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        ant.angle = Math.atan2(centerY - ant.logicalY, centerX - ant.logicalX);
        
        const moveX = Math.cos(ant.angle) * ant.speed;
        const moveY = Math.sin(ant.angle) * ant.speed;
        ant.logicalX += moveX;
        ant.logicalY += moveY;
        ant.x += moveX;
        ant.y += moveY;
        ant.lastX = ant.x;
        ant.lastY = ant.y;
      }
      
      return ant.opacity > 0;
    });
  }, [spawnAnt, getDistortedPosition, stillnessThreshold, maxAnts, antSpawnRate]);

  const initMesh = useCallback(() => {
    const points: Point[] = [];
    const sticks: Stick[] = [];
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const meshSize = (gridSize - 1) * spacing;
    const offset = centerX - meshSize / 2;
    const offsetY = centerY - meshSize / 2;

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const px = offset + x * spacing;
        const py = offsetY + y * spacing;
        
        points.push({
          x: px,
          y: py,
          oldX: px,
          oldY: py,
          restX: px,
          restY: py,
          pinned: false
        });
      }
    }

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize - 1; x++) {
        const p1 = points[y * gridSize + x];
        const p2 = points[y * gridSize + x + 1];
        sticks.push({ p1, p2, length: spacing });
      }
    }

    for (let y = 0; y < gridSize - 1; y++) {
      for (let x = 0; x < gridSize; x++) {
        const p1 = points[y * gridSize + x];
        const p2 = points[(y + 1) * gridSize + x];
        sticks.push({ p1, p2, length: spacing });
      }
    }

    pointsRef.current = points;
    sticksRef.current = sticks;
  }, [gridSize, spacing]);

  const updatePoints = useCallback(() => {
    const dragPoint = dragRef.current;
    
    for (const p of pointsRef.current) {
      if (p.pinned) continue;

      const vx = (p.x - p.oldX) * damping;
      const vy = (p.y - p.oldY) * damping;

      p.oldX = p.x;
      p.oldY = p.y;

      p.x += vx;
      p.y += vy;

      const dx = p.restX - p.x;
      const dy = p.restY - p.y;
      p.x += dx * returnForce;
      p.y += dy * returnForce;

      if (dragPoint && p !== dragPoint) {
        const toDragX = dragPoint.x - p.x;
        const toDragY = dragPoint.y - p.y;
        const distToDrag = Math.sqrt(toDragX * toDragX + toDragY * toDragY);
        
        if (distToDrag < pinchRadius && distToDrag > 0) {
          const falloff = 1 - (distToDrag / pinchRadius);
          const pinchForce = falloff * falloff * pinchStrength;
          p.x += (toDragX / distToDrag) * pinchForce * distToDrag * 0.1;
          p.y += (toDragY / distToDrag) * pinchForce * distToDrag * 0.1;
        }
      }
    }
  }, [damping, returnForce, pinchRadius, pinchStrength]);

  const updateSticks = useCallback(() => {
    for (let i = 0; i < 3; i++) {
      for (const s of sticksRef.current) {
        const dx = s.p2.x - s.p1.x;
        const dy = s.p2.y - s.p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const diff = s.length - dist;
        const percent = diff / dist / 2;
        const offsetX = dx * percent;
        const offsetY = dy * percent;

        if (!s.p1.pinned) {
          s.p1.x -= offsetX;
          s.p1.y -= offsetY;
        }
        if (!s.p2.pinned) {
          s.p2.x += offsetX;
          s.p2.y += offsetY;
        }
      }
    }
  }, []);

  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = '#c9cdd1';
    ctx.lineWidth = 1;
    for (const s of sticksRef.current) {
      ctx.beginPath();
      ctx.moveTo(s.p1.x, s.p1.y);
      ctx.lineTo(s.p2.x, s.p2.y);
      ctx.stroke();
    }
    
    for (const ant of antsRef.current) {
      ctx.save();
      ctx.globalAlpha = ant.opacity;
      ctx.fillStyle = '#374151';
      ctx.beginPath();
      ctx.arc(ant.x, ant.y, ant.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;

    updatePoints();
    updateSticks();
    updateAnts();
    draw(ctx, width, height);

    animationRef.current = requestAnimationFrame(animate);
  }, [updatePoints, updateSticks, updateAnts, draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      initMesh();
      animate();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [initMesh, animate]);

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const handleStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const pos = getMousePos(e);
    
    let closest: Point | null = null;
    let minDist = 30;
    
    for (const p of pointsRef.current) {
      const dx = p.x - pos.x;
      const dy = p.y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        closest = p;
      }
    }

    if (closest) {
      closest.pinned = true;
      dragRef.current = closest;
    }
  };

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      e.preventDefault();
      const pos = getMousePos(e);
      dragRef.current.x = pos.x;
      dragRef.current.y = pos.y;
    }
  };

  const handleEnd = () => {
    if (dragRef.current) {
      dragRef.current.pinned = false;
      
      antsRef.current.forEach(ant => {
        if (ant.onGrid && !ant.flung && ant.logicalX && ant.logicalY) {
          const canvas = canvasRef.current;
          if (!canvas) return;
          
          const meshCenter = canvas.width / 2;
          const meshSize = (gridSize - 1) * spacing;
          const meshStart = meshCenter - meshSize / 2;
          const gridX = Math.round((ant.logicalX - meshStart) / spacing);
          const gridY = Math.round((ant.logicalY - meshStart) / spacing);
          
          if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
            const meshPoint = pointsRef.current[gridY * gridSize + gridX];
            if (meshPoint) {
              const meshVx = meshPoint.x - meshPoint.oldX;
              const meshVy = meshPoint.y - meshPoint.oldY;
              const meshSpeed = Math.sqrt(meshVx * meshVx + meshVy * meshVy);
              
              const snapX = ant.logicalX - ant.x;
              const snapY = ant.logicalY - ant.y;
              const displacement = Math.sqrt(snapX * snapX + snapY * snapY);
              
              if (meshSpeed > 2 && displacement > 7) {
                ant.flung = true;
                const speed = displacement * 0.3;
                ant.vx = (snapX / displacement) * speed;
                ant.vy = (snapY / displacement) * speed;
              }
            }
          }
        }
      });
      
      dragRef.current = null;
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={500}
      height={500}
      style={{ cursor: dragRef.current ? 'grabbing' : 'grab' }}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
    />
  );
};

export default AntMesh;
