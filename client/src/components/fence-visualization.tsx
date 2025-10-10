import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { RotateCcw, Box, Layers } from "lucide-react";
import { FenceDesign } from "@shared/schema";

interface FenceVisualizationProps {
  design: FenceDesign;
  activeSpanId?: string;
}

export function FenceVisualization({ design, activeSpanId }: FenceVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const [webglError, setWebglError] = useState(false);
  const [viewMode, setViewMode] = useState<"2d" | "elevation" | "3d">("elevation");

  useEffect(() => {
    if (!containerRef.current || viewMode !== "3d") return;

    try {
      // Scene setup
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a1a);
      sceneRef.current = scene;

      // Camera setup
      const camera = new THREE.PerspectiveCamera(
        45,
        containerRef.current.clientWidth / containerRef.current.clientHeight,
        0.1,
        1000
      );
      camera.position.set(10, 8, 10);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      // Renderer setup with error handling
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      
      // Check if WebGL context was created successfully
      const gl = renderer.getContext();
      if (!gl) {
        throw new Error("WebGL context not available");
      }

      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(5, 10, 5);
      scene.add(directionalLight);

      // Grid floor
      const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
      scene.add(gridHelper);

      // Render fence based on design
      renderFence(scene, design, activeSpanId);

      // Animation loop
      const animate = () => {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();

      // Handle window resize
      const handleResize = () => {
        if (!containerRef.current || !camera || !renderer) return;
        camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      };
      window.addEventListener("resize", handleResize);

      // Mouse controls
      const handleMouseDown = (e: MouseEvent) => {
        isDragging.current = true;
        previousMousePosition.current = { x: e.clientX, y: e.clientY };
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current || !camera) return;

        const deltaX = e.clientX - previousMousePosition.current.x;
        const deltaY = e.clientY - previousMousePosition.current.y;

        const rotationSpeed = 0.005;
        const radius = Math.sqrt(
          camera.position.x ** 2 + camera.position.z ** 2
        );

        const angle = Math.atan2(camera.position.z, camera.position.x);
        const newAngle = angle - deltaX * rotationSpeed;

        camera.position.x = radius * Math.cos(newAngle);
        camera.position.z = radius * Math.sin(newAngle);
        camera.position.y = Math.max(2, camera.position.y - deltaY * 0.05);

        camera.lookAt(0, 0, 0);

        previousMousePosition.current = { x: e.clientX, y: e.clientY };
      };

      const handleMouseUp = () => {
        isDragging.current = false;
      };

      const handleWheel = (e: WheelEvent) => {
        if (!camera) return;
        e.preventDefault();
        const zoomSpeed = 0.001;
        const distance = camera.position.length();
        const newDistance = Math.max(5, Math.min(30, distance + e.deltaY * zoomSpeed * distance));
        const scale = newDistance / distance;
        camera.position.multiplyScalar(scale);
      };

      renderer.domElement.addEventListener("mousedown", handleMouseDown);
      renderer.domElement.addEventListener("mousemove", handleMouseMove);
      renderer.domElement.addEventListener("mouseup", handleMouseUp);
      renderer.domElement.addEventListener("mouseleave", handleMouseUp);
      renderer.domElement.addEventListener("wheel", handleWheel, { passive: false });

      return () => {
        window.removeEventListener("resize", handleResize);
        renderer.domElement.removeEventListener("mousedown", handleMouseDown);
        renderer.domElement.removeEventListener("mousemove", handleMouseMove);
        renderer.domElement.removeEventListener("mouseup", handleMouseUp);
        renderer.domElement.removeEventListener("mouseleave", handleMouseUp);
        renderer.domElement.removeEventListener("wheel", handleWheel);
        if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
          containerRef.current.removeChild(renderer.domElement);
        }
        renderer.dispose();
      };
    } catch (error) {
      console.error("WebGL initialization failed:", error);
      setWebglError(true);
      setViewMode("2d");
    }
  }, [viewMode]);

  useEffect(() => {
    if (sceneRef.current && !webglError && viewMode === "3d") {
      // Clear previous fence
      const objectsToRemove = sceneRef.current.children.filter(
        (child) => child.userData.isFence
      );
      objectsToRemove.forEach((obj) => sceneRef.current!.remove(obj));

      // Render new fence
      renderFence(sceneRef.current, design, activeSpanId);
    }
  }, [design, activeSpanId, webglError, viewMode]);

  useEffect(() => {
    if ((viewMode === "2d" || viewMode === "elevation") && canvasRef.current) {
      if (viewMode === "2d") {
        render2DView(canvasRef.current, design, activeSpanId);
      } else {
        renderElevationView(canvasRef.current, design, activeSpanId);
      }
    }
  }, [design, activeSpanId, viewMode]);

  const handleResetView = () => {
    if (cameraRef.current && viewMode === "3d") {
      cameraRef.current.position.set(10, 8, 10);
      cameraRef.current.lookAt(0, 0, 0);
    }
  };

  const cycleViewMode = () => {
    setViewMode((prev) => {
      if (prev === "2d") return "elevation";
      if (prev === "elevation") return webglError ? "2d" : "3d";
      return "2d";
    });
  };

  const getViewModeLabel = () => {
    if (viewMode === "2d") return "2D Plan";
    if (viewMode === "elevation") return "Elevation";
    return "3D View";
  };

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-background to-muted/30" data-testid="fence-visualization">
      {viewMode === "3d" ? (
        <div ref={containerRef} className="w-full h-full" />
      ) : (
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          data-testid={viewMode === "2d" ? "fence-2d-canvas" : "fence-elevation-canvas"}
        />
      )}

      <div className="absolute top-4 right-4 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={cycleViewMode}
          data-testid="button-cycle-view"
          className="gap-2"
        >
          <Layers className="w-4 h-4" />
          <span className="hidden sm:inline">{getViewModeLabel()}</span>
        </Button>
        {viewMode === "3d" && !webglError && (
          <Button
            size="icon"
            variant="outline"
            onClick={handleResetView}
            data-testid="button-reset-view"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
      </div>

      {viewMode === "3d" && !webglError && (
        <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-md p-3 text-sm space-y-1">
          <p className="text-muted-foreground">Click and drag to rotate</p>
          <p className="text-muted-foreground">Scroll to zoom</p>
        </div>
      )}

      {viewMode === "2d" && (
        <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-md p-3 text-sm">
          <p className="text-muted-foreground">Top-down plan view</p>
        </div>
      )}

      {viewMode === "elevation" && (
        <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-md p-3 text-sm">
          <p className="text-muted-foreground">Side elevation view</p>
        </div>
      )}

      {webglError && viewMode === "3d" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center p-8">
            <Box className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">3D Preview Unavailable</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              WebGL is not available. Use 2D or Elevation view instead.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function renderElevationView(canvas: HTMLCanvasElement, design: FenceDesign, activeSpanId?: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Set canvas size to match container
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  // Clear canvas
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
  ctx.fillRect(0, 0, rect.width, rect.height);

  // Calculate scaling - each span gets its own horizontal section
  const longestSpan = Math.max(...design.spans.map(span => span.length));
  const scale = Math.min((rect.width - 150) / longestSpan, 0.15);
  
  // Drawing constants
  const panelHeight = 1200; // 1200mm standard height
  const spanVerticalSpacing = 250; // Space between each span section
  const startX = 100;
  const startY = 80;

  design.spans.forEach((span, spanIndex) => {
    const isActive = span.spanId === activeSpanId;
    const effectiveLength = span.length;
    const panelWidth = span.maxPanelWidth;
    const gapSize = span.maxGap;
    const numPanels = Math.floor(effectiveLength / (panelWidth + gapSize));
    const leftRaked = span.leftRakedPanel?.enabled ? span.leftRakedPanel.height : null;
    const rightRaked = span.rightRakedPanel?.enabled ? span.rightRakedPanel.height : null;

    // Calculate Y position for this span (stacked vertically)
    const groundLevel = startY + (spanIndex * spanVerticalSpacing);
    let currentX = startX;

    // Draw span label
    ctx.fillStyle = isActive ? "#4488ff" : "#666";
    ctx.font = "bold 14px Inter";
    ctx.textAlign = "left";
    ctx.fillText(`Span ${span.spanId}`, 10, groundLevel - 100);

    // Draw ground line for this span
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX - 20, groundLevel);
    ctx.lineTo(startX + (span.length * scale) + 20, groundLevel);
    ctx.stroke();

    // Draw each panel in this span
    for (let i = 0; i < numPanels; i++) {
      const isGate = span.gateConfig?.required && i === 0;
      const scaledPanelWidth = panelWidth * scale;
      let scaledPanelHeight = panelHeight * scale;
      
      // Check if this is a raked panel
      const isLeftRaked = i === 0 && leftRaked !== null;
      const isRightRaked = i === numPanels - 1 && rightRaked !== null;
      
      // Draw panel (raked or standard)
      ctx.fillStyle = isGate ? "#aa66ff" : isActive ? "#4488ff" : "#88ccff";
      ctx.globalAlpha = isGate ? 0.4 : isActive ? 0.5 : 0.3;
      
      if (isLeftRaked || isRightRaked) {
        // Draw raked panel: 400mm horizontal at top, then slope to 1200mm
        // For left raked: high on left (400mm), slopes down on right
        // For right raked: slopes down on left, high on right (400mm)
        const rakedHeight = (isLeftRaked ? leftRaked! : rightRaked!) * scale;
        const horizontalWidth = 400 * scale; // 400mm horizontal section
        
        ctx.beginPath();
        if (isLeftRaked) {
          // Left raked: horizontal at top for first 400mm, then slope down
          ctx.moveTo(currentX, groundLevel);
          ctx.lineTo(currentX, groundLevel - rakedHeight);
          ctx.lineTo(currentX + horizontalWidth, groundLevel - rakedHeight);
          ctx.lineTo(currentX + scaledPanelWidth, groundLevel - scaledPanelHeight);
          ctx.lineTo(currentX + scaledPanelWidth, groundLevel);
        } else {
          // Right raked: slope up, then horizontal at top for last 400mm
          ctx.moveTo(currentX, groundLevel);
          ctx.lineTo(currentX, groundLevel - scaledPanelHeight);
          ctx.lineTo(currentX + scaledPanelWidth - horizontalWidth, groundLevel - rakedHeight);
          ctx.lineTo(currentX + scaledPanelWidth, groundLevel - rakedHeight);
          ctx.lineTo(currentX + scaledPanelWidth, groundLevel);
        }
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = isActive ? "#2266dd" : "#6699cc";
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Standard rectangular panel
        ctx.fillRect(currentX, groundLevel - scaledPanelHeight, scaledPanelWidth, scaledPanelHeight);

        // Panel border
        ctx.strokeStyle = isGate ? "#8844cc" : isActive ? "#2266dd" : "#6699cc";
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2;
        ctx.strokeRect(currentX, groundLevel - scaledPanelHeight, scaledPanelWidth, scaledPanelHeight);
      }

      // Glass panel lines (to show it's glass)
      ctx.strokeStyle = isGate ? "#9955dd" : isActive ? "#5599ee" : "#99ccee";
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1;
      for (let j = 1; j < 4; j++) {
        const y = groundLevel - (scaledPanelHeight * j / 4);
        ctx.beginPath();
        ctx.moveTo(currentX, y);
        ctx.lineTo(currentX + scaledPanelWidth, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Panel width dimension line with arrows
      const dimLineY = groundLevel + 35;
      ctx.strokeStyle = "#666";
      ctx.lineWidth = 1;
      
      // Horizontal dimension line
      ctx.beginPath();
      ctx.moveTo(currentX, dimLineY);
      ctx.lineTo(currentX + scaledPanelWidth, dimLineY);
      ctx.stroke();
      
      // Left arrow
      ctx.beginPath();
      ctx.moveTo(currentX, dimLineY);
      ctx.lineTo(currentX + 5, dimLineY - 3);
      ctx.lineTo(currentX + 5, dimLineY + 3);
      ctx.closePath();
      ctx.fillStyle = "#666";
      ctx.fill();
      
      // Right arrow
      ctx.beginPath();
      ctx.moveTo(currentX + scaledPanelWidth, dimLineY);
      ctx.lineTo(currentX + scaledPanelWidth - 5, dimLineY - 3);
      ctx.lineTo(currentX + scaledPanelWidth - 5, dimLineY + 3);
      ctx.closePath();
      ctx.fill();
      
      // Vertical tick marks
      ctx.beginPath();
      ctx.moveTo(currentX, groundLevel + 30);
      ctx.lineTo(currentX, dimLineY + 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(currentX + scaledPanelWidth, groundLevel + 30);
      ctx.lineTo(currentX + scaledPanelWidth, dimLineY + 5);
      ctx.stroke();

      // Panel width label
      ctx.fillStyle = "#444";
      ctx.font = "bold 11px JetBrains Mono";
      ctx.textAlign = "center";
      ctx.fillText(
        `${panelWidth}mm`,
        currentX + scaledPanelWidth / 2,
        dimLineY + 15
      );

      if (isGate) {
        ctx.fillStyle = "#aa66ff";
        ctx.font = "bold 11px Inter";
        ctx.fillText(
          "GATE",
          currentX + scaledPanelWidth / 2,
          groundLevel - scaledPanelHeight - 10
        );
      }

      currentX += scaledPanelWidth;

      // Gap between panels (no post - using spigots)
      if (i < numPanels - 1) {
        const scaledGapSize = gapSize * scale;
        const gapStart = currentX;
        
        // Gap dimension line with arrows
        const gapDimLineY = groundLevel + 35;
        ctx.strokeStyle = "#888";
        ctx.lineWidth = 1;
        
        // Horizontal dimension line for gap
        ctx.beginPath();
        ctx.moveTo(gapStart, gapDimLineY);
        ctx.lineTo(currentX + scaledGapSize, gapDimLineY);
        ctx.stroke();
        
        // Left arrow
        ctx.beginPath();
        ctx.moveTo(gapStart, gapDimLineY);
        ctx.lineTo(gapStart + 4, gapDimLineY - 2);
        ctx.lineTo(gapStart + 4, gapDimLineY + 2);
        ctx.closePath();
        ctx.fillStyle = "#888";
        ctx.fill();
        
        // Right arrow
        ctx.beginPath();
        ctx.moveTo(currentX + scaledGapSize, gapDimLineY);
        ctx.lineTo(currentX + scaledGapSize - 4, gapDimLineY - 2);
        ctx.lineTo(currentX + scaledGapSize - 4, gapDimLineY + 2);
        ctx.closePath();
        ctx.fill();

        // Gap label
        ctx.fillStyle = "#666";
        ctx.font = "10px JetBrains Mono";
        ctx.textAlign = "center";
        ctx.fillText(
          `${gapSize}mm`,
          gapStart + scaledGapSize / 2,
          gapDimLineY + 13
        );

        currentX += scaledGapSize;
      }
    }

    // Total span length
    ctx.fillStyle = "#888";
    ctx.font = "11px JetBrains Mono";
    ctx.textAlign = "left";
    ctx.fillText(
      `Total: ${effectiveLength}mm`,
      startX + (effectiveLength * scale) + 30,
      groundLevel - 50
    );

    // Height dimension line for this span
    const heightDimensionX = startX + (effectiveLength * scale) + 60;
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(heightDimensionX, groundLevel);
    ctx.lineTo(heightDimensionX, groundLevel - (panelHeight * scale));
    ctx.stroke();

    // Arrows for height dimension
    const arrowSize = 5;
    ctx.fillStyle = "#666";
    ctx.beginPath();
    ctx.moveTo(heightDimensionX, groundLevel);
    ctx.lineTo(heightDimensionX - arrowSize, groundLevel - arrowSize);
    ctx.lineTo(heightDimensionX + arrowSize, groundLevel - arrowSize);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(heightDimensionX, groundLevel - (panelHeight * scale));
    ctx.lineTo(heightDimensionX - arrowSize, groundLevel - (panelHeight * scale) + arrowSize);
    ctx.lineTo(heightDimensionX + arrowSize, groundLevel - (panelHeight * scale) + arrowSize);
    ctx.fill();

    // Height label
    ctx.fillStyle = "#666";
    ctx.font = "11px JetBrains Mono";
    ctx.textAlign = "center";
    ctx.save();
    ctx.translate(heightDimensionX + 20, groundLevel - (panelHeight * scale) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("1200mm", 0, 0);
    ctx.restore();
  });
}

function render2DView(canvas: HTMLCanvasElement, design: FenceDesign, activeSpanId?: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Set canvas size to match container
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  // Clear canvas
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
  ctx.fillRect(0, 0, rect.width, rect.height);

  // Calculate scale to fit design
  const maxDimension = calculateMaxDimension(design);
  const scale = Math.min((rect.width - 100) / maxDimension, (rect.height - 100) / maxDimension);
  
  // Center the drawing
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  ctx.save();
  ctx.translate(centerX, centerY);

  // Draw grid
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 0.5;
  const gridSize = 1000 * scale;
  for (let i = -5; i <= 5; i++) {
    ctx.beginPath();
    ctx.moveTo(i * gridSize, -5 * gridSize);
    ctx.lineTo(i * gridSize, 5 * gridSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5 * gridSize, i * gridSize);
    ctx.lineTo(5 * gridSize, i * gridSize);
    ctx.stroke();
  }

  // Draw fence
  let currentX = 0;
  let currentY = 0;
  let currentAngle = 0;

  design.spans.forEach((span) => {
    const isActive = span.spanId === activeSpanId;
    const effectiveLength = span.length;
    const panelWidth = span.maxPanelWidth;
    const gapSize = span.maxGap;
    const numPanels = Math.floor(effectiveLength / (panelWidth + gapSize));

    // Draw panels
    for (let i = 0; i < numPanels; i++) {
      const isGate = span.gateConfig?.required && i === 0;
      
      const offsetX = Math.cos(currentAngle) * (i * (panelWidth + gapSize) + panelWidth / 2) * scale;
      const offsetY = Math.sin(currentAngle) * (i * (panelWidth + gapSize) + panelWidth / 2) * scale;

      ctx.save();
      ctx.translate(currentX + offsetX, currentY + offsetY);
      ctx.rotate(currentAngle);

      // Panel
      ctx.fillStyle = isGate ? "#aa66ff" : isActive ? "#4488ff" : "#88ccff";
      ctx.globalAlpha = isGate ? 0.6 : isActive ? 0.8 : 0.5;
      ctx.fillRect(-panelWidth * scale / 2, -6, panelWidth * scale, 12);
      
      ctx.strokeStyle = isGate ? "#8844cc" : isActive ? "#2266dd" : "#6699cc";
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.strokeRect(-panelWidth * scale / 2, -6, panelWidth * scale, 12);

      // Panel width dimension (rotated with panel)
      ctx.fillStyle = "#444";
      ctx.font = "bold 10px JetBrains Mono";
      ctx.textAlign = "center";
      ctx.fillText(
        `${panelWidth}mm`,
        0,
        -15
      );

      ctx.restore();

      // Draw post and gap
      if (i < numPanels - 1) {
        const postOffsetX = Math.cos(currentAngle) * ((i + 1) * (panelWidth + gapSize)) * scale;
        const postOffsetY = Math.sin(currentAngle) * ((i + 1) * (panelWidth + gapSize)) * scale;

        ctx.fillStyle = "#666";
        ctx.beginPath();
        ctx.arc(currentX + postOffsetX, currentY + postOffsetY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Gap dimension (between this panel and next)
        const gapMidX = Math.cos(currentAngle) * (i * (panelWidth + gapSize) + panelWidth + gapSize / 2) * scale;
        const gapMidY = Math.sin(currentAngle) * (i * (panelWidth + gapSize) + panelWidth + gapSize / 2) * scale;

        ctx.save();
        ctx.translate(currentX + gapMidX, currentY + gapMidY);
        ctx.rotate(currentAngle);
        
        ctx.fillStyle = "#666";
        ctx.font = "9px JetBrains Mono";
        ctx.textAlign = "center";
        ctx.fillText(
          `${gapSize}mm`,
          0,
          20
        );
        
        ctx.restore();
      }
    }

    // Update position for next span
    const spanEndX = Math.cos(currentAngle) * effectiveLength * scale;
    const spanEndY = Math.sin(currentAngle) * effectiveLength * scale;
    currentX += spanEndX;
    currentY += spanEndY;

    // Update angle based on shape
    if (design.shape === "l-shape") {
      currentAngle += Math.PI / 2;
    } else if (design.shape === "u-shape") {
      if (design.spans.indexOf(span) === 0) {
        currentAngle += Math.PI / 2;
      } else if (design.spans.indexOf(span) === 1) {
        currentAngle += Math.PI / 2;
      }
    } else if (design.shape === "enclosed") {
      currentAngle += Math.PI / 2;
    } else if (design.shape === "custom" && design.customSides) {
      currentAngle += (2 * Math.PI) / design.customSides;
    }

    // Draw span label
    ctx.fillStyle = isActive ? "#4488ff" : "#888";
    ctx.font = "bold 14px Inter";
    ctx.textAlign = "center";
    ctx.fillText(
      `Span ${span.spanId}`,
      currentX - spanEndX / 2,
      currentY - spanEndY / 2 - 20
    );
  });

  ctx.restore();
}

function calculateMaxDimension(design: FenceDesign): number {
  let maxX = 0;
  let maxY = 0;
  let currentX = 0;
  let currentY = 0;
  let currentAngle = 0;

  design.spans.forEach((span) => {
    const effectiveLength = span.length;
    const spanEndX = Math.cos(currentAngle) * effectiveLength;
    const spanEndY = Math.sin(currentAngle) * effectiveLength;
    currentX += spanEndX;
    currentY += spanEndY;

    maxX = Math.max(maxX, Math.abs(currentX));
    maxY = Math.max(maxY, Math.abs(currentY));

    if (design.shape === "l-shape") {
      currentAngle += Math.PI / 2;
    } else if (design.shape === "u-shape") {
      if (design.spans.indexOf(span) === 0 || design.spans.indexOf(span) === 1) {
        currentAngle += Math.PI / 2;
      }
    } else if (design.shape === "enclosed") {
      currentAngle += Math.PI / 2;
    } else if (design.shape === "custom" && design.customSides) {
      currentAngle += (2 * Math.PI) / design.customSides;
    }
  });

  return Math.max(maxX, maxY) * 2;
}

function renderFence(scene: THREE.Scene, design: FenceDesign, activeSpanId?: string) {
  const panelHeight = 1.2;
  const panelThickness = 0.012;
  const postRadius = 0.05;

  // Glass material
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x88ccff,
    transparent: true,
    opacity: 0.3,
    roughness: 0.1,
    metalness: 0.1,
    transmission: 0.9,
    thickness: 0.5,
  });

  const activeGlassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x4488ff,
    transparent: true,
    opacity: 0.5,
    roughness: 0.1,
    metalness: 0.1,
    transmission: 0.9,
    thickness: 0.5,
    emissive: 0x4488ff,
    emissiveIntensity: 0.2,
  });

  const gateMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xaa66ff,
    transparent: true,
    opacity: 0.4,
    roughness: 0.1,
    metalness: 0.1,
    transmission: 0.9,
    thickness: 0.5,
    emissive: 0xaa66ff,
    emissiveIntensity: 0.3,
  });

  const postMaterial = new THREE.MeshStandardMaterial({
    color: 0x666666,
    metalness: 0.8,
    roughness: 0.2,
  });

  let currentX = 0;
  let currentZ = 0;
  let currentAngle = 0;

  design.spans.forEach((span) => {
    const isActive = span.spanId === activeSpanId;
    const material = isActive ? activeGlassMaterial : glassMaterial;

    // Calculate number of panels
    const effectiveLength = span.length / 1000; // Convert to meters
    const panelWidth = span.maxPanelWidth / 1000;
    const gapSize = span.maxGap / 1000;
    const numPanels = Math.floor(effectiveLength / (panelWidth + gapSize));

    // Render panels
    for (let i = 0; i < numPanels; i++) {
      const panelGeometry = new THREE.BoxGeometry(panelWidth, panelHeight, panelThickness);
      const isGate = span.gateConfig?.required && i === 0;
      const panel = new THREE.Mesh(panelGeometry, isGate ? gateMaterial : material);

      const offsetX = Math.cos(currentAngle) * (i * (panelWidth + gapSize) + panelWidth / 2);
      const offsetZ = Math.sin(currentAngle) * (i * (panelWidth + gapSize) + panelWidth / 2);

      panel.position.set(currentX + offsetX, panelHeight / 2, currentZ + offsetZ);
      panel.rotation.y = currentAngle;
      panel.userData.isFence = true;

      scene.add(panel);

      // Add post
      if (i < numPanels - 1) {
        const postGeometry = new THREE.CylinderGeometry(postRadius, postRadius, panelHeight);
        const post = new THREE.Mesh(postGeometry, postMaterial);

        const postOffsetX = Math.cos(currentAngle) * ((i + 1) * (panelWidth + gapSize));
        const postOffsetZ = Math.sin(currentAngle) * ((i + 1) * (panelWidth + gapSize));

        post.position.set(currentX + postOffsetX, panelHeight / 2, currentZ + postOffsetZ);
        post.userData.isFence = true;

        scene.add(post);
      }
    }

    // Update position for next span
    const spanEndX = Math.cos(currentAngle) * effectiveLength;
    const spanEndZ = Math.sin(currentAngle) * effectiveLength;
    currentX += spanEndX;
    currentZ += spanEndZ;

    // Update angle based on shape
    if (design.shape === "l-shape") {
      currentAngle += Math.PI / 2;
    } else if (design.shape === "u-shape") {
      if (design.spans.indexOf(span) === 0) {
        currentAngle += Math.PI / 2;
      } else if (design.spans.indexOf(span) === 1) {
        currentAngle += Math.PI / 2;
      }
    } else if (design.shape === "enclosed") {
      currentAngle += Math.PI / 2;
    } else if (design.shape === "custom" && design.customSides) {
      currentAngle += (2 * Math.PI) / design.customSides;
    }
  });
}
