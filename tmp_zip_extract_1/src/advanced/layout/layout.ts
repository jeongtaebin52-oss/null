export type LayoutMode='fixed'|'auto';
export type AutoDir='row'|'col';
export interface Layout{
  mode:LayoutMode;
  dir?:AutoDir;
  gap?:number;
  padding?:number;
  align?:'start'|'center'|'end';
}
export function applyAutoLayout(children:any[], layout:Layout){
  let offset=layout.padding||0;
  for(const c of children){
    if(layout.dir==='row'){
      c.frame.x=offset;
      offset+=c.frame.w+(layout.gap||0);
    }else{
      c.frame.y=offset;
      offset+=c.frame.h+(layout.gap||0);
    }
  }
}
