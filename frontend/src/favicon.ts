const faviconFrames: string[] = [
  './favicon/favicon1.ico',
  './favicon/favicon2.ico',
  './favicon/favicon3.ico'
];

let frameIndex: number = 0;

function changeFavicon(): void {
  let favicon: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");

  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    document.head.appendChild(favicon);
  }

  if (favicon) {
    favicon.href = faviconFrames[frameIndex];
    frameIndex = (frameIndex + 1) % faviconFrames.length;
  }
}

export function startFaviconAnimation(intervalMs: number = 500): void {
  changeFavicon(); // Run once immediately
  setInterval(changeFavicon, intervalMs); // Animate every intervalMs milliseconds
}