
import React, { useState, useRef, useEffect, useCallback } from 'react';

const InfiniteCylinder = () => {
  const [slices, setSlices] = useState([]);
  const [dragging, setDragging] = useState(null);
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  
  const SLICE_HEIGHT = 28;
  const CYLINDER_WIDTH = 120;
  const ELLIPSE_HEIGHT = 14;
  const VISIBLE_SLICES = 24;
  
  useEffect(() => {
    const initial = Array.from({ length: VISIBLE_SLICES }, (_, i) => ({
      id: i,
      offset: 0,
      y: i * SLICE_HEIGHT,
      vy: 0,
      falling: false
    }));
    setSlices(initial);
  }, []);

  const handleMouseDown = (e, index) => {
    e.preventDefault();
    const slice = slices[index];
    if (slice && !slice.falling) {
      setDragging({
        index,
        startX: e.clientX,
        startOffset: slice.offset || 0
      });
    }
  };

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    const deltaX = e.clientX - dragging.startX;
    const newOffset = dragging.startOffset + deltaX;
    setSlices(prev => prev.map((s, i) => 
      i === dragging.index ? { ...s, offset: newOffset } : s
    ));
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const overlapsHorizontally = (offset1, offset2) => {
    const left1 = offset1;
    const right1 = offset1 + CYLINDER_WIDTH;
    const left2 = offset2;
    const right2 = offset2 + CYLINDER_WIDTH;
    return left1 < right2 && right1 > left2;
  };

  const isInCylinder = (slice) => Math.abs(slice.offset) <= 2;

  // Recursively check if a slice is supported
  const isSupported = (sliceIndex, allSlices, visited = new Set()) => {
    if (visited.has(sliceIndex)) return false; // Prevent infinite loops
    visited.add(sliceIndex);
    
    const slice = allSlices[sliceIndex];
    if (!slice || slice.falling) return false;
    
    // Slices in the cylinder are always supported
    if (isInCylinder(slice)) return true;
    
    // For pulled-out slices, check what's below at the same Y level
    const sliceBottom = slice.y + SLICE_HEIGHT;
    
    // Find all slices that could be supporting this one
    // A supporting slice must:
    // 1. Have its top at or below our bottom (vertically adjacent or below)
    // 2. Overlap horizontally
    // 3. Be stable itself
    
    for (let i = 0; i < allSlices.length; i++) {
      if (i === sliceIndex) continue;
      const other = allSlices[i];
      if (other.falling) continue;
      
      const otherTop = other.y;
      
      // Check if this slice is directly below (within a small threshold)
      if (Math.abs(otherTop - sliceBottom) < 5) {
        // Check horizontal overlap
        if (overlapsHorizontally(slice.offset, other.offset)) {
          // If the supporting slice is in the cylinder, we're supported
          if (isInCylinder(other)) return true;
          // Otherwise, check if that slice is supported (recursively)
          if (isSupported(i, allSlices, visited)) return true;
        }
        
        // Also check if we overlap with the cylinder column and the slice below is in cylinder
        if (overlapsHorizontally(slice.offset, 0) && isInCylinder(other)) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Find what Y position a falling slice should land at
  const findLandingY = (fallingSlice, fallingIndex, allSlices) => {
    let landingY = null;
    
    for (let i = 0; i < allSlices.length; i++) {
      if (i === fallingIndex) continue;
      const other = allSlices[i];
      if (other.falling) continue;
      
      // Must overlap horizontally
      if (!overlapsHorizontally(fallingSlice.offset, other.offset)) continue;
      
      // The other slice must be below our current position
      if (other.y <= fallingSlice.y) continue;
      
      // Check if this slice is supported
      if (!isSupported(i, allSlices, new Set())) continue;
      
      // Land on top of this slice
      const potentialLandingY = other.y - SLICE_HEIGHT;
      if (landingY === null || potentialLandingY < landingY) {
        landingY = potentialLandingY;
      }
    }
    
    return landingY;
  };

  useEffect(() => {
    const animate = () => {
      setSlices(prev => {
        let newSlices = prev.map(s => ({ ...s }));
        let slicesToRemove = [];
        
        // Check each slice
        for (let i = 0; i < newSlices.length; i++) {
          const slice = newSlices[i];
          if (dragging?.index === i) continue;
          
          // If not falling, check if it should start falling
          if (!slice.falling) {
            if (!isInCylinder(slice) && !isSupported(i, newSlices, new Set())) {
              newSlices[i] = { ...slice, falling: true, vy: 0 };
            }
          }
        }
        
        // Update falling slices
        for (let i = 0; i < newSlices.length; i++) {
          const slice = newSlices[i];
          if (dragging?.index === i) continue;
          
          if (slice.falling) {
            const newVy = slice.vy + 0.6;
            const newY = slice.y + newVy;
            
            // Check for landing
            const landingY = findLandingY({ ...slice, y: newY }, i, newSlices);
            
            if (landingY !== null && newY >= landingY) {
              // Land
              newSlices[i] = { ...slice, y: landingY, vy: 0, falling: false };
            } else if (newY > VISIBLE_SLICES * SLICE_HEIGHT + 200) {
              // Fell off bottom
              slicesToRemove.push(i);
            } else {
              // Keep falling
              newSlices[i] = { ...slice, y: newY, vy: newVy };
            }
          }
        }
        
        // Remove fallen slices and add new ones
        if (slicesToRemove.length > 0) {
          const remainingSlices = newSlices.filter((_, i) => !slicesToRemove.includes(i));
          const maxId = Math.max(...newSlices.map(s => s.id)) + 1;
          
          for (let i = 0; i < slicesToRemove.length; i++) {
            remainingSlices.unshift({
              id: maxId + i,
              offset: 0,
              y: -SLICE_HEIGHT * (i + 1),
              vy: 0,
              falling: false
            });
          }
          
          return remainingSlices;
        }
        
        return newSlices;
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [dragging]);

  const totalHeight = VISIBLE_SLICES * SLICE_HEIGHT;
  const bodyColor = '#d1d5db';
  const topColor = '#e5e7eb';

  const Slice = ({ slice, index, showTopCap, showBottomRound }) => {
    const isPulled = Math.abs(slice.offset) > 2;
    
    return (
      <div
        className="absolute"
        style={{
          left: slice.offset,
          top: slice.y,
          width: CYLINDER_WIDTH,
          height: SLICE_HEIGHT,
          cursor: slice.falling ? 'default' : 'grab',
          zIndex: slice.falling ? 1000 : VISIBLE_SLICES - index
        }}
        onMouseDown={(e) => handleMouseDown(e, index)}
      >
        <div
          className="absolute"
          style={{
            top: 0,
            left: 0,
            width: CYLINDER_WIDTH,
            height: SLICE_HEIGHT,
            backgroundColor: bodyColor,
          }}
        />
        
        {(isPulled || showTopCap) && (
          <div
            className="absolute"
            style={{
              top: -ELLIPSE_HEIGHT / 2,
              left: 0,
              width: CYLINDER_WIDTH,
              height: ELLIPSE_HEIGHT,
              borderRadius: '50%',
              backgroundColor: topColor,
            }}
          />
        )}
        
        {(isPulled || showBottomRound) && (
          <div
            className="absolute"
            style={{
              bottom: -ELLIPSE_HEIGHT / 2,
              left: 0,
              width: CYLINDER_WIDTH,
              height: ELLIPSE_HEIGHT,
              borderRadius: '50%',
              backgroundColor: bodyColor,
            }}
          />
        )}
      </div>
    );
  };

  const getSliceProps = (index) => {
    const slice = slices[index];
    if (!slice) return { showTopCap: false, showBottomRound: false };
    
    const isPulled = !isInCylinder(slice);
    
    // Find adjacent slices by Y position
    const sliceTop = slice.y;
    const sliceBottom = slice.y + SLICE_HEIGHT;
    
    let hasAdjacentAbove = false;
    let hasAdjacentBelow = false;
    
    for (const other of slices) {
      if (other.id === slice.id) continue;
      
      const otherBottom = other.y + SLICE_HEIGHT;
      const otherTop = other.y;
      
      // Check if other is directly above
      if (Math.abs(otherBottom - sliceTop) < 5 && overlapsHorizontally(slice.offset, other.offset)) {
        if (!isInCylinder(other) || !isInCylinder(slice)) {
          hasAdjacentAbove = true;
        }
      }
      
      // Check if other is directly below
      if (Math.abs(otherTop - sliceBottom) < 5 && overlapsHorizontally(slice.offset, other.offset)) {
        if (!isInCylinder(other) || !isInCylinder(slice)) {
          hasAdjacentBelow = true;
        }
      }
    }
    
    const showTopCap = isPulled || hasAdjacentAbove;
    const showBottomRound = isPulled || hasAdjacentBelow;
    
    return { showTopCap, showBottomRound };
  };

  const sortedSliceIndices = [...Array(slices.length).keys()].sort((a, b) => {
    return (slices[b]?.y || 0) - (slices[a]?.y || 0);
  });

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-screen overflow-hidden select-none flex items-center justify-center"
      style={{ 
        cursor: dragging ? 'grabbing' : 'default',
        backgroundColor: '#f5f5f4'
      }}
    >
      <div 
        className="relative"
        style={{ 
          width: CYLINDER_WIDTH + 400, 
          height: totalHeight,
        }}
      >
        <div style={{ position: 'absolute', left: 200, top: 0 }}>
          {sortedSliceIndices.map((index) => {
            const slice = slices[index];
            if (!slice) return null;
            const { showTopCap, showBottomRound } = getSliceProps(index);
            return (
              <Slice 
                key={slice.id} 
                slice={slice} 
                index={index}
                showTopCap={showTopCap}
                showBottomRound={showBottomRound}
              />
            );
          })}
        </div>
        
        <div 
          className="absolute left-0 right-0 top-0 pointer-events-none"
          style={{
            height: 150,
            background: 'linear-gradient(to bottom, #f5f5f4 0%, #f5f5f4 30%, transparent 100%)',
            zIndex: 100
          }}
        />
        
        <div 
          className="absolute left-0 right-0 bottom-0 pointer-events-none"
          style={{
            height: 150,
            background: 'linear-gradient(to top, #f5f5f4 0%, #f5f5f4 30%, transparent 100%)',
            zIndex: 100
          }}
        />
      </div>
    </div>
  );
};

export default InfiniteCylinder;