"use client";

import { useCallback, useEffect, useState } from "react";

interface ElectronAPI {
  isElectron: boolean;
  selectDirectory: () => Promise<string | null>;
  sendNotification: (title: string, body: string, route?: string) => Promise<void>;
  getVersion: () => Promise<string>;
  onNavigate: (callback: (route: string) => void) => () => void;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  onUpdateAvailable: (callback: (info: { version: string }) => void) => () => void;
  onUpdateProgress: (callback: (progress: { percent: number }) => void) => () => void;
  onUpdateDownloaded: (callback: () => void) => () => void;
  setOpenAtLogin: (enabled: boolean) => Promise<void>;
  getOpenAtLogin: () => Promise<{ openAtLogin: boolean }>;
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;
  windowIsMaximized: () => Promise<boolean>;
  onWindowMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export function useElectron() {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    setIsElectron(!!window.electronAPI?.isElectron);
  }, []);

  const selectDirectory = useCallback(async (): Promise<string | null> => {
    if (!window.electronAPI) return null;
    return window.electronAPI.selectDirectory();
  }, []);

  const sendNotification = useCallback(
    async (title: string, body: string, route?: string): Promise<void> => {
      if (!window.electronAPI) return;
      return window.electronAPI.sendNotification(title, body, route);
    },
    []
  );

  const downloadUpdate = useCallback(async (): Promise<void> => {
    if (!window.electronAPI) return;
    return window.electronAPI.downloadUpdate();
  }, []);

  const installUpdate = useCallback(async (): Promise<void> => {
    if (!window.electronAPI) return;
    return window.electronAPI.installUpdate();
  }, []);

  const onUpdateAvailable = useCallback(
    (callback: (info: { version: string }) => void): (() => void) => {
      if (!window.electronAPI) return () => {};
      return window.electronAPI.onUpdateAvailable(callback);
    },
    []
  );

  const onUpdateProgress = useCallback(
    (callback: (progress: { percent: number }) => void): (() => void) => {
      if (!window.electronAPI) return () => {};
      return window.electronAPI.onUpdateProgress(callback);
    },
    []
  );

  const onUpdateDownloaded = useCallback(
    (callback: () => void): (() => void) => {
      if (!window.electronAPI) return () => {};
      return window.electronAPI.onUpdateDownloaded(callback);
    },
    []
  );

  const setOpenAtLogin = useCallback(async (enabled: boolean): Promise<void> => {
    if (!window.electronAPI) return;
    return window.electronAPI.setOpenAtLogin(enabled);
  }, []);

  const getOpenAtLogin = useCallback(async (): Promise<{ openAtLogin: boolean } | null> => {
    if (!window.electronAPI) return null;
    return window.electronAPI.getOpenAtLogin();
  }, []);

  const windowMinimize = useCallback(async (): Promise<void> => {
    if (!window.electronAPI) return;
    return window.electronAPI.windowMinimize();
  }, []);

  const windowMaximize = useCallback(async (): Promise<void> => {
    if (!window.electronAPI) return;
    return window.electronAPI.windowMaximize();
  }, []);

  const windowClose = useCallback(async (): Promise<void> => {
    if (!window.electronAPI) return;
    return window.electronAPI.windowClose();
  }, []);

  const windowIsMaximized = useCallback(async (): Promise<boolean> => {
    if (!window.electronAPI) return false;
    return window.electronAPI.windowIsMaximized();
  }, []);

  const onWindowMaximizeChange = useCallback(
    (callback: (isMaximized: boolean) => void): (() => void) => {
      if (!window.electronAPI) return () => {};
      return window.electronAPI.onWindowMaximizeChange(callback);
    },
    []
  );

  return {
    isElectron,
    selectDirectory,
    sendNotification,
    downloadUpdate,
    installUpdate,
    onUpdateAvailable,
    onUpdateProgress,
    onUpdateDownloaded,
    setOpenAtLogin,
    getOpenAtLogin,
    windowMinimize,
    windowMaximize,
    windowClose,
    windowIsMaximized,
    onWindowMaximizeChange,
  };
}
