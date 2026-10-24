const socket = io();
let roomId = null;
let playerId = null;
let selectedIndex = null;

socket.on('connect', () => { playerId = socket.id; });

document.getElementById('create').onclick = () => {
  const name = document.getElementById('name').value || "Baqdaulet";
  socket.emit('createRoom', { name });
};

document.getElementById('join').onclick = () => {
  const name = document.getElementById('name').value || "Oyinshy";
  const code = document.getElementById('roomId').value.trim().toUpperCase();
  if (!code) { alert('Bolme kodyn jaz'); return; }
  roomId = code;
  socket.emit('joinRoom', { roomId: code, name });
};

socket.on('roomCreated', (data) => {
  roomId = data.roomId;
  document.getElementById('roomInfo').innerHTML = `Bolme kody: <b style="font-size:22px;letter-spacing:3px">${roomId}</b> <button onclick="navigator.clipboard.writeText('${roomId}')">Koshiru</button><br>Dostarina jiber`;
  document.getElementById('copy').classList.remove('hidden');
  document.getElementById('roomId').value = roomId;
});

socket.on('roomCode', (d)=>{ roomId = d.roomId; });

socket.on('lobby', (data)=>{
  roomId = data.roomId;
  document.getElementById('lobby').classList.remove('hidden');
  document.getElementById('game').classList.add('hidden');
  document.getElementById('roomInfo').innerHTML = `Bolme kody: <b style="font-size:22px">${roomId}</b> <button onclick="navigator.clipboard.writeText('${roomId}')">Koshiru</button><br>Kutudemiz: ${data.players.map(p=>p.name).join(', ')}`;
});

socket.on('state', (s) => {
  showGame(s);
});

socket.on('errorMsg', (msg) => alert(msg));

function showGame(s){
  if(roomId){
    const info = document.getElementById('roomInfo');
    if(info) info.innerHTML = `Bolme: <b>${roomId}</b> <button onclick="navigator.clipboard.writeText('${roomId}')">Koshiru</button>`;
  }
  document.getElementById('lobby').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  document.getElementById('pot').textContent = s.pot;
  document.getElementById('trump').textContent = s.trump ? s.trump.r + s.trump.s : '-';
  const turnName = s.players.find(p=>p.id===s.turnPlayerId)?.name || '-';
  document.getElementById('turn').textContent = turnName;
  const battleDiv = document.getElementById('battle');
  battleDiv.innerHTML = s.battle && s.battle.length ? s.battle.map(b=>`<div class="card ${b.card.red?'red':''}">${b.card.r}${b.card.s}<br><small>${b.name}</small></div>`).join('') : '<i style="color:#9f9">Ali karta oinalmady</i>';
  const handDiv = document.getElementById('hand');
  if (s.self && s.self.hand) {
    handDiv.innerHTML = s.self.hand.map((c,i)=>{
      if (!s.self.seen) return `<div class="card back" data-i="${i}">🂠</div>`;
      return `<div class="card ${c.red?'red':''} ${selectedIndex===i?'selected':''}" data-i="${i}">${c.r}${c.s}</div>`;
    }).join('');
    handDiv.querySelectorAll('.card').forEach(el=>{
      el.onclick=()=>{ selectedIndex=Number(el.dataset.i); handDiv.querySelectorAll('.card').forEach(x=>x.classList.remove('selected')); el.classList.add('selected'); }
    });
  }
  const isMyTurn = s.turnPlayerId === socket.id;
  document.querySelectorAll('#betActions button, #duelActions button').forEach(b=> b.disabled = !isMyTurn);
  document.getElementById('betActions').classList.toggle('hidden', !(s.phase==='betting'));
  document.getElementById('duelActions').classList.toggle('hidden', !(s.phase==='duel'));
  document.getElementById('players').innerHTML = s.players.map(p=>`${p.name}: ${p.money} fishka (${p.cardCount} karta) ${p.id===s.turnPlayerId?'👉 kezek':''}`).join('<br>');
  document.getElementById('log').innerHTML = s.log.join('<br>');
}

document.querySelectorAll('#betActions button').forEach(btn=>{
  btn.onclick=()=>{
    const act = btn.dataset.act;
    const amount = document.getElementById('betAmount').value;
    socket.emit('action', { roomId, action: { type: act, amount } });
  };
});
document.getElementById('reveal').onclick=()=> socket.emit('action', { roomId, action: { type: 'reveal' } });
document.getElementById('play').onclick=()=>{
  if (selectedIndex===null){ alert('Karta tanda'); return; }
  socket.emit('action', { roomId, action: { type: 'play', cardIndex: selectedIndex } });
  selectedIndex=null;
};
document.getElementById('foldDuel').onclick=()=> socket.emit('action', { roomId, action: { type: 'fold' } });
