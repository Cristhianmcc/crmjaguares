// Regenera el video completo: narración -> grabación -> mezcla de voz (MP4 + WebM).
//   node video-tutorial/generar-todo.mjs [eleven|Laura|Helena|Pablo]
import { execFileSync } from "node:child_process";

const voz = process.argv[2] ?? "eleven";
const run = (script, ...args) => execFileSync(process.execPath, [`video-tutorial/${script}`, ...args], { stdio: "inherit" });
const t0 = Date.now();
console.log(`== 1/3 Narración (${voz})`); run("narrar.mjs", voz);
console.log("== 2/3 Grabando el video (cuadro a cuadro)"); run("grabar-video.mjs");
console.log("== 3/3 Uniendo la voz y generando MP4"); run("mezclar.mjs");
console.log(`Todo listo en ${Math.round((Date.now() - t0) / 60000)} min.`);
