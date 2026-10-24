// Server-authoritative starter engine. Preserves the supplied prototype's card set,
// trump-card display, ante and broad showdown concept. Rules still need owner confirmation.
const SUITS=[{s:"♥",red:true},{s:"♦",red:true},{s:"♣",red:false},{s:"♠",red:false}];
const RANKS=["7","9","10","В","Д","К","Т"];
const VALUES={"7":7,"9":9,"10":10,"В":10,"Д":10,"К":10,"Т":11};
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const makeDeck=()=>shuffle(SUITS.flatMap(s=>RANKS.map(r=>({r,s:s.s,red:s.red}))));
class Game {
  constructor(players) {
    this.players=players.map((p,i)=>({id:p.id,name:p.name,seat:i,hand:[],folded:false,connected:true,seen:false,money:10000,contribution:0}));
    this.deck=makeDeck(); this.trump=null; this.pot=0; this.currentBet=100; this.turn=0;
    this.status="playing"; this.phase="betting"; this.log=[]; this.round=1; this.battle=[]; this.lastRaiser=null;
    // Prototype ante: 100 virtual chips from every seated participant.
    this.players.forEach(p=>{p.money-=100;p.contribution=100;this.pot+=100;});
    this.players.forEach(p=>p.hand=[this.deck.pop(),this.deck.pop(),this.deck.pop()]);
    this.trump=this.deck.pop();
    this.turn=0; this.note("Раздама басталды. Әр ойыншы 100 виртуалды фишка қосты.");
  }
  note(s){this.log.unshift(s);this.log=this.log.slice(0,12);}
  active(){return this.players.filter(p=>!p.folded);}
  current(){return this.players[this.turn];}
  nextActive(from){for(let k=1;k<=this.players.length;k++){const i=(from+k)%this.players.length;if(!this.players[i].folded)return i;}return from;}
  act(pid,a) {
    const p=this.players.find(x=>x.id===pid);if(!p||p.folded)throw Error("Ойыншы табылмады");
    if(this.current()?.id!==pid)throw Error("Қазір сенің кезегің емес");
    if(this.phase==="betting")this.betAction(p,a);
    else if(this.phase==="duel")this.duelAction(p,a);
    else throw Error("Бұл әрекет қазір қолжетімсіз");
  }
  betAction(p,a) {
    if(a.type==="fold"){p.folded=true;this.note(p.name+" пас деді.");}
    else if(a.type==="look"){p.seen=true;this.note(p.name+" карталарын қарады.");}
    else if(a.type==="call"||a.type==="blind"){
      if(a.type==="blind"&&p.seen)throw Error("Картаны көрген соң соқыр ойнауға болмайды");
      const amount=Math.min(this.currentBet,p.money);p.money-=amount;p.contribution+=amount;this.pot+=amount;
      this.note(p.name+" "+(a.type==="blind"?"соқыр жалғастырды":"ставканы теңестірді")+".");
    } else if(a.type==="raise"){
      const amount=Math.max(100,Math.min(1000,Number(a.amount)||100));
      if(p.money<amount)throw Error("Фишка жеткіліксіз");
      p.money-=amount;p.contribution+=amount;this.pot+=amount;this.currentBet+=amount;this.lastRaiser=p.id;
      this.note(p.name+" ставканы көтерді.");
    } else throw Error("Белгісіз әрекет");
    if(this.active().length<=1){this.award(this.active()[0],"Қалған жалғыз ойыншы банк алды.");return;}
    if(this.active().length===2){this.phase="duel";this.turn=this.lastRaiser?this.players.findIndex(x=>x.id===this.lastRaiser):this.players.findIndex(x=>!x.folded);this.battle=[];this.note("Финалдық дуэль басталды.");return;}
    this.turn=this.nextActive(this.turn);
  }
  duelAction(p,a) {
    if(a.type==="fold"){p.folded=true;const w=this.active()[0];this.award(w,"Қарсылас берілді.");return;}
    if(a.type==="reveal"){
      if(this.battle.length)throw Error("Кулис тек алғашқы картаға дейін ашылады");
      if(!this.culis(p.hand))throw Error("Қолыңда танылған кулис жоқ");
      this.award(p,"Кулис ашылды — банк сенікі.");return;
    }
    if(a.type!=="play")throw Error("Дуэль әрекеті белгісіз");
    const index=Number(a.cardIndex);
    if(!Number.isInteger(index)||index<0||index>=p.hand.length)throw Error("Картаны таңда");
    const card=p.hand[index];
    if(this.battle.length){
      const prev=this.battle[this.battle.length-1].card;
      if(!this.beats(card,prev)){this.award(this.active().find(x=>x.id!==p.id),"Картаң қарсыластың картасын ұтпады.");return;}
    }
    p.hand.splice(index,1);this.battle.push({pid:p.id,name:p.name,card});
    if(this.battle.length===2){this.battle=[];this.note(p.name+" дуэльдегі картаны ұтты.");}
    this.turn=this.nextActive(this.turn);
  }
  beats(a,b){const trumpSuit=this.trump.s;if(a.s===trumpSuit&&b.s!==trumpSuit)return true;if(a.s!==trumpSuit&&b.s===trumpSuit)return false;if(a.s!==b.s)return false;return RANKS.indexOf(a.r)>RANKS.indexOf(b.r);}
  culis(h){
    // Existing prototype marks any 3 cards of one suit as culis.
    return h.length===3 && h.every(c=>c.s===h[0].s);
  }
  award(winner,reason){if(!winner)return;winner.money+=this.pot;this.note(reason);this.pot=0;this.status="finished";this.phase="finished";this.winnerId=winner.id;}
  markDisconnected(pid){const p=this.players.find(x=>x.id===pid);if(p)p.connected=false;}
  stateFor(pid){
    const self=this.players.find(p=>p.id===pid);
    return {status:this.status,phase:this.phase,players:this.players.map(p=>({id:p.id,name:p.name,seat:p.seat,folded:p.folded,connected:p.connected,money:p.money,cardCount:p.hand.length})),
      self:self?{id:self.id,money:self.money,hand:self.hand}:null,
      trump:this.trump,pot:this.pot,currentBet:this.currentBet,turnPlayerId:this.current()?.id||null,
      battle:this.battle,log:this.log,winnerId:this.winnerId||null};
  }
}
module.exports={Game};
