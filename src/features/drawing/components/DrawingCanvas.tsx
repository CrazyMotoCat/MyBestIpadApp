import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { DrawingPoint, DrawingStroke } from "@/shared/types/models";
import { ToolStrokeStyle } from "@/shared/types/presets";
import { createId } from "@/shared/lib/utils/id";

interface DrawingCanvasProps {
  strokes: DrawingStroke[];
  toolId: DrawingStroke["toolId"];
  color: string;
  strokeWidth: number;
  opacity: number;
  strokeStyle: ToolStrokeStyle;
  smoothing: number;
  className?: string;
  onChange?: (strokes: DrawingStroke[]) => void;
}

export interface DrawingCanvasHandle {
  beginStroke: (point: DrawingPoint) => void;
  appendPoint: (point: DrawingPoint) => void;
  endStroke: () => void;
  getStrokes: () => DrawingStroke[];
}

function applyStrokeStyle(
  context: CanvasRenderingContext2D,
  stroke: Pick<DrawingStroke, "color" | "width" | "opacity" | "strokeStyle">,
) {
  context.lineWidth = stroke.width;
  context.globalAlpha = stroke.strokeStyle === "marker" ? stroke.opacity : 1;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.setLineDash([]);
  context.globalCompositeOperation = "source-over";
  context.strokeStyle = stroke.color;

  if (stroke.strokeStyle === "dashed") {
    context.setLineDash([10, 6]);
  }

  if (stroke.strokeStyle === "marker") {
    context.lineCap = "square";
  }

  if (stroke.strokeStyle === "grain") {
    context.setLineDash([1, 3]);
  }

  if (stroke.strokeStyle === "eraser") {
    context.globalCompositeOperation = "destination-out";
    context.strokeStyle = "rgba(0,0,0,1)";
    context.globalAlpha = 1;
  }
}

function drawStroke(context: CanvasRenderingContext2D, stroke: DrawingStroke) {
  if (stroke.points.length === 0) {
    return;
  }

  applyStrokeStyle(context, stroke);
  context.beginPath();
  context.moveTo(stroke.points[0]!.x, stroke.points[0]!.y);

  for (let index = 1; index < stroke.points.length; index += 1) {
    const point = stroke.points[index]!;
    const previousPoint = stroke.points[index - 1]!;
    const midpointX = (previousPoint.x + point.x) / 2;
    const midpointY = (previousPoint.y + point.y) / 2;
    context.quadraticCurveTo(previousPoint.x, previousPoint.y, midpointX, midpointY);
  }

  const lastPoint = stroke.points[stroke.points.length - 1]!;
  context.lineTo(lastPoint.x, lastPoint.y);
  context.stroke();
}

function drawStrokeSegment(
  context: CanvasRenderingContext2D,
  stroke: DrawingStroke,
  previousPoint: DrawingPoint,
  nextPoint: DrawingPoint,
) {
  applyStrokeStyle(context, stroke);
  context.beginPath();
  context.moveTo(previousPoint.x, previousPoint.y);
  context.lineTo(nextPoint.x, nextPoint.y);
  context.stroke();
}

