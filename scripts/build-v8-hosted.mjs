import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseVideoSource } from "./video-source.mjs";

const root = new URL("../", import.meta.url);
const source = await readFile(new URL("index.html", root), "utf8");
const match = source.match(/<script>([\s\S]*?)<\/script>/);
if (!match || source.match(/<script>/g).length !== 1)
  throw new Error("Expected one original v8 script");
let script = match[1];
function replace(pattern, replacement) {
  const next = script.replace(pattern, replacement);
  if (next === script) throw new Error(`v8 bridge anchor missing: ${pattern}`);
  script = next;
}
let hostedDocument = source.replace(
  match[0],
  '<script src="/v8-hosted.js"></script>',
);
function replaceDocument(pattern, replacement) {
  const next = hostedDocument.replace(pattern, replacement);
  if (next === hostedDocument)
    throw new Error(`hosted document anchor missing: ${pattern}`);
  hostedDocument = next;
}
replace(
  /^function save\(\).*$/m,
  `function save(){current().updated=Date.now();renderBoardList();parent.postMessage({type:'huddle:save',workspace:ws},'*')}`,
);
replace(
  /^ try\{const raw=localStorage\.getItem.*$/m,
  " if(initialWorkspace)ws=initialWorkspace;",
);
replace(/^ if\(migratedShapeCount\)try\{localStorage.*$/m, "");
replace(
  "load();renderBoard();applyView();setTool('select');",
  "load();renderBoard();applyView();setTool('select');if(!initialWorkspace||migratedShapeCount)save();",
);
replace(
  "function setTool(t){tool=t;document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('active',b.dataset.tool===t||(b.id==='shapesBtn'&&vectorTypes.includes(t)&&t!=='line')));",
  "function setTool(t){tool=t;document.querySelectorAll('.tool').forEach(b=>{const active=b.dataset.tool===t||(b.id==='shapesBtn'&&vectorTypes.includes(t)&&t!=='line');b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});",
);
replace(
  "This cannot be undone in the portable build.",
  "This cannot be undone.",
);
replace("'AI QUIZ'", "'QUIZ'");
replace(/AI quiz/g, "Quiz");
replace(
  "This portable build keeps AI local. Try: “create a quiz from this board”, summarize, actions, or idea prompts. A hosted edition can use a secure model backend for semantic generation.",
  "Board tools are deterministic in this alpha. Use the visible canvas controls for notes, actions, quizzes, voting and export.",
);
replace(
  "I created an editable quiz card from the board. A connected AI model can generate semantic questions, distractors, explanations and difficulty levels.",
  "I created an editable quiz card from the board using its existing text.",
);
replace(
  "Created ${count} editable quiz card${count===1?'':'s'} on the board. In the hosted AI edition, these can become semantic questions with explanations and scoring.",
  "Created ${count} editable quiz card${count===1?'':'s'} from the text already on this board.",
);
replace(
  "Private brainstorm ON — new stickies will be masked",
  "Personal reveal mode ON — new stickies will be masked on this account",
);
replace("Private brainstorm OFF", "Personal reveal mode OFF");
replace("Private notes revealed", "Masked notes revealed on this account");
replace(
  "Hosted edition: facilitator viewport sync needs realtime collaboration",
  "Participant viewport sync is planned for the collaborative milestone",
);
if (script.includes("localStorage"))
  throw new Error("Local persistence remains in hosted bridge");
// Native browser prompts are blocked in opaque-origin frames. Keep the same
// questions and cancellation behavior using accessible in-document dialogs.
for (const name of ["renameBoard", "deleteBoard", "resetBoardContent"]) {
  replace(`function ${name}(`, `async function ${name}(`);
}
for (const id of ["bulkDeleteBoards", "clearInkBtn", "resetVotesBtn"]) {
  replace(
    `document.getElementById('${id}').onclick=()=>`,
    `document.getElementById('${id}').onclick=async()=>`,
  );
}
replace(
  "document.getElementById('textOverflowMenu').onclick=e=>",
  "document.getElementById('textOverflowMenu').onclick=async e=>",
);
replace(
  "row.querySelector('button').onclick=()=>{if(!confirm",
  "row.querySelector('button').onclick=async()=>{if(!confirm",
);
replace(
  "row.querySelector('.manageActions').onclick=e=>",
  "row.querySelector('.manageActions').onclick=async e=>",
);
replace(
  "if(a==='rename')renameBoard(b.id);if(a==='duplicate')duplicateBoardById(b.id);if(a==='delete')deleteBoard(b.id);renderManageBoards()",
  "if(a==='rename')await renameBoard(b.id);if(a==='duplicate')duplicateBoardById(b.id);if(a==='delete')await deleteBoard(b.id);renderManageBoards()",
);
script = script
  .replaceAll("confirm(", "await hostedConfirm(")
  .replaceAll("prompt(", "await hostedPrompt(")
  .replaceAll("alert(", "await hostedAlert(");
const dialogs = `
function hostedDialog(message,value,kind){return new Promise(resolve=>{
 const dialog=document.createElement('dialog');dialog.style.cssText='max-width:440px;border:1px solid #ddd;border-radius:14px;padding:24px;color:#222;background:white';
 const form=document.createElement('form');form.method='dialog';const label=document.createElement('label');label.textContent=message;label.style.display='block';form.append(label);
 const input=document.createElement('input');if(kind==='prompt'){input.value=value||'';input.style.cssText='display:block;width:100%;margin:16px 0';label.append(input)}
 const close=value=>{if(dialog.open)dialog.close(value)};
 if(kind!=='alert'){const cancel=document.createElement('button');cancel.textContent='Cancel';cancel.value='cancel';cancel.type='button';cancel.onclick=()=>close('cancel');form.append(cancel)}
 const ok=document.createElement('button');ok.textContent='OK';ok.value='ok';ok.type='submit';form.addEventListener('submit',event=>{event.preventDefault();close('ok')});form.append(ok);dialog.append(form);document.body.append(dialog);
 dialog.addEventListener('close',()=>{const accepted=dialog.returnValue==='ok';dialog.remove();resolve(kind==='prompt'?(accepted?input.value:null):accepted)},{once:true});
 dialog.showModal();if(kind==='prompt')input.focus();else ok.focus();
})}
const hostedConfirm=message=>hostedDialog(message,'','confirm');
const hostedPrompt=(message,value)=>hostedDialog(message,value,'prompt');
const hostedAlert=message=>hostedDialog(message,'','alert');
function improveHostedAccessibility(bridge){
 document.querySelectorAll('button[title]').forEach(button=>{if(!button.getAttribute('aria-label'))button.setAttribute('aria-label',button.title)});
 const rail=document.querySelector('.toolrail');if(rail){rail.setAttribute('role','toolbar');rail.setAttribute('aria-label','Canvas tools')}
 const canvas=document.getElementById('boardWrap');if(canvas){canvas.setAttribute('role','region');canvas.setAttribute('aria-label','Canvas workspace');canvas.tabIndex=0}
 document.querySelectorAll('.modalShade').forEach((shade,index)=>{const heading=shade.querySelector('h2');shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');shade.setAttribute('aria-hidden',shade.classList.contains('show')?'false':'true');if(heading){if(!heading.id)heading.id='hosted-dialog-title-'+index;shade.setAttribute('aria-labelledby',heading.id)}const modal=shade.querySelector('.modal');if(modal)modal.tabIndex=-1});
 let lastDialogTrigger=null;
 const baseToggleModal=bridge.toggleModal;
 const hostedToggleModal=function(id,on=true){const shade=document.getElementById(id);if(!shade)return;if(on)lastDialogTrigger=document.activeElement;baseToggleModal(id,on);shade.setAttribute('aria-hidden',on?'false':'true');if(on){queueMicrotask(()=>{const target=shade.querySelector('input:not([type="hidden"]),textarea,button,[tabindex]:not([tabindex="-1"])')||shade.querySelector('.modal');target?.focus()})}else if(lastDialogTrigger?.isConnected){lastDialogTrigger.focus()}};
 function activeHostedDialog(){return Array.from(document.querySelectorAll('.modalShade.show')).at(-1)}
 document.addEventListener('keydown',event=>{const modal=activeHostedDialog();if(event.key==='Escape'&&modal){event.preventDefault();event.stopImmediatePropagation();hostedToggleModal(modal.id,false);return}if(event.key!=='Tab'||!modal)return;const focusable=Array.from(modal.querySelectorAll('button:not([disabled]),input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(node=>node.getClientRects().length);if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}},true);
 const sidebarButton=document.getElementById('mobileSidebarBtn'),sidebarBackdrop=document.getElementById('sidebarBackdrop'),sidebar=document.querySelector('.sidebar');
 function setMobileSidebar(open){document.body.classList.toggle('mobileSidebarOpen',open);sidebarButton?.setAttribute('aria-expanded',String(open));sidebarBackdrop?.setAttribute('aria-hidden',String(!open));if(open)queueMicrotask(()=>sidebar?.querySelector('button')?.focus());else sidebarButton?.focus()}
 sidebarButton?.addEventListener('click',()=>setMobileSidebar(!document.body.classList.contains('mobileSidebarOpen')));sidebarBackdrop?.addEventListener('click',()=>setMobileSidebar(false));
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('mobileSidebarOpen')){event.preventDefault();setMobileSidebar(false)}},true);
 function enhanceCanvasItems(){document.querySelectorAll('.canvasItem').forEach(element=>{if(element.dataset.hostedKeyboard==='true')return;element.dataset.hostedKeyboard='true';element.tabIndex=0;element.setAttribute('role','group');const item=bridge.current().items.find(candidate=>candidate.id===element.dataset.id);if(!item)return;const description=item.text||item.title||item.question||item.shape||item.type||'Board object';if(!element.getAttribute('aria-label'))element.setAttribute('aria-label',String(description).slice(0,180));element.addEventListener('keydown',event=>{if(event.target!==element)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();bridge.selectItem(item.id,event.shiftKey);return}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||item.locked)return;event.preventDefault();if(!bridge.getSelectedIds().has(item.id))bridge.selectItem(item.id,false);bridge.hist();const amount=event.shiftKey?10:1;if(event.key==='ArrowLeft')item.x-=amount;if(event.key==='ArrowRight')item.x+=amount;if(event.key==='ArrowUp')item.y-=amount;if(event.key==='ArrowDown')item.y+=amount;bridge.renderItems();bridge.save();queueMicrotask(()=>document.querySelector('.canvasItem[data-id="'+item.id+'"]')?.focus())})})}
 const objectLayer=document.getElementById('objects');if(objectLayer){new MutationObserver(enhanceCanvasItems).observe(objectLayer,{childList:true});enhanceCanvasItems()}
 return hostedToggleModal;
}
`;
replace(
  "function toggleModal(id,on=true){document.getElementById(id).classList.toggle('show',on)}",
  "function toggleModal(id,on=true){document.getElementById(id).classList.toggle('show',on)}toggleModal=improveHostedAccessibility({toggleModal,current,selectItem,getTool:()=>tool,getSelectedIds:()=>selectedIds,hist,renderItems,save});",
);
script = dialogs + script;
script = `let initialized=false;\nwindow.addEventListener('message',event=>{\nif(event.source!==parent||event.data?.type!=='huddle:init'||initialized)return;\ninitialized=true;const initialWorkspace=event.data.workspace;\n${script}\n});\nparent.postMessage({type:'huddle:ready'},'*');\n`;

replaceDocument(
  "</style>",
  `.topbtn:focus-visible,.tool:focus-visible,.btn:focus-visible,.commandItem:focus-visible,.zoom button:focus-visible,.canvasItem:focus-visible{outline:3px solid #2563eb;outline-offset:2px}
.tool[title]:focus-visible:after,.penPreset[title]:focus-visible:before{content:attr(title);position:absolute;left:48px;top:50%;transform:translateY(-50%);z-index:120;background:#20242c;color:#fff;border-radius:7px;padding:6px 8px;font-size:10px;font-weight:650;white-space:nowrap;pointer-events:none;box-shadow:0 7px 18px rgba(0,0,0,.18)}
.mobileSidebarBtn,.sidebarBackdrop{display:none}
@media(max-width:850px){
 .mobileSidebarBtn{display:grid;place-items:center;flex:0 0 40px;width:40px;height:40px;border:0;border-radius:9px;background:#f4f5f8;color:#303641}
 .sidebar{display:flex;position:absolute;left:0;top:0;width:min(86vw,320px);transform:translateX(-105%);transition:transform .18s ease;box-shadow:0 18px 55px rgba(15,23,42,.24)}
 body.mobileSidebarOpen .sidebar{transform:translateX(0)}
 .sidebarBackdrop{position:absolute;z-index:19;inset:0;background:rgba(15,23,42,.38)}
 body.mobileSidebarOpen .sidebarBackdrop{display:block}
 .topbar{left:8px;right:8px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
 .topbar::-webkit-scrollbar{display:none}
 #boardTitle{min-width:132px;max-width:150px}
 .toolrail{left:8px}.tool{width:44px;height:44px}.resizeHandle{width:22px;height:22px}
}
[hidden]{display:none!important}</style>`,
);
replaceDocument(
  '<div class="topbar">\n      <input id="boardTitle"',
  '<div class="topbar">\n      <button id="mobileSidebarBtn" class="mobileSidebarBtn" type="button" aria-label="Open workspace navigation" aria-controls="hostedSidebar" aria-expanded="false"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h16M4 12h16M4 19h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button><input id="boardTitle"',
);
replaceDocument(
  '<aside class="sidebar">',
  '<aside id="hostedSidebar" class="sidebar" aria-label="Workspace navigation">',
);
replaceDocument(
  '  </aside>\n\n  <main class="main">',
  '  </aside>\n  <button id="sidebarBackdrop" class="sidebarBackdrop" type="button" aria-label="Close workspace navigation" aria-hidden="true"></button>\n\n  <main class="main">',
);
replaceDocument(
  '<button id="aiBtn" class="topbtn ai">',
  '<button id="aiBtn" class="topbtn ai" hidden aria-hidden="true" tabindex="-1">',
);
replaceDocument(
  '<button id="collabBtn" class="topbtn utility" title="Collaboration">',
  '<button id="collabBtn" class="topbtn utility" title="Collaboration" hidden aria-hidden="true" tabindex="-1">',
);
replaceDocument(
  '<button id="bringEveryoneBtn" class="featureCard hosted">',
  '<button id="bringEveryoneBtn" class="featureCard hosted" hidden aria-hidden="true" tabindex="-1">',
);
replaceDocument(
  '<div id="collabModal" class="modalShade">',
  '<div id="collabModal" class="modalShade" hidden aria-hidden="true">',
);
replaceDocument(
  "The portable build stays local. These controls define the hosted collaboration experience without pretending a server is connected.",
  "Live multi-user collaboration is planned and is not available in this single-account alpha.",
);
replaceDocument(
  /<span class="featurePill">Backend required<\/span>/g,
  '<span class="featurePill">Planned milestone</span>',
);
replaceDocument(
  '<div id="aiPanel" class="panel">',
  '<div id="aiPanel" class="panel" hidden aria-hidden="true">',
);
replaceDocument(
  '<button class="commandItem" data-command="ai">✦ Open AI Copilot</button>',
  '<button class="commandItem" data-command="ai" hidden aria-hidden="true" tabindex="-1">Board tools</button>',
);
replaceDocument(
  '<div id="storageWarn" class="storageWarn">Local storage is getting full. Export important boards.</div>',
  '<div id="storageWarn" class="storageWarn">Cloud save is near its 10 MB limit. Export a backup and remove large media or checkpoints.</div>',
);
replaceDocument(
  "Portable mode stores boards locally in this browser. Image-heavy boards use more space.",
  "Boards and checkpoints are saved to this signed-in account. Image-heavy boards use more space.",
);
replaceDocument(
  "Find text, actions, checklist items, quiz questions and board titles across your local workspace.",
  "Find text, actions, checklist items, quiz questions and board titles across your saved workspace.",
);
replaceDocument(
  "Portable mode stores up to 12 checkpoints per board.",
  "This signed-in workspace stores up to 12 checkpoints per board.",
);
replaceDocument(
  "Comments are stored on selected objects. Type @name to make an assignment-like mention in this prototype.",
  "Comments are saved with selected objects. @mentions are labels only and do not notify another user yet.",
);
replaceDocument(
  "Tools for workshops, voting, private ideation and alignment.",
  "Single-account tools for workshops, local voting, masked ideation and alignment.",
);
replaceDocument("Private brainstorm", "Personal reveal mode");
replaceDocument(
  "New sticky notes are masked until you reveal them.",
  "New sticky notes are masked on this account until you reveal them.",
);
replaceDocument("Local prototype", "Single-account preview");
replaceDocument("Reveal private notes", "Reveal masked notes");
replaceDocument(
  "Reveal all masked brainstorming notes together.",
  "Reveal all notes masked on this account.",
);
replaceDocument(
  "Portable mode uses files. A hosted version can add live links, permissions and real-time collaboration.",
  "Export a portable backup or presentation copy. Live sharing and participant permissions are not available in this alpha.",
);
replaceDocument("<b>HuddleCanvas AI</b>", "<b>Board tools</b>");
replaceDocument(
  "I can already inspect the board locally for simple productivity actions. A production AI version can use a secure server-side model connection so API keys never live in the app.",
  "These deterministic tools use only the text already on this board. They do not call an AI model.",
);
replaceDocument(
  '<span id="timerValue" class="timerValue">00:00</span><button id="expandTimer">⛶</button><button id="stopTimer">×</button>',
  '<span id="timerValue" class="timerValue">00:00</span><button id="expandTimer" title="Expand timer" aria-label="Expand timer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button><button id="stopTimer" title="Stop timer" aria-label="Stop timer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>',
);
replaceDocument(
  '<button id="resetView" title="Reset view">⌂</button>',
  '<button id="resetView" title="Reset view" aria-label="Reset view"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5M7 10.5V20h10v-9.5M10 20v-5h4v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>',
);
replaceDocument(
  '<button id="zoomOut" title="Zoom out">−</button>',
  '<button id="zoomOut" title="Zoom out" aria-label="Zoom out"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>',
);
replaceDocument(
  '<button id="zoomIn" title="Zoom in">+</button>',
  '<button id="zoomIn" title="Zoom in" aria-label="Zoom in"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 6v12M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>',
);
replaceDocument(
  '<button id="shrinkSelectionBtn" class="transformBtn" title="Scale down" aria-label="Scale selected objects down">−</button>',
  '<button id="shrinkSelectionBtn" class="transformBtn" title="Scale down" aria-label="Scale selected objects down"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>',
);
replaceDocument(
  '<button id="growSelectionBtn" class="transformBtn" title="Scale up" aria-label="Scale selected objects up">＋</button>',
  '<button id="growSelectionBtn" class="transformBtn" title="Scale up" aria-label="Scale selected objects up"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 6v12M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>',
);
replaceDocument(
  '<button id="rotateSelectionBtn" class="transformBtn" title="Rotate 15°" aria-label="Rotate selected objects 15 degrees">↻</button>',
  '<button id="rotateSelectionBtn" class="transformBtn" title="Rotate 15°" aria-label="Rotate selected objects 15 degrees"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 8V4m0 0h-4m4 0-3 3a7 7 0 1 0 2 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>',
);
replaceDocument(
  '<button class="commandItem" data-command="new">＋ New board</button><button class="commandItem" data-command="timer">⏱ Start 5-minute break</button>',
  '<button class="commandItem" data-command="new"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> New board</button><button class="commandItem" data-command="timer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="13" r="8" stroke="currentColor" stroke-width="1.7"/><path d="M12 9v4l2.5 1.5M9 3h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg> Start 5-minute break</button>',
);
replaceDocument(
  '<button class="commandItem" data-command="focus">◫ Toggle focus mode</button>',
  '<button class="commandItem" data-command="focus"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Toggle focus mode</button>',
);
replaceDocument('<button class="commandItem" data-command="new">', '<button class="commandItem" data-command="video">Add video link</button><button class="commandItem" data-command="new">');
replace("if(c==='new')newBoard();", "if(c==='video')addVideoLink();if(c==='new')newBoard();");
replace("function renderItems(){", parseVideoSource.toString() + `
function addVideoLink(){
 const dialog=document.createElement('dialog'),form=document.createElement('form');
 const label=document.createElement('label'),input=document.createElement('input');
 label.textContent='YouTube or Vimeo video URL ';input.type='url';input.required=true;label.append(input);
 const add=document.createElement('button'),cancel=document.createElement('button');
 add.textContent='Add to board';cancel.textContent='Cancel';cancel.type='button';
 form.append(label,add,cancel);dialog.append(form);dialog.setAttribute('aria-label','Add video link');document.body.append(dialog);
 cancel.onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();input.oninput=()=>input.setCustomValidity('');
 form.onsubmit=e=>{e.preventDefault();const source=parseVideoSource(input.value);
 if(!source){input.setCustomValidity('Enter a supported HTTPS YouTube or Vimeo video link.');input.reportValidity();return}
 hist();const wrap=document.getElementById('boardWrap').getBoundingClientRect(),world=objects.getBoundingClientRect();
 const scale=objects.offsetWidth ? world.width/objects.offsetWidth : 1;
 current().items.push({id:id(),type:'video',url:source.embedUrl,x:(wrap.left+wrap.width/2-world.left)/(scale||1)-140,y:(wrap.top+wrap.height/2-world.top)/(scale||1)-80,w:280,h:192});
 dialog.close();renderItems();save()};dialog.showModal();input.focus()
}
function renderItems(){`);
replace("current().items.forEach(item=>{\n if(item.type==='sticky')", `current().items.forEach(item=>{
 if(item.type==='video'){
 const source=parseVideoSource(item.url),card=document.createElement('div'),header=document.createElement('div'),play=document.createElement('button');
 card.className='actionCard canvasItem';card.dataset.id=item.id;card.style.left=item.x+'px';card.style.top=item.y+'px';card.style.width='280px';
 header.className='objtop';header.textContent=source?'Video · '+source.provider:'Unsupported video';
 play.textContent='Load video';play.disabled=!source;
 play.onclick=()=>{if(!source)return;const player=document.createElement('iframe');player.title=source.provider+' video';player.src=source.embedUrl;player.width='260';player.height='150';play.replaceWith(player)};
 header.classList.add('dragHandle');card.append(header,play);objects.appendChild(card);dragBind(card,item,header)}
 if(item.type==='sticky')`);
const boardCss = await readFile(new URL("./hosted-board.css", import.meta.url), "utf8");
replaceDocument("</style>", boardCss + "\n</style>");
replaceDocument("Presentation frame — creates a persistent slide region", "Presentation frame: create a slide region");
replaceDocument("Vote mode — choose up to 5 objects", "Vote for up to 5 objects");
replaceDocument('data-command="video">Add video link', 'data-command="video"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="m10 8 6 4-6 4z" fill="currentColor"/></svg>Add video link');
for (const [from,to] of [
  ["Objects grouped — move one to move the whole group","Objects grouped. Drag any member to move the group."],
  ["Object locked — use Arrange to unlock it","Object locked. Open Arrange to unlock it."],
  ["Checklist added — edit the title and rows directly","Checklist added. Edit the title or a row."],
  ["Clipboard text is unavailable — use Ctrl/Cmd + V instead","Clipboard unavailable. Paste with Ctrl+V or Command+V."],
  ["Personal reveal mode ON — new stickies will be masked on this account","Personal reveal is on. New sticky notes are hidden on this account."],
  ["it.owner||'—'","it.owner||'Unassigned'"],["it.due||'—'","it.due||'Not set'"],
  ["'Open'} — ","'Open'}: "]
]) replace(from,to);
await writeFile(new URL("assets/v8-hosted.js", root), script);
await writeFile(new URL("assets/v8-hosted.html", root), hostedDocument);
console.log(
  `Generated hosted v8 assets in ${fileURLToPath(new URL("assets/", root))}`,
);
