"use client";

import { Bell } from "@phosphor-icons/react";

import type { Locale } from "@/lib/locale";
import { notifications } from "@/lib/mock-content";
import { useMockApp } from "./mock-app-provider";

const shell = "mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6 sm:py-8";


export function NotificationsScreen({ locale }: { readonly locale: Locale }) { const {state,dispatch}=useMockApp();const unread=notifications.filter(n=>!state.readNotificationIds.includes(n.id));return <div className={`${shell} max-w-3xl`}><div className="flex items-end justify-between gap-4"><PageHeading eyebrow="iRide" title={locale==="th"?"การแจ้งเตือน":"Notifications"} detail={locale==="th"?`${unread.length} รายการใหม่`:`${unread.length} new`}/><button className="text-xs font-bold text-primary" onClick={()=>dispatch({type:"read-all-notifications",notificationIds:notifications.map(n=>n.id)})} type="button">{locale==="th"?"อ่านทั้งหมด":"Mark all read"}</button></div><div className="mt-6 space-y-2">{notifications.map(item=>{const read=state.readNotificationIds.includes(item.id);return <button className={`notification-row ${read?"is-read":""}`} onClick={()=>dispatch({type:"read-notification",notificationId:item.id})} key={item.id} type="button"><span className="notification-icon"><Bell size={19}/></span><span><strong>{item.title}</strong><small>{item.detail} · {item.time}</small></span>{!read?<i/>:null}</button>})}</div></div>; }

function PageHeading({eyebrow,title,detail}:{eyebrow:string;title:string;detail:string}){return <div><p className="premium-kicker">{eyebrow}</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{detail}</p></div>}
