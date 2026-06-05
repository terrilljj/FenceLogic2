import pg from "pg";
import { emitGlassBalChannelHdSpan } from "../server/services/bom/glass-bal-channel-hd-emit";
import { computeSpanLayout } from "../server/services/layout/layout-service";
const cfgs:any[]=[];
for(const fin of ["satin","black"]) for(const sub of ["concrete","timber"]) cfgs.push({label:`ch ${fin} ${sub}`,chFin:fin,sub});
for(const t of ["wall-tie","end-cap","90-degree","adjustable-corner"]) cfgs.push({label:`rail ${t}`,chFin:"satin",sub:"concrete",rail:true,t1:t,t2:"wall-tie"});
(async()=>{
  const skus=new Set<string>(),um:string[]=[];
  for(const c of cfgs){
    const span:any={spanId:"A",length:5000,maxPanelWidth:1200,desiredGap:50,channelMounting:"ground",spigotSubstrate:c.sub,fieldValues:{"channel-finish":c.chFin},leftGap:{enabled:true,size:25},rightGap:{enabled:true,size:25}};
    if(c.rail)span.handrail={enabled:true,type:"series-35x35",finish:"satin",startTermination:c.t1,endTermination:c.t2};
    let lay;try{lay=computeSpanLayout({productVariant:"glass-bal-channel-hd",gatesAllowed:false,span});}catch(e:any){um.push(`${c.label}: LAYOUT ${e.message}`);continue;}
    span.panelLayout=lay?.panelLayout;
    const u:string[]=[];for(const l of emitGlassBalChannelHdSpan({productVariant:"glass-bal-channel-hd"},span,u))skus.add(l.sku);for(const x of u)um.push(`${c.label}: ${x}`);
  }
  const cl=new pg.Client({connectionString:process.env.DATABASE_URL});await cl.connect();
  const r=await cl.query(`SELECT p.sku,EXISTS(SELECT 1 FROM bh_storefront.product_placements pp WHERE pp.sku=p.sku) AS placed FROM bh_storefront.products p WHERE p.sku=ANY($1)`,[[...skus]]);await cl.end();
  const known=new Map(r.rows.map((x:any)=>[x.sku,x.placed]));
  const phantom=[...skus].filter(s=>!known.has(s)),unplaced=[...skus].filter(s=>known.get(s)===false);
  console.log(`BAL-CHANNEL-HD: ${cfgs.length} configs, ${skus.size} SKUs, unmapped=${um.length}, phantom=${phantom.length}, unplaced=${unplaced.length}`);
  um.forEach(x=>console.log("  ✗ "+x)); if(phantom.length)console.log("PHANTOM:",phantom.join(", "));
  process.exit(um.length||phantom.length||unplaced.length?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
