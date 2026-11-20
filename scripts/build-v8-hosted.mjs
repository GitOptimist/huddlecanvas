import { installPaletteLayout } from "./palette-layout.mjs";
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
// Media lives on a canvas layer, so draw and hit-test its grip in board coordinates.
replace("pctx.strokeRect(it.x-4/scale,it.y-4/scale,it.w+8/scale,it.h+8/scale);", `$&
 const grip=12/scale, left=it.x+it.w-grip/2, top=it.y+it.h-grip/2;
 pctx.setLineDash([]);pctx.fillStyle='white';
 pctx.fillRect(left,top,grip,grip);pctx.strokeRect(left,top,grip,grip);`);
replace("const m=mediaHit(p);", `const selected=current().media?.find(image=>image.id===selectedMedia);
 const radius=(e.pointerType==='touch'?20:10)/scale;
 const resize=selected && Math.abs(p.x-selected.x-selected.w)<=radius && Math.abs(p.y-selected.y-selected.h)<=radius;
 const m=resize?selected:mediaHit(p);`);
replace("mediaDrag={id:m.id,start:p,x:m.x,y:m.y}", "mediaDrag={id:m.id,start:p,x:m.x,y:m.y,w:m.w,h:m.h,resize}");
replace("m.x=mediaDrag.x+(p.x-mediaDrag.start.x);m.y=mediaDrag.y+(p.y-mediaDrag.start.y);", `const dx=p.x-mediaDrag.start.x,dy=p.y-mediaDrag.start.y;
 if(mediaDrag.resize){
   const {w,h}=mediaDrag;
   const factor=Math.max(12/Math.max(w,h),1+(dx*w+dy*h)/(w*w+h*h));
   m.w=w*factor;m.h=h*factor;
 }else{m.x=mediaDrag.x+dx;m.y=mediaDrag.y+dy;}`);
