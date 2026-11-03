import fs from "fs";
import path from "path";
import { jsPDF } from "file:///C:/Users/Cris/Desktop/jaguares-cms-dev/react/node_modules/jspdf/dist/jspdf.es.min.js";

const artifactsDir = "C:/Users/Cris/.gemini/antigravity-ide/brain/ecd6fd87-6ead-4e85-8fcd-b0b001eb84bc";
const outPath = path.resolve("./public/guia-inscripcion-jaguares.pdf");

// Helper to load base64 image
function getBase64Image(filename) {
  const fullPath = path.join(artifactsDir, filename);
  const data = fs.readFileSync(fullPath);
  return `data:image/png;base64,${data.toString("base64")}`;
}

const doc = new jsPDF({
  orientation: "portrait",
  unit: "mm",
  format: "a4",
});

const pageWidth = doc.internal.pageSize.getWidth(); // 210
const pageHeight = doc.internal.pageSize.getHeight(); // 297

function drawHeader(pageTitle) {
  // Top banner
  doc.setFillColor(18, 18, 18);
  doc.rect(0, 0, pageWidth, 24, "F");

  // Orange accent line
  doc.setFillColor(224, 56, 33);
  doc.rect(0, 24, pageWidth, 2.5, "F");

  // Brand Name
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("ESCUELA DEPORTIVA JAGUARES", 14, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(220, 220, 220);
  doc.text(pageTitle || "Guía Oficial de Inscripción Online", pageWidth - 14, 15, { align: "right" });
}

function drawFooter(pageNumber, totalPages) {
  doc.setFillColor(245, 245, 245);
  doc.rect(0, pageHeight - 12, pageWidth, 12, "F");

  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Plataforma Oficial: https://jaguarescar.com  |  WhatsApp Oficial: +51 978 381 535", 14, pageHeight - 5);
  doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - 14, pageHeight - 5, { align: "right" });
}

// ==================== PÁGINA 1: PORTADA Y PASO 1 ====================
drawHeader("Guía Oficial de Matrícula 2026");

// Header Title Banner
doc.setFont("helvetica", "bold");
doc.setFontSize(18);
doc.setTextColor(20, 20, 20);
doc.text("CÓMO INSCRIBIRSE PASO A PASO", 14, 38);

doc.setFont("helvetica", "normal");
doc.setFontSize(10.5);
doc.setTextColor(70, 70, 70);
doc.text("Sigue esta guía visual para asegurar la vacante de tu hijo(a) en 3 sencillos pasos 100% online.", 14, 45);

// Step 1 Box
doc.setFillColor(255, 248, 240);
doc.setDrawColor(224, 56, 33);
doc.roundedRect(14, 52, pageWidth - 28, 20, 3, 3, "FD");

doc.setFont("helvetica", "bold");
doc.setFontSize(11);
doc.setTextColor(224, 56, 33);
doc.text("PASO 1: Ingresa a la Plataforma Web Oficial", 20, 61);

doc.setFont("helvetica", "normal");
doc.setFontSize(9.5);
doc.setTextColor(40, 40, 40);
doc.text("Entra desde tu celular o computadora a https://jaguarescar.com y presiona el botón naranja «Inscríbete ahora».", 20, 67);

// Screenshot 1
try {
  const img1 = getBase64Image("1_inicio_web_1793666286013.png");
  doc.addImage(img1, "PNG", 14, 76, pageWidth - 28, 102, undefined, "FAST");
} catch (e) {
  console.error("Error adding img1", e);
}

// Step 2 Box (Preview)
doc.setFillColor(248, 249, 250);
doc.setDrawColor(200, 200, 200);
doc.roundedRect(14, 184, pageWidth - 28, 18, 3, 3, "FD");

doc.setFont("helvetica", "bold");
doc.setFontSize(10.5);
doc.setTextColor(20, 20, 20);
doc.text("PASO 2: Selecciona la Disciplina Deportiva", 20, 192);

doc.setFont("helvetica", "normal");
doc.setFontSize(9);
doc.setTextColor(60, 60, 60);
doc.text("Elige entre Fútbol Formativo, Vóley, Baby Fútbol o Mamas Fit según la edad del alumno.", 20, 197);

try {
  const img2 = getBase64Image("home_disciplines_1793665117934.png");
  doc.addImage(img2, "PNG", 14, 206, pageWidth - 28, 72, undefined, "FAST");
} catch (e) {
  console.error("Error adding img2", e);
}

drawFooter(1, 3);

// ==================== PÁGINA 2: PASO 3 Y PASO 4 ====================
doc.addPage();
drawHeader("Selección de Categoría y Horarios");

// Step 3 Box
doc.setFillColor(255, 248, 240);
doc.setDrawColor(224, 56, 33);
doc.roundedRect(14, 32, pageWidth - 28, 20, 3, 3, "FD");

