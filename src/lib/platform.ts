/**
 * Platform & Execution Environment Utilities
 * Detects whether Cortex is running as a Native Windows Desktop Application or Web Browser.
 */

export interface SystemMetrics {
  platform: string;
  arch: string;
  totalMemoryMB: number;
  freeMemoryMB: number;
  cpus: number;
}

export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Injected global via Electron preload
  if ((window as any).isDesktopApp === true) return true;

  // 2. Electron API context bridge
  if ((window as any).electronAPI) return true;

  // 3. Custom User Agent string
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    if (navigator.userAgent.includes('CortexDesktop') || navigator.userAgent.includes('Electron')) {
      return true;
    }
  }

  // 4. Query param override for preview testing (?platform=desktop) or localStorage toggle
  if (typeof window !== 'undefined') {
    try {
      if (window.localStorage && window.localStorage.getItem('cortex_force_desktop') === 'true') {
        return true;
      }
      if (window.location && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        if (params.get('platform') === 'desktop') return true;
      }
    } catch {}
  }

  return false;
}

export async function openNativeFolderDialog(): Promise<string | null> {
  if (!isDesktopApp()) return null;
  const api = (window as any).electronAPI;
  if (!api || !api.openFolderDialog) return null;

  try {
    const result = await api.openFolderDialog();
    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
  } catch (err) {
    console.error('Failed to open native folder dialog:', err);
  }
  return null;
}

export async function getNativeSystemMetrics(): Promise<SystemMetrics | null> {
  if (!isDesktopApp()) return null;
  const api = (window as any).electronAPI;
  if (!api || !api.getSystemMetrics) return null;

  try {
    return await api.getSystemMetrics();
  } catch {
    return null;
  }
}
