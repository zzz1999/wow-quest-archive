/* Self-contained, versioned item records and local artwork. No remote tooltip script. */
(() => {
 'use strict';
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const cache=new Map(),loading=new Map();globalThis.QUEST_ITEM_PACKS={};
 const locales={zhCN:'简中',zhTW:'繁中',enUS:'英文'};
 const quality=['粗糙','普通','优秀','精良','史诗','传说','神器','传家宝'];
 const slots=['','头部','颈部','肩部','衬衣','胸部','腰部','腿部','脚部','腕部','手部','手指','饰品','单手','副手','远程','背部','双手','背包','战袍','胸部','主手','副手','副手物品','弹药','投掷','远程','箭袋','圣物'];
 const armor=['','布甲','皮甲','锁甲','板甲','装饰','盾牌'];
 const weapons=['斧','双手斧','弓','枪','锤','双手锤','长柄武器','剑','双手剑','战刃','法杖','','','拳套','','匕首','投掷武器','','弩','魔杖','鱼竿'];
 const classes=['','战士','圣骑士','猎人','潜行者','牧师','死亡骑士','萨满祭司','法师','术士','武僧','德鲁伊','恶魔猎手'];
 const skillNames={164:'锻造',165:'制皮',171:'炼金术',182:'草药学',185:'烹饪',186:'采矿',197:'裁缝',202:'工程学',333:'附魔',356:'钓鱼',393:'剥皮',755:'珠宝加工',773:'铭文',129:'急救'};
 const schools=['物理','神圣','火焰','自然','冰霜','暗影','奥术'];
 const bindings=['','拾取后绑定','装备后绑定','使用后绑定','任务物品','任务物品'];
 const triggers={0:'使用',1:'装备',2:'击中时可能',4:'灵魂石效果',5:'使用',6:'学会'};
 const num=n=>Number(n).toLocaleString('zh-CN',{maximumFractionDigits:2}),sign=n=>(n>=0?'+':'')+num(n);
 const badge=l=>l?`<span class="item-language">${locales[l]||escape(l)}</span>`:'';
 const line=(text,cls='')=>text?`<div class="item-tip-line ${cls}">${escape(text)}</div>`:'';
 const money=n=>[n>=10000?Math.floor(n/10000)+' 金':'',Math.floor(n/100)%100?Math.floor(n/100)%100+' 银':'',n%100?n%100+' 铜':''].filter(Boolean).join(' ');
 const duration=ms=>ms%3600000===0?num(ms/3600000)+' 小时':ms%60000===0?num(ms/60000)+' 分钟':num(ms/1000)+' 秒';
 function lookup(version,id){return cache.get(version)?.get(Number(id));}
 function load(version,revision='1'){
  if(cache.has(version))return Promise.resolve(cache.get(version));if(loading.has(version))return loading.get(version);
  const p=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=`web/items/${version}.js?v=${revision}`;
   script.onload=async()=>{try{const b64=globalThis.QUEST_ITEM_PACKS[version];if(!b64)throw Error('物品数据文件不完整。');const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),rows=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();const map=new Map(rows.map(r=>[r.id,r]));cache.set(version,map);delete globalThis.QUEST_ITEM_PACKS[version];resolve(map);}catch(e){reject(e);}finally{script.remove();}};
   script.onerror=()=>{script.remove();reject(Error('无法读取物品资料，请下载并解压完整文件夹，或刷新重试。'));};document.head.append(script);
  });loading.set(version,p);p.catch(()=>loading.delete(version));return p;
 }
 function icon(item){return /^[a-z0-9_-]+$/.test(item?.icon||'')?`web/icons/${item.icon}.jpg`:'web/icons/inv_misc_questionmark.jpg';}
 function button(version,ref){const item=lookup(version,ref.id)||ref;return `<button type="button" class="reward-icon quality-${item.quality??1}" data-item-version="${escape(version)}" data-item-id="${ref.id}" aria-label="查看${escape(item.name||'物品 #'+ref.id)}的属性" aria-expanded="false" aria-controls="item-tooltip"><img src="${icon(item)}" alt="" loading="lazy" width="48" height="48"></button>`;}
 function mechanic(e){
  const base=Number(e.effectbasepoints)||0,dice=Number(e.effectdiesides)||0,variable=e.scaling||Number(e.coefficient)||Number(e.effectrealpointsperlevel)||Number(e.effectpointsperresource);
  const lo=base+(dice?Math.min(1,dice):0),hi=base+(dice?Math.max(1,dice):0),amount=variable?'数值随角色变化':lo===hi?num(lo):num(lo)+'–'+num(hi),a=Number(e.effectaura),type=Number(e.effect),misc=Number(e.effectmiscvalue_0);
  if(type===2)return `造成伤害：${amount}`;if(type===10)return `恢复生命：${amount}`;if(type===30)return `恢复资源：${amount}`;
  if(![6,35,65,119,128,129,143].includes(type))return '';
  if(a===29)return `${['力量','敏捷','耐力','智力','精神'][misc]||'全部属性'}：${amount}`;
  if(a===99)return `攻击强度：${amount}`;if(a===124)return `远程攻击强度：${amount}`;
  if(a===13)return `伤害加成：${amount}`;if(a===135)return `治疗效果加成：${amount}`;
  if(a===22)return `抗性加成：${amount}`;
  if([3,8,24].includes(a))return `${{3:'周期伤害',8:'周期治疗',24:'周期资源回复'}[a]}：每 ${num(Number(e.effectauraperiod)/1000)} 秒 ${amount}`;
  if(a===42&&Number(e.effecttriggerspell))return '可触发额外法术，具体效果暂未收录。';
  return '';
 }
 function effectHtml(e){
  const prefix=triggers[e.trigger]||'效果',text=e.text||[...new Set((e.mechanics||[]).map(mechanic).filter(Boolean))].join('；')||e.name||'效果说明暂未收录';
  const cooldown=Math.max(e.cooldown||0,e.categoryCooldown||0),details=[cooldown>0?'冷却 '+duration(cooldown):'',e.charges?Math.abs(e.charges)+' 次'+(e.charges<0?'（用完消耗物品）':''):''].filter(Boolean).join(' · ');
  return `<div class="item-tip-effect">${escape(prefix+'：'+text)} ${e.text?badge(e.textLocale):''}${details?`<div class="item-tip-muted">${escape(details)}</div>`:''}${e.unresolved?'<div class="item-tip-muted">'+(e.text?'部分数值需要角色或法术条件。':(e.mechanics||[]).some(mechanic)?'根据同版本效果字段列出；完整说明暂未收录。':'完整效果说明暂未收录。')+'</div>':''}</div>`;
 }
 function tooltipHtml(item){
  if(!item)return '<p>物品资料暂未收录。</p>';
  const kind=item.classId===4?(item.subclassId===0?'':armor[item.subclassId]||'护甲'):item.classId===2?weapons[item.subclassId]||'武器':'',delay=item.delay>0?item.delay/1000:0;
  let body=`<div class="item-tip-title quality-${item.quality??1}">${escape(item.name||'物品 #'+item.id)} ${badge(item.nameLocale)}</div>`;
  body+=line(item.itemLevel>0?'物品等级 '+num(item.itemLevel):'','item-tip-gold')+line(bindings[item.binding]);
  if(item.maxCount>0)body+=line(item.maxCount===1?'唯一':'最多持有 '+num(item.maxCount)+' 件');
  if(slots[item.inventoryType]||kind)body+=`<div class="item-tip-row"><span>${escape(slots[item.inventoryType]||'')}</span><span>${escape(kind)}</span></div>`;
  if(item.bagSlots>0)body+=line(num(item.bagSlots)+' 格容器');
  if(item.armor>0)body+=line(num(item.armor)+' 点护甲');
  if(item.block>0)body+=line(num(item.block)+' 点格挡');
  for(const [i,d]of (item.damage||[]).entries())body+=`<div class="item-tip-row"><span>${escape(num(d.min)+'–'+num(d.max)+' '+(schools[d.school]||'')+'伤害')}</span>${i===0&&delay?`<span>速度 ${delay.toFixed(2)}</span>`:''}</div>`;
  if(item.damage?.length&&delay)body+=line('（每秒伤害 '+num(item.damage.reduce((s,d)=>s+(d.dps??(d.min+d.max)/2/delay),0))+'）');
  for(const s of item.stats||[])body+=line((s.amount===null?'数值暂未收录':sign(s.amount))+' '+s.label,s.type>7?'item-tip-green':'');
  for(const r of item.resistances||[])body+=line(sign(r.amount)+' '+(schools[r.school]||'')+'抗性');
  const colorNames={1:'多彩',2:'红色',4:'黄色',8:'蓝色',16:'液压',32:'齿轮',14:'棱彩'};
  const indexNames=['','多彩','红色','黄色','蓝色','液压','齿轮','棱彩','钢铁圣物','鲜血圣物','暗影圣物','邪能圣物','奥术圣物','冰霜圣物','火焰圣物','水之圣物','生命圣物','风暴圣物','神圣圣物'];
  for(const s of item.sockets||[])body+=line('◇ '+(s.encoding==='index'?indexNames[s.type]:colorNames[s.type])+'插槽','item-tip-socket');
  if(item.socketBonus)body+=line('插槽奖励：'+(item.socketBonus.text||'说明暂未收录'),'item-tip-muted');
  if(item.durability>0)body+=line('耐久度 '+num(item.durability)+' / '+num(item.durability));
  if(item.classMask>0&&item.classMask<4095){const allowed=classes.filter((_,i)=>i>0&&item.classMask&(1<<(i-1)));if(allowed.length&&allowed.length<classes.length-1)body+=line('职业：'+allowed.join('、'));}
  if(item.requiredLevel>0)body+=line('需要等级 '+num(item.requiredLevel));
  if(item.requiredSkill)body+=line('需要 '+(skillNames[item.requiredSkill]||'技能 #'+item.requiredSkill)+(item.requiredSkillRank?'（'+num(item.requiredSkillRank)+'）':''));
  body+=(item.effects||[]).map(effectHtml).join('');
  if(item.description)body+=`<div class="item-tip-flavor">“${escape(item.description)}” ${badge(item.descriptionLocale)}</div>`;
  if(item.sellPrice>0)body+=line('出售价格：'+money(item.sellPrice),'item-tip-price');
  for(const note of item.notes||[])body+=line(note,'item-tip-muted');
  body+=`<div class="item-tip-footer">${escape(quality[item.quality]||'物品')} · ${escape(({classic:'经典旧世',wotlk:'巫妖王之怒',cataclysm:'大地的裂变',pandaria:'潘达利亚之谜',legion:'军团再临'})[item.version]||item.version)} #${item.id}<br>基础物品资料 · 已随离线包保存</div>`;
  return body;
 }
 let panel,anchor,pinned=false,hideTimer,suppressFocus=false,dismissed;
 function ensure(){if(panel)return;panel=document.createElement('aside');panel.id='item-tooltip';panel.className='item-tooltip';panel.hidden=true;panel.setAttribute('role','tooltip');document.body.append(panel);panel.addEventListener('pointerenter',()=>clearTimeout(hideTimer));panel.addEventListener('pointerleave',scheduleHide);}
 function position(){
  if(!anchor?.isConnected){close();return;}const rect=anchor.getBoundingClientRect(),width=panel.offsetWidth,gap=12;let left,top=rect.top;panel.style.maxHeight='';
  if(rect.right+gap+width<=innerWidth-gap)left=rect.right+gap;
  else if(rect.left-gap-width>=gap)left=rect.left-gap-width;
  else{left=Math.max(gap,Math.min(rect.left,innerWidth-width-gap));const above=rect.top-gap*2,below=innerHeight-rect.bottom-gap*2,useBelow=below>=panel.offsetHeight||below>=above;panel.style.maxHeight=Math.max(80,useBelow?below:above)+'px';top=useBelow?rect.bottom+gap:rect.top-gap-panel.offsetHeight;}
  panel.style.left=Math.max(gap,Math.min(left,innerWidth-width-gap))+'px';panel.style.top=Math.max(gap,Math.min(top,innerHeight-panel.offsetHeight-gap))+'px';
 }
 function close({restoreFocus=false}={}){clearTimeout(hideTimer);const old=anchor;if(old){old.setAttribute('aria-expanded','false');old.removeAttribute('aria-describedby');dismissed=old;}if(panel)panel.hidden=true;anchor=null;pinned=false;if(restoreFocus&&old?.isConnected){suppressFocus=true;old.focus();suppressFocus=false;}}
 function show(button,pin=false){const item=lookup(button.dataset.itemVersion,button.dataset.itemId);if(!item)return;ensure();clearTimeout(hideTimer);if(anchor!==button)close();anchor=button;pinned=pin||pinned;
  dismissed=null;panel.innerHTML=(pinned?'<button class="item-tip-close" type="button" aria-label="关闭物品提示">×</button>':'')+tooltipHtml(item);panel.hidden=false;panel.classList.toggle('pinned',pinned);panel.setAttribute('role',pinned?'dialog':'tooltip');panel.setAttribute('aria-label',item.name||'物品属性');button.setAttribute('aria-expanded','true');button.setAttribute('aria-describedby','item-tooltip');position();
  if(pinned){panel.querySelector('.item-tip-close').addEventListener('click',()=>close({restoreFocus:true}));}
 }
 function scheduleHide(){if(!pinned){clearTimeout(hideTimer);hideTimer=setTimeout(()=>{if(document.activeElement!==anchor)close();},180);}}
 if(typeof document!=='undefined'){
  document.addEventListener('pointerover',e=>{const b=e.target.closest?.('.reward-icon');if(b&&b!==dismissed&&!pinned&&e.pointerType!=='touch')show(b);});
  document.addEventListener('pointerout',e=>{const b=e.target.closest?.('.reward-icon');if(b&&e.relatedTarget?.closest?.('.reward-icon')!==b){if(dismissed===b)dismissed=null;if(!e.relatedTarget?.closest?.('#item-tooltip,.reward-icon'))scheduleHide();}});
  document.addEventListener('focusin',e=>{if(!suppressFocus&&e.target.matches?.('.reward-icon'))show(e.target);});
  document.addEventListener('focusout',e=>{if(e.target.matches?.('.reward-icon')&&!e.relatedTarget?.closest?.('#item-tooltip'))scheduleHide();});
  document.addEventListener('click',e=>{const b=e.target.closest?.('.reward-icon');if(b){if(anchor===b&&pinned)close();else show(b,true);}else if(!e.target.closest?.('#item-tooltip'))close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&anchor){e.preventDefault();close({restoreFocus:pinned});}});
  document.addEventListener('scroll',e=>{if(anchor&&!panel?.contains(e.target)){if(pinned||document.activeElement===anchor)position();else close();}},true);
  globalThis.addEventListener('resize',()=>{if(anchor)position();});
 }
 globalThis.QuestItems={load,lookup,button,tooltipHtml,effectHtml,close,icon};
})();
