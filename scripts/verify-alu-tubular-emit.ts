import pg from "pg";
import { emitAluPoolTubularSpan } from "../server/services/bom/alu-pool-tubular-emit";
import { computeSpanLayout } from "../server/services/layout/layout-service";
const cfgs:any[]=[];
for(const fin of ["black","white"]) for(const sub of ["decking","concrete-slab","in-ground","core-drilled","side-mounted"]) cfgs.push({label:`${fin} ${sub}`,fin,sub});
for(const fin of ["black","white"]) cfgs.push({label:`${fin} gate`,fin,sub:"decking",gate:true});
cfgs.push({label:"angled side-mount",fin:"black",sub:"side-mounted",angles:2});
(async()=>{
  const skus=new Set<string>(),um:string[]=[];
  for(const c of cfgs){
    const span:any={spanId:"A",length:6000,maxPanelWidth:2450,desiredGap:50,tubularFinish:c.fin,fieldValues:{"tubular-substrate":c.sub,"tubular-material":"concrete","tubular-angled-corners":String(c.angles||0)},leftGap:{enabled:true,size:25},rightGap:{enabled:true,size:25}};
    if(c.gate)span.gateConfig={required:true,gateSize:975,autoHingePanel:false,hingeFrom:"wall",position:0,flipped:false};
    let lay;try{lay=computeSpanLayout({productVariant:"alu-pool-tubular",gatesAllowed:true,span});}catch(e:any){um.push(`${c.label}: LAYOUT ${e.message}`);continue;}
    span.panelLayout=lay?.panelLayout;
    const u:string[]=[];for(const l of emitAluPoolTubularSpan({productVariant:"alu-pool-tubular"},span,u))skus.add(l.sku);for(const x of u)um.push(`${c.label}: ${x}`);
  }
  const cl=new pg.Client({connectionString:process.env.DATABASE_URL});await cl.connect();
  const r=await cl.query(`SELECT p.sku,EXISTS(SELECT 1 FROM bh_storefront.product_placements pp WHERE pp.sku=p.sku) AS placed FROM bh_storefront.products p WHERE p.sku=ANY($1)`,[[...skus]]);await cl.end();
  const known=new Map(r.rows.map((x:any)=>[x.sku,x.placed]));
  const phantom=[...skus].filter(s=>!known.has(s)),unplaced=[...skus].filter(s=>known.get(s)===false);
  console.log(`ALU-TUBULAR: ${cfgs.length} configs, ${skus.size} SKUs, unmapped=${um.length}, phantom=${phantom.length}, unplaced=${unplaced.length}`);
  um.forEach(x=>console.log("  ✗ "+x)); if(phantom.length)console.log("PHANTOM:",phantom.join(", ")); if(unplaced.length)console.log("UNPLACED:",unplaced.join(", "));
  process.exit(um.length||phantom.length||unplaced.length?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
