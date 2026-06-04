import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { RotateCcw, Box, Layers, Download } from "lucide-react";
import { FenceDesign, spanVariant } from "@shared/schema";

interface FenceVisualizationProps {
  design: FenceDesign;
  activeSpanId?: string;
  /** When set, only these spans are DRAWN (PDF/export still use the full design). */
  visibleSpanIds?: string[];
  /** Caps the elevation draw scale — lower = smaller "mini" render. Default 0.15. */
  maxScale?: number;
  onDownloadPDFReady?: (handler: () => void) => void;
}

export function FenceVisualization({ design, activeSpanId, visibleSpanIds, maxScale = 0.15, onDownloadPDFReady }: FenceVisualizationProps) {
  // Render-only filter: draw a subset of sections (e.g. the active run on the
  // configure step) without changing the design used for PDF/export.
  // Memoized on visibleKey (stable string), NOT visibleSpanIds (a fresh array each
  // parent render) — otherwise renderDesign gets a new identity every render and the
  // canvas draw effect below re-runs (bitmap reset + full redraw) on every re-render.
  const visibleKey = visibleSpanIds?.join(",") ?? "";
  const renderDesign: FenceDesign = useMemo(() => {
    if (!visibleKey) return design;
    const ids = visibleKey.split(",");
    return { ...design, spans: design.spans.filter((s) => ids.includes(s.spanId)) };
  }, [design, visibleKey]);
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
      renderFence(sceneRef.current, renderDesign, activeSpanId);
    }
  }, [design, renderDesign, activeSpanId, webglError, viewMode, visibleKey]);

  useEffect(() => {
    if ((viewMode === "2d" || viewMode === "elevation") && canvasRef.current) {
      if (viewMode === "2d") {
        render2DView(canvasRef.current, renderDesign, activeSpanId);
      } else {
        renderElevationView(canvasRef.current, renderDesign, activeSpanId, maxScale);
      }
    }
  }, [design, renderDesign, activeSpanId, viewMode, visibleKey, maxScale]);

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

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch('/api/designs/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${design.name || 'fence-design'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  // Expose download handler to parent component.
  // Re-register when `design` changes so the handler PDFs the current design,
  // not the mount-time snapshot. The parent stores it (does not invoke it).
  useEffect(() => {
    if (onDownloadPDFReady) {
      onDownloadPDFReady(handleDownloadPDF);
    }
  }, [onDownloadPDFReady, design]);

  // Fallback: Browser-based PDF (old method)
  const handleDownloadPDFBrowser = () => {
    let imageDataUrl: string | null = null;

    // Capture canvas based on current view mode
    if (viewMode === "3d" && rendererRef.current) {
      // For 3D view, capture from WebGL renderer
      imageDataUrl = rendererRef.current.domElement.toDataURL('image/png');
    } else if (canvasRef.current) {
      // For 2D/elevation view, capture from canvas
      imageDataUrl = canvasRef.current.toDataURL('image/png');
    }

    if (!imageDataUrl) return;

    // Format current date
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Create a printable HTML page with the image
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${design.name} - FenceLogic</title>
          <style>
            @page {
              margin: 0.2in;
              size: landscape;
            }
            
            * {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              box-sizing: border-box;
            }
            
            html, body {
              height: 100vh;
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
            }
            
            body {
              display: flex;
              flex-direction: row;
              page-break-inside: avoid;
              padding: 0.06in 0.2in 0.2in 0.06in;
            }
            
            .main-content {
              flex: 1;
              display: flex;
              flex-direction: column;
              min-width: 0;
              padding-right: 0.1in;
            }
            
            .header-info {
              display: flex;
              gap: 8px;
              align-items: baseline;
              margin-bottom: 8px;
              flex-shrink: 0;
            }
            
            h1 {
              margin: 0;
              font-size: 14px;
              color: #000;
              font-weight: bold;
            }
            
            .date {
              color: #666;
              font-size: 9px;
            }
            
            .info {
              color: #666;
              font-size: 9px;
            }
            
            .visualization-container {
              flex: 1;
              min-height: 0;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            img {
              width: 100%;
              height: 100%;
              object-fit: contain;
              border: 1px solid #ddd;
            }
            
            .branding-sidebar {
              width: 0.25in;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }
            
            .vertical-text {
              writing-mode: vertical-rl;
              transform: rotate(180deg);
              font-weight: bold;
              font-size: 10px;
              color: #000;
              white-space: nowrap;
              text-align: center;
            }
            
            .no-print {
              display: none;
            }
            
            @media print {
              .no-print {
                display: none;
              }
            }
            
            @media screen {
              body {
                padding: 20px;
              }
              .no-print {
                display: block;
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
              }
              button {
                padding: 10px 20px;
                font-size: 16px;
                cursor: pointer;
                background: #000;
                color: white;
                border: none;
                border-radius: 4px;
                margin-left: 10px;
              }
              button:hover {
                background: #333;
              }
            }
          </style>
        </head>
        <body>
          <div class="main-content">
            <div class="header-info">
              <h1>${design.name}</h1>
              <span class="date">${currentDate}</span>
              <span class="info">•</span>
              <span class="info">${design.productVariant} • ${design.shape} • ${design.spans.length} section${design.spans.length > 1 ? 's' : ''}</span>
            </div>
            <div class="visualization-container">
              <img src="${imageDataUrl}" alt="Fence Design Visualization" />
            </div>
          </div>
          
          <div class="branding-sidebar">
            <div class="vertical-text">FenceLogic By Barrier Dynamics &copy; ${new Date().getFullYear()}</div>
          </div>
          
          <div class="no-print">
            <button onclick="window.print()">Print / Save as PDF</button>
            <button onclick="window.close()" style="background: #666;">Close</button>
          </div>
          <script>
            // Auto-trigger print dialog after a short delay
            setTimeout(() => {
              window.print();
            }, 500);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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


      {/* View cycling disabled - only elevation view for v1 */}
      {false && (
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
      )}

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

function renderElevationView(canvas: HTMLCanvasElement, design: FenceDesign, activeSpanId?: string, maxScale: number = 0.15) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Check product type
  // Channel systems: pool (12mm) + balustrade 15mm — same VersaTilt channel drawing.
  // The one elevation difference is friction-plate spacing (operator ruling 2026-06-03):
  // pool = 150mm end setback / 500mm max centres; bal = 25mm setback / 300mm centres.
  // Style is resolved PER SECTION inside the draw loop (multi-style designs: each section
  // can be its own style). A small helper computes the per-span style flags from the
  // section's resolved variant; the pre-loop height calc uses the same resolution.
  const styleFlags = (variant: string) => {
    const isBalChannel = variant === "glass-bal-channel" || variant === "glass-bal-channel-hd";
    return {
      isBalChannel,
      isChannelSystem: variant === "glass-pool-channel" || isBalChannel,
      isBladeFencing: variant === "alu-pool-blade",
      isBarrFencing: variant === "alu-pool-barr",
      isTubularFencing: variant === "alu-pool-tubular",
      isSemiFrameless: variant === "semi-frameless-1000" || variant === "semi-frameless-1800",
      isHamptonsPVC: variant.startsWith("pvc-hamptons-"),
      isBalBarr: variant === "alu-bal-barr",
      isBalBlade: variant === "alu-bal-blade",
      isStandoffSystem: variant === "glass-bal-standoffs",
    };
  };

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

  // Drawing constants
  const panelHeight = 1200; // 1200mm standard height (fallback)
  const startX = 100;

  // Find max panel height including raked panels, custom panels, and auto-calc config.
  // Computed BEFORE the scale so the scale can also be bounded by the box height.
  // Bal channel 15mm (operator ruling 2026-06-03): finished height = 35mm channel base
  // + 1000mm glass + 35mm top rail = 1070mm — used for scale/spacing so nothing clips.
  // Standoff bal 15mm (SF-16): 1280mm pre-drilled glass + 35mm top rail = 1315mm.
  let maxPanelHeight = panelHeight;
  design.spans.forEach(span => {
    // Per-section base height: channel bal = 1070, standoff bal = 1315, else 1200.
    const sf = styleFlags(spanVariant(design, span));
    const base = sf.isBalChannel ? 1070 : sf.isStandoffSystem ? 1315 : panelHeight;
    if (base > maxPanelHeight) maxPanelHeight = base;
    // Check auto-calc config panel height (for custom-frameless)
    if (span.autoCalcConfig?.panelHeight && span.autoCalcConfig.panelHeight > maxPanelHeight) {
      maxPanelHeight = span.autoCalcConfig.panelHeight;
    }
    if (span.leftRakedPanel?.enabled && span.leftRakedPanel.height > maxPanelHeight) {
      maxPanelHeight = span.leftRakedPanel.height;
    }
    if (span.rightRakedPanel?.enabled && span.rightRakedPanel.height > maxPanelHeight) {
      maxPanelHeight = span.rightRakedPanel.height;
    }
    if (span.customPanel?.enabled && span.customPanel.height > maxPanelHeight) {
      maxPanelHeight = span.customPanel.height;
    }
  });

  // Scale: bounded by width, the maxScale cap, AND the available HEIGHT so a tall
  // raked/custom section shrinks to fit instead of clipping the bottom gap labels.
  const numRenderSpans = Math.max(1, design.spans.length);
  const widthScale = (rect.width - 150) / longestSpan;
  const heightScale = Math.min(
    (rect.height - 103 - (numRenderSpans - 1) * 250) / maxPanelHeight,
    (rect.height - (numRenderSpans - 1) * 80 - 103) / (numRenderSpans * maxPanelHeight),
  );
  const scale = Math.max(0.02, Math.min(widthScale, maxScale, heightScale));
  
  // Dynamic vertical spacing based on tallest panel to ensure panels don't overlap
  const spanVerticalSpacing = Math.max(250, (maxPanelHeight * scale) + 80);
  
  // Need enough margin for: max panel height (scaled) + label + buffer
  const startY = (maxPanelHeight * scale) + 40; // Dynamic top margin based on tallest panel

  design.spans.forEach((span, spanIndex) => {
    // Per-section style — each section draws in its OWN style (multi-style designs).
    const spanVar = spanVariant(design, span);
    const {
      isBalChannel, isChannelSystem, isBladeFencing, isBarrFencing, isTubularFencing,
      isSemiFrameless, isHamptonsPVC, isBalBarr, isBalBlade, isStandoffSystem,
    } = styleFlags(spanVar);
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
    // Centre the fence horizontally in the canvas (fall back to left margin if it's
    // wider than the canvas). The section label stays pinned at the far left.
    const spanContentWidth = span.length * scale;
    const drawStartX = Math.max(startX, (rect.width - spanContentWidth) / 2);
    let currentX = drawStartX;

    // Draw section label - cleaner typography
    ctx.fillStyle = isActive ? "#3b82f6" : "#374151";
    ctx.font = "600 15px Inter";
    ctx.textAlign = "left";
    ctx.fillText(span.name?.trim() || `Section ${span.spanId}`, 10, groundLevel - 100);
    
    // Total section length (under the section label) - cleaner
    ctx.fillStyle = "#6b7280";
    ctx.font = "600 16px Inter";
    ctx.textAlign = "left";
    ctx.fillText(
      `${effectiveLength}mm`,
      10,
      groundLevel - 80
    );

    // Calculate left and right gaps
    let leftGapSize = span.leftGap?.enabled ? span.leftGap.size : 0;
    let rightGapSize = span.rightGap?.enabled ? span.rightGap.size : 0;
    
    // For Semi-Frameless with wall posts: NO gap at walls (wall post mounts directly to wall)
    // Left/right gaps would only apply if using core posts at boundaries
    if (isSemiFrameless) {
      // Wall posts mount directly to wall with no gap
      // Only show gaps if explicitly configured (for core post at boundary scenario)
      // Default behavior: wall posts at ends = no gaps
      if (!span.leftGap?.enabled) leftGapSize = 0;
      if (!span.rightGap?.enabled) rightGapSize = 0;
    }
    // For Blade, BARR, Tubular, Hamptons PVC (including Bal BARR / Bal Blade), use gaps from panelLayout array (N+1 gaps for N panels)
    else if ((isBladeFencing || isBarrFencing || isTubularFencing || isHamptonsPVC || isBalBarr || isBalBlade) && span.panelLayout?.gaps && span.panelLayout.gaps.length > 0) {
      const gaps = span.panelLayout.gaps;
      leftGapSize = gaps[0]; // First gap
      rightGapSize = gaps[gaps.length - 1]; // Last gap
    } else if (span.gateConfig?.required && span.gateConfig.centreFromLeft == null) {
      // Override end gaps based on gate configuration (glass fencing only).
      // Skipped when the gate is CENTRED (centreFromLeft set): the gate sits mid-run
      // regardless of its position index, so the real left/right end gaps apply.
      const latchGap = span.gateConfig.latchGap || 9;
      const hingeGap = span.gateConfig.hingeGap || 9;
      
      if (span.gateConfig.hingeFrom === "wall") {
        // Wall-mounted gate
        if (span.gateConfig.position === 0) {
          leftGapSize = 0; // Hinge at left wall (no gap)
          if (span.gateConfig.latchTo === "wall") {
            rightGapSize = latchGap; // Latch at right wall
          }
        } else if (span.gateConfig.position >= 1) {
          rightGapSize = 0; // Hinge at right wall (no gap)
          if (span.gateConfig.latchTo === "wall") {
            leftGapSize = latchGap; // Latch at left wall
          }
        }
      } else {
        // Glass-to-glass gate: check which end the latch/hinge is at based on position and flip
        const numPanels = span.panelLayout?.panels.length || 0;
        const isAtLeftEnd = span.gateConfig.position === 0;
        const isAtRightEnd = numPanels > 0 && span.gateConfig.position >= numPanels - 2;
        
        if (isAtLeftEnd && !span.gateConfig.flipped) {
          // Gate at left, latch on left side
          leftGapSize = latchGap;
        } else if (isAtLeftEnd && span.gateConfig.flipped) {
          // Hinge panel at left, hinge on left side
          leftGapSize = hingeGap;
        } else if (isAtRightEnd && !span.gateConfig.flipped) {
          // Gate at right, hinge on right side
          rightGapSize = hingeGap;
        } else if (isAtRightEnd && span.gateConfig.flipped) {
          // Gate at right, latch on right side
          rightGapSize = latchGap;
        }
      }
    }
    
    const scaledLeftGap = leftGapSize * scale;
    const scaledRightGap = rightGapSize * scale;

    // Draw ground line at bottom of spigots - cleaner
    const spigotGap = 50 * scale; // 50mm gap below glass
    ctx.strokeStyle = "#c0c0c0";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(drawStartX - 20, groundLevel + spigotGap);
    ctx.lineTo(drawStartX + (span.length * scale) + 20, groundLevel + spigotGap);
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
      ctx.font = "600 13px Inter";
      ctx.textAlign = "center";
      ctx.fillText(
        `${leftGapSize.toFixed(1)}`,
        currentX + scaledLeftGap / 2,
        gapDimLineY + 18
      );

      currentX += scaledLeftGap;
    }

    // STANDOFF FASCIA — drawn BEFORE the glass so the substrate sits BEHIND the
    // panels (operator correction 2026-06-03: "the substrate is in front of the
    // glass — wrong"). The standoff discs draw AFTER the glass (they grip through
    // it) — see the isStandoffSystem block below the panel loop.
    if (isStandoffSystem) {
      const FASCIA_H_MM = 280;
      const fasciaH = FASCIA_H_MM * scale;
      const fasciaStartX = currentX;
      const fasciaW = span.length * scale - scaledLeftGap - rightGapSize * scale;
      ctx.fillStyle = "#cfd8de";
      ctx.fillRect(fasciaStartX, groundLevel - fasciaH, fasciaW, fasciaH);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(fasciaStartX, groundLevel - fasciaH, fasciaW, fasciaH);
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
      
      // Determine actual panel height for this span.
      // Bal channel 15mm: glass is 1000mm high (operator ruling 2026-06-03 — finished
      // glass height in channel = 1035mm: 1000mm glass + 35mm channel base).
      // Standoff bal 15mm: 1280mm pre-drilled glass (SF-16 / 1280S- SKU family).
      const actualPanelHeight =
        span.autoCalcConfig?.panelHeight || (isBalChannel ? 1000 : isStandoffSystem ? 1280 : panelHeight);
      let scaledPanelHeight = actualPanelHeight * scale;
      
      // Check if this is a raked panel
      const isRaked = panelType === "raked";
      const isCustom = panelType === "custom";
      const isLeftRaked = i === 0 && leftRaked !== null;
      const isRightRaked = i === numPanels - 1 && rightRaked !== null;
      
      // Get custom panel height if this is a custom panel
      if (isCustom && span.customPanel?.enabled) {
        scaledPanelHeight = span.customPanel.height * scale;
      }
      
      // Blade panels have different rendering — Bal Blade reuses the same visual.
      if (isBladeFencing || isBalBlade) {
        // Blade panel configuration
        const railSize = 40 * scale; // 40x40mm horizontal rail
        const bladeWidth = 16 * scale; // 50x16mm blades (16mm width for vertical blades)
        const bladeSpacing = 80 * scale; // Space between vertical blades
        const postWidth = 50 * scale; // 50x50mm posts
        const bladeGap = 15 * scale; // Gap between blades and posts
        
        // Draw Blade panel with vertical blades - sits on ground
        const panelBottom = groundLevel;
        const panelTop = panelBottom - scaledPanelHeight;
        
        // Draw vertical blades (slats) - FULL HEIGHT with gaps at posts
        ctx.fillStyle = isGate ? "#b0b0b0" : "#9a9a9a";
        const bladeStart = currentX + postWidth / 2 + bladeGap;
        const bladeEnd = currentX + scaledPanelWidth - postWidth / 2 - bladeGap;
        
        let bladeX = bladeStart + (bladeSpacing / 2);
        while (bladeX < bladeEnd - bladeWidth) {
          ctx.fillRect(
            bladeX - bladeWidth / 2,
            panelTop,
            bladeWidth,
            scaledPanelHeight
          );
          bladeX += bladeSpacing;
        }
        
        // Draw horizontal rails (40x40mm) - inset from top and bottom
        ctx.fillStyle = isGate ? "#a0a0a0" : "#888888";
        const railInset = 80 * scale; // Rails inset from panel edges
        // Top rail (inset from top edge)
        ctx.fillRect(currentX, panelTop + railInset, scaledPanelWidth, railSize);
        // Bottom rail (inset from bottom edge)
        ctx.fillRect(currentX, panelBottom - railInset - railSize, scaledPanelWidth, railSize);
        
        // Draw posts at panel edges (posts extend to ground)
        // For Blade: N panels need N+1 posts (one before first panel, one after each panel)
        ctx.fillStyle = "#000000";
        
        // Draw start post only for first panel
        if (i === 0) {
          ctx.fillRect(
            currentX - postWidth / 2,
            panelTop,
            postWidth,
            groundLevel - panelTop
          );
        }
        
        // Always draw post after this panel
        ctx.fillStyle = "#000000";
        ctx.fillRect(
          currentX + scaledPanelWidth - postWidth / 2,
          panelTop,
          postWidth,
          groundLevel - panelTop
        );
        
      } 
      // BARR panels have different rendering — Bal BARR reuses the same visual.
      else if (isBarrFencing || isBalBarr) {
        // BARR panel configuration
        const barrBottomClearance = 100 * scale; // Panels float above ground
        const railHeight = 25 * scale; // Top and bottom rails (thinner)
        const railInset = 80 * scale; // Rails are inset from panel edges
        const picketSpacing = 100 * scale; // Space between pickets (50mm pickets + 50mm gaps)
        const postWidth = 25 * scale; // 25mm posts
        const picketGap = 15 * scale; // Gap between pickets and posts
        
        // Draw BARR panel with vertical pickets
        const panelBottom = groundLevel - barrBottomClearance;
        const panelTop = panelBottom - scaledPanelHeight;
        
        // Draw vertical pickets (slats) - FULL HEIGHT with gaps at posts
        ctx.fillStyle = isGate ? "#b0b0b0" : "#9a9a9a";
        const picketWidth = 25 * scale; // 25mm wide pickets
        const picketStart = currentX + postWidth / 2 + picketGap;
        const picketEnd = currentX + scaledPanelWidth - postWidth / 2 - picketGap;
        let picketX = picketStart + (picketSpacing / 2);
        
        while (picketX < picketEnd - picketWidth) {
          ctx.fillRect(
            picketX - picketWidth / 2,
            panelTop,
            picketWidth,
            scaledPanelHeight
          );
          picketX += picketSpacing;
        }
        
        // Draw rails OVER pickets (inset from edges, proportional)
        ctx.fillStyle = isGate ? "#a0a0a0" : "#888888";
        // Top rail (inset from top edge)
        ctx.fillRect(currentX, panelTop + railInset, scaledPanelWidth, railHeight);
        // Bottom rail (inset from bottom edge)
        ctx.fillRect(currentX, panelBottom - railInset - railHeight, scaledPanelWidth, railHeight);
        
        // Draw posts at panel edges (posts extend to ground)
        // For BARR: N panels need N+1 posts (one before first panel, one after each panel)
        ctx.fillStyle = "#000000";
        
        // Draw start post only for first panel
        if (i === 0) {
          ctx.fillRect(
            currentX - postWidth / 2,
            panelTop,
            postWidth,
            groundLevel - panelTop
          );
          
          // Post measurement label - 25mm
          ctx.fillStyle = "#4b5563";
          ctx.font = "600 10px Inter";
          ctx.textAlign = "center";
          ctx.fillText("25mm", currentX, groundLevel + 20);
        }
        
        // Always draw post after this panel
        ctx.fillStyle = "#000000";
        ctx.fillRect(
          currentX + scaledPanelWidth - postWidth / 2,
          panelTop,
          postWidth,
          groundLevel - panelTop
        );
        
        // Post measurement label - 25mm
        ctx.fillStyle = "#4b5563";
        ctx.font = "600 10px Inter";
        ctx.textAlign = "center";
        ctx.fillText("25mm", currentX + scaledPanelWidth, groundLevel + 20);
        
      } 
      // Tubular Flat Top panels have different rendering
      else if (isTubularFencing) {
        // Tubular panel configuration
        const railHeight = 25 * scale; // Top and bottom rails (38x25mm)
        const picketDiameter = 16 * scale; // 16mm round pickets
        const picketSpacing = 88 * scale; // 88mm center-to-center (72mm gap + 16mm picket)
        const postWidth = 50 * scale; // 50mm square posts
        
        // Tubular panels sit on ground (no bottom clearance)
        const panelBottom = groundLevel;
        const panelTop = panelBottom - scaledPanelHeight;
        
        // Draw vertical round pickets (tubes) - FULL HEIGHT
        ctx.fillStyle = isGate ? "#b0b0b0" : "#9a9a9a";
        let picketX = currentX + picketSpacing;
        
        while (picketX < currentX + scaledPanelWidth - picketSpacing) {
          // Draw round picket as circle (elevation view)
          ctx.beginPath();
          ctx.arc(picketX, panelTop + scaledPanelHeight / 2, picketDiameter / 2, 0, Math.PI * 2);
          ctx.fill();
          
          // Draw vertical line to show full height
          ctx.fillRect(
            picketX - picketDiameter / 2,
            panelTop,
            picketDiameter,
            scaledPanelHeight
          );
          picketX += picketSpacing;
        }
        
        // Draw rails at top and bottom edges (not inset)
        ctx.fillStyle = isGate ? "#a0a0a0" : "#888888";
        // Top rail (at top edge)
        ctx.fillRect(currentX, panelTop, scaledPanelWidth, railHeight);
        // Bottom rail (at bottom edge)
        ctx.fillRect(currentX, panelBottom - railHeight, scaledPanelWidth, railHeight);
        
        // Draw posts at panel edges (posts extend to ground)
        // For Tubular: N panels need N+1 posts (one before first panel, one after each panel)
        ctx.fillStyle = "#000000";
        
        // Draw start post only for first panel - extends from top to ground
        if (i === 0) {
          ctx.fillRect(
            currentX - postWidth / 2,
            panelTop,
            postWidth,
            groundLevel - panelTop
          );
        }
        
        // Always draw post after this panel - extends from top to ground
        ctx.fillStyle = "#000000";
        ctx.fillRect(
          currentX + scaledPanelWidth - postWidth / 2,
          panelTop,
          postWidth,
          groundLevel - panelTop
        );
        
      } 
      // Semi-Frameless panels: full-height posts with shuffle-glazed glass
      else if (isSemiFrameless) {
        // Semi-frameless panel configuration
        const postWidth = (span.semiFramelessConfig?.postWidth || 50) * scale; // All posts: 50mm (glass shuffles 10mm into posts)
        const shuffleDepth = 10 * scale; // 10mm shuffle glaze each side
        
        // Glass sits from ground level up (no bottom clearance)
        const panelBottom = groundLevel;
        const panelTop = panelBottom - scaledPanelHeight;
        
        // Draw glass panel (shuffle-glazed, sits inside posts by 10mm each side)
        ctx.fillStyle = isGate ? "rgba(135, 206, 235, 0.15)" : "rgba(135, 206, 235, 0.2)";
        ctx.fillRect(currentX, panelTop, scaledPanelWidth, scaledPanelHeight);
        
        // Glass border
        ctx.strokeStyle = isGate ? "rgba(70, 130, 180, 0.3)" : "rgba(70, 130, 180, 0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(currentX, panelTop, scaledPanelWidth, scaledPanelHeight);
        
        // Draw posts at panel edges (posts extend from top of glass to ground, full height)
        // For Semi-Frameless: N panels need N+1 posts (one before first panel, one after each panel)
        ctx.fillStyle = "#555555"; // Darker gray for semi-frameless posts
        
        // Draw start post only for first panel - WALL POST (50mm)
        if (i === 0) {
          ctx.fillRect(
            currentX - postWidth / 2,
            panelTop,
            postWidth,
            groundLevel - panelTop
          );
        }
        
        // Always draw post after this panel (same 50mm for all posts)
        ctx.fillStyle = "#555555";
        ctx.fillRect(
          currentX + scaledPanelWidth - postWidth / 2,
          panelTop,
          postWidth,
          groundLevel - panelTop
        );
      }
      // Hamptons PVC panels have different rendering
      else if (isHamptonsPVC) {
        // Hamptons PVC panel configuration
        const postWidth = 127 * scale; // 127mm square posts
        const slatWidth = 8 * scale; // Approximate slat width for visual representation
        const slatSpacing = 12 * scale; // Space between vertical slats
        
        // Hamptons panels sit on ground (no bottom clearance)
        const panelBottom = groundLevel;
        const panelTop = panelBottom - scaledPanelHeight;
        
        // Draw panel background
        ctx.fillStyle = isGate ? "#f5f5f5" : "#ffffff";
        ctx.fillRect(currentX, panelTop, scaledPanelWidth, scaledPanelHeight);
        
        // Draw vertical slats based on style
        const style = spanVar.replace("pvc-hamptons-", "");
        ctx.fillStyle = "#e0e0e0";
        
        if (style === "full-privacy") {
          // Full privacy: solid vertical slats with no gaps
          let slatX = currentX + slatWidth;
          while (slatX < currentX + scaledPanelWidth - slatWidth) {
            ctx.fillRect(slatX - slatWidth / 2, panelTop, slatWidth, scaledPanelHeight);
            slatX += slatWidth + 2;
          }
        } else if (style === "semi-privacy" || style === "vertical-paling") {
          // Semi-privacy/vertical paling: vertical slats with gaps
          let slatX = currentX + slatWidth;
          while (slatX < currentX + scaledPanelWidth - slatWidth) {
            ctx.fillRect(slatX - slatWidth / 2, panelTop, slatWidth, scaledPanelHeight);
            slatX += slatWidth + slatSpacing;
          }
        } else if (style === "combo") {
          // Combo: solid bottom + decorative top
          const solidHeight = scaledPanelHeight * 0.6;
          // Solid bottom
          ctx.fillStyle = "#e0e0e0";
          ctx.fillRect(currentX, panelTop + (scaledPanelHeight - solidHeight), scaledPanelWidth, solidHeight);
          // Decorative top slats
          let slatX = currentX + slatWidth;
          while (slatX < currentX + scaledPanelWidth - slatWidth) {
            ctx.fillRect(slatX - slatWidth / 2, panelTop, slatWidth, scaledPanelHeight - solidHeight);
            slatX += slatWidth + slatSpacing;
          }
        } else if (style === "3rail") {
          // 3 rail: three horizontal rails
          const railHeight = 8 * scale;
          const railSpacing = scaledPanelHeight / 4;
          // Top rail
          ctx.fillRect(currentX, panelTop + railSpacing - railHeight / 2, scaledPanelWidth, railHeight);
          // Middle rail
          ctx.fillRect(currentX, panelTop + railSpacing * 2 - railHeight / 2, scaledPanelWidth, railHeight);
          // Bottom rail
          ctx.fillRect(currentX, panelTop + railSpacing * 3 - railHeight / 2, scaledPanelWidth, railHeight);
        }
        
        // Draw posts at panel edges (posts extend to ground)
        ctx.fillStyle = "#d0d0d0";
        
        // Draw start post only for first panel
        if (i === 0) {
          ctx.fillRect(
            currentX - postWidth / 2,
            panelTop,
            postWidth,
            groundLevel - panelTop
          );
          
          // Post measurement label - 127mm
          ctx.fillStyle = "#4b5563";
          ctx.font = "600 10px Inter";
          ctx.textAlign = "center";
          ctx.fillText("127mm", currentX, groundLevel + 20);
        }
        
        // Always draw post after this panel
        ctx.fillStyle = "#d0d0d0";
        ctx.fillRect(
          currentX + scaledPanelWidth - postWidth / 2,
          panelTop,
          postWidth,
          groundLevel - panelTop
        );
        
        // Post measurement label - 127mm
        ctx.fillStyle = "#4b5563";
        ctx.font = "600 10px Inter";
        ctx.textAlign = "center";
        ctx.fillText("127mm", currentX + scaledPanelWidth, groundLevel + 20);
        
      } else if (isLeftRaked || isRightRaked) {
        // Glass panels - raked. Distinct AMBER so raked panels read differently from
        // standard (blue) / gate (purple) / hinge (green) / custom (orange) at a glance.
        ctx.fillStyle = "#f7ecc3";
        ctx.globalAlpha = 1;
        // Draw raked panel: 400mm horizontal at top, then slope to 1200mm
        // For left raked: high on left (400mm), slopes down on right
        // For right raked: slopes down on left, high on right (400mm)
        // Channel systems: glass sits INSIDE the channel (pool: 37mm above the fixing
        // surface; bal 15mm: 35mm — finished glass height 1035mm, operator ruling).
        const rakedBase = isChannelSystem ? groundLevel - (isBalChannel ? 35 : 37) * scale : groundLevel;
        const rakedHeight = (isLeftRaked ? leftRaked! : rightRaked!) * scale;
        const horizontalWidth = 400 * scale; // 400mm horizontal section
        
        ctx.beginPath();
        if (isLeftRaked) {
          // Left raked: horizontal at top for first 400mm, then slope down
          ctx.moveTo(currentX, rakedBase);
          ctx.lineTo(currentX, rakedBase - rakedHeight);
          ctx.lineTo(currentX + horizontalWidth, rakedBase - rakedHeight);
          ctx.lineTo(currentX + scaledPanelWidth, rakedBase - scaledPanelHeight);
          ctx.lineTo(currentX + scaledPanelWidth, rakedBase);
        } else {
          // Right raked: slope up, then horizontal at top for last 400mm
          ctx.moveTo(currentX, rakedBase);
          ctx.lineTo(currentX, rakedBase - scaledPanelHeight);
          ctx.lineTo(currentX + scaledPanelWidth - horizontalWidth, rakedBase - rakedHeight);
          ctx.lineTo(currentX + scaledPanelWidth, rakedBase - rakedHeight);
          ctx.lineTo(currentX + scaledPanelWidth, rakedBase);
        }
        ctx.closePath();
        ctx.fill();

        // Amber border to match the raked fill
        ctx.strokeStyle = "#e3d194";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        // Glass panels - standard rectangular. Channel systems: glass sits INSIDE the
        // channel on the friction-plate rubber feet (pool: 37mm above the fixing
        // surface; bal 15mm: 35mm — finished glass height 1035mm, operator ruling).
        // Standoff system: glass draws semi-transparent IN FRONT of the fascia band
        // so the substrate reads as behind the glass (operator sample).
        const glassBase = isChannelSystem ? groundLevel - (isBalChannel ? 35 : 37) * scale : groundLevel;
        ctx.fillStyle = isCustom ? "#f9d5c5" : isHinge ? "#c5f9d4" : isGate ? "#d4c5f9" : isActive ? "#bdd7ee" : "#d9e8f5";
        ctx.globalAlpha = isStandoffSystem ? 0.75 : 1;
        ctx.fillRect(currentX, glassBase - scaledPanelHeight, scaledPanelWidth, scaledPanelHeight);
        ctx.globalAlpha = 1;

        // Panel border - cleaner, more subtle
        ctx.strokeStyle = isHinge ? "#a4e8b8" : isGate ? "#b8a4e8" : isActive ? "#90c3e0" : "#b8d4e8";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(currentX, glassBase - scaledPanelHeight, scaledPanelWidth, scaledPanelHeight);
      }

      // Panel width is annotated ONCE — on the glass panel itself (below).
      // The lower dimension strip carries GAP numbers only (left/between/right),
      // so the panel size is not repeated. (Owner gripe: elevation must not duplicate panel size.)

      // Panel width label on the panel itself - number and type
      ctx.fillStyle = "#000000";
      ctx.font = "600 13px Inter";
      ctx.textAlign = "center";
      
      // For semi-frameless, show panel size and opening width - positioned at ¼ points
      // Raked panels are ALWAYS 1200 wide — their variable is HEIGHT, so the label
      // shows the user-selected height (e.g. "1500H"), not the width.
      let widthLabel = `${currentPanelWidth}${isRaked ? 'H' : ''}`;
      if (isLeftRaked || isRightRaked) {
        widthLabel = `${isLeftRaked ? leftRaked : rightRaked}H`;
      } else if (isSemiFrameless) {
        widthLabel = `${currentPanelWidth}`; // Just the panel size number
      } else if (isCustom && span.customPanel?.enabled) {
        widthLabel = `${currentPanelWidth}x${span.customPanel.height}`;
      }
      
      // Position labels: top ¼ point for panel size, lower ¼ point for opening
      const topLabelY = isSemiFrameless ? groundLevel - scaledPanelHeight * 0.75 : groundLevel - scaledPanelHeight / 2 - 8;
      const bottomLabelY = isSemiFrameless ? groundLevel - scaledPanelHeight * 0.25 : groundLevel - scaledPanelHeight / 2 + 6;
      
      ctx.fillText(
        widthLabel,
        currentX + scaledPanelWidth / 2,
        topLabelY
      );
      
      // Draw the panel type or opening width below
      let panelTypeLabel = "Panel";
      if (isSemiFrameless) {
        const openingWidth = currentPanelWidth - 20; // Opening = panel - 20mm shuffle glazing
        panelTypeLabel = `${openingWidth}`; // Just the opening size number
      } else if (isGate) {
        panelTypeLabel = "Gate";
      } else if (isHinge) {
        panelTypeLabel = "Hinge";
      } else if (isRaked) {
        panelTypeLabel = "Rake";
      } else if (isCustom) {
        panelTypeLabel = "Custom";
      }
      
      if (!isSemiFrameless) {
        ctx.font = "500 10px Inter";
        ctx.fillText(
          panelTypeLabel,
          currentX + scaledPanelWidth / 2,
          bottomLabelY
        );
      } else {
        // For semi-frameless, show opening width at lower ¼ point
        ctx.font = "500 10px Inter";
        ctx.fillText(
          panelTypeLabel,
          currentX + scaledPanelWidth / 2,
          bottomLabelY
        );
      }

      // Draw mounting hardware at base of panel - spigots OR channel (gates don't have spigots, Blade/BARR/Tubular/Hamptons/SemiFrameless use posts).
      // Bal BARR / Bal Blade use aluminium posts (handled in their render branches above).
      // Standoff systems draw 4 standoffs on the panel body instead — handled in the dedicated branch below.
      if (!isGate && !isChannelSystem && !isBladeFencing && !isBarrFencing && !isTubularFencing && !isHamptonsPVC && !isSemiFrameless && !isBalBarr && !isBalBlade && !isStandoffSystem) {
        const spigotWidth = 50 * scale;   // 50mm wide
        const spigotHeight = 200 * scale; // 200mm height (doubled)
        const spigotGap = 50 * scale;     // 50mm gap below glass
        const spigotOffset = scaledPanelWidth * 0.1; // 10% from panel edge
        
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

      // Standoff mounting hardware — 4 standoff buttons per panel (replaces the 2 base spigots).
      // Two horizontal positions (~150mm in from each side edge), two vertical pairs
      // (~200mm down from top, ~200mm up from bottom). 50mm diameter visual.
      // Standoff discs are drawn per-span AFTER the panel loop (with the fascia band) —
      // see the isStandoffSystem block below the channel-system block.

      // Draw hinges and latch for gate - at edge of panel
      if (isGate) {
        const gateConfig = span.gateConfig;
        const hingeWidth = 14;
        const hingeHeight = 14;
        const latchWidth = 10;
        const latchHeight = 24;
        
        // Determine hinge side based on gate type and configuration
        let hingeOffset: number;
        if (gateConfig?.hingeFrom === "wall") {
          // Wall-mounted gate: hinge position based on which wall (position)
          // Position 0 = left wall, so hinges on left
          // Position 1 = right wall, so hinges on right
          hingeOffset = gateConfig.position === 0 ? hingeWidth / 2 : scaledPanelWidth - hingeWidth / 2;
        } else {
          // Glass-to-glass gate: use flipped config (inverted logic)
          hingeOffset = gateConfig?.flipped ? hingeWidth / 2 : scaledPanelWidth - hingeWidth / 2;
        }
        
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
        
        // Latch on opposite side at top ¼ of panel
        let latchOffset: number;
        if (gateConfig?.hingeFrom === "wall") {
          // Wall-mounted gate: latch on opposite side from hinges
          latchOffset = gateConfig.position === 0 ? scaledPanelWidth - latchWidth / 2 : latchWidth / 2;
        } else {
          // Glass-to-glass gate: use flipped config
          latchOffset = gateConfig?.flipped ? scaledPanelWidth - latchWidth / 2 : latchWidth / 2;
        }
        ctx.fillStyle = "#4b5563";
        ctx.fillRect(
          currentX + latchOffset - latchWidth / 2,
          groundLevel - scaledPanelHeight * 0.75 - latchHeight / 2,
          latchWidth,
          latchHeight
        );
        ctx.strokeStyle = "#374151";
        ctx.lineWidth = 1;
        ctx.strokeRect(
          currentX + latchOffset - latchWidth / 2,
          groundLevel - scaledPanelHeight * 0.75 - latchHeight / 2,
          latchWidth,
          latchHeight
        );
      }

      currentX += scaledPanelWidth;

      // Gap between panels
      if (i < numPanels - 1) {
        // For BARR, Blade, Tubular, Hamptons PVC, and Semi-Frameless (including Bal BARR / Bal Blade): gaps array has N+1 elements, gap[i+1] is between panel i and i+1
        // For glass: gaps array uses gap[i] for gap between panel i and i+1
        const gapIndex = (isBarrFencing || isBladeFencing || isTubularFencing || isHamptonsPVC || isSemiFrameless || isBalBarr || isBalBlade) ? i + 1 : i;
        const actualGapSize = span.panelLayout?.gaps?.[gapIndex] ?? gapSize;
        const scaledGapSize = actualGapSize * scale;
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
        ctx.font = "600 13px Inter";
        ctx.textAlign = "center";
        ctx.fillText(
          `${actualGapSize.toFixed(1)}`,
          gapStart + scaledGapSize / 2,
          gapDimLineY + 18
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
      ctx.font = "600 13px Inter";
      ctx.textAlign = "center";
      ctx.fillText(
        `${rightGapSize.toFixed(1)}`,
        gapStart + scaledRightGap / 2,
        gapDimLineY + 18
      );
    }

    // Draw mid-rail for semi-frameless 1800mm variant
    if (spanVar === "semi-frameless-1800") {
      const midRailHeight = 1000 * scale; // Mid-rail at 1000mm from ground
      const railHeight = 4; // Rail thickness
      const railStartX = drawStartX + (leftGapSize * scale);
      const railEndX = currentX - (rightGapSize * scale);
      const railY = groundLevel - midRailHeight;
      
      // Draw mid-rail
      ctx.fillStyle = "#808080"; // Gray for aluminum rail
      ctx.fillRect(railStartX, railY, railEndX - railStartX, railHeight);
      
      // Rail outline
      ctx.strokeStyle = "#666666";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(railStartX, railY, railEndX - railStartX, railHeight);
      
      // Mid-rail label - positioned to the left to avoid overlap
      ctx.fillStyle = "#4b5563";
      ctx.font = "500 10px Inter";
      ctx.textAlign = "left";
      ctx.fillText(
        "Mid-Rail @ 1000mm",
        railStartX - 100,
        railY + 2
      );
    }
    
    // Draw top-mounted rail for glass balustrade if enabled.
    // startsWith("glass-bal-spigots") catches both the 12mm and 15mm suffixed variants
    // that home.tsx emits, mirroring the same fix landed in bom-calculator.ts (PR #27).
    const isGlassBalustrade = spanVar.startsWith("glass-bal-spigots") ||
                              spanVar === "glass-bal-channel" ||
                              spanVar === "glass-bal-channel-hd" ||
                              spanVar === "glass-bal-standoffs";
    
    if (isGlassBalustrade && span.handrail?.enabled) {
      // Rail runs across the entire span length at the top of panels.
      // Bal channel 15mm (operator ruling 2026-06-03): the 35-Series rail (35mm tall)
      // sits ON the glass top edge at 1035mm — finished height 1070mm.
      // Standoff bal 15mm: same 35-Series bar on the 1280mm glass top — 1315mm finished.
      // Other balustrades keep the generic thin-line rail above the panels.
      const railHeight = isBalChannel || isStandoffSystem ? Math.max(3, 35 * scale) : 3;
      const railY = isBalChannel
        ? groundLevel - 1035 * scale - railHeight
        : isStandoffSystem
          ? groundLevel - 1280 * scale - railHeight
          : groundLevel - (maxPanelHeight * scale) - 5; // 5px above panels for visibility
      const railStartX = drawStartX + (leftGapSize * scale);
      const railEndX = currentX - (rightGapSize * scale);
      
      // Draw rail with a distinct color based on material
      const railColor = span.handrail.material === "stainless-steel" ? "#9ca3af" : "#94a3b8";
      ctx.fillStyle = railColor;
      ctx.fillRect(railStartX, railY, railEndX - railStartX, railHeight);
      
      // Rail outline for definition
      ctx.strokeStyle = "#6b7280";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(railStartX, railY, railEndX - railStartX, railHeight);

      // Rail stock-length joins (operator ruling 2026-06-03): the 35-Series rail comes
      // in 5800mm lengths, so a run longer than 5800mm is JOINED (1 inline joiner per
      // join). Draw a join line at every 5800mm — same treatment as the channel's
      // 4200mm break lines.
      const RAIL_STOCK_PX = 5800 * scale;
      for (let joinX = railStartX + RAIL_STOCK_PX; joinX < railEndX - 2; joinX += RAIL_STOCK_PX) {
        ctx.strokeStyle = "#1f2937";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(joinX, railY);
        ctx.lineTo(joinX, railY + railHeight);
        ctx.stroke();
        // Small "join" tick marks either side of the join line (channel pattern).
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(joinX - 3, railY + railHeight * 0.3);
        ctx.lineTo(joinX + 3, railY + railHeight * 0.3);
        ctx.moveTo(joinX - 3, railY + railHeight * 0.7);
        ctx.lineTo(joinX + 3, railY + railHeight * 0.7);
        ctx.stroke();
      }

      // Rail type label at the end of the rail
      const railTypeNames = {
        "nonorail-25x21": "25×21mm",
        "nanorail-30x21": "30×21mm",
        "series-35x35": "35×35mm",
      };
      const railTypeName = railTypeNames[span.handrail.type as keyof typeof railTypeNames] || "";
      
      ctx.fillStyle = "#4b5563";
      ctx.font = "500 10px Inter";
      ctx.textAlign = "right";
      ctx.fillText(
        `Top Rail ${railTypeName}`,
        railEndX + 80,
        railY
      );
    }

    // Draw channel system - for channel systems only. PTS proportions (operator,
    // 2026-06-03): channel is 128mm high with its base 38mm above the ground; the
    // GLASS SITS INSIDE the channel (finished glass top = 1237mm). The channel BREAKS
    // at the gate (the gate swings on hinges off the neighbouring panel — it can't sit
    // in a channel) and at the gate's hardware gaps either side.
    if (isChannelSystem) {
      const CHANNEL_HEIGHT_MM = 128;
      const channelHeight = CHANNEL_HEIGHT_MM * scale;
      // Deck mount: the channel sits ON the fixing surface. Glass bottom is 37mm up,
      // inside the channel, resting on the friction-plate rubber feet.
      const channelBottomY = groundLevel;
      const channelTopY = channelBottomY - channelHeight;
      const channelStartX = drawStartX + scaledLeftGap;
      const channelEndX = currentX;

      // Walk the panel layout once: channel segments (glass + gaps between glass sit
      // over channel; the gate and its adjacent gaps do not) AND per-panel positions
      // for the pressure-plate clamps.
      const segments: Array<[number, number]> = [];
      const glassPanels: Array<{ startX: number; widthMm: number; isRaked: boolean }> = [];
      const layoutPanels = span.panelLayout?.panels ?? [];
      const layoutGaps = span.panelLayout?.gaps ?? [];
      const layoutTypes = span.panelLayout?.panelTypes ?? layoutPanels.map(() => "standard");
      if (layoutPanels.length) {
        let x = channelStartX;
        let segStart: number | null = null;
        let prevPanelEnd = channelStartX;
        for (let i = 0; i < layoutPanels.length; i++) {
          const panelEnd = x + layoutPanels[i] * scale;
          if (layoutTypes[i] === "gate") {
            // Close the running segment at the end of the previous glass panel.
            if (segStart !== null) {
              segments.push([segStart, prevPanelEnd]);
              segStart = null;
            }
          } else {
            if (segStart === null) segStart = x;
            prevPanelEnd = panelEnd;
            // Raked panels are the first/last panel when enabled on that side.
            const isRaked =
              (i === 0 && !!span.leftRakedPanel?.enabled) ||
              (i === layoutPanels.length - 1 && !!span.rightRakedPanel?.enabled);
            glassPanels.push({ startX: x, widthMm: layoutPanels[i], isRaked });
          }
          x = panelEnd + (layoutGaps[i] ?? 0) * scale;
        }
        if (segStart !== null && prevPanelEnd > segStart) segments.push([segStart, prevPanelEnd]);
      } else {
        // No layout yet — fall back to a continuous channel.
        segments.push([channelStartX, channelEndX]);
      }

      // 1. Channel bodies — drawn OVER the glass so the glass reads as sitting inside.
      for (const [segStart, segEnd] of segments) {
        const segWidth = segEnd - segStart;
        if (segWidth <= 0) continue;
        ctx.fillStyle = "#b8c0c9"; // Aluminum
        ctx.fillRect(segStart, channelTopY, segWidth, channelHeight);
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(segStart, channelTopY, segWidth, channelHeight);
        // Darker base strip (the channel's hollow base section, ~29mm, under the plates).
        const baseStripH = Math.max(3, 29 * scale);
        ctx.fillStyle = "#9aa3ad";
        ctx.fillRect(segStart, channelBottomY - baseStripH, segWidth, baseStripH);
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 1;
        ctx.strokeRect(segStart, channelBottomY - baseStripH, segWidth, baseStripH);

        // Channel stock-length breaks: the channel comes in 4200mm lengths, so a run
        // longer than 4200mm is joined from multiple pieces (4 joining pins per join).
        // Draw a break line at every 4200mm from the start of this run.
        const STOCK_LEN_PX = 4200 * scale;
        for (let breakX = segStart + STOCK_LEN_PX; breakX < segEnd - 2; breakX += STOCK_LEN_PX) {
          ctx.strokeStyle = "#1f2937";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(breakX, channelTopY);
          ctx.lineTo(breakX, channelBottomY);
          ctx.stroke();
          // Small "join" tick marks either side of the break line
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(breakX - 3, channelTopY + channelHeight * 0.3);
          ctx.lineTo(breakX + 3, channelTopY + channelHeight * 0.3);
          ctx.moveTo(breakX - 3, channelTopY + channelHeight * 0.7);
          ctx.lineTo(breakX + 3, channelTopY + channelHeight * 0.7);
          ctx.stroke();
        }
      }

      // 2. Pressure-plate clamps (friction plates) — PER PANEL (they grip the glass),
      //    all measures to centre. Spacing rule per variant (operator ruling 2026-06-03):
      //    • Pool channel (12mm): 150mm from each panel end, max 500mm between centres.
      //    • Bal channel (15mm):  25mm setback + 100mm-wide plate → 75mm first centre,
      //      300mm max between centres (VER-PPKIT-15MM geometric formula, SF-10).
      const CLAMP_END_SETBACK_MM = isBalChannel ? 75 : 150;
      const CLAMP_MAX_SPACING_MM = isBalChannel ? 300 : 500;
      const clampW = Math.max(6, 80 * scale);
      const clampH = Math.max(5, 56 * scale);
      // Plate base ~29mm above the fixing surface; the glass sits 8mm higher again,
      // on the plate's rubber foot (glass bottom = 37mm).
      const clampY = groundLevel - 29 * scale - clampH;
      for (const panel of glassPanels) {
        if (panel.widthMm < CLAMP_END_SETBACK_MM * 2) continue;
        const firstCentre = CLAMP_END_SETBACK_MM;
        const lastCentre = panel.widthMm - CLAMP_END_SETBACK_MM;
        const innerSpan = lastCentre - firstCentre;
        // Raked panels: ALWAYS 4 friction clamps (operator rule). Standard panels:
        // end setback + max spacing between centres per the variant rule above.
        const nGaps = panel.isRaked ? 3 : Math.max(1, Math.ceil(innerSpan / CLAMP_MAX_SPACING_MM));
        const centres: number[] = [];
        if (innerSpan === 0) {
          centres.push(firstCentre);
        } else {
          for (let k = 0; k <= nGaps; k++) centres.push(firstCentre + (innerSpan * k) / nGaps);
        }
        for (const centreMm of centres) {
          const cx = panel.startX + centreMm * scale;
          ctx.beginPath();
          ctx.roundRect(cx - clampW / 2, clampY, clampW, clampH, Math.min(6, clampW / 5));
          ctx.fillStyle = "#6b7280";
          ctx.fill();
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Channel label (V1 is deck mount only)
      ctx.fillStyle = "#374151";
      ctx.font = "500 11px Inter";
      ctx.textAlign = "center";
      ctx.fillText(
        "VersaTilt Channel — Deck Mount",
        channelStartX + (channelEndX - channelStartX) / 2,
        channelTopY - 8
      );
    }

    // Point-fix standoff discs — standoff balustrade only. Drawn AFTER the glass
    // (the standoffs grip through the glass into the fascia behind it). The fascia
    // band itself is drawn BEFORE the panel loop so it sits BEHIND the glass
    // (operator correction 2026-06-03).
    if (isStandoffSystem) {
      // Standoffs per panel: 2 rows inside the fascia zone. Columns: 2 for panels
      // ≤750mm wide (4 standoffs), 3 for wider panels (6 standoffs) — SF-16 rule.
      const sLayoutPanels = span.panelLayout?.panels ?? [];
      const sLayoutGaps = span.panelLayout?.gaps ?? [];
      const sLayoutTypes = span.panelLayout?.panelTypes ?? sLayoutPanels.map(() => "standard");
      const standoffRadius = Math.max(3, (50 * scale) / 2);
      const rowYs = [groundLevel - 80 * scale, groundLevel - 200 * scale];
      let px = drawStartX + scaledLeftGap; // start of the first panel
      for (let i = 0; i < sLayoutPanels.length; i++) {
        const panelWmm = sLayoutPanels[i];
        const panelWpx = panelWmm * scale;
        if (sLayoutTypes[i] !== "gate") {
          const inset = 150 * scale;
          const cols =
            panelWmm >= 800
              ? [px + inset, px + panelWpx / 2, px + panelWpx - inset]
              : [px + inset, px + panelWpx - inset];
          ctx.fillStyle = "#9ca3af";
          ctx.strokeStyle = "#6b7280";
          ctx.lineWidth = 1;
          for (const cx of cols) {
            for (const cy of rowYs) {
              ctx.beginPath();
              ctx.arc(cx, cy, standoffRadius, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
          }
        }
        px += panelWpx + (sLayoutGaps[i] ?? 0) * scale;
      }
    }

    // Height dimension removed per user request
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

    // Draw section label
    ctx.fillStyle = isActive ? "#4488ff" : "#888";
    ctx.font = "bold 14px Inter";
    ctx.textAlign = "center";
    ctx.fillText(
      `Section ${span.spanId}`,
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
        // For aluminium gates: panel width + 25mm allowance = clear opening
        const clearOpening = panelWidthMm + 25;
        labelText = `${panelWidthMm}mm Gate (${clearOpening}mm Opening)`;
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
