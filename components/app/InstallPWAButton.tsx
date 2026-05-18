'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';

/** The non-standard `beforeinstallprompt` event (Chromium browsers). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Sidebar "Install App" button. On Chromium browsers it triggers the native
 * install prompt; on iOS Safari (which has no prompt API) it shows the manual
 * Add-to-Home-Screen steps. It hides itself once the app is installed.
 */
export function InstallPWAButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosInstallable, setIosInstallable] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return; // already installed — nothing to offer

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setPromptEvent(null);
      setIosInstallable(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // iOS Safari never fires `beforeinstallprompt`; detect it for a manual hint.
    // The state update is deferred a tick so it isn't a synchronous effect render.
    const ua = window.navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|crios|fxios|android).)*safari/i.test(ua);
    const iosTimer = isIOS && isSafari
      ? window.setTimeout(() => setIosInstallable(true), 0)
      : undefined;

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      if (iosTimer !== undefined) window.clearTimeout(iosTimer);
    };
  }, []);

  if (!promptEvent && !iosInstallable) return null;

  const handleClick = async () => {
    if (promptEvent) {
      await promptEvent.prompt();
      await promptEvent.userChoice;
      setPromptEvent(null);
    } else {
      alert(
        'To install Yakuza DMS:\n\nTap the Share button in Safari, then choose “Add to Home Screen”.',
      );
    }
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={handleClick}
        tooltip="Install App"
        className="text-red-700 hover:text-red-800 hover:bg-red-50"
      >
        <Download />
        <span>Install App</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
