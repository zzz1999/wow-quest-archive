/* Reward presentation uses only the versioned archive embedded in each quest. */
(() => {
 'use strict';
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const labels={zhCN:'简中',zhTW:'繁中',enUS:'英文'},paths={classic:'classic/',wotlk:'wotlk/',cataclysm:'cata/',pandaria:'mop-classic/',legion:''};
 const quality=['粗糙','普通','优秀','精良','史诗','传说','神器','传家宝'];
 const slots=['','头部','颈部','肩部','衬衣','胸部','腰部','腿部','脚部','腕部','手部','手指','饰品','单手','副手盾牌','远程','背部','双手','背包','战袍','胸部','主手','副手','副手物品','弹药','投掷','远程','箭袋','圣物'];
 const kindLabel={item:'物品',faction:'声望阵营',currency:'货币',spell:'法术',skill:'技能',title:'头衔'};
 const num=n=>Number(n).toLocaleString('zh-CN'),signed=n=>`${n>0?'+':''}${num(n)}`;
 const badge=l=>l?`<span class="locale-badge ${escape(l)}">${labels[l]||escape(l)}</span>`:'';
 function money(copper){const n=Math.abs(Math.trunc(copper));return (copper<0?'-':'')+[n>=10000?`${Math.floor(n/10000)} 金`:'',Math.floor(n/100)%100?`${Math.floor(n/100)%100} 银`:'',n%100||n===0?`${n%100} 铜`:''].filter(Boolean).join(' ');}
 function name(item,kind,settings={}){return item.name?String(item.name).replace(/%s/g,()=>settings.name||'玩家名称'):`${kindLabel[kind]} #${item.id}（名称暂未收录）`;}
 function itemLink(q,item,kind,settings){
  const text=escape(name(item,kind,settings)),path=paths[q.version];
  if(!['item','spell','faction','currency'].includes(kind)||path===undefined||q.tags?.includes('community-custom')||!Number.isSafeInteger(item.id)||item.id<=0)return text;
  return `<a href="https://www.wowhead.com/${path}cn/${kind}=${item.id}" target="_blank" rel="noopener noreferrer" title="在 Wowhead 查看${kindLabel[kind]}详情（新标签页，需要联网）">${text}<span aria-hidden="true"> ↗</span></a>`;
 }
 function cards(q,items,settings){return `<ul class="reward-items">${items.map(item=>{
  const details=[quality[item.quality],slots[item.inventoryType],item.itemLevel>0?`基础物品等级 ${num(item.itemLevel)}`:'',item.requiredLevel>0?`需要等级 ${num(item.requiredLevel)}`:'',item.scalesWithLevel?'随等级变化':''].filter(Boolean);
  return `<li class="reward-item">${globalThis.QuestItems?QuestItems.button(q.version,item):`<span class="reward-quality quality-${Number.isInteger(item.quality)?item.quality:1}" aria-hidden="true">◇</span>`}<div><div class="reward-item-name">${itemLink(q,item,'item',settings)} ${badge(item.nameLocale)}</div>${details.length?`<small>${details.map(escape).join(' · ')}</small>`:''}</div><b class="reward-count">${item.count===null?'数量未收录':'× '+num(item.count)}</b></li>`;
 }).join('')}</ul>`;}
 function describe(q,settings={}){
  const r=q.rewards;if(!r)return {groups:[],stats:[],notes:['暂未收录奖励详情。']};
  const groups=[],stats=[],notes=[];
  if(r.items.length)groups.push({title:'你将获得',items:r.items});
  if(r.choices.length)groups.push({title:'从以下奖励中任选一件',items:r.choices});
  if(r.package){if(r.package.items.length)groups.push({title:'奖励包中的可选物品',items:r.package.items,note:'按职业、专精或阵营决定可选范围；下列物品不会全部获得。'});else notes.push('此任务有奖励包，物品明细暂未收录。');}
  if(r.money.copper!==null&&r.money.copper!==0)stats.push({label:r.money.copper<0?'需要支付':'基础金钱',value:money(Math.abs(r.money.copper)),note:r.money.dynamic?'金额随角色等级变化，此处为原始记录值。':r.money.basis?`按任务等级 ${r.money.level} 计算`:''});
  else if(r.money.dynamic)stats.push({label:'金钱',value:'随角色等级变化'});
  if(r.experience.amount>0)stats.push({label:'基础经验',value:num(r.experience.amount),note:`任务等级 ${r.experience.level} · 未计等级衰减与加成`});
  else if(r.experience.amount===null&&(r.experience.difficulty>0||r.experience.dynamic))stats.push({label:'经验',value:r.experience.dynamic?'随角色等级变化':'数值暂未收录'});
  if(r.money.maxLevelBonus>0)stats.push({label:'满级时额外金钱',value:money(r.money.maxLevelBonus),note:'代替经验发放，实际数额取决于角色与服务器设置。'});
  if(r.honor)stats.push({label:'荣誉',value:r.honor.dynamic?'随角色等级变化':num(r.honor.points),note:r.honor.dynamic&&r.honor.points?`另有固定荣誉 ${num(r.honor.points)}`:''});
  if(r.talentPoints)stats.push({label:'天赋点',value:signed(r.talentPoints)});
  if(r.arenaPoints)stats.push({label:'竞技场点数',value:signed(r.arenaPoints)});
  if(r.skill)stats.push({label:'技能提升',value:name(r.skill,'skill',settings)+' '+signed(r.skill.points),locale:r.skill.nameLocale});
  if(r.title)stats.push({label:'获得头衔',value:name(r.title,'title',settings),locale:r.title.nameLocale});
  if(r.mail)notes.push(r.mail.delaySeconds?`另有任务邮件，记录的发送延迟为 ${r.mail.delaySeconds%3600===0?num(r.mail.delaySeconds/3600)+' 小时':r.mail.delaySeconds%60===0?num(r.mail.delaySeconds/60)+' 分钟':num(r.mail.delaySeconds)+' 秒'}；附件明细暂未收录。`:'另有任务邮件，附件明细暂未收录。');
  if(r.dynamicRewardId)notes.push('另含动态奖励，最终内容取决于角色或世界任务状态。');
  if(r.artifactPower)notes.push('另有神器能量奖励，具体数值取决于角色状态。');
  return {groups,stats,notes};
 }
 function html(q,settings={}){
  const r=q.rewards,{groups,stats,notes}=describe(q,settings);
  let content=stats.length?`<dl class="reward-stats">${stats.map(s=>`<div><dt>${escape(s.label)}</dt><dd>${escape(s.value)} ${badge(s.locale)}</dd>${s.note?`<small>${escape(s.note)}</small>`:''}</div>`).join('')}</dl>`:'';
  content+=groups.map(g=>`<div class="reward-group"><h4>${escape(g.title)}</h4>${g.note?`<p class="reward-note">${escape(g.note)}</p>`:''}${g.items.length>8?cards(q,g.items.slice(0,6),settings)+`<details class="reward-more"><summary>展开其余 ${g.items.length-6} 件候选物品</summary>${cards(q,g.items.slice(6),settings)}</details>`:cards(q,g.items,settings)}</div>`).join('');
  for(const [field,kind,title]of [['currencies','currency','货币奖励'],['reputation','faction','声望变化'],['spells','spell','法术与效果']]){
   const rows=r?.[field]||[];if(!rows.length)continue;
   content+=`<div class="reward-group"><h4>${title}</h4><ul class="reward-lines">${rows.map(item=>`<li><span>${itemLink(q,item,kind,settings)} ${badge(item.nameLocale)}</span><b>${field==='reputation'?(item.amount===null?'数值暂未收录':signed(item.amount)):field==='currencies'?(item.count===null?'数量暂未收录':'× '+num(item.count)):item.role==='cast'?'完成时触发':'奖励效果'}</b></li>`).join('')}</ul></div>`;
  }
  if(!content&&!notes.length)content='<p class="empty-field">档案未记录可直接列出的奖励。</p>';
  return `<section class="text-section quest-rewards" aria-labelledby="quest-rewards-heading"><h3 class="section-label" id="quest-rewards-heading">任务奖励</h3>${groups.length?'<p class="reward-tip-hint">悬停或点击物品图标查看属性与效果 · 支持离线查阅</p>':''}${content}${notes.map(n=>`<p class="reward-note">${escape(n)}</p>`).join('')}<p class="reward-footnote">按对应版本的档案展示基础值；等级、职业、重复完成与服务器设置可能改变实得奖励。物品名称链接可在 Wowhead 查看更多资料。</p></section>`;
 }
 function text(q,settings={}){
  const r=q.rewards,{groups,stats,notes}=describe(q,settings),lines=['## 任务奖励'];
  for(const s of stats)lines.push(`${s.label}：${s.value}${s.note?'（'+s.note+'）':''}`);
  for(const g of groups){lines.push('\n'+g.title+(g.note?'（'+g.note+'）':''));for(const item of g.items)lines.push(`- ${name(item,'item',settings)} × ${item.count??'数量未收录'}`);}
  for(const item of r?.currencies||[])lines.push(`货币：${name(item,'currency',settings)} × ${item.count??'数量未收录'}`);
  for(const item of r?.reputation||[])lines.push(`声望：${name(item,'faction',settings)} ${item.amount===null?'数值暂未收录':signed(item.amount)}`);
  for(const item of r?.spells||[])lines.push(`法术与效果：${name(item,'spell',settings)}（${item.role==='cast'?'完成时触发':'奖励效果'}）`);
  lines.push(...notes);if(lines.length===1)lines.push('档案未记录可直接列出的奖励。');return lines.join('\n');
 }
 globalThis.QuestRewards={html,text,money,describe};
})();
