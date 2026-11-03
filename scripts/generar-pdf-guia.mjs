import { readFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_DIR = "docs/capturas-guia";

async function toBase64(filename) {
  const file = await readFile(path.join(BASE_DIR, filename));
  return `data:image/png;base64,${file.toString("base64")}`;
}

const imgBandeja = await toBase64("01_bandeja.png");
const imgEmbudo = await toBase64("02_embudo.png");
const imgCupos = await toBase64("03_cupos.png");
const imgCampanas = await toBase64("04_campanas.png");
const imgRespuestas = await toBase64("05_respuestas_rapidas.png");
const imgAgente = await toBase64("06_agente_ia.png");

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Guía de Usuario - Monterrial CRM</title>
  <style>
    @page {
      size: A4;
      margin: 12mm 15mm 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      font-size: 11pt;
      line-height: 1.5;
    }
    .page {
      page-break-after: always;
      position: relative;
      height: 100%;
      min-height: 250mm;
      padding-bottom: 20px;
    }
    .page:last-child {
      page-break-after: avoid;
    }
    /* Portada */
    .cover {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      min-height: 260mm;
      padding: 40px 20px;
      background: linear-gradient(135deg, #090d16 0%, #1e1b4b 50%, #0f172a 100%);
      color: #ffffff;
      border-radius: 16px;
    }
    .cover-badge {
      display: inline-block;
      padding: 6px 16px;
      background: rgba(13, 91, 255, 0.25);
      border: 1px solid rgba(13, 91, 255, 0.6);
      color: #60a5fa;
      font-weight: 700;
      font-size: 10pt;
      text-transform: uppercase;
      letter-spacing: 2px;
      border-radius: 20px;
      margin-bottom: 24px;
    }
    .cover-title {
      font-size: 32pt;
      font-weight: 900;
      line-height: 1.15;
      margin-bottom: 16px;
      color: #ffffff;
      letter-spacing: -1px;
    }
    .cover-title span {
      background: linear-gradient(90deg, #38bdf8, #818cf8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .cover-subtitle {
      font-size: 14pt;
      color: #cbd5e1;
      max-width: 520px;
      line-height: 1.4;
      margin-bottom: 40px;
    }
    .cover-footer {
      margin-top: auto;
      font-size: 9.5pt;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      width: 100%;
      max-width: 520px;
      border-top: 1px solid rgba(255,255,255,0.1);
      padding-top: 16px;
    }
    /* Estructura de Páginas de Módulos */
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 10px;
      border-bottom: 2px solid #f1f5f9;
      margin-bottom: 18px;
    }
    .header-tag {
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #0284c7;
      background: #e0f2fe;
      padding: 3px 10px;
      border-radius: 12px;
    }
    .header-doc {
      font-size: 9pt;
      color: #94a3b8;
      font-weight: 500;
    }
    .section-title {
      font-size: 18pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      margin-bottom: 6px;
    }
    .section-desc {
      font-size: 10pt;
      color: #475569;
      margin-bottom: 16px;
      line-height: 1.4;
    }
    /* Contenedor de Capturas */
    .screenshot-container {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px -2px rgba(0,0,0,0.06);
      margin-bottom: 16px;
      display: flex;
      justify-content: center;
      align-items: center;
      max-height: 140mm;
    }
    .screenshot-img {
      width: 100%;
      height: auto;
      display: block;
      object-fit: contain;
    }
    /* Parrilla de Puntos Clave */
    .features-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 14px;
    }
    .feature-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #0d5bff;
      border-radius: 8px;
      padding: 10px 14px;
    }
    .feature-card.green {
      border-left-color: #10b981;
    }
    .feature-card.blue {
      border-left-color: #0284c7;
    }
    .feature-title {
      font-size: 9.5pt;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 3px;
    }
    .feature-desc {
      font-size: 8.5pt;
      color: #64748b;
      line-height: 1.35;
    }
    .tip-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 8.5pt;
      color: #1e40af;
      display: flex;
      gap: 8px;
      align-items: flex-start;
      margin-top: auto;
    }
    .footer-page {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 6px;
    }
  </style>
