"use client";
import { X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useCallback,useEffect,useRef,useState,type ReactNode } from "react";

export function EditModal({children,closeUrl,title}:{readonly children:ReactNode;readonly closeUrl:string;readonly title:string}){
  const router=useRouter(),dialogRef=useRef<HTMLDivElement>(null),returnFocus=useRef<HTMLElement|null>(null),[dirty,setDirty]=useState(false);
  const close=useCallback(()=>{if(dirty&&!window.confirm("Discard unsaved changes?"))return;router.replace(closeUrl)},[closeUrl,dirty,router]);
  useEffect(()=>{returnFocus.current=document.activeElement as HTMLElement;const dialog=dialogRef.current;dialog?.querySelector<HTMLElement>("button,input,textarea,select")?.focus();const key=(event:KeyboardEvent)=>{if(event.key==="Escape")close();if(event.key==="Tab"&&dialog){const items=[...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled])')];if(!items.length)return;const first=items[0]!,last=items.at(-1)!;if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}};document.addEventListener("keydown",key);return()=>{document.removeEventListener("keydown",key);returnFocus.current?.focus()}},[close]);
  return <div className="modal-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)close()}}><div aria-labelledby="edit-modal-title" aria-modal="true" className="edit-modal" ref={dialogRef} role="dialog"><header><h2 id="edit-modal-title">{title}</h2><button aria-label="Close" onClick={close} type="button"><X size={20}/></button></header><div onChange={()=>setDirty(true)}>{children}</div></div></div>;
}
