const lines={
 start:'Подтверждено повторное воплощение. Перекрыть мосты. Наземным группам не преследовать в одиночку.',
 fire:'Выстрелы в секторе один. Он вооружён. Повторяю: в одиночку не вступать.',
 fork:'Цель на развилке. Дроны на мосты. Мосты перекрыть.',
 roof:'Он наверху. Сбить.',room:'Служебный вход! Кто-нибудь, закройте служебный вход!',
 low:'Тело нестабильно. Продержитесь ещё немного.',kill:'Потеряли ещё одного…',
 death:'Сигнал потерян. Деактивация подтверждена. Ждём следующего воплощения.',end:'Он идёт к башне. Поднимайте всех.'
};
export function radio(squelch){
 const el=document.createElement('output');el.id='radio';document.body.append(el);
 let last=-Infinity;const used=new Set();
 return {reset(){el.textContent='';used.clear();last=-Infinity;},say(key,t){
   if(used.has(key)||t-last<8)return;
   used.add(key);last=t;squelch();el.textContent='ДИСПЕТЧЕР 04  /  '+lines[key];
 },update(t){if(t-last>5)el.textContent='';}};
}
