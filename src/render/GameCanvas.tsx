import { useEffect, useRef } from "react";

function resizeCanvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
): void {
  const bounds = canvas.getBoundingClientRect();
  const pixelRatio = Math.max(1, window.devicePixelRatio);
  canvas.width = Math.round(bounds.width * pixelRatio);
  canvas.height = Math.round(bounds.height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d") ?? null;
    if (canvas === null || context === null) return undefined;

    let frameId = 0;
    const resize = () => resizeCanvas(canvas, context);
    const drawFrame = () => {
      const bounds = canvas.getBoundingClientRect();
      context.clearRect(0, 0, bounds.width, bounds.height);
      frameId = requestAnimationFrame(drawFrame);
    };

    resize();
    window.addEventListener("resize", resize);
    frameId = requestAnimationFrame(drawFrame);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="game-canvas" aria-label="Simulation canvas" />;
}
