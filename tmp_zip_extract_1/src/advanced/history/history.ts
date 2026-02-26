export interface Command{ do():void; undo():void; }
export class History{
  private s:Command[]=[]; private i=-1;
  exec(c:Command){ this.s.splice(this.i+1); c.do(); this.s.push(c); this.i++; }
  undo(){ if(this.i>=0) this.s[this.i--].undo(); }
  redo(){ if(this.i+1<this.s.length) this.s[++this.i].do(); }
}
