/**
 * Server-side BOM (Bill of Materials) calculator.
 * Moved from client/src/pages/fence-builder.tsx to keep product data server-side.
 */
import {
  FenceDesign,
  Component,
  SpigotMounting,
  SpigotColor,
  HingeType,
  LatchType,
  GateHardware,
  HandrailType,
  HandrailMaterial,
  HandrailFinish,
  RailTerminationType,
  getSpigotDetails,
  getHingeDetails,
  getLatchDetails,
  optimizeRailLengths,
} from "@shared/schema";

type SlotMapping = {
  internalId: string;
  fieldName: string;
  productId: string | null;
  label: string | null;
};

type ProductLookup = {
  id: string;
  code: string;
  description: string;
  price: string | null;
};

export function calculateComponents(
  design: FenceDesign,
  slotMappings: SlotMapping[] = [],
  products: ProductLookup[] = []
): Component[] {
  const lookupProductFromSlot = (panelWidth: number, fieldName: string = "glass-panels"): { sku: string; description: string } | null => {
    const fieldSlots = slotMappings.filter(slot =>
      slot.fieldName === fieldName && slot.productId
    );

    if (fieldSlots.length === 0) {
      return null;
    }

    for (const slot of fieldSlots) {
      const product = products.find(p => p.id === slot.productId);
      if (!product) continue;

      const widthPattern = new RegExp(`\\b${panelWidth}(mm|W)\\b`, 'i');

      if (widthPattern.test(product.description) || widthPattern.test(product.code)) {
        return {
          sku: product.code,
          description: product.description
        };
      }
    }

    return null;
  };

  const components: Component[] = [];
  const isChannelSystem = design.productVariant === "glass-pool-channel";
  const isBladeFencing = design.productVariant === "alu-pool-blade";
  const isBarrFencing = design.productVariant === "alu-pool-barr";
  const isTubularFencing = design.productVariant === "alu-pool-tubular";
  const isSemiFrameless = design.productVariant === "semi-frameless-1000" || design.productVariant === "semi-frameless-1800";
  const gatesAllowed = !design.productVariant.includes("bal-");

  // Cast spans to any — design JSON from clients may carry extra dynamic properties
  // (e.g. postFinish, bladeHeight) that aren't on the strict SpanConfig type.
  (design.spans as any[]).forEach((span: any) => {
    // Semi-Frameless
    if (isSemiFrameless && span.panelLayout && span.panelLayout.panels.length > 0) {
      const glassHeight = design.productVariant === "semi-frameless-1000" ? 1000 : 1800;
      const glassThickness = design.productVariant === "semi-frameless-1000" ? 12 : 10;
      const postFinish = span.postFinish || "satin";
      const postMounting = span.postMounting || "core-drilled";
      const leftEndPost = span.leftEndPost || "end";
      const rightEndPost = span.rightEndPost || "end";

      const panelTypes = span.panelLayout.panelTypes || [];
      span.panelLayout.panels.forEach((panelWidth: number, index: number) => {
        const panelType = panelTypes[index] || "standard";

        if (panelType === "gate") {
          components.push({
            qty: 1,
            description: `Semi-Frameless Gate Panel ${panelWidth}mm x ${glassHeight}mm (${glassThickness}mm thick)`,
            sku: `SF-GATE-${panelWidth}-${glassHeight}-${glassThickness}`,
          });
        } else if (panelType === "hinge") {
          components.push({
            qty: 1,
            description: `Semi-Frameless Hinge Panel ${panelWidth}mm x ${glassHeight}mm (${glassThickness}mm thick)`,
            sku: `SF-HINGE-${panelWidth}-${glassHeight}-${glassThickness}`,
          });
        } else {
          components.push({
            qty: 1,
            description: `Semi-Frameless Glass Panel ${panelWidth}mm x ${glassHeight}mm (${glassThickness}mm thick)`,
            sku: `SF-PANEL-${panelWidth}-${glassHeight}-${glassThickness}`,
          });
        }
      });

      const numPosts = span.panelLayout.panels.length + 1;
      const postDescription = `Semi-Frameless 50mm Square Post ${glassHeight + 200}mm (${postFinish} finish, ${postMounting} mounting)`;
      components.push({
        qty: numPosts,
        description: postDescription,
        sku: `SF-POST-50-${glassHeight + 200}-${postFinish.toUpperCase()}-${postMounting.toUpperCase()}`,
      });

      if (leftEndPost !== "end") {
        components.push({
          qty: 1,
          description: `Semi-Frameless Left ${leftEndPost} Post ${glassHeight + 200}mm (${postFinish} finish)`,
          sku: `SF-POST-LEFT-${leftEndPost.toUpperCase()}-${glassHeight + 200}-${postFinish.toUpperCase()}`,
        });
      }

      if (rightEndPost !== "end") {
        components.push({
          qty: 1,
          description: `Semi-Frameless Right ${rightEndPost} Post ${glassHeight + 200}mm (${postFinish} finish)`,
          sku: `SF-POST-RIGHT-${rightEndPost.toUpperCase()}-${glassHeight + 200}-${postFinish.toUpperCase()}`,
        });
      }

      if (design.productVariant === "semi-frameless-1000") {
        const railFinish = span.railFinish || "satin";
        const totalLength = span.length || 5000;
        components.push({
          qty: 1,
          description: `Semi-Frameless Top Rail ${totalLength}mm (${railFinish} finish)`,
          sku: `SF-RAIL-TOP-${totalLength}-${railFinish.toUpperCase()}`,
        });
      } else {
        const midRailFinish = span.midRailFinish || "satin";
        const midRailHeight = span.midRailHeight || 1000;
        const totalLength = span.length || 5000;
        components.push({
          qty: 1,
          description: `Semi-Frameless Mid-Rail @ ${midRailHeight}mm ${totalLength}mm (${midRailFinish} finish)`,
          sku: `SF-RAIL-MID-${midRailHeight}-${totalLength}-${midRailFinish.toUpperCase()}`,
        });
      }

      if (gatesAllowed && span.gateConfig?.required) {
        const gateWidth = span.gateConfig.gateSize || 900;
        components.push({
          qty: 1,
          description: `Semi-Frameless Gate Hinge Set for ${gateWidth}mm x ${glassHeight}mm Gate`,
          sku: `SF-HINGE-SET-${gateWidth}-${glassHeight}`,
        });
        components.push({
          qty: 1,
          description: `Semi-Frameless Gate Latch for ${gateWidth}mm x ${glassHeight}mm Gate`,
          sku: `SF-LATCH-${gateWidth}-${glassHeight}`,
        });
      }

      return;
    }
    // Blade Fencing
    else if (isBladeFencing && span.panelLayout && span.panelLayout.panels.length > 0) {
      const bladeHeight = span.bladeHeight || "1200mm";
      const bladeFinish = span.bladeFinish || "satin-black";
      const bladePostType = span.bladePostType || "welded-base-plate";

      const panelSpecs: Record<string, { width: number; height: number; sku: string }> = {
        "1000mm": { width: 1700, height: 1000, sku: "BLADE-1000" },
        "1200mm": { width: 2200, height: 1200, sku: "BLADE-1200" },
      };
      const spec = panelSpecs[bladeHeight];

      const finishName = bladeFinish === "satin-black" ? "Satin Black (CN150A)" : "Pearl White (GA078A)";
      const finishSku = bladeFinish === "satin-black" ? "CN150A" : "GA078A";

      const panelTypes = span.panelLayout.panelTypes || [];
      span.panelLayout.panels.forEach((panelWidth: number, index: number) => {
        const panelType = panelTypes[index] || "standard";

        if (panelType === "gate") {
          components.push({
            qty: 1,
            description: `Blade Gate Panel ${bladeHeight} x ${panelWidth}mm (${finishName})`,
            sku: `${spec.sku}-GATE-${panelWidth}-${finishSku}`,
          });
        } else if (panelWidth === spec.width) {
          components.push({
            qty: 1,
            description: `Blade Panel ${bladeHeight} x ${spec.width}mm (${finishName})`,
            sku: `${spec.sku}-${spec.width}-${finishSku}`,
          });
        } else {
          components.push({
            qty: 1,
            description: `Blade Panel ${bladeHeight} x ${panelWidth}mm (Cut from ${spec.width}mm, ${finishName})`,
            sku: `${spec.sku}-CUT-${panelWidth}-${finishSku}`,
          });
        }
      });

      const numPosts = span.panelLayout.gaps.length;
      if (bladePostType === "welded-base-plate") {
        components.push({
          qty: numPosts,
          description: `Blade 50x50mm Welded Base Plate Post 1300mm (${finishName})`,
          sku: `BLADE-POST-WBP-1300-${finishSku}`,
        });
      } else {
        const postLength = bladeHeight === "1200mm" ? 2400 : 1800;
        components.push({
          qty: numPosts,
          description: `Blade 50x50mm Standard Post ${postLength}mm (${finishName})`,
          sku: `BLADE-POST-STD-${postLength}-${finishSku}`,
        });
      }

      if (gatesAllowed && span.gateConfig?.required) {
        const gateHeight = spec.height;
        const gateWidth = span.gateConfig.gateSize || 975;

        components.push({
          qty: 1,
          description: `D&D Hinge Set for ${gateHeight}mm x ${gateWidth}mm Blade Gate`,
          sku: `DD-HINGE-BLADE-${gateHeight}-${gateWidth}`,
        });

        components.push({
          qty: 1,
          description: `D&D Latch for ${gateHeight}mm x ${gateWidth}mm Blade Gate`,
          sku: `DD-LATCH-BLADE-${gateHeight}-${gateWidth}`,
        });
      }

      return;
    }
    // BARR Fencing
    else if (isBarrFencing && span.panelLayout && span.panelLayout.panels.length > 0) {
      const barrHeight = span.barrHeight || "1200mm";
      const barrFinish = span.barrFinish || "satin-black";
      const barrPostType = span.barrPostType || "welded-base-plate";

      const panelSpecs: Record<string, { width: number; height: number; sku: string }> = {
        "1000mm": { width: 1733, height: 1000, sku: "BARR-1000" },
        "1200mm": { width: 2205, height: 1200, sku: "BARR-1200" },
        "1800mm": { width: 1969, height: 1800, sku: "BARR-1800" },
      };
      const spec = panelSpecs[barrHeight];

      const finishName = barrFinish === "satin-black" ? "Satin Black (CN150A)" : "Pearl White (GA078A)";
      const finishSku = barrFinish === "satin-black" ? "CN150A" : "GA078A";

      const panelTypes = span.panelLayout.panelTypes || [];
      span.panelLayout.panels.forEach((panelWidth: number, index: number) => {
        const panelType = panelTypes[index] || "standard";

        if (panelType === "gate") {
          components.push({
            qty: 1,
            description: `BARR Gate Panel ${barrHeight} x ${panelWidth}mm (${finishName})`,
            sku: `${spec.sku}-GATE-${panelWidth}-${finishSku}`,
          });
        } else if (panelWidth === spec.width) {
          components.push({
            qty: 1,
            description: `BARR Panel ${barrHeight} x ${spec.width}mm (${finishName})`,
            sku: `${spec.sku}-${spec.width}-${finishSku}`,
          });
        } else {
          components.push({
            qty: 1,
            description: `BARR Panel ${barrHeight} x ${panelWidth}mm (Cut from ${spec.width}mm, ${finishName})`,
            sku: `${spec.sku}-CUT-${panelWidth}-${finishSku}`,
          });
        }
      });

      const numPosts = span.panelLayout.gaps.length;
      if (barrPostType === "welded-base-plate") {
        components.push({
          qty: numPosts,
          description: `BARR Welded Base Plate Post 1280mm (${finishName})`,
          sku: `BARR-POST-WBP-1280-${finishSku}`,
        });
      } else {
        const postLength = barrHeight === "1800mm" ? 2500 : 1800;
        components.push({
          qty: numPosts,
          description: `BARR Standard Post ${postLength}mm (${finishName})`,
          sku: `BARR-POST-STD-${postLength}-${finishSku}`,
        });
      }

      if (gatesAllowed && span.gateConfig?.required) {
        const gateHeight = spec.height;
        const gateWidth = span.gateConfig.gateSize || 975;

        components.push({
          qty: 1,
          description: `D&D Hinge Set for ${gateHeight}mm x ${gateWidth}mm BARR Gate`,
          sku: `DD-HINGE-BARR-${gateHeight}-${gateWidth}`,
        });

        components.push({
          qty: 1,
          description: `D&D Latch for ${gateHeight}mm x ${gateWidth}mm BARR Gate`,
          sku: `DD-LATCH-BARR-${gateHeight}-${gateWidth}`,
        });
      }

      return;
    }
    // Tubular Flat Top
    else if (isTubularFencing && span.panelLayout && span.panelLayout.panels.length > 0) {
      const tubularHeight = span.tubularHeight || "1200mm";
      const tubularFinish = span.tubularFinish || "black";
      const tubularPanelWidth = span.tubularPanelWidth || "2400mm";
      const tubularPostType = span.tubularPostType || "welded-base-plate";

      const panelWidths: Record<string, number> = {
        "2400mm": 2400,
        "2450mm": 2450,
        "3000mm": 3000,
      };
      const standardWidth = panelWidths[tubularPanelWidth];

      const finishNames: Record<string, string> = {
        "black": "Black",
        "white": "White",
        "monument": "Monument Grey",
      };
      const finishName = finishNames[tubularFinish];
      const finishSku = tubularFinish.toUpperCase();

      const panelTypes = span.panelLayout.panelTypes || [];
      span.panelLayout.panels.forEach((panelWidth: number, index: number) => {
        const panelType = panelTypes[index] || "standard";

        if (panelType === "gate") {
          components.push({
            qty: 1,
            description: `Tubular Flat Top Gate Panel ${tubularHeight} x ${panelWidth}mm (${finishName})`,
            sku: `TUBULAR-GATE-${tubularHeight}-${panelWidth}-${finishSku}`,
          });
        } else if (panelWidth === standardWidth) {
          components.push({
            qty: 1,
            description: `Tubular Flat Top Panel ${tubularHeight} x ${standardWidth}mm (${finishName})`,
            sku: `TUBULAR-${tubularHeight}-${standardWidth}-${finishSku}`,
          });
        } else {
          components.push({
            qty: 1,
            description: `Tubular Flat Top Panel ${tubularHeight} x ${panelWidth}mm (Cut from ${standardWidth}mm, ${finishName})`,
            sku: `TUBULAR-CUT-${tubularHeight}-${panelWidth}-${finishSku}`,
          });
        }
      });

      const numPosts = span.panelLayout.gaps.length;
      if (tubularPostType === "welded-base-plate") {
        components.push({
          qty: numPosts,
          description: `Tubular Welded Base Plate Post 1280mm (${finishName})`,
          sku: `TUBULAR-POST-WBP-1280-${finishSku}`,
        });
      } else {
        const postLength = tubularHeight === "900mm" ? 1800 : 1800;
        components.push({
          qty: numPosts,
          description: `Tubular Standard Post ${postLength}mm (${finishName})`,
          sku: `TUBULAR-POST-STD-${postLength}-${finishSku}`,
        });
      }

      if (gatesAllowed && span.gateConfig?.required) {
        const gateHeight = tubularHeight === "1200mm" ? 1200 : 900;
        const gateWidth = span.gateConfig.gateSize || 975;

        components.push({
          qty: 1,
          description: `D&D Hinge Set for ${gateHeight}mm x ${gateWidth}mm Tubular Gate`,
          sku: `DD-HINGE-TUBULAR-${gateHeight}-${gateWidth}`,
        });

        components.push({
          qty: 1,
          description: `D&D Latch for ${gateHeight}mm x ${gateWidth}mm Tubular Gate`,
          sku: `DD-LATCH-TUBULAR-${gateHeight}-${gateWidth}`,
        });
      }

      return;
    }

    // Glass and other fencing types
    if (span.panelLayout && span.panelLayout.panels.length > 0) {
      const panels = span.panelLayout.panels;
      const panelTypes = span.panelLayout.panelTypes || [];

      panels.forEach((panelWidth: number, index: number) => {
        const panelType = panelTypes[index] || "standard";

        if (panelType === "standard") {
          const mappedProduct = lookupProductFromSlot(panelWidth, "glass-panels");

          if (mappedProduct) {
            components.push({
              qty: 1,
              description: mappedProduct.description,
              sku: mappedProduct.sku,
            });
          } else {
            components.push({
              qty: 1,
              description: `Glass Panel ${panelWidth}mm x 1200mm (12mm thick)`,
              sku: `GP-${panelWidth}-1200-12`,
            });
          }
        } else if (panelType === "raked") {
          const isLeftRaked = index === 0 && span.leftRakedPanel?.enabled;
          const height = isLeftRaked ? span.leftRakedPanel?.height : span.rightRakedPanel?.height;

          if (isLeftRaked) {
            components.push({
              qty: 1,
              description: `Raked Glass Panel 1200mm wide (400mm horizontal at ${height}mm, steps down to 1200mm) 12mm thick`,
              sku: `RP-L-1200-${height}-12`,
            });
          } else {
            components.push({
              qty: 1,
              description: `Raked Glass Panel 1200mm wide (steps down from 1200mm to ${height}mm over 800mm, horizontal 400mm) 12mm thick`,
              sku: `RP-R-1200-${height}-12`,
            });
          }
        } else if (panelType === "gate") {
          components.push({
            qty: 1,
            description: `Gate Panel ${panelWidth}mm x 1200mm (12mm thick)`,
            sku: `GP-GATE-${panelWidth}-1200-12`,
          });
        } else if (panelType === "custom") {
          const customHeight = span.customPanel?.height || 1200;
          components.push({
            qty: 1,
            description: `Custom Glass Panel ${panelWidth}mm x ${customHeight}mm (12mm thick)`,
            sku: `GP-CUSTOM-${panelWidth}-${customHeight}-12`,
          });
        } else if (panelType === "hinge") {
          components.push({
            qty: 1,
            description: `Hinge Panel ${panelWidth}mm x 1200mm (12mm thick)`,
            sku: `GP-HINGE-${panelWidth}-1200-12`,
          });
        }

        // Add hardware per panel - either spigots OR channel clamps
        if (!isChannelSystem) {
          const spigotDetails = getSpigotDetails(
            (span.spigotMounting || "base-plate") as SpigotMounting,
            (span.spigotColor || "polished") as SpigotColor
          );
          components.push({
            qty: 2,
            description: spigotDetails.description,
            sku: spigotDetails.sku,
          });
        }
      });

      // Channel system hardware (per span)
      if (isChannelSystem) {
        const spanLength = span.length;
        const channelLength = 4200;

        const numChannels = Math.ceil(spanLength / channelLength);
        const mountingType = span.channelMounting === "wall" ? "Wall" : "Ground";

        components.push({
          qty: numChannels,
          description: `Versatilt Aluminum Channel 4200mm (${mountingType} Mount)`,
          sku: `VC-4200-${span.channelMounting || "ground"}`,
        });

        const numClamps = Math.ceil(spanLength / 300) + 2;
        components.push({
          qty: numClamps,
          description: `Channel Friction Clamp (300mm spacing)`,
          sku: `CFC-300`,
        });

        components.push({
          qty: 2,
          description: `Channel End Cap`,
          sku: `CEC-STD`,
        });
      }

      // Gate hardware
      if (gatesAllowed && span.gateConfig?.required) {
        const hingeType = (span.gateConfig.hingeType || "glass-to-glass") as HingeType;
        const latchType = (span.gateConfig.latchType || "glass-to-glass") as LatchType;
        const hardware = (span.gateConfig.hardware || "polaris") as GateHardware;
        const hingeDetails = getHingeDetails(hingeType, hardware);
        const latchDetails = getLatchDetails(latchType);

        components.push({
          qty: 1,
          description: `${hingeDetails.description} (for ${span.gateConfig.gateSize}mm gate)`,
          sku: `${hingeDetails.sku}-${span.gateConfig.gateSize}`,
        });

        components.push({
          qty: 1,
          description: `${latchDetails.description} (for ${span.gateConfig.gateSize}mm gate)`,
          sku: `${latchDetails.sku}-${span.gateConfig.gateSize}`,
        });

        if (hardware === "polaris" && span.gateConfig.postAdapterPlate) {
          components.push({
            qty: 1,
            description: `Polaris/Atlantic Post Adapter Plate`,
            sku: `PAP-POLARIS`,
          });
        }
      }
    } else {
      // Fallback calculation when panelLayout not yet calculated
      const effectiveLength = span.length;
      const fallbackPanelWidth = span.maxPanelWidth;
      const fallbackGapSize = span.desiredGap;
      const numPanels = Math.floor((effectiveLength + fallbackGapSize) / (fallbackPanelWidth + fallbackGapSize));

      if (numPanels > 0) {
        components.push({
          qty: numPanels,
          description: `Glass Panel ${fallbackPanelWidth}mm x 1200mm (12mm thick) [provisional]`,
          sku: `GP-${fallbackPanelWidth}-1200-12`,
        });

        if (!isChannelSystem) {
          const spigotDetails = getSpigotDetails(
            (span.spigotMounting || "base-plate") as SpigotMounting,
            (span.spigotColor || "polished") as SpigotColor
          );
          components.push({
            qty: numPanels * 2,
            description: spigotDetails.description,
            sku: spigotDetails.sku,
          });
        } else {
          const spanLength = span.length;
          const channelLength = 4200;
          const numChannels = Math.ceil(spanLength / channelLength);
          const mountingType = span.channelMounting === "wall" ? "Wall" : "Ground";

          components.push({
            qty: numChannels,
            description: `Versatilt Aluminum Channel 4200mm (${mountingType} Mount)`,
            sku: `VC-4200-${span.channelMounting || "ground"}`,
          });

          const numClamps = Math.ceil(spanLength / 300) + 2;
          components.push({
            qty: numClamps,
            description: `Channel Friction Clamp (300mm spacing)`,
            sku: `CFC-300`,
          });

          components.push({
            qty: 2,
            description: `Channel End Cap`,
            sku: `CEC-STD`,
          });
        }

        if (gatesAllowed && span.gateConfig?.required) {
          const hingeType = (span.gateConfig.hingeType || "glass-to-glass") as HingeType;
          const latchType = (span.gateConfig.latchType || "glass-to-glass") as LatchType;
          const hardware = (span.gateConfig.hardware || "polaris") as GateHardware;
          const hingeDetails = getHingeDetails(hingeType, hardware);
          const latchDetails = getLatchDetails(latchType);

          components.push({
            qty: 1,
            description: `${hingeDetails.description} (for ${span.gateConfig.gateSize}mm gate)`,
            sku: `${hingeDetails.sku}-${span.gateConfig.gateSize}`,
          });

          components.push({
            qty: 1,
            description: `${latchDetails.description} (for ${span.gateConfig.gateSize}mm gate)`,
            sku: `${latchDetails.sku}-${span.gateConfig.gateSize}`,
          });

          if (hardware === "polaris" && span.gateConfig.postAdapterPlate) {
            components.push({
              qty: 1,
              description: `Polaris/Atlantic Post Adapter Plate`,
              sku: `PAP-POLARIS`,
            });
          }
        }
      }
    }
  });

  // Top-mounted rail optimization for glass balustrade variants
  const isGlassBalustrade = design.productVariant === "glass-bal-spigots" ||
                           design.productVariant === "glass-bal-channel" ||
                           design.productVariant === "glass-bal-standoffs";

  if (isGlassBalustrade) {
    const railGroups = new Map<string, {
      config: { type: HandrailType; material: HandrailMaterial; finish: HandrailFinish };
      spans: { length: number; startTermination: RailTerminationType; endTermination: RailTerminationType }[];
    }>();

    (design.spans as any[]).forEach((span: any) => {
      if (span.handrail?.enabled) {
        const configKey = `${span.handrail.type}-${span.handrail.material}-${span.handrail.finish}`;

        if (!railGroups.has(configKey)) {
          railGroups.set(configKey, {
            config: {
              type: span.handrail.type as HandrailType,
              material: span.handrail.material as HandrailMaterial,
              finish: span.handrail.finish as HandrailFinish,
            },
            spans: [],
          });
        }

        let actualRailLength: number;

        if (span.panelLayout && span.panelLayout.panels.length > 0) {
          actualRailLength = span.panelLayout.totalPanelWidth;
        } else {
          const leftGapSize = span.leftGap?.enabled ? span.leftGap.size : 0;
          const rightGapSize = span.rightGap?.enabled ? span.rightGap.size : 0;
          actualRailLength = span.length - leftGapSize - rightGapSize;
        }

        if (actualRailLength <= 0) {
          return;
        }

        railGroups.get(configKey)!.spans.push({
          length: actualRailLength,
          startTermination: (span.handrail.startTermination || "end-cap") as RailTerminationType,
          endTermination: (span.handrail.endTermination || "end-cap") as RailTerminationType,
        });
      }
    });

    railGroups.forEach((group) => {
      const spanLengths = group.spans.map(s => s.length);
      const optimization = optimizeRailLengths(spanLengths);

      const railTypeNames: Record<string, string> = {
        "nonorail-25x21": "25×21mm NonoRail",
        "nanorail-30x21": "30×21mm NanoRail",
        "series-35x35": "35×35mm Series 35",
      };

      const materialNames: Record<string, string> = {
        "stainless-steel": "Stainless Steel",
        "anodised-aluminium": "Anodised Aluminium",
      };

      const finishNamesMap: Record<string, string> = {
        "polished": "Polished",
        "satin": "Satin",
        "black": "Black",
        "white": "White",
      };

      const railTypeName = railTypeNames[group.config.type];
      const materialName = materialNames[group.config.material];
      const finishName = finishNamesMap[group.config.finish];

      if (optimization.standardLengths > 0) {
        components.push({
          qty: optimization.standardLengths,
          description: `Top Rail ${railTypeName} 5800mm (${materialName}, ${finishName})`,
          sku: `RAIL-${group.config.type.toUpperCase()}-5800-${group.config.material.toUpperCase()}-${group.config.finish.toUpperCase()}`,
        });

        if (optimization.wastage > 0) {
          components.push({
            qty: 1,
            description: `Rail Optimization: ${optimization.totalLength}mm total required, ${optimization.wastage}mm wastage from ${optimization.standardLengths} × 5800mm lengths`,
            sku: `RAIL-OPT-NOTE`,
          });
        }
      }

      const terminationCounts = new Map<string, number>();

      group.spans.forEach((span) => {
        terminationCounts.set(span.startTermination, (terminationCounts.get(span.startTermination) || 0) + 1);
        terminationCounts.set(span.endTermination, (terminationCounts.get(span.endTermination) || 0) + 1);
      });

      const terminationNames: Record<string, string> = {
        "end-cap": "End Cap",
        "wall-tie": "Wall Tie",
        "90-degree": "90° Corner",
        "adjustable-corner": "Adjustable Corner",
      };

      terminationCounts.forEach((count, termination) => {
        if (count > 0) {
          const terminationName = terminationNames[termination];
          components.push({
            qty: count,
            description: `${railTypeName} ${terminationName} (${materialName}, ${finishName})`,
            sku: `RAIL-${group.config.type.toUpperCase()}-${termination.toUpperCase()}-${group.config.material.toUpperCase()}-${group.config.finish.toUpperCase()}`,
          });
        }
      });
    });
  }

  // Consolidate duplicate components
  const consolidated: Component[] = [];
  components.forEach((comp) => {
    const existing = consolidated.find((c) => c.description === comp.description);
    if (existing) {
      existing.qty += comp.qty;
    } else {
      consolidated.push({ ...comp });
    }
  });

  // Sort components
  const sorted = consolidated.sort((a, b) => {
    const extractPanelWidth = (desc: string): number => {
      const match = desc.match(/(\d+)mm/);
      return match ? parseInt(match[1]) : 0;
    };

    const getCategory = (desc: string): number => {
      if (desc.includes('Glass Panel') || desc.includes('Raked Glass Panel') ||
          desc.includes('Gate Panel') || desc.includes('Hinge Panel') || desc.includes('Custom Glass Panel')) {
        return 1;
      }
      if (desc.includes('BARR Panel') || desc.includes('BARR Gate Panel')) {
        return 1;
      }
      if (desc.includes('Spigot')) return 2;
      if (desc.includes('Channel')) return 3;
      if (desc.includes('Post')) return 4;
      if (desc.includes('Hinge Set') || desc.includes('D&D Hinge')) return 5;
      if (desc.includes('Latch') || desc.includes('D&D Latch')) return 6;
      return 7;
    };

    const categoryA = getCategory(a.description);
    const categoryB = getCategory(b.description);

    if (categoryA !== categoryB) {
      return categoryA - categoryB;
    }

    if (categoryA === 1) {
      const widthA = extractPanelWidth(a.description);
      const widthB = extractPanelWidth(b.description);
      return widthB - widthA;
    }

    return 0;
  });

  return sorted;
}

/**
 * Strip SKUs from components for the public response.
 * Per CLAUDE.md: "Response from /api/quote contains descriptions only, NO supplier SKUs"
 */
export function stripSkus(components: Component[]): Array<{ qty: number; description: string }> {
  return components.map(({ qty, description }) => ({ qty, description }));
}