export const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(function DrawingCanvas(
  {
    strokes,
    toolId,
    color,
    strokeWidth,
    opacity,
    strokeStyle,
    smoothing,
    className,
    onChange,
  },
  ref,
) {
  const committedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeStrokeRef = useRef<DrawingStroke | null>(null);
  const strokesRef = useRef<DrawingStroke[]>(strokes);
  const liveClearFrameRef = useRef<number | null>(null);

  function cancelPendingLiveClear() {
    if (liveClearFrameRef.current !== null) {
      window.cancelAnimationFrame(liveClearFrameRef.current);
      liveClearFrameRef.current = null;
    }
  }

  function syncCanvas(canvas: HTMLCanvasElement) {
    const ratio = window.devicePixelRatio || 1;
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(bounds.width, 1);
    const height = Math.max(bounds.height, 320);
    const nextWidth = Math.round(width * ratio);
    const nextHeight = Math.round(height * ratio);
    const needsResize = canvas.width !== nextWidth || canvas.height !== nextHeight;

    if (needsResize) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { context, width, height, resized: needsResize };
  }

  function drawStrokeList(canvas: HTMLCanvasElement | null, nextStrokes: DrawingStroke[]) {
    if (!canvas) {
      return;
    }

    const canvasState = syncCanvas(canvas);

    if (!canvasState) {
      return;
    }

    const { context, width, height } = canvasState;
    context.clearRect(0, 0, width, height);

    for (const stroke of nextStrokes) {
      drawStroke(context, stroke);
    }
  }

  function redrawLiveStroke(stroke: DrawingStroke | null) {
    const liveCanvas = liveCanvasRef.current;

    if (!liveCanvas) {
      return;
    }

    const canvasState = syncCanvas(liveCanvas);

    if (!canvasState) {
      return;
    }

    const { context, width, height } = canvasState;
    context.clearRect(0, 0, width, height);

    if (!stroke) {
      return;
    }

    drawStroke(context, stroke);
  }

  useEffect(() => {
    strokesRef.current = strokes;

    drawStrokeList(committedCanvasRef.current, strokes);
    redrawLiveStroke(activeStrokeRef.current);
  }, [strokes]);

  useEffect(() => {
    function handleResize() {
      drawStrokeList(committedCanvasRef.current, strokesRef.current);
      redrawLiveStroke(activeStrokeRef.current);
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      cancelPendingLiveClear();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      beginStroke(point) {
        cancelPendingLiveClear();

        const stroke: DrawingStroke = {
          id: createId("stroke"),
          pageId: "draft",
          toolId,
          color,
          width: strokeWidth,
          opacity,
          strokeStyle,
          smoothing,
          points: [point],
          createdAt: new Date().toISOString(),
        };

        activeStrokeRef.current = stroke;

        if (stroke.strokeStyle === "eraser") {
          redrawLiveStroke(null);
          return;
        }

        redrawLiveStroke(stroke);
      },
      appendPoint(point) {
        const activeStroke = activeStrokeRef.current;

        if (!activeStroke) {
          return;
        }

        const previousPoint = activeStroke.points[activeStroke.points.length - 1];

        const updatedStroke: DrawingStroke = {
          ...activeStroke,
          points: [...activeStroke.points, point],
        };

        activeStrokeRef.current = updatedStroke;

        if (!previousPoint) {
          return;
        }

        if (updatedStroke.strokeStyle === "eraser") {
          const committedCanvas = committedCanvasRef.current;
          const context = committedCanvas?.getContext("2d");

          if (context) {
            drawStrokeSegment(context, updatedStroke, previousPoint, point);
          }

          return;
        }

        const liveCanvas = liveCanvasRef.current;
        const context = liveCanvas?.getContext("2d");

        if (context) {
          drawStrokeSegment(context, updatedStroke, previousPoint, point);
        }
      },
      endStroke() {
        const committedCanvas = committedCanvasRef.current;
        const liveCanvas = liveCanvasRef.current;
        const activeStroke = activeStrokeRef.current;

        if (committedCanvas && activeStroke && activeStroke.strokeStyle !== "eraser") {
          const context = committedCanvas.getContext("2d");

          if (context) {
            context.save();
            context.setTransform(1, 0, 0, 1, 0, 0);
            context.drawImage(liveCanvas ?? committedCanvas, 0, 0);
            context.restore();
          }
        }

        if (activeStroke) {
          strokesRef.current = [...strokesRef.current, activeStroke];
          onChange?.([...strokesRef.current]);
        }

        activeStrokeRef.current = null;
        liveClearFrameRef.current = window.requestAnimationFrame(() => {
          liveClearFrameRef.current = null;
          if (!activeStrokeRef.current) {
            redrawLiveStroke(null);
          }
        });
      },
      getStrokes() {
        return [...strokesRef.current];
      },
    }),
    [color, onChange, opacity, smoothing, strokeStyle, strokeWidth, toolId],
  );

  return (
    <>
      <canvas ref={committedCanvasRef} className={className ?? "editor-canvas"} aria-hidden="true" />
      <canvas ref={liveCanvasRef} className={className ?? "editor-canvas"} aria-hidden="true" />
    </>
  );
});
