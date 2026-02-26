import { NextResponse } from 'next/server';
let store:any = {};
export async function POST(req:Request){
  const { slug, doc } = await req.json();
  store[slug]=doc;
  return NextResponse.json({ ok:true });
}
export async function GET(req:Request){
  const { searchParams } = new URL(req.url);
  const slug=searchParams.get('slug')!;
  return NextResponse.json(store[slug]||null);
}