</head>
<body>

  <!-- PORTADA -->
  <div class="page cover">
    <div class="cover-badge">Guía Oficial de Usuario</div>
    <h1 class="cover-title">Monterrial CRM<br><span>WhatsApp & Ventas</span></h1>
    <p class="cover-subtitle">Manual práctico ilustrado paso a paso para el equipo comercial y atención al cliente.</p>
    <div style="background: rgba(255,255,255,0.06); padding: 18px 24px; border-radius: 10px; max-width: 480px; text-align: left; margin-bottom: 20px; font-size: 9pt; color: #e2e8f0; line-height: 1.6;">
      ✓ Bandeja multicanal con respuestas rápidas y archivos adjuntos.<br>
      ✓ Embudo de ventas visual (Kanban) con atajos directos a WhatsApp.<br>
      ✓ Catálogo de cupos y horarios en tiempo real.<br>
      ✓ Campañas masivas oficiales de WhatsApp sin riesgo de baneo.<br>
      ✓ Agente de Inteligencia Artificial que atiende 24/7.
    </div>
    <div class="cover-footer">
      <span>Monterrial CRM &copy; 2026</span>
      <span>Versión 2.5 Comercial</span>
    </div>
  </div>

  <!-- PÁGINA 1: BANDEJA DE ENTRADA -->
  <div class="page">
    <div class="header-bar">
      <span class="header-tag">Módulo 1 · Atención en Vivo</span>
      <span class="header-doc">Monterrial CRM — Manual de Usuario</span>
    </div>
    <h2 class="section-title">Bandeja de Entrada y Respuestas Rápidas</h2>
    <p class="section-desc">El centro neurálgico donde los asesores atienden todas las conversaciones en tiempo real, usan respuestas frecuentes y activan al asistente inteligente.</p>

    <div class="screenshot-container">
      <img src="${imgBandeja}" class="screenshot-img" alt="Bandeja de Entrada">
    </div>

    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-title">⚡ Chips de Respuestas a un Clic</div>
        <div class="feature-desc">Encima del cuadro de texto tienes atajos automáticos (<code>/inscripcion</code>, <code>/cupos</code>). Al hacer clic se redacta el mensaje de inmediato con el nombre del cliente.</div>
      </div>
      <div class="feature-card green">
        <div class="feature-title">🤖 Interruptor de IA en Vivo</div>
        <div class="feature-desc">En la cabecera superior derecha puedes activar o apagar el bot por conversación cuando un vendedor humano quiera tomar el control exclusivo.</div>
      </div>
      <div class="feature-card blue">
        <div class="feature-title">🔒 Notas Internas Seguras</div>
        <div class="feature-desc">Usa la pestaña «Nota interna» para apuntar datos privados del cliente (ej. <i>«Llamar hoy a las 5pm»</i>). Tus compañeros las ven, pero el cliente jamás.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">📎 Botón de Rayo ⚡ y Adjuntos</div>
        <div class="feature-desc">Toca el icono de rayo para buscar en todo tu catálogo de respuestas o adjunta imágenes, audios y PDFs directamente.</div>
      </div>
    </div>

    <div class="tip-box">
      <span>💡</span>
      <span><strong>Consejo Comercial:</strong> Usar las respuestas rápidas ahorra más de 2 horas al día a cada asesor y garantiza que nunca se envíen números de cuenta o precios con errores.</span>
    </div>

    <div class="footer-page">
      <span>Monterrial CRM</span>
      <span>Página 2</span>
    </div>
  </div>

  <!-- PÁGINA 2: EMBUDO DE VENTAS -->
  <div class="page">
    <div class="header-bar">
      <span class="header-tag">Módulo 2 · Gestión Comercial</span>
      <span class="header-doc">Monterrial CRM — Manual de Usuario</span>
    </div>
    <h2 class="section-title">Embudo de Ventas (Pipeline Kanban)</h2>
    <p class="section-desc">Tu tablero visual para no perder ningún prospecto. Organiza cada contacto según la fase en la que se encuentra y mide el valor de tu cartera.</p>

    <div class="screenshot-container">
      <img src="${imgEmbudo}" class="screenshot-img" alt="Embudo de Ventas">
    </div>

    <div class="features-grid">
      <div class="feature-card green">
        <div class="feature-title">🟢 Botón Directo WhatsApp (WA)</div>
        <div class="feature-desc">Cada tarjeta tiene un botón verde <strong>WA</strong>. Con un solo clic abres WhatsApp Web directo con ese cliente sin tener que guardar su número en tu celular.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">🔍 Buscador Instantáneo</div>
        <div class="feature-desc">Escribe el nombre o teléfono arriba y el tablero filtrará al instante entre todas las columnas para que encuentres al alumno en un segundo.</div>
      </div>
      <div class="feature-card blue">
        <div class="feature-title">✋ Arrastre Fluido (Drag & Drop)</div>
        <div class="feature-desc">Mueve los prospectos con el mouse o en tu tablet entre etapas (<i>Nuevo ➔ Cupos ➔ Link Enviado ➔ Inscrito</i>) para actualizar el estado del trato.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">💰 Montos y Métricas de Dinero</div>
        <div class="feature-desc">Arriba verás la suma total de soles o dólares en negociación. En cada tarjeta puedes registrar el valor del plan para proyectar tus ingresos.</div>
      </div>
    </div>

    <div class="tip-box">
      <span>🎯</span>
      <span><strong>Mejor Práctica:</strong> Al terminar cada llamada o chat, mueve la tarjeta a la columna correcta. Así el administrador siempre tiene la foto real de las ventas del día.</span>
    </div>

    <div class="footer-page">
      <span>Monterrial CRM</span>
      <span>Página 3</span>
    </div>
  </div>

  <!-- PÁGINA 3: CUPOS Y HORARIOS -->
  <div class="page">
    <div class="header-bar">
      <span class="header-tag">Módulo 3 · Consulta en Vivo</span>
      <span class="header-doc">Monterrial CRM — Manual de Usuario</span>
    </div>
    <h2 class="section-title">Cupos y Horarios en Tiempo Real</h2>
    <p class="section-desc">Permite a los asesores consultar vacantes y horarios disponibles en vivo sin tener que abrir otras pestañas, hojas de Excel o consultar al coordinador.</p>

    <div class="screenshot-container">
      <img src="${imgCupos}" class="screenshot-img" alt="Cupos y Horarios">
    </div>

    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-title">📋 Filtros por Disciplina y Edad</div>
        <div class="feature-desc">Selecciona con un clic entre Fútbol, Baby Fútbol, Vóley o Mamas Fit para ver al instante las categorías correspondientes al año de nacimiento del alumno.</div>
      </div>
      <div class="feature-card green">
        <div class="feature-title">📊 Barras de Vacantes Libres</div>
        <div class="feature-desc">Indicadores visuales en verde que te dicen cuántos cupos quedan disponibles (ej. 11/20) y cuántas clases están totalmente llenas.</div>
      </div>
      <div class="feature-card blue">
        <div class="feature-title">📄 Botón «Copiar» a un Clic</div>
        <div class="feature-desc">Cada tarjeta de horario incluye un botón «Copiar». Al presionarlo, copia el texto formateado para pegarlo de inmediato en el chat de WhatsApp del papá.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">🔄 Sincronización Automática</div>
        <div class="feature-desc">Conectado a la API oficial de la academia para que las vacantes se mantengan actualizadas en todo momento sin esfuerzo manual.</div>
      </div>
    </div>

    <div class="tip-box">
      <span>⚡</span>
      <span><strong>Rapidez de Atención:</strong> Responder al cliente en menos de 2 minutos sobre vacantes disponibles multiplica por 3 la probabilidad de que asista a la clase o concrete la matrícula.</span>
    </div>

    <div class="footer-page">
      <span>Monterrial CRM</span>
      <span>Página 4</span>
    </div>
  </div>

  <!-- PÁGINA 4: CAMPAÑAS MASIVAS -->
  <div class="page">
    <div class="header-bar">
      <span class="header-tag">Módulo 4 · Marketing y Difusión</span>
      <span class="header-doc">Monterrial CRM — Manual de Usuario</span>
    </div>
    <h2 class="section-title">Campañas Masivas por WhatsApp</h2>
    <p class="section-desc">Comunícate con decenas o cientos de contactos en minutos para promocionar nuevos ciclos, enviar recordatorios de pago o anunciar eventos importantes.</p>

    <div class="screenshot-container">
      <img src="${imgCampanas}" class="screenshot-img" alt="Campañas Masivas">
    </div>

    <div class="features-grid">
      <div class="feature-card green">
        <div class="feature-title">🛡️ 100% Seguro Sin Baneo</div>
        <div class="feature-desc">Los mensajes se despachan mediante la API Oficial de WhatsApp y Zernio, protegiendo tu número contra bloqueos o suspensiones de Meta.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">🎯 Segmentación de Audiencias</div>
        <div class="feature-desc">Elige enviar solo a prospectos en el embudo, a alumnos matriculados, a listas específicas o a toda la base de contactos.</div>
      </div>
      <div class="feature-card blue">
        <div class="feature-title">📱 Mockup Realista de WhatsApp</div>
        <div class="feature-desc">El creador de campañas te muestra un teléfono en tiempo real para que veas con tus propios ojos cómo le llegará el mensaje al cliente antes de enviarlo.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">📊 Estadísticas de Entrega</div>
        <div class="feature-desc">Conoce el progreso del envío, cuántos mensajes fueron entregados con éxito y cuáles fallaron para dar seguimiento oportuno.</div>
      </div>
    </div>

    <div class="footer-page">
      <span>Monterrial CRM</span>
      <span>Página 5</span>
    </div>
  </div>

  <!-- PÁGINA 5: RESPUESTAS RÁPIDAS CON ADJUNTOS -->
  <div class="page">
    <div class="header-bar">
      <span class="header-tag">Módulo 5 · Automatización y Productividad</span>
      <span class="header-doc">Monterrial CRM — Manual de Usuario</span>
    </div>
    <h2 class="section-title">Respuestas Rápidas con Fotos y PDFs</h2>
    <p class="section-desc">Configura los mensajes que se envían repetitivamente e incluye fotos, brochures y documentos para que tu equipo los comparta en un abrir y cerrar de ojos.</p>

    <div class="screenshot-container">
      <img src="${imgRespuestas}" class="screenshot-img" alt="Respuestas Rápidas">
    </div>

    <div class="features-grid">
      <div class="feature-card green">
        <div class="feature-title">📎 Adjuntar Documentos y Flyers</div>
        <div class="feature-desc">Ahora puedes subir un archivo (PDF del brochure, imagen de horarios, volante de precios). Al usar el atajo en el chat, <strong>el archivo se adjunta solo</strong> listo para mandar.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">🏷️ Atajos Fáciles de Recordar</div>
        <div class="feature-desc">Crea atajos claros como <code>/sedes</code>, <code>/cupos</code>, <code>/requisitos</code> o <code>/inscripcion</code> para que todo el equipo hable el mismo idioma.</div>
      </div>
      <div class="feature-card blue">
        <div class="feature-title">👤 Variable Automática {nombre}</div>
        <div class="feature-desc">Escribe <code>{nombre}</code> en el texto y el CRM lo sustituirá automáticamente por el nombre de pila de la persona con la que estás hablando.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">✏️ Edición en Cualquier Momento</div>
        <div class="feature-desc">Modifica precios, cuentas bancarias o flyers cuando cambie la temporada sin alterar el trabajo de los asesores.</div>
      </div>
    </div>

    <div class="footer-page">
      <span>Monterrial CRM</span>
      <span>Página 6</span>
    </div>
  </div>

  <!-- PÁGINA 6: INTELIGENCIA ARTIFICIAL Y CIERRE -->
  <div class="page">
    <div class="header-bar">
      <span class="header-tag">Módulo 6 · Inteligencia Artificial 24/7</span>
      <span class="header-doc">Monterrial CRM — Manual de Usuario</span>
    </div>
    <h2 class="section-title">Agente IA y Atención Ininterrumpida</h2>
    <p class="section-desc">Tu asistente virtual atiende al instante, resuelve preguntas sobre precios y ubicación, y guía a los clientes mientras el equipo comercial descansa.</p>

    <div class="screenshot-container">
      <img src="${imgAgente}" class="screenshot-img" alt="Agente de IA">
    </div>

    <div class="features-grid">
      <div class="feature-card green">
        <div class="feature-title">🧠 Base de Conocimiento Propia</div>
        <div class="feature-desc">En los ajustes de IA se cargan las respuestas a las dudas comunes: formas de pago, ubicaciones de canchas, requisitos y edades. El agente nunca inventa datos fuera de su base.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">🔬 Laboratorio de Entrenamiento</div>
        <div class="feature-desc">Antes de que hable con personas reales, puedes chatear con el bot en el simulador de Laboratorio para probar su comportamiento y afinar sus respuestas.</div>
      </div>
      <div class="feature-card blue">
        <div class="feature-title">📋 Listas Desplegables en WhatsApp</div>
        <div class="feature-desc">El agente puede desplegar menús interactivos nativos de WhatsApp para que el usuario elija su disciplina o sede con solo tocar una opción en su pantalla.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">🤝 Traspaso Suave a Asesores</div>
        <div class="feature-desc">Cuando el cliente pide hablar con una persona o desea cerrar la matrícula, la IA notifica al equipo para que un vendedor tome la conversación.</div>
      </div>
    </div>

    <div class="tip-box" style="margin-top: 14px; background: #ecfdf5; border-color: #a7f3d0; color: #065f46;">
      <span>🏆</span>
      <span><strong>¡Tu negocio está listo para despegar!</strong> Con Monterrial CRM no se pierde ningún prospecto, tus tiempos de respuesta son inmediatos y tienes el control total de tus ventas por WhatsApp.</span>
    </div>

    <div class="footer-page">
      <span>Monterrial CRM</span>
      <span>Página 7</span>
    </div>
  </div>

</body>
</html>`;

const browser = await chromium.launch({
  executablePath: CHROME_PATH,
  headless: true,
});

const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
await page.waitForTimeout(1000);

const pdfPath = "docs/Guia_Usuario_Monterrial_CRM.pdf";
await page.pdf({
  path: pdfPath,
  format: "A4",
  printBackground: true,
  margin: {
    top: "10mm",
    bottom: "10mm",
    left: "12mm",
    right: "12mm",
  },
});

console.log(`✓ PDF generado exitosamente en: ${pdfPath}`);
const desktopPath = "C:\\Users\\Cris\\Desktop\\Guia_Usuario_Monterrial_CRM.pdf";
await copyFile(pdfPath, desktopPath);
console.log(`✓ PDF copiado exitosamente al Escritorio: ${desktopPath}`);

await browser.close();
