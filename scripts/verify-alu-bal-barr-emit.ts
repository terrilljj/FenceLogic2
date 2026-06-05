import pg from "pg";
import { emitAluBalBarrSpan } from "../server/services/bom/alu-bal-barr-emit";
import { computeSpanLayout } from "../server/services/layout/layout-service";
const cfgs:any[]=[];
for(const fin of ["black","white"]) for(const sub of ["base-plated","core-drilled","face-mounted"]) cfgs.push({label:`${fin} ${sub}`,fin,sub});
(async()=>{
  const skus=new Set<string>(),um:string[]=[];
  for(const c of cfgs){
    const span:any={spanId:"A",length:6000,maxPanelWidth:1733,desiredGap:50,balBarrFinish:c.fin,fieldValues:{"bal-substrate":c.sub,"bal-material":"concrete","bal-fall-height":"over-1m"},leftGap:{enabled:true,size:25},rightGap:{enabled:true,size:25}};
    let lay;try{lay=computeSpanLayout({productVariant:"alu-bal-barr",gatesAllowed:false,span});}catch(e:any){um.push(`${c.label}: LAYOUT ${e.message}`);continue;}
    span.panelLayout=lay?.panelLayout;
    const u:string[]=[];for(const l of emitAluBalBarrSpan({productVariant:"alu-bal-barr"},span,u))skus.add(l.sku);for(const x of u)um.push(`${c.label}: ${x}`);
  }
  const cl=new pg.Client({connectionString:process.env.DATABASE_URL});await cl.connect();
  const r=await cl.query(`SELECT p.sku,EXISTS(SELECT 1 FROM bh_storefront.product_placements pp WHERE pp.sku=p.sku) AS placed FROM bh_storefront.products p WHERE p.sku=ANY($1)`,[[...skus]]);await cl.end();
  const known=new Map(r.rows.map((x:any)=>[x.sku,x.placed]));
  const phantom=[...skus].filter(s=>!known.has(s)),unplaced=[...skus].filter(s=>known.get(s)===false);
  console.log(`ALU-BAL-BARR: ${cfgs.length} configs, ${skus.size} SKUs, unmapped=${um.length}, phantom=${phantom.length}, unplaced=${unplaced.length}`);
  [...new Set(um.map(x=>x.split(": ")[1]))].forEach(x=>console.log("  ✗ "+x)); if(phantom.length)console.log("PHANTOM:",phantom.join(", "));
  process.exit(um.length||phantom.length||unplaced.length?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
