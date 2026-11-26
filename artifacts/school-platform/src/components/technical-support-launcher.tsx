import { useEffect, useState } from "react";
import { Link } from "wouter";
import { LifeBuoy } from "lucide-react";
import { getSupabaseClient, hasSupabaseConfig } from "@/lib/supabase/client";
export default function TechnicalSupportLauncher(){
 const [visible,setVisible]=useState(false);
 useEffect(()=>{if(!hasSupabaseConfig){setVisible(false);return;}let alive=true;const db=getSupabaseClient() as any;const check=async()=>{try{const {data:{user}}=await db.auth.getUser();if(!user){if(alive)setVisible(false);return;}const {data}=await db.from("school_memberships").select("school_id").eq("user_id",user.id).eq("status","active").limit(1);if(alive)setVisible(Boolean(data?.length));}catch{if(alive)setVisible(false);}};void check();const {data:{subscription}}=db.auth.onAuthStateChange(()=>void check());return()=>{alive=false;subscription.unsubscribe();};},[]);
 if(!visible)return null;
 return <Link href="/technical-support" aria-label="Report an issue or request maintenance" className="fixed bottom-5 left-4 z-[80] inline-flex items-center gap-2 rounded-full border border-emerald-700 bg-white px-4 py-3 text-sm font-extrabold text-emerald-950 shadow-xl transition hover:-translate-y-0.5 hover:bg-emerald-50"><LifeBuoy size={18}/><span className="hidden sm:inline">Technical Support</span><span className="sm:hidden">Report issue</span></Link>;
}
