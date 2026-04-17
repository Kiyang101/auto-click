import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { useEffect, useState } from 'react';

export function PointOverlay({ id }: { id: string }) {
  const urlParams = new URLSearchParams(window.location.search);
  const initialLabel = urlParams.get('label');

  const [currentIndex, setCurrentIndex] = useState(initialLabel || '');
  const [isHighlighted, setIsHighlighted] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('point-overlay');

    const unlistenIndices = listen('update-indices', (event: any) => {
      const mapping = event.payload.mapping;
      if (mapping[id]) {
        setCurrentIndex(mapping[id].toString());
      }
    });

    const unlistenHighlight = listen('highlight-point', (event: any) => {
      if (event.payload.id === id) {
        setIsHighlighted(event.payload.active);
      }
    });

    const interval = setInterval(async () => {
      const win = await WebviewWindow.getByLabel(`point-${id}`);
      if (win) {
        await win.outerPosition();
      }
    }, 1000);

    return () => {
      document.documentElement.classList.remove('point-overlay');
      unlistenIndices.then(fn => fn());
      unlistenHighlight.then(fn => fn());
      clearInterval(interval);
    };
  }, [id]);

  return (
    <div
      data-tauri-drag-region
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        cursor: 'move',
        transition: 'all 0.2s ease'
      }}
    >
      <div style={{ position: 'relative', transform: isHighlighted ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.2s ease' }}>
        
        {/* Outer Ring */}
        <div
          data-tauri-drag-region
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: `1px solid ${isHighlighted ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.4)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            boxShadow: isHighlighted ? '0 0 15px rgba(59, 130, 246, 0.5)' : 'none',
            backgroundColor: isHighlighted ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0, 0, 0, 0.2)',
            backdropFilter: 'blur(2px)',
            transition: 'all 0.2s ease'
          }}
        >
          {/* Inner Circle */}
          <div
            data-tauri-drag-region
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: `2px solid ${isHighlighted ? '#60a5fa' : '#3b82f6'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
          >
            {/* Center Point */}
            <div
              data-tauri-drag-region
              style={{
                width: '4px',
                height: '4px',
                backgroundColor: isHighlighted ? '#60a5fa' : '#3b82f6',
                borderRadius: '50%',
                boxShadow: `0 0 8px ${isHighlighted ? '#60a5fa' : '#3b82f6'}`,
              }}
            />
          </div>

          {/* Crosshairs */}
          <div data-tauri-drag-region style={{ position: 'absolute', top: '0', bottom: '0', left: '50%', width: '1px', background: 'rgba(255,255,255,0.2)', transform: 'translateX(-50%)', pointerEvents: 'none' }} />
          <div data-tauri-drag-region style={{ position: 'absolute', left: '0', right: '0', top: '50%', height: '1px', background: 'rgba(255,255,255,0.2)', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>

        {/* Index Label */}
        {currentIndex && (
          <div
            data-tauri-drag-region
            style={{
              position: 'absolute',
              top: '-12px',
              right: '-12px',
              backgroundColor: isHighlighted ? '#3b82f6' : '#1e293b',
              color: 'white',
              fontSize: '10px',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.1)',
              zIndex: 10,
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              fontFamily: 'Inter, sans-serif',
              pointerEvents: 'none',
              transition: 'all 0.2s ease'
            }}
          >
            {currentIndex}
          </div>
        )}
      </div>
    </div>
  );
}
