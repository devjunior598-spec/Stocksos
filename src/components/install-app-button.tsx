"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isAppleMobileDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [appleDevice, setAppleDevice] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) {
      setAppleDevice(isAppleMobileDevice());
      setHelpOpen(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  }

  return (
    <>
      <button className="install-app-action" type="button" onClick={install} disabled={installed}>
        <Download size={16} aria-hidden="true" />
        {installed ? "StockSOS is installed" : "Install StockSOS"}
      </button>
      {helpOpen && (
        <div className="install-help-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setHelpOpen(false);
        }}>
          <section className="install-help" role="dialog" aria-modal="true" aria-labelledby="install-help-title">
            <button className="install-help-close" type="button" onClick={() => setHelpOpen(false)} aria-label="Close install instructions">×</button>
            <span className="install-help-icon"><Download size={21} /></span>
            <h2 id="install-help-title">Add StockSOS to your device</h2>
            {appleDevice ? (
              <ol>
                <li>Open this page in Safari.</li>
                <li>Tap the <Share size={15} aria-label="Share" className="install-inline-icon" /> Share button.</li>
                <li>Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</li>
              </ol>
            ) : (
              <ol>
                <li>Open this page in Chrome, Edge, or another supported browser.</li>
                <li>Open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
                <li>Confirm the prompt to add StockSOS to your device.</li>
              </ol>
            )}
            <p>StockSOS needs an internet connection for sign-in, supplier listings, and marketplace actions.</p>
            <button className="button button-primary install-help-done" type="button" onClick={() => setHelpOpen(false)}>Got it</button>
          </section>
        </div>
      )}
    </>
  );
}
