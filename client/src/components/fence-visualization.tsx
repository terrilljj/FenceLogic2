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

  // Clear canvas with clean light background
  ctx.fillStyle = "#f8f9fa";
  ctx.fillRect(0, 0, rect.width, rect.height);

  // Calculate scaling - each span gets its own horizontal section
  const longestSpan = Math.max(...design.spans.map(span => span.length));
  const scale = Math.min((rect.width - 150) / longestSpan, 0.15);
  
  // Drawing constants
  const panelHeight = 1200; // 1200mm standard height
  const spanVerticalSpacing = 250; // Space between each span section
  const startX = 100;
  
  // Find max panel height including raked panels (which can be up to 1800mm)
  let maxPanelHeight = panelHeight;
  design.spans.forEach(span => {
    if (span.leftRakedPanel?.enabled && span.leftRakedPanel.height > maxPanelHeight) {
      maxPanelHeight = span.leftRakedPanel.height;
    }
    if (span.rightRakedPanel?.enabled && span.rightRakedPanel.height > maxPanelHeight) {
      maxPanelHeight = span.rightRakedPanel.height;
    }
  });
  
  // Need enough margin for: max panel height (scaled) + label + buffer
  const startY = (maxPanelHeight * scale) + 40; // Dynamic top margin based on tallest panel

  design.spans.forEach((span, spanIndex) => {
    const isActive = span.spanId === activeSpanId;
    const effectiveLength = span.length;
    // Use calculated panel layout with fallback
    let numPanels: number;
    let panelWidth: number;
    let gapSize: number;
    
    if (span.panelLayout && span.panelLayout.panels.length > 0) {
      numPanels = span.panelLayout.panels.length;
      panelWidth = span.panelLayout.panels[0];
      gapSize = span.panelLayout.averageGap;
    } else {
      // Fallback calculation when panelLayout not yet calculated
      const fallbackPanelWidth = span.maxPanelWidth;
      const fallbackGapSize = span.desiredGap;
      numPanels = Math.floor((effectiveLength + fallbackGapSize) / (fallbackPanelWidth + fallbackGapSize));
      panelWidth = fallbackPanelWidth;
      gapSize = fallbackGapSize;
    }
    
    const leftRaked = span.leftRakedPanel?.enabled ? span.leftRakedPanel.height : null;
    const rightRaked = span.rightRakedPanel?.enabled ? span.rightRakedPanel.height : null;

    // Calculate Y position for this span (stacked vertically)
    const groundLevel = startY + (spanIndex * spanVerticalSpacing);
    let currentX = startX;

    // Draw span label - cleaner typography
    ctx.fillStyle = isActive ? "#3b82f6" : "#374151";
    ctx.font = "600 15px Inter";
    ctx.textAlign = "left";
    ctx.fillText(`Span ${span.spanId}`, 10, groundLevel - 100);
    
    // Total span length (under the span label) - cleaner
    ctx.fillStyle = "#6b7280";
    ctx.font = "500 12px Inter";
    ctx.textAlign = "left";
    ctx.fillText(
      `Total: ${effectiveLength}mm`,
      10,
      groundLevel - 80
    );

    // Calculate left and right gaps
    const leftGapSize = span.leftGap?.enabled ? span.leftGap.size : 0;
    const rightGapSize = span.rightGap?.enabled ? span.rightGap.size : 0;
    const scaledLeftGap = leftGapSize * scale;
    const scaledRightGap = rightGapSize * scale;

    // Draw ground line for this span - cleaner
    ctx.strokeStyle = "#c0c0c0";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(startX - 20, groundLevel);
    ctx.lineTo(startX + (span.length * scale) + 20, groundLevel);
    ctx.stroke();

    // Draw left gap if present
    if (leftGapSize > 0) {
      const gapDimLineY = groundLevel + 35;
      ctx.strokeStyle = "#888";
      ctx.lineWidth = 1;
      
      // Horizontal dimension line for left gap
      ctx.beginPath();
      ctx.moveTo(currentX, gapDimLineY);
      ctx.lineTo(currentX + scaledLeftGap, gapDimLineY);
      ctx.stroke();
      
      // Left arrow
      ctx.beginPath();
      ctx.moveTo(currentX, gapDimLineY);
      ctx.lineTo(currentX + 4, gapDimLineY - 2);
      ctx.lineTo(currentX + 4, gapDimLineY + 2);
      ctx.closePath();
      ctx.fillStyle = "#888";
      ctx.fill();
      
      // Right arrow
      ctx.beginPath();
      ctx.moveTo(currentX + scaledLeftGap, gapDimLineY);
      ctx.lineTo(currentX + scaledLeftGap - 4, gapDimLineY - 2);
      ctx.lineTo(currentX + scaledLeftGap - 4, gapDimLineY + 2);
      ctx.closePath();
      ctx.fill();

      // Left gap label - cleaner
      ctx.fillStyle = "#6b7280";
      ctx.font = "11px Inter";
      ctx.textAlign = "center";
      ctx.fillText(
        `${leftGapSize.toFixed(1)}`,
        currentX + scaledLeftGap / 2,
        gapDimLineY + 14
      );

      currentX += scaledLeftGap;
    }

    // Draw each panel in this span
    for (let i = 0; i < numPanels; i++) {
      const panelType = span.panelLayout?.panelTypes?.[i] || "standard";
      const isGate = panelType === "gate";
      const isHinge = panelType === "hinge";
      const isGateOrHinge = isGate || isHinge;
      
      // Get individual panel width (may vary for mixed panels)
      const currentPanelWidth = span.panelLayout?.panels[i] || panelWidth;
      const scaledPanelWidth = currentPanelWidth * scale;
      let scaledPanelHeight = panelHeight * scale;
      
      // Check if this is a raked panel
      const isRaked = panelType === "raked";
      const isLeftRaked = i === 0 && leftRaked !== null;
      const isRightRaked = i === numPanels - 1 && rightRaked !== null;
      
      // Draw panel (raked or standard) - cleaner colors
      ctx.fillStyle = isGateOrHinge ? "#d4c5f9" : isActive ? "#bdd7ee" : "#d9e8f5";
      ctx.globalAlpha = 1;
      
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
        
        ctx.strokeStyle = isGateOrHinge ? "#b8a4e8" : isActive ? "#90c3e0" : "#b8d4e8";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        // Standard rectangular panel
        ctx.fillRect(currentX, groundLevel - scaledPanelHeight, scaledPanelWidth, scaledPanelHeight);

        // Panel border - cleaner, more subtle
        ctx.strokeStyle = isGateOrHinge ? "#b8a4e8" : isActive ? "#90c3e0" : "#b8d4e8";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(currentX, groundLevel - scaledPanelHeight, scaledPanelWidth, scaledPanelHeight);
      }

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

      // Panel width dimension label - cleaner
      ctx.fillStyle = "#374151";
      ctx.font = "500 11px Inter";
      ctx.textAlign = "center";
      ctx.fillText(
        `${currentPanelWidth}`,
        currentX + scaledPanelWidth / 2,
        dimLineY + 16
      );

      // Panel width label on the panel itself - number and type
      ctx.fillStyle = "#000000";
      ctx.font = "600 13px Inter";
      ctx.textAlign = "center";
      
      // Draw the width number
      ctx.fillText(
        `${currentPanelWidth}${isRaked ? 'H' : ''}`,
        currentX + scaledPanelWidth / 2,
        groundLevel - scaledPanelHeight / 2 - 4
      );
      
      // Draw the panel type below
      let panelTypeLabel = "Panel";
      if (isGate) panelTypeLabel = "Gate";
      else if (isHinge) panelTypeLabel = "Hinge";
      else if (isRaked) panelTypeLabel = "Rake";
      
      ctx.font = "500 11px Inter";
      ctx.fillText(
        panelTypeLabel,
        currentX + scaledPanelWidth / 2,
        groundLevel - scaledPanelHeight / 2 + 10
      );

      // Draw spigots at base of panel (left and right) - gates do not have spigots
      if (!isGate) {
        const spigotWidth = 50 * scale;  // 50mm wide
        const spigotHeight = 100 * scale; // 100mm height
        const spigotGap = 50 * scale;     // 50mm gap below glass
        const spigotOffset = 15;
        
        // Left spigot
        ctx.fillStyle = "#9ca3af";
        ctx.fillRect(
          currentX + spigotOffset - spigotWidth / 2,
          groundLevel + spigotGap - spigotHeight,
          spigotWidth,
          spigotHeight
        );
        ctx.strokeStyle = "#6b7280";
        ctx.lineWidth = 1;
        ctx.strokeRect(
          currentX + spigotOffset - spigotWidth / 2,
          groundLevel + spigotGap - spigotHeight,
          spigotWidth,
          spigotHeight
        );
        
        // Right spigot
        ctx.fillStyle = "#9ca3af";
        ctx.fillRect(
          currentX + scaledPanelWidth - spigotOffset - spigotWidth / 2,
          groundLevel + spigotGap - spigotHeight,
          spigotWidth,
          spigotHeight
        );
        ctx.strokeStyle = "#6b7280";
        ctx.lineWidth = 1;
        ctx.strokeRect(
          currentX + scaledPanelWidth - spigotOffset - spigotWidth / 2,
          groundLevel + spigotGap - spigotHeight,
          spigotWidth,
          spigotHeight
        );
      }

      // Draw hinges and latch for gate - cleaner styling
      if (isGate) {
        const gateConfig = span.gateConfig;
        const hingeWidth = 14;
        const hingeHeight = 14;
        const latchWidth = 10;
        const latchHeight = 24;
        
        // Determine hinge side based on flipped config
        const hingeOffset = gateConfig?.flipped ? scaledPanelWidth - 20 : 20;
        
        // Top hinge
        ctx.fillStyle = "#4b5563";
        ctx.fillRect(
          currentX + hingeOffset - hingeWidth / 2,
          groundLevel - scaledPanelHeight * 0.8 - hingeHeight / 2,
          hingeWidth,
          hingeHeight
        );
        ctx.strokeStyle = "#374151";
        ctx.lineWidth = 1;
        ctx.strokeRect(
          currentX + hingeOffset - hingeWidth / 2,
          groundLevel - scaledPanelHeight * 0.8 - hingeHeight / 2,
          hingeWidth,
          hingeHeight
        );
        
        // Bottom hinge
        ctx.fillStyle = "#4b5563";
        ctx.fillRect(
          currentX + hingeOffset - hingeWidth / 2,
          groundLevel - scaledPanelHeight * 0.2 - hingeHeight / 2,
          hingeWidth,
          hingeHeight
        );
        ctx.strokeStyle = "#374151";
        ctx.lineWidth = 1;
        ctx.strokeRect(
          currentX + hingeOffset - hingeWidth / 2,
          groundLevel - scaledPanelHeight * 0.2 - hingeHeight / 2,
          hingeWidth,
          hingeHeight
        );
        
        // Latch on opposite side
        const latchOffset = gateConfig?.flipped ? 20 : scaledPanelWidth - 20;
        ctx.fillStyle = "#4b5563";
        ctx.fillRect(
          currentX + latchOffset - latchWidth / 2,
          groundLevel - scaledPanelHeight * 0.5 - latchHeight / 2,
          latchWidth,
          latchHeight
        );
        ctx.strokeStyle = "#374151";
        ctx.lineWidth = 1;
        ctx.strokeRect(
          currentX + latchOffset - latchWidth / 2,
          groundLevel - scaledPanelHeight * 0.5 - latchHeight / 2,
          latchWidth,
          latchHeight
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

        // Gap label - cleaner typography
        ctx.fillStyle = "#6b7280";
        ctx.font = "11px Inter";
        ctx.textAlign = "center";
        ctx.fillText(
          `${gapSize.toFixed(1)}`,
          gapStart + scaledGapSize / 2,
          gapDimLineY + 14
        );

        currentX += scaledGapSize;
      }
    }

    // Draw right gap if present
    if (rightGapSize > 0) {
      const gapStart = currentX;
      const gapDimLineY = groundLevel + 35;
      ctx.strokeStyle = "#888";
      ctx.lineWidth = 1;
      
      // Horizontal dimension line for right gap
      ctx.beginPath();
      ctx.moveTo(gapStart, gapDimLineY);
      ctx.lineTo(currentX + scaledRightGap, gapDimLineY);
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
      ctx.moveTo(currentX + scaledRightGap, gapDimLineY);
      ctx.lineTo(currentX + scaledRightGap - 4, gapDimLineY - 2);
      ctx.lineTo(currentX + scaledRightGap - 4, gapDimLineY + 2);
      ctx.closePath();
      ctx.fill();

      // Right gap label - cleaner
      ctx.fillStyle = "#6b7280";
      ctx.font = "11px Inter";
      ctx.textAlign = "center";
      ctx.fillText(
        `${rightGapSize.toFixed(1)}`,
        gapStart + scaledRightGap / 2,
        gapDimLineY + 14
      );
    }

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

    // Height label - cleaner
    ctx.fillStyle = "#374151";
    ctx.font = "500 11px Inter";
    ctx.textAlign = "center";
    ctx.save();
    ctx.translate(heightDimensionX + 20, groundLevel - (panelHeight * scale) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${panelHeight}`, 0, 0);
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
    // Use calculated panel layout with fallback
    let numPanels: number;
    let panelWidth: number;
    let gapSize: number;
    
    if (span.panelLayout && span.panelLayout.panels.length > 0) {
      numPanels = span.panelLayout.panels.length;
      panelWidth = span.panelLayout.panels[0];
      gapSize = span.panelLayout.averageGap;
    } else {
      // Fallback calculation when panelLayout not yet calculated
      const fallbackPanelWidth = span.maxPanelWidth;
      const fallbackGapSize = span.desiredGap;
      numPanels = Math.floor((effectiveLength + fallbackGapSize) / (fallbackPanelWidth + fallbackGapSize));
      panelWidth = fallbackPanelWidth;
      gapSize = fallbackGapSize;
    }

    // Draw panels (track cumulative position for mixed widths)
    let cumulativePos = 0;
    for (let i = 0; i < numPanels; i++) {
      const panelType = span.panelLayout?.panelTypes?.[i] || "standard";
      const isGate = panelType === "gate";
      const isHinge = panelType === "hinge";
      const isGateOrHinge = isGate || isHinge;
      
      const currentPanelWidth = span.panelLayout?.panels[i] || panelWidth;
      
      const panelCenterOffset = cumulativePos + currentPanelWidth / 2;
      const offsetX = Math.cos(currentAngle) * panelCenterOffset * scale;
      const offsetY = Math.sin(currentAngle) * panelCenterOffset * scale;

      ctx.save();
      ctx.translate(currentX + offsetX, currentY + offsetY);
      ctx.rotate(currentAngle);

      // Panel
      ctx.fillStyle = isGateOrHinge ? "#aa66ff" : isActive ? "#4488ff" : "#88ccff";
      ctx.globalAlpha = isGateOrHinge ? 0.6 : isActive ? 0.8 : 0.5;
      ctx.fillRect(-currentPanelWidth * scale / 2, -6, currentPanelWidth * scale, 12);
      
      ctx.strokeStyle = isGateOrHinge ? "#8844cc" : isActive ? "#2266dd" : "#6699cc";
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.strokeRect(-currentPanelWidth * scale / 2, -6, currentPanelWidth * scale, 12);

      // Panel width dimension (rotated with panel)
      ctx.fillStyle = "#444";
      ctx.font = "bold 10px JetBrains Mono";
      ctx.textAlign = "center";
      ctx.fillText(
        `${currentPanelWidth}mm`,
        0,
        -15
      );

      ctx.restore();

      cumulativePos += currentPanelWidth;

      // Draw post and gap
      if (i < numPanels - 1) {
        const postOffsetX = Math.cos(currentAngle) * cumulativePos * scale;
        const postOffsetY = Math.sin(currentAngle) * cumulativePos * scale;

        ctx.fillStyle = "#666";
        ctx.beginPath();
        ctx.arc(currentX + postOffsetX, currentY + postOffsetY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Gap dimension (between this panel and next)
        const gapMidX = Math.cos(currentAngle) * (cumulativePos + gapSize / 2) * scale;
        const gapMidY = Math.sin(currentAngle) * (cumulativePos + gapSize / 2) * scale;
        
        cumulativePos += gapSize;

        ctx.save();
        ctx.translate(currentX + gapMidX, currentY + gapMidY);
        ctx.rotate(currentAngle);
        
        ctx.fillStyle = "#666";
        ctx.font = "9px JetBrains Mono";
        ctx.textAlign = "center";
        ctx.fillText(
          `${gapSize.toFixed(1)}mm`,
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

// Helper function to create text sprite for panel labels
function createTextSprite(text: string, textColor = "#ffffff", bgColor = "rgba(0, 0, 0, 0.6)") {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  
  canvas.width = 512;
  canvas.height = 128;
  
  context.fillStyle = bgColor;
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  context.font = 'Bold 48px Inter, sans-serif';
  context.fillStyle = textColor;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(0.5, 0.125, 1);
  
  return sprite;
}

function renderFence(scene: THREE.Scene, design: FenceDesign, activeSpanId?: string) {
  const panelHeight = 1.2;
  const panelThickness = 0.012;
  const postRadius = 0.05;

  // Glass material (no edges/wireframe)
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

  const hingeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xdd88ff,
    transparent: true,
    opacity: 0.4,
    roughness: 0.1,
    metalness: 0.1,
    transmission: 0.9,
    thickness: 0.5,
    emissive: 0xdd88ff,
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

    // Use calculated panel layout with fallback
    const effectiveLength = span.length / 1000; // Convert to meters
    let numPanels: number;
    let panelWidth: number;
    let gapSize: number;
    
    if (span.panelLayout && span.panelLayout.panels.length > 0) {
      numPanels = span.panelLayout.panels.length;
      panelWidth = span.panelLayout.panels[0] / 1000;
      gapSize = span.panelLayout.averageGap / 1000;
    } else {
      // Fallback calculation when panelLayout not yet calculated
      const fallbackPanelWidth = span.maxPanelWidth / 1000;
      const fallbackGapSize = span.desiredGap / 1000;
      numPanels = Math.floor((effectiveLength + fallbackGapSize) / (fallbackPanelWidth + fallbackGapSize));
      panelWidth = fallbackPanelWidth;
      gapSize = fallbackGapSize;
    }

    // Render panels (track cumulative position for mixed widths)
    let cumulativePos = 0;
    for (let i = 0; i < numPanels; i++) {
      const currentPanelWidth = (span.panelLayout?.panels[i] || panelWidth * 1000) / 1000;
      const panelGeometry = new THREE.BoxGeometry(currentPanelWidth, panelHeight, panelThickness);
      
      // Determine panel material and type
      const panelType = span.panelLayout?.panelTypes?.[i] || "standard";
      let panelMaterial = material;
      if (panelType === "gate") {
        panelMaterial = gateMaterial;
      } else if (panelType === "hinge") {
        panelMaterial = hingeMaterial;
      }
      
      const panel = new THREE.Mesh(panelGeometry, panelMaterial);

      const panelCenterOffset = cumulativePos + currentPanelWidth / 2;
      const offsetX = Math.cos(currentAngle) * panelCenterOffset;
      const offsetZ = Math.sin(currentAngle) * panelCenterOffset;

      panel.position.set(currentX + offsetX, panelHeight / 2, currentZ + offsetZ);
      panel.rotation.y = currentAngle;
      panel.userData.isFence = true;

      scene.add(panel);

      // Add text label to panel
      const panelWidthMm = Math.round((span.panelLayout?.panels[i] || panelWidth * 1000));
      let labelText = `${panelWidthMm}mm`;
      if (panelType === "gate") {
        labelText = `${panelWidthMm}mm Gate`;
      } else if (panelType === "hinge") {
        labelText = `${panelWidthMm}mm Hinge`;
      } else if (panelType === "raked") {
        labelText = `${panelWidthMm}mm Raked`;
      } else {
        labelText = `${panelWidthMm}mm Panel`;
      }
      
      const label = createTextSprite(labelText);
      label.position.set(currentX + offsetX, panelHeight * 0.6, currentZ + offsetZ);
      scene.add(label);

      // Add spigots (at base of panel, left and right)
      const spigotMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.3 });
      const spigotRadius = 0.02;
      const spigotHeight = 0.06;
      
      // Left spigot
      const leftSpigot = new THREE.Mesh(
        new THREE.CylinderGeometry(spigotRadius, spigotRadius, spigotHeight),
        spigotMaterial
      );
      const leftSpigotOffsetX = Math.cos(currentAngle) * (cumulativePos + 0.05);
      const leftSpigotOffsetZ = Math.sin(currentAngle) * (cumulativePos + 0.05);
      leftSpigot.position.set(currentX + leftSpigotOffsetX, spigotHeight / 2, currentZ + leftSpigotOffsetZ);
      scene.add(leftSpigot);
      
      // Right spigot
      const rightSpigot = new THREE.Mesh(
        new THREE.CylinderGeometry(spigotRadius, spigotRadius, spigotHeight),
        spigotMaterial
      );
      const rightSpigotOffsetX = Math.cos(currentAngle) * (cumulativePos + currentPanelWidth - 0.05);
      const rightSpigotOffsetZ = Math.sin(currentAngle) * (cumulativePos + currentPanelWidth - 0.05);
      rightSpigot.position.set(currentX + rightSpigotOffsetX, spigotHeight / 2, currentZ + rightSpigotOffsetZ);
      scene.add(rightSpigot);

      // Add hinges and latch to gate
      if (panelType === "gate") {
        const hingeMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.2 });
        
        // Determine hinge side based on gate configuration
        const gateConfig = span.gateConfig;
        const hingeOffset = gateConfig?.flipped ? currentPanelWidth - 0.1 : 0.1;
        
        // Top hinge
        const topHinge = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.08, 0.04),
          hingeMaterial
        );
        const topHingeOffsetX = Math.cos(currentAngle) * (cumulativePos + hingeOffset);
        const topHingeOffsetZ = Math.sin(currentAngle) * (cumulativePos + hingeOffset);
        topHinge.position.set(currentX + topHingeOffsetX, panelHeight * 0.8, currentZ + topHingeOffsetZ);
        scene.add(topHinge);
        
        // Bottom hinge
        const bottomHinge = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.08, 0.04),
          hingeMaterial
        );
        bottomHinge.position.set(currentX + topHingeOffsetX, panelHeight * 0.2, currentZ + topHingeOffsetZ);
        scene.add(bottomHinge);
        
        // Latch (on opposite side from hinges)
        const latchOffset = gateConfig?.flipped ? 0.1 : currentPanelWidth - 0.1;
        const latch = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.15, 0.04),
          hingeMaterial
        );
        const latchOffsetX = Math.cos(currentAngle) * (cumulativePos + latchOffset);
        const latchOffsetZ = Math.sin(currentAngle) * (cumulativePos + latchOffset);
        latch.position.set(currentX + latchOffsetX, panelHeight * 0.5, currentZ + latchOffsetZ);
        scene.add(latch);
      }

      cumulativePos += currentPanelWidth;

      // Add post
      if (i < numPanels - 1) {
        const postGeometry = new THREE.CylinderGeometry(postRadius, postRadius, panelHeight);
        const post = new THREE.Mesh(postGeometry, postMaterial);

        const postOffsetX = Math.cos(currentAngle) * cumulativePos;
        const postOffsetZ = Math.sin(currentAngle) * cumulativePos;

        post.position.set(currentX + postOffsetX, panelHeight / 2, currentZ + postOffsetZ);
        post.userData.isFence = true;

        scene.add(post);
        
        cumulativePos += gapSize;
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
