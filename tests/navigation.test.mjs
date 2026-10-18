import test from 'node:test';
import assert from 'node:assert/strict';
import '../web/navigation.js';

function browser(hash='#cataclysm/85'){
 const location={hash},entries=[{hash,state:null}];let cursor=0;
 const history={
  get state(){return structuredClone(entries[cursor].state);},
  replaceState(state,_,hash){entries[cursor]={hash,state:structuredClone(state)};location.hash=hash;},
  pushState(state,_,hash){entries.splice(++cursor);entries.push({hash,state:structuredClone(state)});location.hash=hash;},
  go(offset){assert.ok(cursor+offset>=0&&cursor+offset<entries.length,'must remain within the recorded history');cursor+=offset;location.hash=entries[cursor].hash;}
 };
 return {history,location,entries,get cursor(){return cursor;}};
}
const create=env=>globalThis.QuestNavigation.create(env);

test('first task cannot navigate away; relation back restores its reading snapshot',()=>{
 const env=browser(),nav=create(env);nav.showQuest('#cataclysm/85','丢失的项链',{push:false});
 assert.equal(nav.goBack(),false);
 const view={filters:{search:'项链'},page:1,listScroll:430,y:910,details:[true,false,false]};
 nav.save(view);nav.showQuest('#cataclysm/86','比利的馅饼');
 assert.equal(nav.previous().title,'丢失的项链');assert.equal(nav.goBack(),true);
 assert.equal(env.location.hash,'#cataclysm/85');assert.deepEqual(nav.adopt().view,view);assert.equal(nav.previous(),null);
});

test('reselecting or rerendering a task does not add a history stop',()=>{
 const env=browser(),nav=create(env);nav.showQuest('#cataclysm/85','丢失的项链');
 nav.showQuest('#cataclysm/86','比利的馅饼');nav.showQuest('#cataclysm/86','比利的馅饼');
 assert.equal(env.entries.length,2);assert.equal(nav.previous().route,'#cataclysm/85');
});

test('browser back and forward adopt the matching visit; a new branch discards forward history',()=>{
 const env=browser(),nav=create(env);nav.showQuest('#cataclysm/85','项链');nav.showQuest('#cataclysm/86','馅饼');nav.showQuest('#cataclysm/87','金牙');
 env.history.go(-1);nav.adopt();assert.equal(nav.previous().route,'#cataclysm/85');
 env.history.go(1);nav.adopt();assert.equal(nav.previous().route,'#cataclysm/86');
 env.history.go(-1);nav.adopt();nav.showQuest('#cataclysm/88','公主');
 assert.equal(env.entries.length,3);assert.equal(env.entries.at(-1).hash,'#cataclysm/88');
 nav.goBack();nav.adopt();assert.equal(env.location.hash,'#cataclysm/86');
});

test('returning from an NPC-linked task skips the NPC overlay and reaches the original task',()=>{
 const env=browser(),nav=create(env);nav.showQuest('#cataclysm/85','项链');nav.save({y:700});
 nav.showActor('#cataclysm/npc/247');nav.showActor('#cataclysm/npc/246');nav.showQuest('#cataclysm/86','馅饼');
 nav.goBack();assert.equal(env.cursor,0);assert.equal(nav.adopt().view.y,700);
});

test('closing an NPC overlay and reading the same task does not create a self-return loop',()=>{
 const env=browser(),nav=create(env);nav.showQuest('#cataclysm/85','项链');nav.showQuest('#cataclysm/86','馅饼');
 nav.showActor('#cataclysm/npc/247');nav.showQuest('#cataclysm/86','馅饼',{push:false});
 assert.equal(nav.previous().route,'#cataclysm/85');nav.goBack();assert.equal(env.location.hash,'#cataclysm/85');
});

test('refresh preserves history and snapshots; equal IDs in different versions remain distinct',()=>{
 const env=browser(),nav=create(env);nav.showQuest('#cataclysm/85','项链');nav.save({page:1,y:400});nav.showQuest('#classic/85','项链');
 const refreshed=create(env);assert.equal(refreshed.previous().route,'#cataclysm/85');refreshed.goBack();
 assert.deepEqual(refreshed.adopt().view,{page:1,y:400});
 env.location.hash='#classic/7';const freshLink=create(env);freshLink.showQuest('#classic/7','剿灭狗头人',{push:false});assert.equal(freshLink.goBack(),false);
});
