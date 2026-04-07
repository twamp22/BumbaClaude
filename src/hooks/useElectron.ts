"use client";

import { useCallback, useEffect, useState } from "react";

interface ElectronAPI {
  isElectron: boolean;
  selectDirectory: () => Promise<string | null>;
  sendNotification: (title: string, body: string, route?: string) => Promise<void>;
  getVersion: () => Promise<string>;
  onNavigate: (callback: (route: string) => void) => () => void;
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

  return {
    isElectron,
    selectDirectory,
    sendNotification,
  };
}
