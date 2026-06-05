import pg from "pg";
import { emitGlassBalSpigots15mmSpan } from "../server/services/bom/glass-bal-spigots-15mm-emit";
import { computeSpanLayout } from "../server/services/layout/layout-service";
const FIN=["polished","satin","black","white"], TERMS=["wall-tie","end-cap","90-degree","adjustable-corner"];
const cfgs:any[]=[];
for(const color of FIN){cfgs.push({label:`base ${color}`,mounting:"base-plate",color,substrate:"concrete"});cfgs.push({label:`core ${color}`,mounting:"core-drilled",color});}
cfgs.push({label:"timber lag",mounting:"base-plate",color:"polished",substrate:"timber",fixing:"lag"},{label:"timber csk",mounting:"base-plate",color:"polished",substrate:"timber",fixing:"csk"},{label:"steel",mounting:"base-plate",color:"polished",substrate:"steel"});
for(const t of TERMS)cfgs.push({label:`rail ${t}`,mounting:"base-plate",color:"polished",substrate:"concrete",rail:true,t1:t,t2:"wall-tie"});
(async()=>{
  const skus=new Set<string>(),um:string[]=[];
  for(const c of cfgs){
    const span:any={spanId:"A",length:6000,maxPanelWidth:1500,desiredGap:50,spigotMounting:c.mounting,spigotColor:c.color,spigotSubstrate:c.substrate,fieldValues:{"fixing-method":c.fixing||"lag"},leftGap:{enabled:true,size:25},rightGap:{enabled:true,size:25}};
    if(c.rail)span.handrail={enabled:true,type:"series-35x35",finish:c.color,startTermination:c.t1,endTermination:c.t2};
    let lay;try{lay=computeSpanLayout({productVariant:"glass-bal-spigots-15mm",gatesAllowed:false,span});}catch(e:any){um.push(`${c.label}: LAYOUT ${e.message}`);continue;}
    span.panelLayout=lay?.panelLayout;
    const u:string[]=[];for(const l of emitGlassBalSpigots15mmSpan({productVariant:"glass-bal-spigots-15mm"},span,u))skus.add(l.sku);for(const x of u)um.push(`${c.label}: ${x}`);
  }
  const cl=new pg.Client({connectionString:process.env.DATABASE_URL});await cl.connect();
  const r=await cl.query(`SELECT p.sku,EXISTS(SELECT 1 FROM bh_storefront.product_placements pp WHERE pp.sku=p.sku) AS placed FROM bh_storefront.products p WHERE p.sku=ANY($1)`,[[...skus]]);await cl.end();
  const known=new Map(r.rows.map((x:any)=>[x.sku,x.placed]));
  const phantom=[...skus].filter(s=>!known.has(s)),unplaced=[...skus].filter(s=>known.get(s)===false);
  console.log(`15MM: ${cfgs.length} configs, ${skus.size} SKUs, unmapped=${um.length}, phantom=${phantom.length}, unplaced=${unplaced.length}`);
  if(um.length){console.log("UNMAPPED:");um.forEach(x=>console.log("  ✗ "+x));}
  if(phantom.length)console.log("PHANTOM:",phantom.join(", "));
  process.exit(um.length||phantom.length||unplaced.length?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
