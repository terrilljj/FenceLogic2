import pg from "pg";
import { emitAluPoolBladeSpan } from "../server/services/bom/alu-pool-blade-emit";
import { computeSpanLayout } from "../server/services/layout/layout-service";
const cfgs:any[]=[];
for(const sub of ["decking","concrete-slab","in-ground","core-drilled","side-mounted"]) cfgs.push({label:sub,sub});
cfgs.push({label:"gate",sub:"decking",gate:true});
(async()=>{
  const skus=new Set<string>(),um:string[]=[];
  for(const c of cfgs){
    const span:any={spanId:"A",length:6000,maxPanelWidth:2200,desiredGap:50,fieldValues:{"blade-substrate":c.sub,"blade-material":"concrete"},leftGap:{enabled:true,size:25},rightGap:{enabled:true,size:25}};
    if(c.gate)span.gateConfig={required:true,gateSize:975,autoHingePanel:false,hingeFrom:"wall",position:0,flipped:false};
    let lay;try{lay=computeSpanLayout({productVariant:"alu-pool-blade",gatesAllowed:true,span});}catch(e:any){um.push(`${c.label}: LAYOUT ${e.message}`);continue;}
    span.panelLayout=lay?.panelLayout;
    const u:string[]=[];for(const l of emitAluPoolBladeSpan({productVariant:"alu-pool-blade"},span,u))skus.add(l.sku);for(const x of u)um.push(`${c.label}: ${x}`);
  }
  const cl=new pg.Client({connectionString:process.env.DATABASE_URL});await cl.connect();
  const r=await cl.query(`SELECT p.sku,EXISTS(SELECT 1 FROM bh_storefront.product_placements pp WHERE pp.sku=p.sku) AS placed FROM bh_storefront.products p WHERE p.sku=ANY($1)`,[[...skus]]);await cl.end();
  const known=new Map(r.rows.map((x:any)=>[x.sku,x.placed]));
  const phantom=[...skus].filter(s=>!known.has(s)),unplaced=[...skus].filter(s=>known.get(s)===false);
  console.log(`ALU-BLADE: ${cfgs.length} configs, ${skus.size} SKUs, unmapped=${um.length}, phantom=${phantom.length}, unplaced=${unplaced.length}`);
  [...new Set(um.map(x=>x.split(": ")[1]))].forEach(x=>console.log("  ✗ "+x)); if(phantom.length)console.log("PHANTOM:",phantom.join(", "));
  process.exit(um.length||phantom.length||unplaced.length?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
