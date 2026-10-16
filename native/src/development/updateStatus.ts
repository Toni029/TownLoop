export function updateStatus(s: { isUpdatePending: boolean; isChecking: boolean; isDownloading: boolean; isStartupProcedureRunning: boolean; isUpdateAvailable: boolean; downloadProgress?: number; checkError?: unknown; downloadError?: unknown }) {
  if (s.isUpdatePending) return { kind: 'ready', label: 'Update ready', progress: null };
  if (s.isDownloading) {
    const progress = typeof s.downloadProgress === 'number' && Number.isFinite(s.downloadProgress)
      ? Math.floor(Math.max(0, Math.min(1, s.downloadProgress)) * 100) : null;
    return { kind: 'downloading', label: progress === null ? 'Downloading update…' : `Downloading update · ${progress}%`, progress };
  }
  if (s.isChecking || s.isStartupProcedureRunning) return { kind: 'checking', label: 'Checking for updates…', progress: null };
  if (s.downloadError || s.checkError) return { kind: 'error', label: 'Update could not finish. You can keep using TownLoop.', progress: null };
  if (s.isUpdateAvailable) return { kind: 'available', label: 'A TownLoop update is available', progress: null };
  return null;
}