doc.setFont("helvetica", "bold");
doc.setFontSize(11);
doc.setTextColor(224, 56, 33);
doc.text("PASO 3: Revisa las Categorías y Cupos en Tiempo Real", 20, 41);

doc.setFont("helvetica", "normal");
doc.setFontSize(9.5);
doc.setTextColor(40, 40, 40);
doc.text("Verifica los grupos correspondientes al año de nacimiento, días de entrenamiento y cupos vigentes.", 20, 47);

try {
  const img3 = getBase64Image("discipline_futbol_categories_1793665314511.png");
  doc.addImage(img3, "PNG", 14, 56, pageWidth - 28, 105, undefined, "FAST");
} catch (e) {
  console.error("Error adding img3", e);
}

// Step 4 Box
doc.setFillColor(248, 249, 250);
doc.setDrawColor(200, 200, 200);
doc.roundedRect(14, 168, pageWidth - 28, 20, 3, 3, "FD");

doc.setFont("helvetica", "bold");
doc.setFontSize(11);
doc.setTextColor(20, 20, 20);
doc.text("PASO 4: Llena los Datos del Alumno y Apoderado", 20, 177);

doc.setFont("helvetica", "normal");
doc.setFontSize(9.5);
doc.setTextColor(60, 60, 60);
doc.text("Ingresa el DNI del postulante para autocompletar o escribe sus nombres, apellidos y datos de contacto.", 20, 183);

try {
  const img4 = getBase64Image("2_datos_postulante_1793666314614.png");
  doc.addImage(img4, "PNG", 14, 192, pageWidth - 28, 86, undefined, "FAST");
} catch (e) {
  console.error("Error adding img4", e);
}

drawFooter(2, 3);

// ==================== PÁGINA 3: PASO 5 Y RECOMENDACIONES ====================
doc.addPage();
drawHeader("Confirmación y Reserva de Vacante");

// Step 5 Box
doc.setFillColor(255, 248, 240);
doc.setDrawColor(224, 56, 33);
doc.roundedRect(14, 32, pageWidth - 28, 20, 3, 3, "FD");

doc.setFont("helvetica", "bold");
doc.setFontSize(11);
doc.setTextColor(224, 56, 33);
doc.text("PASO 5: Confirmación de Matrícula y Pago Seguro", 20, 41);

doc.setFont("helvetica", "normal");
doc.setFontSize(9.5);
doc.setTextColor(40, 40, 40);
doc.text("Adjunta la foto del DNI y carnet para el seguro del alumno, acepta los términos y confirma tu inscripción.", 20, 47);

try {
  const img5 = getBase64Image("paso4_seleccion_horario_1793665792476.png");
  doc.addImage(img5, "PNG", 14, 56, pageWidth - 28, 105, undefined, "FAST");
} catch (e) {
  console.error("Error adding img5", e);
}

// Important Guidelines
doc.setFillColor(240, 244, 248);
doc.setDrawColor(33, 150, 243);
doc.roundedRect(14, 170, pageWidth - 28, 85, 3, 3, "FD");

doc.setFont("helvetica", "bold");
doc.setFontSize(11);
doc.setTextColor(13, 71, 161);
doc.text("INFORMACIÓN IMPORTANTE PARA APODERADOS", 20, 181);

doc.setFont("helvetica", "normal");
doc.setFontSize(9);
doc.setTextColor(30, 30, 30);

const bulletPoints = [
  "• Reserva Directa: Tu vacante queda reservada en el sistema en cuanto completas la inscripción.",
  "• Sin Clases de Prueba: Por metodología y aforo de cada grupo, la escuela no cuenta con clases de prueba.",
  "• Carnet y Uniforme: Al matricularte se genera la credencial digital oficial del alumno para acceso a sedes.",
  "• Medios de Pago Oficiales: Se aceptan transferencias bancarias directas, Yape y Plin autorizados.",
  "• Asistencia en Línea: Si requieres asistencia con la selección de horarios, nuestro asistente IA o un",
  "  asesor humano están disponibles en el WhatsApp oficial: +51 978 381 535."
];

let yPos = 191;
bulletPoints.forEach((line) => {
  doc.text(line, 20, yPos);
  yPos += 7.5;
});

// Final Call to Action
doc.setFillColor(224, 56, 33);
doc.roundedRect(25, 246, pageWidth - 50, 14, 3, 3, "F");

doc.setFont("helvetica", "bold");
doc.setFontSize(11);
doc.setTextColor(255, 255, 255);
doc.text("¡Comienza la inscripción oficial ahora en https://jaguarescar.com!", pageWidth / 2, 255, { align: "center" });

drawFooter(3, 3);

// Save to public folder
const pdfBytes = doc.output("arraybuffer");
fs.writeFileSync(outPath, Buffer.from(pdfBytes));
console.log(`PDF generado exitosamente en: ${outPath} (${pdfBytes.byteLength} bytes)`);
