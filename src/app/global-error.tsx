"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <button onClick={() => reset()}>Reload</button>
      </body>
    </html>
  );
}