replace("panning=false;mediaDrag=null;if(lasso)", `panning=false;
 if(mediaDrag){const image=current().media.find(it=>it.id===mediaDrag.id);
   if(image){const {x,y,w,h}=mediaDrag;Object.assign(image,{x,y,w,h});renderMedia()}
   mediaDrag=null;
 }if(lasso)`);
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
for (const anchor of [
    'Delete “${b.title}”? This cannot be undone.',
    "Delete ${selectedBoardIds.size} selected board${selectedBoardIds.size===1?'':'s'}? This cannot be undone.",
  ]) {
    replace("hostedConfirm(`" + anchor + "`)", "hostedConfirm(`" + anchor + "`, 'Delete')");
}
const dialogs = `
function hostedDialog(message,value,kind,acceptLabel='OK'){return new Promise(resolve=>{
 const dialog=document.createElement('dialog');dialog.style.cssText='max-width:440px;border:1px solid #ddd;border-radius:14px;padding:24px;color:#222;background:white';
 const form=document.createElement('div');const label=document.createElement('label');label.textContent=message;label.style.display='block';form.append(label);
 const input=document.createElement('input');if(kind==='prompt'){input.value=value||'';input.style.cssText='display:block;width:100%;margin:16px 0';label.append(input)}
 const close=value=>{if(dialog.open)dialog.close(value)};
 if(kind!=='alert'){const cancel=document.createElement('button');cancel.textContent='Cancel';cancel.value='cancel';cancel.type='button';cancel.onclick=()=>close('cancel');form.append(cancel)}
 const ok=document.createElement('button');ok.textContent=acceptLabel;ok.value='ok';ok.type='button';ok.onclick=()=>close('ok');input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();close('ok')}});form.append(ok);dialog.append(form);document.body.append(dialog);
 dialog.addEventListener('close',()=>{const accepted=dialog.returnValue==='ok';dialog.remove();resolve(kind==='prompt'?(accepted?input.value:null):accepted)},{once:true});
 dialog.showModal();if(kind==='prompt')input.focus();else if(acceptLabel==='Delete')form.querySelector('button').focus();else ok.focus();
})}
const hostedConfirm=(message,acceptLabel)=>hostedDialog(message,'','confirm',acceptLabel);
const hostedPrompt=(message,value)=>hostedDialog(message,value,'prompt');
const hostedAlert=message=>hostedDialog(message,'','alert');
function improveHostedAccessibility(bridge){
 document.querySelectorAll('button[title]').forEach(button=>{if(!button.getAttribute('aria-label'))button.setAttribute('aria-label',button.title)});
 const rail=document.querySelector('.toolrail');if(rail){rail.setAttribute('role','toolbar');rail.setAttribute('aria-label','Canvas tools');(${installPaletteLayout.toString()})(rail)}
 const canvas=document.getElementById('boardWrap');if(canvas){canvas.setAttribute('role','region');canvas.setAttribute('aria-label','Canvas workspace');canvas.tabIndex=0}
 document.querySelectorAll('.modalShade').forEach((shade,index)=>{const heading=shade.querySelector('h2');shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');shade.setAttribute('aria-hidden',shade.classList.contains('show')?'false':'true');if(heading){if(!heading.id)heading.id='hosted-dialog-title-'+index;shade.setAttribute('aria-labelledby',heading.id)}const modal=shade.querySelector('.modal');if(modal)modal.tabIndex=-1});
 let lastDialogTrigger=null;
 const baseToggleModal=bridge.toggleModal;
 const hostedToggleModal=function(id,on=true){const shade=document.getElementById(id);if(!shade)return;if(id==='backgroundModal'&&!on)document.getElementById('boardWrap').style.setProperty('--board-bg',bridge.current().background||'#ffffff');if(on)lastDialogTrigger=document.activeElement;baseToggleModal(id,on);shade.setAttribute('aria-hidden',on?'false':'true');if(on){queueMicrotask(()=>{const target=shade.querySelector('input:not([type="hidden"]),textarea,button,[tabindex]:not([tabindex="-1"])')||shade.querySelector('.modal');target?.focus()})}else if(lastDialogTrigger?.isConnected){lastDialogTrigger.focus()}};
 function activeHostedDialog(){return Array.from(document.querySelectorAll('.modalShade.show')).at(-1)}
 document.addEventListener('keydown',event=>{if(document.querySelector('dialog[open]'))return;const modal=activeHostedDialog();if(event.key==='Escape'&&modal){event.preventDefault();event.stopImmediatePropagation();hostedToggleModal(modal.id,false);return}if(event.key!=='Tab'||!modal)return;const focusable=Array.from(modal.querySelectorAll('button:not([disabled]),input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(node=>node.getClientRects().length);if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}},true);
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
 const dialog=document.createElement('dialog'),form=document.createElement('div');
 const label=document.createElement('label'),input=document.createElement('input');
 label.textContent='YouTube or Vimeo video URL ';input.type='url';input.required=true;label.append(input);
 const add=document.createElement('button'),cancel=document.createElement('button');
 add.textContent='Add to board';cancel.textContent='Cancel';cancel.type='button';
 form.append(label,add,cancel);dialog.append(form);dialog.setAttribute('aria-label','Add video link');document.body.append(dialog);
 cancel.onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();input.oninput=()=>input.setCustomValidity('');
 input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();add.click()}};
 add.onclick=()=>{if(!input.reportValidity())return;const source=parseVideoSource(input.value);
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
// Keep the original controls and event targets while replacing their artwork.
const toolArtwork = [
  ["select", "Select", "M5 3l14 9-7 1-3 7z"],
  ["pen", "Pen", "M4 20l2-7L16 3l5 5-10 10z M6 13l5 5 M14 5l5 5"],
  ["highlighter", "Highlight", "M5 15l8-11 6 4-8 11z M5 15l-2 4 5 1 M13 21h8"],
  ["eraser", "Erase", "M3 14l10-11 8 7-10 11H9z M8 9l8 7 M11 21h10"],
  ["line", "Line", "M6 17L18 7 M3 17h4v4H3z M17 3h4v4h-4z"],
  ["shapesBtn", "Shapes", "M3 5h11v11H3z M14 11a5 5 0 1 1-5 5"],
  ["frame", "Frame", "M3 9V4h5 M16 4h5v5 M21 15v5h-5 M8 20H3v-5 M7 8h10v8H7z"],
  ["text", "Text", "M3 19L9 4l6 15 M5 14h8 M16 10h6 M19 10v9"],
  ["sticky", "Note", "M4 3h16v11l-6 7H4z M14 21v-7h6 M8 8h8 M8 11h5"],
  ["stamp", "Marker", "M5 15h14l2 4H3z M9 15v-3c0-2-2-3-2-5a5 5 0 0 1 10 0c0 2-2 3-2 5v3 M5 22h14"],
  ["action", "Action", "M5 21V3 M5 4h14l-3 4 3 4H5 M12 18l3 3 6-7"],
  ["checklist", "Checklist", "M3 6l2 2 4-5 M12 6h9 M3 15l2 2 4-5 M12 15h9"],
  ["vote", "Vote", "M4 14h3l2 3h6l2-3h3l1 7H3z M8 8l5-6 6 5-5 6z"],
  ["pan", "Pan", "M12 2v20 M2 12h20 M8 6l4-4 4 4 M8 18l4 4 4-4 M6 8l-4 4 4 4 M18 8l4 4-4 4"],
];
for (const [tool, label, path] of toolArtwork) {
  const attribute = tool === "shapesBtn" ? 'id="shapesBtn"' : 'data-tool="' + tool + '"';
  const original = new RegExp('(<button [^>]*' + attribute + '[^>]*>)<svg[^>]*>[\\s\\S]*?</svg>');
  replaceDocument(original, '$1<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="' + path + '"/></svg><span class="toolLabel">' + label + '</span>');
}
replaceDocument('<div class="properties">', '<div class="properties" role="group" aria-label="Drawing controls">');
replaceDocument('id="customColor" type', 'id="customColor" aria-label="Choose custom ink color" title="Custom ink color" type');
replaceDocument('id="size" type', 'id="size" aria-label="Stroke width" type');
replaceDocument('<b id="sizeLabel">4</b>', '<b id="sizeLabel">4</b><svg class="strokeSample" viewBox="0 0 48 36" aria-hidden="true"><path d="M11 23Q23 9 37 15" fill="none" stroke="currentColor" stroke-linecap="round"/></svg>');
replaceDocument(/(<button class="penPreset"[^>]*>)<svg[^]*?<\/svg>/g,
  '$1<svg class="penBody" viewBox="0 0 22 44" fill="none" aria-hidden="true"><path d="M5 42V17L8 9h6l3 8v25z" fill="currentColor"/><path d="M8 9l3-8 3 8z" fill="#27243a"/><path d="M7 18h8M7 21h8" stroke="white" opacity=".72"/><path d="M8 25v13" stroke="white" opacity=".32" stroke-linecap="round"/></svg>');
const syncPreset = `const pressed=tool==='pen' && p.dataset.pen.toLowerCase()===color.toLowerCase();
  p.classList.toggle('active',pressed);p.setAttribute('aria-pressed',String(pressed));`;
replace("p=>p.classList.toggle('active',t==='pen'&&p.dataset.pen.toLowerCase()===color.toLowerCase())", "p=>{" + syncPreset + "}");
replace("function renderPalette(){paletteEl.innerHTML='';", `function renderPalette(){
 document.querySelectorAll('.penPreset').forEach(p=>{${syncPreset}});
 document.querySelector('.strokeSample').style.color=color;
 paletteEl.innerHTML='';`);
replace("x.style.background=c;x.onclick", "x.style.background=c;x.setAttribute('aria-label','Ink '+c);x.title='Ink '+c;x.setAttribute('aria-pressed',String(x.classList.contains('active')));x.onclick");
replace("renderPalette()};paletteEl.appendChild(x)", "renderPalette();Array.from(paletteEl.children).find(button=>button.getAttribute('aria-pressed')==='true')?.focus({preventScroll:true})};paletteEl.appendChild(x)");
replace("sizeInput.oninput=()=>sizeLabel.textContent=sizeInput.value;", `sizeInput.oninput=()=>{
 sizeLabel.textContent=sizeInput.value;
 document.querySelector('.strokeSample path').setAttribute('stroke-width',sizeInput.value);
};sizeInput.oninput();`);
replaceDocument('Tip: paste images or text with Ctrl/Cmd + V, then draw over images', 'Paste text or images <kbd>Ctrl / ⌘ + V</kbd>');
replaceDocument('<span>Stroke</span>', '<label for="size">Stroke</label>');
replaceDocument('<div class="zoom">', '<div class="zoom" role="group" aria-label="Canvas view">');
for (const [id, label] of [["zoomOut", "Zoom out"], ["zoomIn", "Zoom in"], ["resetView", "Reset view"]]) {
  replaceDocument('<button id="' + id + '"', '<button aria-label="' + label + '" id="' + id + '"');
}
replaceDocument("Select one or many boards for bulk actions, or manage a single board inline.", "Select boards to duplicate or delete them together.");
replaceDocument('id="bulkBoardCount" style="font-size:10px;color:#7b8390"', 'id="bulkBoardCount" role="status"');
replace("function updateBulkBoardUI(){", `function updateBulkBoardUI(){
 for(const id of ['bulkDuplicateBoards','bulkDeleteBoards'])document.getElementById(id).disabled=selectedBoardIds.size===0;`);
replace("row.querySelector('.manageName').textContent=b.title;", `$&
 row.querySelector('.manageCheck').setAttribute('aria-label','Select '+b.title);
 row.querySelector('.manageName').title=b.title;`);
replaceDocument("White is the classic default, but the workspace can adapt to workshops, presentations and low-light sessions.", "Choose a colour for this board.");
replaceDocument('<input id="canvasCustomColor"', '<label for="canvasCustomColor">Custom colour</label><input id="canvasCustomColor"');
replaceDocument('<span class="modalSubtle">Live preview · White remains one click away.</span>', '');
replaceDocument('<button id="applyCanvasCustom" class="btn">Apply custom color</button>', '<button id="applyCanvasCustom" class="btn">Apply</button>');
replace("customBg.onchange=()=>setCanvasBackground(customBg.value);", "customBg.onchange=customBg.oninput;");
replace("b=>b.classList.toggle('active',(current()?.background||'#ffffff').toLowerCase()===b.dataset.bg.toLowerCase())", `b=>{
 const chosen=(current()?.background||'#ffffff').toLowerCase()===b.dataset.bg.toLowerCase();
 b.classList.toggle('active',chosen);b.setAttribute('aria-pressed',String(chosen))
}`);
replace("document.getElementById('customBgPreview').style.background=c.value;", "document.getElementById('customBgPreview').textContent=c.value.toUpperCase();");
replace("document.getElementById('customBgPreview').style.background=customBg.value", "document.getElementById('customBgPreview').textContent=customBg.value.toUpperCase()");
replace("document.getElementById('customBgPreview').style.background=bg;", "customBg.value=bg;document.getElementById('customBgPreview').textContent=bg.toUpperCase();");
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
