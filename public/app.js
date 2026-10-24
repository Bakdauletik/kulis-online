const socket = io();
let roomId = null;
let playerId = null;
let selectedIndex = null;
let myState = null;

socket.on('connect', () => { playerId = socket.id; });

document.getElementById('create').onclick = () => {
  const name = document.getElementById('name').value || 'Бақдәулет';
  socket.emit('createRoom', { name });
};

document.getElementById('join').onclick = () => {
  const name = document.getElementById('name').value || 'Ойыншы';
  const code = document.getElementById('roomId').value.trim().toUpperCase();
  if (!code) { alert('Бөлме кодын жаз'); return; }
  roomId = code;
  socket.emit('joinRoom', { roomId: code, name });
};

socket.on('roomCreated', (data) => {
  roomId = data.roomId;
  document.getElementById('roomInfo').innerHTML = `Бөлме коды: <b>${roomId}</b> — достарыңа жібер`;
  document.getElementById('copy').classList.remove('hidden');
  document.getElementById('copy').onclick = () => navigator.clipboard.writeText(roomId);
  document.getElementById('roomId').value = roomId;
  // авто қосылу
  const name = document.getElementById('name').value || 'Бақдәулет';
  socket.emit('joinRoom', { roomId, name });
});

socket.on('lobby', (players) => {
  document.getElementById('roomInfo').innerHTML += `<br>Ойыншылар: ${players.map(p=>p.name).join(', ')} - тағы 1 ойыншы күтудеміз...`;
});

socket.on('state', (s) => {
  myState = s;
  showGame(s);
});

socket.on('errorMsg', (msg) => alert(msg));
socket.on('gameOver', (d) => alert('Ойын бітті! Лог: ' + d.log[0]));

function showGame(s){
  document.getElementById('lobby').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  document.getElementById('pot').textContent = s.pot;
  document.getElementById('trump').textContent = s.trump ? s.trump.r + s.trump.s : '-';
  const turnName = s.players.find(p=>p.id===s.turnPlayerId)?.name || '-';
  document.getElementById('turn').textContent = turnName;

  // ҮСТЕЛ
  const battleDiv = document.getElementById('battle');
  if (s.battle && s.battle.length) {
    battleDiv.innerHTML = s.battle.map(b=>`<div class="card ${b.card.red?'red':''}">${b.card.r}${b.card.s}<br><small>${b.name}</small></div>`).join('');
  } else {
    battleDiv.innerHTML = '<i style="color:#9f9">Әлі карта ойналмады</i>';
  }

  // ҚОЛ
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
  document.getElementById('betActions').classList.toggle('hidden', !(s.phase==='betting'));
  document.getElementById('duelActions').classList.toggle('hidden', !(s.phase==='duel'));
  
  // Кезек емес болса батырмаларды өшіру
  document.querySelectorAll('#betActions button, #duelActions button').forEach(b=> b.disabled = !isMyTurn);

  document.getElementById('players').innerHTML = s.players.map(p=>`${p.name}: ${p.money} фишка (${p.cardCount} карта) ${p.id===s.turnPlayerId?'👉 кезек':''}`).join('<br>');
  document.getElementById('log').innerHTML = s.log.join('<br>');
}

// BETTING actions
document.querySelectorAll('#betActions button').forEach(btn=>{
  btn.onclick=()=>{
    const act = btn.dataset.act;
    const amount = document.getElementById('betAmount').value;
    socket.emit('action', { roomId, action: { type: act, amount } });
  };
});
document.getElementById('reveal').onclick=()=> socket.emit('action', { roomId, action: { type: 'reveal' } });
document.getElementById('play').onclick=()=>{
  if (selectedIndex===null){ alert('Карта таңда'); return; }
  socket.emit('action', { roomId, action: { type: 'play', cardIndex: selectedIndex } });
  selectedIndex=null;
};
document.getElementById('foldDuel').onclick=()=> socket.emit('action', { roomId, action: { type: 'fold' } });
