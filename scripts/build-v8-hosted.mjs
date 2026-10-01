import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const source = (await readFile(new URL("index.html", root), "utf8")).replaceAll(
  "\n",
  "\n",
);
const match = source.match(/<script>([\s\S]*?)<\/script>/);
if (!match || source.match(/<script>/g).length !== 1)
  throw new Error("Expected one original v8 script");
let script = match[1];
function replace(pattern, replacement) {
  const next = script.replace(pattern, replacement);
  if (next === script) throw new Error(`v8 bridge anchor missing: ${pattern}`);
  script = next;
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
 if(kind!=='alert'){const cancel=document.createElement('button');cancel.textContent='Cancel';cancel.value='cancel';cancel.type='submit';form.append(cancel)}
 const ok=document.createElement('button');ok.textContent='OK';ok.value='ok';ok.type='submit';form.append(ok);dialog.append(form);document.body.append(dialog);
 dialog.addEventListener('close',()=>{const accepted=dialog.returnValue==='ok';dialog.remove();resolve(kind==='prompt'?(accepted?input.value:null):accepted)},{once:true});
 dialog.showModal();if(kind==='prompt')input.focus();else ok.focus();
})}
const hostedConfirm=message=>hostedDialog(message,'','confirm');
const hostedPrompt=(message,value)=>hostedDialog(message,value,'prompt');
const hostedAlert=message=>hostedDialog(message,'','alert');
`;
script = dialogs + script;
script = `let initialized=false;\nwindow.addEventListener('message',event=>{\nif(event.source!==parent||event.data?.type!=='huddle:init'||initialized)return;\ninitialized=true;const initialWorkspace=event.data.workspace;\n${script}\n});\nparent.postMessage({type:'huddle:ready'},'*');\n`;
await writeFile(new URL("assets/v8-hosted.js", root), script);
await writeFile(
  new URL("assets/v8-hosted.html", root),
  source.replace(match[0], '<script src="/v8-hosted.js"></script>'),
);
console.log(
  `Generated hosted v8 assets in ${fileURLToPath(new URL("assets/", root))}`,
);
