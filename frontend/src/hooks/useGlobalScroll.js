import { useEffect, useRef } from 'react';

/**
 * Custom hook to enable global horizontal scrolling via arrow keys.
 * Supports hover detection and shift-key for faster scrolling.
 */
const useGlobalScroll = () => {
  const mousePos = useRef({ x: 0, y: 0 });
  const lastActiveTarget = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    };

    // Track last clicked element to prioritize as "active" scroll target if mouse is elsewhere
    const handleMouseDown = (e) => {
      const target = e.target.closest('.overflow-x-auto, .overflow-x-scroll, [class*="table-"], .table-container');
      if (target) {
        lastActiveTarget.current = target;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);

    const handleKeyDown = (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      const activeElement = document.activeElement;
      const isInput = activeElement.tagName === 'INPUT' || 
                      activeElement.tagName === 'TEXTAREA' || 
                      activeElement.tagName === 'SELECT' ||
                      activeElement.isContentEditable;
      
      // Don't scroll table if typing
      if (isInput && !e.ctrlKey && !e.altKey) return;

      let target = null;

      // 1. Hover Detection (Fastest/Most Intuitive)
      const elementAtPoint = document.elementFromPoint(mousePos.current.x, mousePos.current.y);
      if (elementAtPoint) {
        target = elementAtPoint.closest('.overflow-x-auto, .overflow-x-scroll, .table-container, .table-wrapper, [style*="overflow-x: auto"], [style*="overflow-x: scroll"]');
        if (!target) {
          let curr = elementAtPoint;
          while (curr && curr !== document.body) {
            const style = window.getComputedStyle(curr);
            if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && curr.scrollWidth > curr.clientWidth) {
              target = curr;
              break;
            }
            curr = curr.parentElement;
          }
        }
      }

      // 2. Last Clicked Detection
      if (!target && lastActiveTarget.current && document.body.contains(lastActiveTarget.current)) {
        if (lastActiveTarget.current.scrollWidth > lastActiveTarget.current.clientWidth) {
          target = lastActiveTarget.current;
        }
      }

      // 3. Fallback: Most Visible Container
      if (!target) {
        const scrollContainers = document.querySelectorAll('.overflow-x-auto, .overflow-x-scroll, .table-container, .table-wrapper');
        target = Array.from(scrollContainers).find(el => {
          const rect = el.getBoundingClientRect();
          const isVisible = rect.top < (window.innerHeight || document.documentElement.clientHeight) && rect.bottom > 0;
          return isVisible && el.scrollWidth > el.clientWidth;
        });
      }

      if (target) {
        // Only prevent default if we actually found something to scroll
        e.preventDefault();

        const scrollAmount = e.shiftKey ? 300 : 150;
        const direction = e.key === 'ArrowRight' ? 1 : -1;

        target.scrollBy({
          left: direction * scrollAmount,
          behavior: 'smooth'
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true, passive: false });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);
};

export default useGlobalScroll;
