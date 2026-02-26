'use client';
import React,{useState} from 'react';
import { createDoc, type LayoutMode } from '../doc/scene';
import { applyAutoLayout } from '../layout/layout';

export default function AdvancedEditor(){
  const [doc,setDoc]=useState(()=>createDoc());

  function toggleAuto(id:string){
    setDoc(d=>{
      const n=d.nodes[id];
      const layout: LayoutMode = n.layout?.mode==='auto'
        ? { mode: 'fixed' }
        : { mode: 'auto', dir: 'row', gap: 8, padding: { t: 8, r: 8, b: 8, l: 8 }, align: 'start', wrap: false };
      const nn={...n, layout};
      const nd={...d, nodes:{...d.nodes, [id]: nn}};
      if (layout.mode === 'auto') {
        const kids = nn.children.map(cid => nd.nodes[cid]);
        applyAutoLayout(kids, { mode: 'auto', dir: layout.dir === 'column' ? 'col' : 'row', gap: layout.gap, padding: layout.padding.t });
      }
      return nd;
    });
  }

  return (
    <div>
      {Object.values(doc.nodes).map(n=>n.id!=='root'&&(
        <button key={n.id} onClick={()=>toggleAuto(n.id)}>
          Toggle AutoLayout ({n.layout?.mode||'fixed'})
        </button>
      ))}
    </div>
  );
}
