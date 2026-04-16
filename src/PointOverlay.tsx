import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useEffect } from 'react';

export function PointOverlay({ id }: { id: string }) {
  useEffect(() => {
    const interval = setInterval(async () => {
      const win = await WebviewWindow.getByLabel(`point-${id}`);
      if (win) {
        // We just keep this interval running to ensure the window is alive
        // The position is actually fetched by the main window right before clicking starts
        await win.outerPosition(); 
      }
    }, 1000);
    return () => clearInterval(interval);
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
        cursor: 'move'
      }}
    >
      <div 
        data-tauri-drag-region
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: '3px solid #ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}
      >
        <div data-tauri-drag-region style={{ width: '4px', height: '4px', backgroundColor: '#ef4444', borderRadius: '50%' }} />
        {/* Crosshairs */}
        <div data-tauri-drag-region style={{ position: 'absolute', top: '-10px', bottom: '-10px', left: '18px', right: '18px', borderLeft: '1px solid #ef4444', pointerEvents: 'none' }} />
        <div data-tauri-drag-region style={{ position: 'absolute', left: '-10px', right: '-10px', top: '18px', bottom: '18px', borderTop: '1px solid #ef4444', pointerEvents: 'none' }} />
      </div>
    </div>
  );
}
